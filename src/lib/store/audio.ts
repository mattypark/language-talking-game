import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Where a participant's own recording lands.
 *
 * Demo mode writes to .data/audio, which is gitignored. Production writes to
 * object storage — same key shape, so nothing above this file changes.
 *
 * Retention: deleted once the report is generated. The only exception is a
 * session someone reported, which is kept for 30 days as evidence and then
 * purged. Recording without deleting is how a practice app quietly becomes a
 * surveillance archive.
 */

const AUDIO_ROOT = join(process.cwd(), ".data", "audio");

/** 25MB. Five minutes of Opus is well under 3MB; this is an abuse ceiling. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export function audioKeyFor(sessionId: string, profileId: string): string {
  return `${sessionId}/${profileId}.webm`;
}

export async function saveAudio(key: string, data: Buffer): Promise<void> {
  const path = join(AUDIO_ROOT, key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

export async function deleteAudio(key: string): Promise<void> {
  try {
    await unlink(join(AUDIO_ROOT, key));
  } catch (error: unknown) {
    const isMissing =
      error instanceof Error && "code" in error && error.code === "ENOENT";
    // Already gone is the desired end state either way.
    if (!isMissing) throw error;
  }
}

export function audioPath(key: string): string {
  return join(AUDIO_ROOT, key);
}
