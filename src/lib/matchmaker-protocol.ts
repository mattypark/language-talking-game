import type { AgeBandId, LevelBandId } from "@/lib/domain";

/**
 * Mirror of services/matchmaker/src/protocol.js.
 *
 * Kept as a hand-written mirror rather than generated: the service is plain
 * JavaScript with no build step, and a codegen pipeline for six message types
 * would cost more than it saves. If you change one file, change both — the
 * integration test in services/matchmaker/test/server.test.mjs is what catches
 * a drift between them.
 */

export type QueueProfile = {
  id: string;
  displayName: string;
  cohortIds: string[];
  levelBand: LevelBandId;
  ageBand: AgeBandId;
  firstLanguage: string;
};

export type Topic = {
  id: string;
  prompt: string;
  nudges: string[];
};

export type PartnerSummary = {
  displayName: string;
  levelBand: LevelBandId;
};

export type ServerEvent =
  | { type: "ready"; profileId: string }
  | { type: "queued"; waitingSince: number; othersWaiting: number }
  | {
      type: "proposed";
      proposalId: string;
      partner: PartnerSummary;
      expiresAt: number;
    }
  | {
      type: "matched";
      sessionId: string;
      topic: Topic;
      isOfferer: boolean;
      partner: PartnerSummary;
    }
  | { type: "requeued"; reason: string }
  | { type: "ai-available" }
  | { type: "signal"; payload: unknown }
  | { type: "peer-left"; sessionId: string }
  | { type: "error"; reason: string };

export type ClientEvent =
  | { type: "hello"; profile: QueueProfile }
  | { type: "enqueue" }
  | { type: "ack"; proposalId: string }
  | { type: "cancel" }
  | { type: "signal"; payload: unknown }
  | { type: "leave" };

export function isServerEvent(value: unknown): value is ServerEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}
