/**
 * Wire protocol between the browser and the matchmaker.
 *
 * One socket carries both matchmaking and WebRTC signaling. They are the same
 * conversation — you are matched, then you negotiate — and a second connection
 * would only add another thing to fall over.
 *
 * Note what this socket does NOT carry: audio. Media goes peer to peer and
 * never touches this process.
 */

/** Browser -> server. */
export const ClientMessage = {
  /**
   * Identify. Must arrive before anything else.
   *
   * Carries `token`, not a profile. The server reads the profile out of
   * verified claims — see src/token.js.
   */
  HELLO: "hello",
  /** Join the queue. */
  ENQUEUE: "enqueue",
  /** Accept a proposed partner. Both sides must, or it expires. */
  ACK: "ack",
  /** Leave the queue, or decline a proposal. */
  CANCEL: "cancel",
  /** WebRTC offer/answer/ICE, relayed verbatim to the peer. */
  SIGNAL: "signal",
  /** Hang up. */
  LEAVE: "leave",
};

/** Server -> browser. */
export const ServerMessage = {
  READY: "ready",
  QUEUED: "queued",
  /** A partner has been found; say ack to take it. */
  PROPOSED: "proposed",
  /** Both sides said yes. Carries the topic and who makes the WebRTC offer. */
  MATCHED: "matched",
  /** The proposal expired or the other side walked. Back in the queue. */
  REQUEUED: "requeued",
  /** Waited long enough that the AI partner is worth offering. */
  AI_AVAILABLE: "ai-available",
  SIGNAL: "signal",
  PEER_LEFT: "peer-left",
  ERROR: "error",
};

export function encode(type, payload = {}) {
  return JSON.stringify({ type, ...payload });
}

export function decode(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.type !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}
