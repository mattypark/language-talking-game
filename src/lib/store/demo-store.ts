import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  EMPTY_DATABASE,
  STARTING_TRUST,
  type Cohort,
  type Database,
  type PracticeSession,
  type Profile,
} from "./types";
import type { AgeBandId, LevelBandId, TargetLanguageCode } from "@/lib/domain";

/**
 * File-backed store for demo mode.
 *
 * The point is that the whole product runs with no keys and no Supabase
 * project: you can drive the real flow end to end on a laptop. Supabase
 * replaces this behind the same functions once credentials exist — nothing
 * above this file knows which one it is talking to.
 *
 * Deliberately not concurrency-safe beyond a single process. It is a
 * development store, and the matchmaker (the one component with real
 * concurrency) keeps its own state in memory rather than here.
 */

const DATA_FILE = join(process.cwd(), ".data", "onair.json");

let writeQueue: Promise<void> = Promise.resolve();

/**
 * Always reads from disk. Deliberately not cached in memory.
 *
 * Next runs server components and route handlers in separate module graphs, so
 * a module-level cache is not one cache — it is several, and they drift. The
 * symptom is vicious: pages resolve the signed-in user correctly while every
 * API route returns 401, because the route's copy of the database was loaded
 * before that profile existed.
 *
 * A few kilobytes of JSON per request is free, and this is a development store
 * that Supabase replaces. Correctness wins.
 */
