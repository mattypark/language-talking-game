import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import WebSocket from "ws";

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
        const timer = setTimeout(
          () => reject(new Error(`timed out waiting for "${type}"`)),
          timeoutMs,
        );
        waiters.push({
          type,
          resolve: (m) => {
            clearTimeout(timer);
            resolve(m);
          },
        });
      });
    },
    close: () => socket.close(),
  };
}

const profile = (id, overrides = {}) => ({
  id,
  displayName: id,
  cohortIds: ["cohort-a"],
  levelBand: "intermediate",
  ageBand: "adult",
  firstLanguage: "Spanish",
  ...overrides,
});

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

  it("refuses a malformed hello", async () => {
    const client = connect();
    await client.open();
    client.send("hello", { profile: { id: "nope" } });

    const error = await client.next("error");
    assert.equal(error.reason, "bad-profile");
  });

  it("runs two people from queue to live call", async () => {
    const alice = connect();
    const bob = connect();
    await Promise.all([alice.open(), bob.open()]);

    alice.send("hello", { profile: profile("alice") });
    bob.send("hello", { profile: profile("bob", { firstLanguage: "Korean" }) });
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

  it("tells the other side when a socket simply disappears", async () => {
    const carol = connect();
    const dave = connect();
    await Promise.all([carol.open(), dave.open()]);

    carol.send("hello", { profile: profile("carol") });
    dave.send("hello", { profile: profile("dave", { firstLanguage: "Korean" }) });
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

    const left = await dave.next("peer-left");
    assert.ok(left.sessionId);
    dave.close();
  });
});
