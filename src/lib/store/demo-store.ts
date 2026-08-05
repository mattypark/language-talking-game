import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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

let cache: Database | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function load(): Promise<Database> {
  if (cache) return cache;

  try {
    const raw = await readFile(DATA_FILE, "utf8");
    cache = { ...EMPTY_DATABASE, ...(JSON.parse(raw) as Partial<Database>) };
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
    cache = structuredClone(EMPTY_DATABASE);
  }

  return cache;
}

/** Serialised so two overlapping requests cannot interleave a read-modify-write. */
async function mutate<T>(change: (db: Database) => T): Promise<T> {
  const run = writeQueue.then(async () => {
    const db = await load();
    const result = change(db);
    await mkdir(dirname(DATA_FILE), { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
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

/** Test seam. The cache is process-wide, so tests need a way to drop it. */
export function resetCacheForTests(): void {
  cache = null;
}
