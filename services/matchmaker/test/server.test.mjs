import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import WebSocket from "ws";
import { createHmac } from "node:crypto";

/**
 * Integration test against the real process, spawned as a child.
 *
 * Two browsers, one socket each, all the way through: hello, queue, proposal,
 * both acks, match, a relayed WebRTC signal, and a hang-up the other side is
 * told about.
 */

const PORT = 4199;
const BASE = `http://127.0.0.1:${PORT}`;
const SERVER = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "server.js");

let child;

function connect() {
  const socket = new WebSocket(`ws://127.0.0.1:${PORT}`);
  const inbox = [];
  const waiters = [];

  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString());
    inbox.push(message);
    for (let i = waiters.length - 1; i >= 0; i -= 1) {
      if (waiters[i].type === message.type) {
        waiters.splice(i, 1)[0].resolve(message);
      }
    }
  });

  return {
    socket,
    open: () =>
      new Promise((resolve, reject) => {
        socket.once("open", resolve);
        socket.once("error", reject);
      }),
    send: (type, payload = {}) =>
      socket.send(JSON.stringify({ type, ...payload })),
    /** Resolve with the next (or already-received) message of this type. */
    next: (type, timeoutMs = 4000) => {
      const found = inbox.find((m) => m.type === type);
      if (found) {
        inbox.splice(inbox.indexOf(found), 1);
        return Promise.resolve(found);
      }
      return new Promise((resolve, reject) => {
        const waiter = {
          type,
          resolve: (m) => {
            clearTimeout(timer);
            resolve(m);
          },
        };

        const timer = setTimeout(() => {
          // Drop the waiter, or it stays registered and swallows the message a
          // later call is waiting for.
          const index = waiters.indexOf(waiter);
          if (index !== -1) waiters.splice(index, 1);
          reject(new Error(`timed out waiting for "${type}"`));
        }, timeoutMs);

        waiters.push(waiter);
      });
    },
    close: () => socket.close(),
  };
}

/**
 * Mints the same token the web server does.
 *
 * Deliberately reimplemented here rather than imported from src/token.js: the
 * test should fail if the verifier changes shape, and importing the module
 * under test to build its own input would hide exactly that.
 */
const SECRET = "onair-dev-insecure-do-not-ship";
const b64 = (value) => Buffer.from(value).toString("base64url");

const token = (id, overrides = {}, claimOverrides = {}) => {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: id,
    iss: "onair-web",
    aud: "onair-matchmaker",
    iat: now,
    exp: now + 900,
    onair: {
      displayName: id,
      cohortIds: ["cohort-a"],
      levelBand: "intermediate",
      ageBand: "adult",
      firstLanguage: "Spanish",
      targetLanguage: "en",
      tier: "member",
      ...overrides,
    },
    ...claimOverrides,
  };

  const body = `${b64(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64(
    JSON.stringify(payload),
  )}`;
  return `${body}.${createHmac("sha256", SECRET).update(body).digest("base64url")}`;
};

before(async () => {
  child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const deadline = Date.now() + 8000;
  for (;;) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) break;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) throw new Error("matchmaker did not start");
    await new Promise((r) => setTimeout(r, 100));
  }
});

after(() => {
  child?.kill("SIGTERM");
});

