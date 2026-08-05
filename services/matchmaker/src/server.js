import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { Matchmaker } from "./matchmaker.js";
import { ClientMessage, ServerMessage, decode, encode } from "./protocol.js";
import { pickTopic } from "./topics.js";

/**
 * Matchmaker + WebRTC signaling.
 *
 * Deliberately one stateful process holding its queues in memory. That is not
 * a shortcut — it is the reason the matching is correct. A single-threaded
 * process cannot interleave "read the queue, take two people, pair them", so
 * double-matching is impossible without a lock, a Lua script, or a transaction.
 *
 * It is also why this cannot live on Vercel: serverless functions terminate
 * with the response and cannot hold a socket.
 *
 * Scaling past one box means moving to Durable Objects or Redis, not adding a
 * second copy of this — two instances would each match from their own half of
 * the pool.
 */

const PORT = Number(process.env.PORT ?? 4100);
const SWEEP_INTERVAL_MS = 2_000;
const HEARTBEAT_INTERVAL_MS = 30_000;

const matchmaker = new Matchmaker();

/** profileId -> connection state */
const clients = new Map();
/** sessionId -> { profileIds, topicId, startedAt } */
const sessions = new Map();
/** profileId -> { proposalId, entry } so a failed proposal can be requeued. */
const pending = new Map();
/** profileId -> { partnerProfileId: lastMatchedAt } */
const recentPartners = new Map();

function send(profileId, type, payload) {
  const client = clients.get(profileId);
  if (!client || client.socket.readyState !== client.socket.OPEN) return false;
  client.socket.send(encode(type, payload));
  return true;
}

function partnerOf(profileId) {
  const client = clients.get(profileId);
  if (!client?.sessionId) return null;
  const session = sessions.get(client.sessionId);
  if (!session) return null;
  return session.profileIds.find((id) => id !== profileId) ?? null;
}

function queueEntryFor(profile, enqueuedAt) {
  return {
    profileId: profile.id,
    cohortIds: profile.cohortIds,
    band: profile.levelBand,
    ageBand: profile.ageBand,
    firstLanguage: profile.firstLanguage,
    recentPartners: Object.fromEntries(recentPartners.get(profile.id) ?? []),
    enqueuedAt,
  };
}

function announceProposal(proposal) {
  for (const participant of proposal.participants) {
    const partner = proposal.participants.find(
      (p) => p.profileId !== participant.profileId,
    );
    const partnerClient = clients.get(partner.profileId);

    pending.set(participant.profileId, { proposalId: proposal.id });

    send(participant.profileId, ServerMessage.PROPOSED, {
      proposalId: proposal.id,
      partner: {
        displayName: partnerClient?.profile.displayName ?? "Someone",
        levelBand: partner.band,
      },
      expiresAt: proposal.expiresAt,
    });
  }
}

function confirmMatch(proposal) {
  const [first, second] = proposal.participants;
  const topic = pickTopic(proposal.sessionId);

  sessions.set(proposal.sessionId, {
    profileIds: [first.profileId, second.profileId],
    topicId: topic.id,
    startedAt: Date.now(),
  });

  const now = Date.now();
  for (const [a, b] of [
    [first.profileId, second.profileId],
    [second.profileId, first.profileId],
  ]) {
    const seen = recentPartners.get(a) ?? new Map();
    seen.set(b, now);
    recentPartners.set(a, seen);

    pending.delete(a);
    const client = clients.get(a);
    if (client) client.sessionId = proposal.sessionId;
  }

  /*
   * Exactly one side makes the WebRTC offer. Deciding it here rather than
   * letting both try avoids glare — two simultaneous offers that both have to
   * be rolled back. The lower id is arbitrary but stable, which is all that
   * matters.
   */
  const offerer =
    first.profileId < second.profileId ? first.profileId : second.profileId;

  for (const participant of proposal.participants) {
    const partner = proposal.participants.find(
      (p) => p.profileId !== participant.profileId,
    );
    const partnerClient = clients.get(partner.profileId);

    send(participant.profileId, ServerMessage.MATCHED, {
      sessionId: proposal.sessionId,
      topic,
      isOfferer: participant.profileId === offerer,
      partner: {
        displayName: partnerClient?.profile.displayName ?? "Someone",
        levelBand: partner.band,
      },
    });
  }
}

function handleHello(client, message) {
  const profile = message.profile;

  const isValid =
    profile &&
    typeof profile.id === "string" &&
    typeof profile.displayName === "string" &&
    Array.isArray(profile.cohortIds) &&
    typeof profile.levelBand === "string" &&
    typeof profile.ageBand === "string";

  if (!isValid) {
    /*
     * Written straight to the socket, not through send(): the client is not in
     * the registry yet and has no profileId, so a lookup would silently drop
     * this and the browser would see a bare disconnect with no reason.
     */
    client.socket.send(encode(ServerMessage.ERROR, { reason: "bad-profile" }));
    client.socket.close();
    return;
  }

  /*
   * Demo-mode identity: the client asserts who it is.
   *
   * This MUST become a verified Supabase JWT before anything real runs on it.
   * Everything downstream — the age-band separation above all — is only as
   * trustworthy as this line, and right now it is not trustworthy at all.
   */
  client.profile = profile;
  client.profileId = profile.id;
  clients.set(profile.id, client);

  send(profile.id, ServerMessage.READY, { profileId: profile.id });
}

