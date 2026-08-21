const DEFAULT_URL = "ws://localhost:4100";

/**
 * Where the matchmaker is.
 *
 * One env var carries both protocols: the browser opens a socket on it and the
 * server proxies `/topics` and `/rooms` over HTTP to the same host. Deriving
 * one from the other beats a second variable that can be set to a different
 * machine.
 */
export function matchmakerWsUrl(): string {
  return process.env.NEXT_PUBLIC_MATCHMAKER_URL || DEFAULT_URL;
}

export function matchmakerHttpUrl(): string {
  return matchmakerWsUrl().replace(/^ws:/, "http:").replace(/^wss:/, "https:");
}

/**
 * True when the matchmaker is somewhere that sleeps.
 *
 * Render's free tier stops an idle service and starts it again on the next
 * request, which takes tens of seconds. That is not an error state and must
 * not be drawn as one — but it does need saying, because a silent thirty
 * second wait on a "connecting" spinner reads as broken.
 */
export function isRemoteMatchmaker(): boolean {
  return /^wss:/.test(matchmakerWsUrl());
}
