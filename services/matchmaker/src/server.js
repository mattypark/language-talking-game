import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { Matchmaker } from "./matchmaker.js";
import { ClientMessage, ServerMessage, decode, encode } from "./protocol.js";
import {
  IS_INSECURE_DEV_SECRET,
  profileFromClaims,
  verifyQueueToken,
} from "./token.js";
import { TOPICS, getTopic, pickTopic } from "./topics.js";

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

/**
 * Origins allowed to open a socket, comma separated.
 *
 * Empty means anything, which is what a laptop and the end-to-end scripts
 * need. On a deployment it is set to the app's origin — not as a security
 * boundary (a browser sends Origin, a script sends whatever it likes; the
 * signed token is the real gate) but so that someone else's page cannot quietly
 * embed this queue and spend the pool.
 */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isOriginAllowed(origin) {
  if (ALLOWED_ORIGINS.length === 0) return true;
  if (!origin) return true; // Not a browser. The token still has to verify.
  return ALLOWED_ORIGINS.includes(origin);
}

function corsOrigin(origin) {
  if (ALLOWED_ORIGINS.length === 0) return "*";
  return isOriginAllowed(origin) ? (origin ?? ALLOWED_ORIGINS[0]) : ALLOWED_ORIGINS[0];
}
const SWEEP_INTERVAL_MS = 2_000;
const HEARTBEAT_INTERVAL_MS = 10_000;

/** profileId -> connection state */
const clients = new Map();

function isConnected(profileId) {
  const client = clients.get(profileId);
  return client?.socket.readyState === client?.socket.OPEN;
}

const matchmaker = new Matchmaker({ isEligible: isConnected });
/** sessionId -> { profileIds, topicId, startedAt } */
const sessions = new Map();
/** profileId -> { proposalId, entry } so a failed proposal can be requeued. */
const pending = new Map();
/** profileId -> { partnerProfileId: lastMatchedAt } */
const recentPartners = new Map();

/**
 * Sockets that dropped while in a call, held briefly in case they come back.
 *
 * profileId -> { timer, sessionId }
 *
 * A closed socket is not the same as someone hanging up. Wifi hiccups, a
 * browser tab throttles, a reconnect swaps one socket for another — in every
 * case the person is still there, and ending their partner's call is both
 * wrong and unrecoverable. So a disconnect during a call starts a short clock
 * instead, and saying hello again inside that window puts them straight back.
 */
const reconnectGrace = new Map();

const RECONNECT_GRACE_MS = 6_000;

/**
 * Monotonic per-connection sequence.
 *
 * Two sockets from the same profile can say hello in either order — the older
 * one's hello can easily land second. Registering blindly then lets the older
 * socket own the registry, and when it closes moments later the live one is
 * evicted and its partner is told the call ended. Sequencing makes arrival
 * order irrelevant.
 */
let connectionSequence = 0;

/**
 * Set MATCHMAKER_TRACE=1 to log every message in and out.
 *
 * Worth keeping: the failure mode this service has is "two people end up in
 * different states", and that is close to impossible to reason about from
 * either browser alone.
 */
const TRACE = process.env.MATCHMAKER_TRACE === "1";

function trace(direction, profileId, type, extra = "") {
  if (!TRACE) return;
  const name = clients.get(profileId)?.profile?.displayName ?? profileId;
  console.log(`${direction} ${name} ${type} ${extra}`.trim());
}

