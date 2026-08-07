/**
 * The camera handshake.
 *
 * Calls always start as voice. A camera turns on only when BOTH people have
 * said yes, and either can turn it off again unilaterally at any moment,
 * without asking and without a confirmation step.
 *
 * That asymmetry is deliberate. Turning a camera on between two strangers
 * should be hard and mutual; turning it off should be instant and one-sided.
 *
 * These ride the existing signal relay rather than adding server messages —
 * the matchmaker forwards signal payloads verbatim and does not need to
 * understand them.
 */

export type VideoControl =
  | { kind: "video-request" }
  | { kind: "video-accept" }
  | { kind: "video-decline" }
  | { kind: "video-stop" }
  /** The answerer cannot re-offer, so it asks the offerer to. */
  | { kind: "video-renegotiate" };

const CONTROL_KINDS = new Set([
  "video-request",
  "video-accept",
  "video-decline",
  "video-stop",
  "video-renegotiate",
]);

export function isVideoControl(payload: unknown): payload is VideoControl {
  if (typeof payload !== "object" || payload === null) return false;
  const kind = (payload as { kind?: unknown }).kind;
  return typeof kind === "string" && CONTROL_KINDS.has(kind);
}

export type VideoState =
  /** Voice only. */
  | "off"
  /** We asked; waiting on them. */
  | "asked"
  /** They asked; waiting on us. */
  | "invited"
  /** Both agreed and cameras are negotiating or live. */
  | "on";