function handleEnqueue(client) {
  if (!client.profile) return;

  const entry = queueEntryFor(client.profile, Date.now());
  const result = matchmaker.enqueue(entry);

  if (result.status === "proposed") {
    announceProposal(result.proposal);
    return;
  }

  send(client.profileId, ServerMessage.QUEUED, {
    waitingSince: result.waitingSince ?? Date.now(),
    othersWaiting: Math.max(
      0,
      matchmaker.waitingCount(client.profile.cohortIds) - 1,
    ),
  });
}

function handleAck(client, message) {
  if (!client.profile || typeof message.proposalId !== "string") return;

  const result = matchmaker.ack(message.proposalId, client.profileId);
  if (result.status === "confirmed") confirmMatch(result.proposal);
}

function handleCancel(client) {
  if (!client.profile) return;

  const result = matchmaker.cancel(client.profileId);
  pending.delete(client.profileId);

  if (result.status === "cancelled-proposal") {
    // Whoever was left behind goes back in at their original position.
    for (const strandedId of result.strandedProfileIds) {
      pending.delete(strandedId);
      const stranded = clients.get(strandedId);
      if (!stranded?.profile) continue;

      const requeued = matchmaker.enqueue(
        queueEntryFor(stranded.profile, matchmaker.waitingSince(strandedId) ?? Date.now()),
      );
      send(strandedId, ServerMessage.REQUEUED, { reason: "partner-declined" });
      if (requeued.status === "proposed") announceProposal(requeued.proposal);
    }
  }
}

function handleSignal(client, message) {
  const partnerId = partnerOf(client.profileId);
  if (!partnerId) return;
  send(partnerId, ServerMessage.SIGNAL, { payload: message.payload });
}

function handleLeave(client) {
  const sessionId = client.sessionId;
  if (!sessionId) return;

  const partnerId = partnerOf(client.profileId);
  client.sessionId = null;

  if (partnerId) {
    const partner = clients.get(partnerId);
    if (partner) partner.sessionId = null;
    send(partnerId, ServerMessage.PEER_LEFT, { sessionId });
  }

  sessions.delete(sessionId);
}

/** Expired proposals, and anyone who has waited out the whole ladder. */
function sweep() {
  for (const abandoned of matchmaker.sweep()) {
    for (const ghostId of abandoned.ghosts) {
      pending.delete(ghostId);
      send(ghostId, ServerMessage.REQUEUED, { reason: "you-did-not-answer" });
    }

    for (const survivorId of abandoned.survivors) {
      pending.delete(survivorId);
      const survivor = clients.get(survivorId);
      if (!survivor?.profile) continue;

      // Original enqueue time, not now: being ghosted must not cost your place.
      const original =
        matchmaker.waitingSince(survivorId) ?? Date.now() - 12_000;
      const result = matchmaker.enqueue(
        queueEntryFor(survivor.profile, original),
      );

      send(survivorId, ServerMessage.REQUEUED, { reason: "partner-vanished" });
      if (result.status === "proposed") announceProposal(result.proposal);
    }
  }

  for (const profileId of matchmaker.dueForAiPartner()) {
    send(profileId, ServerMessage.AI_AVAILABLE, {});
  }
}

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        waiting: matchmaker.size,
        liveSessions: sessions.size,
        connected: clients.size,
      }),
    );
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (socket) => {
  const client = {
    socket,
    profile: null,
    profileId: null,
    sessionId: null,
    isAlive: true,
  };

  socket.on("pong", () => {
    client.isAlive = true;
  });

  socket.on("message", (raw) => {
    const message = decode(raw.toString());
    if (!message) return;

    if (message.type === ClientMessage.HELLO) return handleHello(client, message);
    if (!client.profile) return;

    switch (message.type) {
      case ClientMessage.ENQUEUE:
        return handleEnqueue(client);
      case ClientMessage.ACK:
        return handleAck(client, message);
      case ClientMessage.CANCEL:
        return handleCancel(client);
      case ClientMessage.SIGNAL:
        return handleSignal(client, message);
      case ClientMessage.LEAVE:
        return handleLeave(client);
      default:
        return;
    }
  });

  socket.on("close", () => {
    if (!client.profileId) return;
    handleLeave(client);
    matchmaker.cancel(client.profileId);
    pending.delete(client.profileId);
    clients.delete(client.profileId);
  });
});

/** Drop half-open sockets, which otherwise sit in the queue as phantom users. */
const heartbeat = setInterval(() => {
  for (const client of clients.values()) {
    if (!client.isAlive) {
      client.socket.terminate();
      continue;
    }
    client.isAlive = false;
    client.socket.ping();
  }
}, HEARTBEAT_INTERVAL_MS);

const sweeper = setInterval(sweep, SWEEP_INTERVAL_MS);

httpServer.listen(PORT, () => {
  console.log(`matchmaker listening on :${PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    clearInterval(heartbeat);
    clearInterval(sweeper);
    wss.close();
    httpServer.close(() => process.exit(0));
  });
}
