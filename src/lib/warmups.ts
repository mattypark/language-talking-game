/**
 * Warm-up prompts shown while you wait.
 *
 * These are explicitly NOT the topic you will be given — the label says so.
 * The real topic is assigned after matching and revealed to both people at
 * once, because prep time produces a rehearsed answer, and rehearsed speech
 * has an unnaturally low hesitation rate and flat prosody. It is both worse
 * practice and unscoreable.
 *
 * But an empty queue screen is dead air, and dead air is when people leave. So
 * the wait gets a real job: say something out loud, watch the meter move, know
 * the microphone works before a stranger is listening.
 */
export const WARMUPS = [
  "Say what you had for breakfast. Out loud — check the bars move.",
  "Describe the room you're in right now.",
  "Count backwards from ten. It's only a mic check.",
  "Say what you did yesterday, in one sentence.",
  "Name three things you can see from where you're sitting.",
  "Say why you're learning English today.",
];

export function warmupAt(seconds: number): string {
  return WARMUPS[Math.floor(seconds / 8) % WARMUPS.length];
}

/**
 * Queue status copy. Warm, honest, and never a fake progress bar — the count
 * of other people waiting is a real number or it is not shown at all.
 */
export function queueStatus(seconds: number, othersWaiting: number): string {
  if (seconds < 8) return "Looking for someone at your level…";
  if (seconds < 20) return "Still looking. Widening to the next level up.";
  if (seconds < 45) {
    return othersWaiting > 0
      ? "Nearly there — a few people are online."
      : "Quiet right now. Widening the search.";
  }
  if (seconds < 75) return "It's thin at the moment. Hang on a little longer.";
  return "Nobody free right now.";
}

/**
 * How wide the search is right now, as a readout.
 *
 * Mirrors the widening ladder in services/matchmaker/src/matchmaker.js — the
 * queue screen shows what the matcher is actually doing rather than a spinner,
 * and "widening" is the one honest thing to say about a thin pool. The service
 * owns the behaviour; this is only its label, so a drift here costs a wrong
 * word rather than a wrong match.
 */
export function queueScope(seconds: number): string {
  if (seconds < 20) return "your level ±1";
  if (seconds < 45) return "any level";
  if (seconds < 75) return "any room";
  return "AI partner offered";
}