describe("matchmaker server", () => {
  it("reports health", async () => {
    const res = await fetch(`${BASE}/health`);
    const body = await res.json();
    assert.equal(body.ok, true);
  });

  it("refuses a hello with no token", async () => {
    const client = connect();
    await client.open();
    client.send("hello", { profile: { id: "nope", ageBand: "under_18" } });

    const error = await client.next("error");
    assert.equal(error.reason, "bad-token");
  });

  /*
   * The load-bearing one. A client asserting its own age band is exactly the
   * attack the token exists to stop, and a forged signature must not get past
   * the door — everything about minor/adult separation rests on this.
   */
  it("refuses a token it did not sign", async () => {
    const client = connect();
    await client.open();

    const forged = token("mallory", { ageBand: "under_18" });
    const tampered = `${forged.slice(0, -4)}AAAA`;
    client.send("hello", { token: tampered });

    const error = await client.next("error");
    assert.equal(error.reason, "bad-token");
  });

  it("refuses an expired token", async () => {
    const client = connect();
    await client.open();

    const past = Math.floor(Date.now() / 1000) - 60;
    client.send("hello", { token: token("late", {}, { exp: past }) });

    const error = await client.next("error");
    assert.equal(error.reason, "bad-token");
  });

  it("refuses a token addressed to something else", async () => {
    const client = connect();
    await client.open();
    client.send("hello", { token: token("elsewhere", {}, { aud: "not-us" }) });

    const error = await client.next("error");
    assert.equal(error.reason, "bad-token");
  });

  it("runs two people from queue to live call", async () => {
    const alice = connect();
    const bob = connect();
    await Promise.all([alice.open(), bob.open()]);

    alice.send("hello", { token: token("alice") });
    bob.send("hello", { token: token("bob", { firstLanguage: "Korean" }) });
    await Promise.all([alice.next("ready"), bob.next("ready")]);

    // First in waits.
    alice.send("enqueue");
    const queued = await alice.next("queued");
    assert.equal(queued.othersWaiting, 0);

    // Second in triggers a proposal to both.
    bob.send("enqueue");
    const [aliceProposal, bobProposal] = await Promise.all([
      alice.next("proposed"),
      bob.next("proposed"),
    ]);
    assert.equal(aliceProposal.proposalId, bobProposal.proposalId);
    assert.equal(aliceProposal.partner.displayName, "bob");
    assert.equal(bobProposal.partner.displayName, "alice");

    // One ack is not enough.
    alice.send("ack", { proposalId: aliceProposal.proposalId });
    await assert.rejects(() => alice.next("matched", 400));

    bob.send("ack", { proposalId: bobProposal.proposalId });
    const [aliceMatch, bobMatch] = await Promise.all([
      alice.next("matched"),
      bob.next("matched"),
    ]);

    assert.equal(aliceMatch.sessionId, bobMatch.sessionId);
    assert.equal(aliceMatch.topic.id, bobMatch.topic.id, "same topic both sides");
    assert.ok(aliceMatch.topic.prompt.length > 0);

    // Exactly one side makes the offer, or the negotiation glares.
    assert.equal(
      [aliceMatch.isOfferer, bobMatch.isOfferer].filter(Boolean).length,
      1,
    );

    // Signaling relays verbatim to the peer.
    alice.send("signal", { payload: { kind: "offer", sdp: "v=0-fake" } });
    const relayed = await bob.next("signal");
    assert.deepEqual(relayed.payload, { kind: "offer", sdp: "v=0-fake" });

    // Hanging up tells the other side rather than leaving them on a dead call.
    alice.send("leave");
    const left = await bob.next("peer-left");
    assert.equal(left.sessionId, aliceMatch.sessionId);

    alice.close();
    bob.close();
  });

  it("holds the call open briefly when a socket simply disappears", async () => {
    const carol = connect();
    const dave = connect();
    await Promise.all([carol.open(), dave.open()]);

    carol.send("hello", { token: token("carol") });
    dave.send("hello", { token: token("dave", { firstLanguage: "Korean" }) });
    await Promise.all([carol.next("ready"), dave.next("ready")]);

    carol.send("enqueue");
    await carol.next("queued");
    dave.send("enqueue");

    const [carolProposal, daveProposal] = await Promise.all([
      carol.next("proposed"),
      dave.next("proposed"),
    ]);
    carol.send("ack", { proposalId: carolProposal.proposalId });
    dave.send("ack", { proposalId: daveProposal.proposalId });
    await Promise.all([carol.next("matched"), dave.next("matched")]);

    // Pull the plug rather than saying goodbye.
    carol.socket.terminate();

    /*
     * A dropped socket is not a hang-up. Wifi hiccups, tabs throttle, and a
     * reconnect swaps one socket for another — in every one of those the
     * person is still there, and ending their partner's call would be both
     * wrong and unrecoverable. So nothing happens immediately...
     */
    await assert.rejects(
      () => dave.next("peer-left", 1500),
      /timed out/,
      "the partner must not be told the moment a socket drops",
    );

    // ...and the partner is only released once the reconnect window closes.
    const left = await dave.next("peer-left", 12_000);
    assert.ok(left.sessionId);
    dave.close();
  });
});
