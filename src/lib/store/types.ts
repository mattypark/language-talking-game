import type { AgeBandId, LevelBandId, TargetLanguageCode } from "@/lib/domain";

export type Profile = {
  id: string;
  displayName: string;
  targetLanguage: TargetLanguageCode;
  levelBand: LevelBandId;
  firstLanguage: string;
  ageBand: AgeBandId;
  /** Cohort rings this person may be matched inside. */
  cohortIds: string[];
  /** Community rules must be accepted before a first match, not after. */
  rulesAcceptedAt: string | null;
  /**
   * Starts neutral. Falls on reports and abandonments, and a low score routes
   * someone into the shadow pool rather than triggering a ban — burner
   * accounts make bans cheap to evade, quiet self-segregation less so.
   */
  trust: number;
  createdAt: string;
};

export type Cohort = {
  id: string;
  name: string;
  inviteCode: string;
  /**
   * A cohort is single-age-band by construction. A school cohort is minors
   * only and matches only within itself.
   */
  ageBand: AgeBandId;
  createdAt: string;
};

export type SessionParticipant = {
  profileId: string;
  displayName: string;
  levelBand: LevelBandId;
  /** Set once the client has uploaded its own microphone recording. */
  audioKey: string | null;
  voicedSeconds: number;
};

export type PracticeSession = {
  id: string;
  cohortId: string;
  topicId: string;
  startedAt: string;
  endedAt: string | null;
  participants: SessionParticipant[];
  /** "ended" once both sides leave; "scored" once reports exist. */
  status: "live" | "ended" | "scored" | "abandoned";
  /**
   * When the recordings get deleted. Set once a report exists; null once the
   * purge has run.
   */
  audioExpiresAt?: string | null;
};

export type Database = {
  profiles: Record<string, Profile>;
  cohorts: Record<string, Cohort>;
  sessions: Record<string, PracticeSession>;
  /** Keyed `${sessionId}:${profileId}` — one report per person per session. */
  reports: Record<string, unknown>;
};

export const EMPTY_DATABASE: Database = {
  profiles: {},
  cohorts: {},
  sessions: {},
  reports: {},
};

export const STARTING_TRUST = 100;
