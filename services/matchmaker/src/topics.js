/**
 * The topic bank.
 *
 * Topics are handed out AFTER a match is made and revealed to both people at
 * the same moment. Two reasons, and both matter:
 *
 *   1. A topic anyone can filter on fragments the queue. Preferences multiply
 *      matching cells, and thin cells are what kill a random-pairing product.
 *   2. Prep time produces a rehearsed answer. Rehearsed speech has an
 *      unnaturally low hesitation rate and flat prosody, which is both bad
 *      practice and unscoreable — the whole point is unprepared speech.
 *
 * Each topic carries two nudges. They are not instructions; they exist because
 * "what do I say" is the failure mode that kills every peer-practice app, and
 * a learner staring at a blank prompt gives up faster than one given a handle.
 */

export const TOPICS = [
  {
    id: "changed-mind",
    prompt: "What is something you used to believe and don't anymore?",
    nudges: ["Say what changed it", "Was anyone annoyed with you about it?"],
  },
  {
    id: "city-or-country",
    prompt: "Would you rather live in a big city or somewhere quiet?",
    nudges: ["Give a real example from your own life", "Say what you'd miss"],
  },
  {
    id: "bad-advice",
    prompt: "What is the worst advice you have ever been given?",
    nudges: ["Who gave it to you?", "Did you follow it anyway?"],
  },
  {
    id: "learned-late",
    prompt: "What is something everyone else seemed to know before you did?",
    nudges: ["How did you find out?", "Do you still think about it?"],
  },
  {
    id: "money-or-time",
    prompt: "Is it better to have more money or more free time?",
    nudges: ["Pick a side and stay on it", "What would you actually do?"],
  },
  {
    id: "one-rule",
    prompt: "If you could add one rule everyone had to follow, what would it be?",
    nudges: ["Say who would hate it", "Would you follow it yourself?"],
  },
  {
    id: "food-home",
    prompt: "What food reminds you of home, and why that one?",
    nudges: ["Describe how it's made", "Who used to make it?"],
  },
  {
    id: "useless-skill",
    prompt: "What is a skill you have that has never once been useful?",
    nudges: ["How did you end up learning it?", "Would you teach it?"],
  },
  {
    id: "disagree-friend",
    prompt: "What do you and your closest friend disagree about?",
    nudges: ["Take their side for a moment", "Has either of you moved?"],
  },
  {
    id: "ten-years",
    prompt: "What will people ten years from now find strange about today?",
    nudges: ["Be specific, not general", "Say whether that's good"],
  },
  {
    id: "quit-something",
    prompt: "Tell me about something you quit, and whether you regret it.",
    nudges: ["What was the last straw?", "Would you go back?"],
  },
  {
    id: "overrated",
    prompt: "What is something popular that you think is overrated?",
    nudges: ["Say what people see in it", "Have you actually tried it?"],
  },
];

/**
 * Deterministic given a seed, so both clients in a session compute the same
 * topic from the session id without an extra round trip.
 */
export function pickTopic(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return TOPICS[hash % TOPICS.length];
}

export function getTopic(id) {
  return TOPICS.find((topic) => topic.id === id) ?? null;
}