async function load(): Promise<Database> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    return { ...EMPTY_DATABASE, ...(JSON.parse(raw) as Partial<Database>) };
  } catch (error: unknown) {
    const isMissing =
      error instanceof Error && "code" in error && error.code === "ENOENT";
    if (!isMissing) {
      throw new Error(
        `Could not read the demo store at ${DATA_FILE}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return structuredClone(EMPTY_DATABASE);
  }
}

let writeCounter = 0;

/** Serialised so two overlapping requests cannot interleave a read-modify-write. */
async function mutate<T>(change: (db: Database) => T): Promise<T> {
  const run = writeQueue.then(async () => {
    const db = await load();
    const result = change(db);
    await mkdir(dirname(DATA_FILE), { recursive: true });

    /*
     * Written to a temporary file and renamed, because writeFile truncates
     * first and every read goes straight to disk. A reader landing in that
     * window gets a partial file and "Unexpected end of JSON input" — which
     * surfaced as intermittent 500s from POST /api/sessions during a real two
     * person call, i.e. as a lost report. rename(2) is atomic within a
     * filesystem, so a reader sees either the old file or the new one.
     *
     * The suffix is per-write: two mutations are serialised by the queue, but
     * a crashed run must not leave a temp file that the next one appends to.
     */
    const temporary = `${DATA_FILE}.${process.pid}.${writeCounter++}.tmp`;
    await writeFile(temporary, JSON.stringify(db, null, 2), "utf8");
    await rename(temporary, DATA_FILE);

    return result;
  });

  // Keep the chain alive even if this caller's change throws.
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function normaliseCode(code: string): string {
  return code.trim().toUpperCase();
}

/* ------------------------------------------------------------------ profiles */

export async function getProfile(id: string): Promise<Profile | null> {
  const db = await load();
  return db.profiles[id] ?? null;
}

export async function createProfile(input: {
  displayName: string;
  targetLanguage: TargetLanguageCode;
  levelBand: LevelBandId;
  firstLanguage: string;
  ageBand: AgeBandId;
  tier?: "member" | "guest";
}): Promise<Profile> {
  const profile: Profile = {
    id: randomUUID(),
    displayName: input.displayName,
    targetLanguage: input.targetLanguage,
    levelBand: input.levelBand,
    firstLanguage: input.firstLanguage,
    ageBand: input.ageBand,
    cohortIds: [],
    rulesAcceptedAt: null,
    trust: STARTING_TRUST,
    tier: input.tier ?? "member",
    createdAt: new Date().toISOString(),
  };

  return mutate((db) => {
    db.profiles[profile.id] = profile;
    return profile;
  });
}

export async function updateProfile(
  id: string,
  patch: Partial<Omit<Profile, "id" | "createdAt">>,
): Promise<Profile> {
  return mutate((db) => {
    const existing = db.profiles[id];
    if (!existing) throw new Error(`No profile ${id}`);
    const next = { ...existing, ...patch };
    db.profiles[id] = next;
    return next;
  });
}

/* ------------------------------------------------------------------- cohorts */

export async function getCohort(id: string): Promise<Cohort | null> {
  const db = await load();
  return db.cohorts[id] ?? null;
}

export async function findCohortByInviteCode(
  code: string,
): Promise<Cohort | null> {
  const db = await load();
  const wanted = normaliseCode(code);
  return (
    Object.values(db.cohorts).find(
      (cohort) => cohort.inviteCode === wanted,
    ) ?? null
  );
}

export async function createCohort(input: {
  name: string;
  inviteCode: string;
  ageBand: AgeBandId;
}): Promise<Cohort> {
  const cohort: Cohort = {
    id: randomUUID(),
    name: input.name,
    inviteCode: normaliseCode(input.inviteCode),
    ageBand: input.ageBand,
    createdAt: new Date().toISOString(),
  };

  return mutate((db) => {
    db.cohorts[cohort.id] = cohort;
    return cohort;
  });
}

export async function listCohorts(): Promise<Cohort[]> {
  const db = await load();
  return Object.values(db.cohorts);
}

/* ------------------------------------------------------------------ sessions */

export async function createSession(
  session: PracticeSession,
): Promise<PracticeSession> {
  return mutate((db) => {
    db.sessions[session.id] = session;
    return session;
  });
}

export async function getSession(id: string): Promise<PracticeSession | null> {
  const db = await load();
  return db.sessions[id] ?? null;
}

export async function updateSession(
  id: string,
  patch: Partial<Omit<PracticeSession, "id">>,
): Promise<PracticeSession> {
  return mutate((db) => {
    const existing = db.sessions[id];
    if (!existing) throw new Error(`No session ${id}`);
    const next = { ...existing, ...patch };
    db.sessions[id] = next;
    return next;
  });
}

export async function listSessionsForProfile(
  profileId: string,
): Promise<PracticeSession[]> {
  const db = await load();
  return Object.values(db.sessions)
    .filter((session) =>
      session.participants.some((p) => p.profileId === profileId),
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/**
 * Creates the session if it is new, otherwise adds this participant to it —
 * all inside one mutation.
 *
 * Both browsers register the same session at the same moment. Doing this as a
 * read then a write lets both see "no session yet", both create one, and the
 * second overwrite the first — leaving one person absent from their own
 * session and their upload rejected as a stranger's.
 */
export async function upsertSessionParticipant(
  draft: PracticeSession,
  participant: PracticeSession["participants"][number],
): Promise<{ session: PracticeSession; created: boolean }> {
  return mutate((db) => {
    const existing = db.sessions[draft.id];

    if (!existing) {
      const session = { ...draft, participants: [participant] };
      db.sessions[draft.id] = session;
      return { session, created: true };
    }

    const alreadyListed = existing.participants.some(
      (p) => p.profileId === participant.profileId,
    );
    const session = alreadyListed
      ? existing
      : { ...existing, participants: [...existing.participants, participant] };

    db.sessions[draft.id] = session;
    return { session, created: false };
  });
}

/**
 * Attaches one participant's recording, atomically.
 *
 * Both uploads land at almost the same moment. Read-then-write lets the second
 * writer overwrite the first, silently dropping one person's audioKey — the
 * session then looks half-recorded, talk share cannot be computed, and the
 * Interaction trait quietly disappears from someone's report.
 *
 * Returns whether every participant has now uploaded, so the caller does not
 * have to re-read and race again to find out.
 */
export async function attachParticipantAudio(
  sessionId: string,
  profileId: string,
  audioKey: string,
  voicedSeconds: number,
): Promise<{ everyoneUploaded: boolean } | null> {
  return mutate((db) => {
    const session = db.sessions[sessionId];
    if (!session) return null;

    const participants = session.participants.map((p) =>
      p.profileId === profileId ? { ...p, audioKey, voicedSeconds } : p,
    );
    const everyoneUploaded = participants.every((p) => p.audioKey !== null);

    db.sessions[sessionId] = {
      ...session,
      participants,
      ...(everyoneUploaded
        ? { status: "ended" as const, endedAt: new Date().toISOString() }
        : {}),
    };

    return { everyoneUploaded };
  });
}

export async function listSessions(): Promise<PracticeSession[]> {
  const db = await load();
  return Object.values(db.sessions);
}

/* ------------------------------------------------------------------- reports */

function reportKey(sessionId: string, profileId: string): string {
  return `${sessionId}:${profileId}`;
}

export async function saveReport(report: {
  sessionId: string;
  profileId: string;
}): Promise<void> {
  await mutate((db) => {
    db.reports[reportKey(report.sessionId, report.profileId)] = report;
  });
}

export async function getReport<T>(
  sessionId: string,
  profileId: string,
): Promise<T | null> {
  const db = await load();
  return (db.reports[reportKey(sessionId, profileId)] as T) ?? null;
}

/** Newest first. Used for the progress sparkline and the recurring-error log. */
export async function listReportsForProfile<T extends { profileId: string; createdAt: string }>(
  profileId: string,
): Promise<T[]> {
  const db = await load();
  return (Object.values(db.reports) as T[])
    .filter((report) => report.profileId === profileId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