function send(profileId, type, payload) {
  const client = clients.get(profileId);
  if (!client || client.socket.readyState !== client.socket.OPEN) return false;
  trace("->", profileId, type);
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

function queueEntryFor(profile, enqueuedAt, choice = {}) {
  return {
    profileId: profile.id,
    cohortIds: profile.cohortIds,
    band: profile.levelBand,
    ageBand: profile.ageBand,
    firstLanguage: profile.firstLanguage,
    language: choice.language ?? profile.targetLanguage ?? "en",
    topicId: choice.topicId ?? "any",
    recentPartners: Object.fromEntries(recentPartners.get(profile.id) ?? []),
    enqueuedAt,
  };
}

/** What someone last asked for, so a requeue keeps their room and language. */
const lastChoice = new Map();

function announceProposal(proposal) {
  /*
   * Belt and braces alongside the eligibility filter. If a socket dies in the
   * gap between being chosen and being told, tear the proposal down now rather
   * than making the other person wait out the full timeout.
   */
  const unreachable = proposal.participants.filter(
    (p) => !isConnected(p.profileId),
  );

  if (unreachable.length > 0) {
    matchmaker.cancel(unreachable[0].profileId);
    for (const participant of proposal.participants) {
      if (unreachable.includes(participant)) continue;
      pending.delete(participant.profileId);
      const client = clients.get(participant.profileId);
      if (!client?.profile) continue;

      const requeued = matchmaker.enqueue(
        queueEntryFor(
          client.profile,
          participant.enqueuedAt,
          lastChoice.get(participant.profileId),
        ),
      );
      if (requeued.status === "proposed") announceProposal(requeued.proposal);
    }
    return;
  }

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

  /*
   * If both asked for the same named room, they get that topic. Otherwise it
   * is drawn from the session id — still after matching, still revealed to
   * both at once, so there is nothing to prepare.
   */
  const firstChoice = lastChoice.get(first.profileId)?.topicId;
  const secondChoice = lastChoice.get(second.profileId)?.topicId;
  const agreed =
    firstChoice && firstChoice !== "any" && firstChoice === secondChoice
      ? getTopic(firstChoice)
      : null;
  const topic = agreed ?? pickTopic(proposal.sessionId);

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
  /*
   * Identity comes from a signed token, never from the socket.
   *
   * This used to accept whatever profile object the browser sent, after a
   * type check. That made every downstream guarantee decorative: a client
   * could claim `ageBand: "under_18"` plus the school cohort's id and join the
   * minors pool, and could claim someone else's id to hijack their live
   * session inside the reconnect grace window. The type check confirmed the
   * shape of a lie.
   *
   * The token is minted by the web server from a stored profile and signed.
   * Every field below is read out of verified claims.
   */
  const claims = verifyQueueToken(message.token);

  if (!claims) {
    /*
     * Written straight to the socket, not through send(): the client is not in
     * the registry yet and has no profileId, so a lookup would silently drop
     * this and the browser would see a bare disconnect with no reason.
     */
    client.socket.send(encode(ServerMessage.ERROR, { reason: "bad-token" }));
    client.socket.close();
    return;
  }

  const profile = profileFromClaims(claims);

  const existing = clients.get(profile.id);
  if (existing && existing !== client && existing.seq > client.seq) {
    // A newer connection from this profile already owns the session.
    trace("--", profile.id, "hello-from-superseded-socket-ignored");
    client.socket.close();
    return;
  }

  client.profile = profile;
  client.profileId = profile.id;
  clients.set(profile.id, client);

  /*
   * They dropped mid-call and came back inside the grace window. Put them
   * back in the session rather than making them requeue — the partner was
   * never told anything happened.
   */
  const pendingDrop = reconnectGrace.get(profile.id);
  if (pendingDrop) {
    clearTimeout(pendingDrop.timer);
    reconnectGrace.delete(profile.id);

    if (sessions.has(pendingDrop.sessionId)) {
      client.sessionId = pendingDrop.sessionId;
      trace("--", profile.id, "reconnected-into-session");
    }
  }

  send(profile.id, ServerMessage.READY, { profileId: profile.id });
}

function handleEnqueue(client, message = {}) {
  if (!client.profile) return;

  const choice = {
    language: typeof message.language === "string" ? message.language : undefined,
    topicId: typeof message.topicId === "string" ? message.topicId : undefined,
  };
  lastChoice.set(client.profileId, choice);

  const entry = queueEntryFor(client.profile, Date.now(), choice);
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
    rooms: matchmaker.roomCounts(
      client.profile.cohortIds,
      choice.language ?? client.profile.targetLanguage ?? "en",
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
        queueEntryFor(
          stranded.profile,
          matchmaker.waitingSince(strandedId) ?? Date.now(),
          lastChoice.get(strandedId),
        ),
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
    /*
     * Ghosts go back in the queue too, but at NOW rather than their original
     * time — not answering costs you your place, which is the whole penalty.
     *
     * They have to be requeued rather than dropped: otherwise their screen
     * says "in the queue" while the server has forgotten them, and they wait
     * forever on a queue they are not in.
     */
    for (const ghostId of abandoned.ghosts) {
      pending.delete(ghostId);
      send(ghostId, ServerMessage.REQUEUED, { reason: "you-did-not-answer" });

      const ghost = clients.get(ghostId);
      if (!ghost?.profile) continue;

      const result = matchmaker.enqueue(
        queueEntryFor(ghost.profile, Date.now(), lastChoice.get(ghostId)),
      );
      if (result.status === "proposed") announceProposal(result.proposal);
    }

    for (const survivorId of abandoned.survivors) {
      pending.delete(survivorId);
      const survivor = clients.get(survivorId);
      if (!survivor?.profile) continue;

      // Original enqueue time, not now: being ghosted must not cost your place.
      const original =
        matchmaker.waitingSince(survivorId) ?? Date.now() - 12_000;
      const result = matchmaker.enqueue(
        queueEntryFor(survivor.profile, original, lastChoice.get(survivorId)),
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
  const allowOrigin = corsOrigin(req.headers.origin);

  if (req.url === "/topics") {
    // One source of truth for the topic bank. The app fetches it rather than
    // keeping a second copy that drifts.
    res.writeHead(200, {
      "content-type": "application/json",
      "access-control-allow-origin": allowOrigin,
    });
    res.end(JSON.stringify({ topics: TOPICS }));
    return;
  }

  if (req.url?.startsWith("/rooms")) {
    // Live counts for the room list. Real numbers or none.
    const url = new URL(req.url, "http://localhost");
    const cohortIds = (url.searchParams.get("cohorts") ?? "")
      .split(",")
      .filter(Boolean);
    const language = url.searchParams.get("language") ?? "en";

    res.writeHead(200, {
      "content-type": "application/json",
      "access-control-allow-origin": allowOrigin,
    });
    res.end(
      JSON.stringify({
        rooms: matchmaker.roomCounts(cohortIds, language),
        waiting: matchmaker.waitingCount(cohortIds),
      }),
    );
    return;
  }

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

const wss = new WebSocketServer({
  server: httpServer,
  verifyClient: ({ origin }) => isOriginAllowed(origin),
});

wss.on("connection", (socket) => {
  connectionSequence += 1;
  const client = {
    socket,
    seq: connectionSequence,
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

    if (message.type !== ClientMessage.SIGNAL) {
      trace("<-", client.profileId, message.type);
    }

    switch (message.type) {
      case ClientMessage.ENQUEUE:
        return handleEnqueue(client, message);
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

    /*
     * Ignore a socket that has already been replaced.
     *
     * The same profile can be connected twice for a moment — a reconnect, a
     * second tab, React's development double-mount. The newer socket takes
     * over the registry entry on hello, and when the older one finally closes
     * this handler would otherwise tear down the LIVE session: it deletes the
     * registry entry and tells the partner they left. The call dies and the
     * cause looks like whatever the user happened to be doing at the time.
     */
    if (clients.get(client.profileId) !== client) {
      trace("--", client.profileId, "stale-socket-close-ignored");
      return;
    }

    const profileId = client.profileId;
    const sessionId = client.sessionId;

    matchmaker.cancel(profileId);
    pending.delete(profileId);
    clients.delete(profileId);

    // Not in a call: nothing to hold open.
    if (!sessionId) return;

    trace("--", profileId, "dropped-mid-call, waiting for reconnect");

    const timer = setTimeout(() => {
      reconnectGrace.delete(profileId);

      // Came back on a new socket in time — that socket owns the session now.
      if (clients.has(profileId)) return;

      const session = sessions.get(sessionId);
      if (!session) return;

      const partnerId = session.profileIds.find((id) => id !== profileId);
      if (partnerId) {
        const partner = clients.get(partnerId);
        if (partner) partner.sessionId = null;
        send(partnerId, ServerMessage.PEER_LEFT, { sessionId });
      }
      sessions.delete(sessionId);
    }, RECONNECT_GRACE_MS);

    reconnectGrace.set(profileId, { timer, sessionId });
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
  if (IS_INSECURE_DEV_SECRET) {
    console.warn(
      "\n  !! MATCHMAKER_JWT_SECRET is not set, so queue tokens are signed\n" +
        "  !! with the published development secret. Anyone can mint one, which\n" +
        "  !! means the minor/adult separation is NOT enforced. Set it before\n" +
        "  !! a single real person uses this.\n",
    );
  }
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    clearInterval(heartbeat);
    clearInterval(sweeper);
    wss.close();
    httpServer.close(() => process.exit(0));
  });
}
