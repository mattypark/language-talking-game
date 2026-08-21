/**
 * What this particular deployment can actually do.
 *
 * Accounts, sessions and reports all go through the file-backed store in
 * lib/store/demo-store.ts, which needs a writable disk that survives between
 * requests. A laptop has one. A serverless deployment does not: the filesystem
 * is read-only, /tmp is per instance, and consecutive requests from one person
 * land on different machines.
 *
 * So a deployed instance runs the half of the product that needs no store —
 * open rooms, guests, live calls — and says so, rather than offering a sign-up
 * that fails on write. The flag is derived from the environment rather than
 * set by hand, because a hand-set flag is a thing that can be wrong.
 *
 * Flipping this to true on a deployment means implementing the Supabase-backed
 * store behind the same functions. Until that exists, this is the honest
 * answer and the UI is built on it.
 */
const IS_SERVERLESS = Boolean(process.env.VERCEL);

export const CAN_STORE_ACCOUNTS = !IS_SERVERLESS;

/** Everything a guest does works everywhere. Stated once so pages can ask. */
export const CAN_MATCH_GUESTS = true;
