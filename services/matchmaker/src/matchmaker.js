import { randomUUID } from "node:crypto";

/**
 * The matching queue.
 *
 * Pure logic, no sockets and no clock of its own — `now` is injected so the
 * tiering and timeout behaviour can be tested deterministically instead of
 * with sleeps.
 *
 * Why this lives in one single-threaded process rather than in Postgres or in
 * Supabase Realtime: matching needs an atomic take. A single Node process is
 * already single-threaded, so "read the queue, remove two people, pair them"
 * cannot interleave — you get atomicity for free, with no locks and no Lua.
 * Realtime presence is eventually consistent and would double-match; Vercel
 * functions cannot hold a socket at all.
 */

/**
 * Widening ladder. A waiting person's candidate pool grows over time rather
 * than starting wide, so an easy match stays a good match and a hard one still
 * resolves.
 *
 * Note the first rung accepts an ADJACENT band immediately rather than holding
 * out for an exact one. There are only three bands precisely so the pool stays
 * thick, and making someone wait eight seconds for a B2 when they are B1 gives
 * back the liquidity those coarse bands bought. The closest band is still
 * *preferred* — that lives in the sort below, where a preference belongs.
 */
export const TIERS = [
  { afterMs: 0, scope: "adjacent-band" },
  { afterMs: 20_000, scope: "any-band" },
  { afterMs: 45_000, scope: "any-cohort" },
  { afterMs: 75_000, scope: "ai-partner" },
];

/** The room that matches across every other room. */
export const ANY_TOPIC = "any";

/**
 * How long a named topic room holds out before matching across all of them.
 *
 * Topic rooms make a queue feel alive and cost liquidity — every room halves
 * the people you can meet. Widening automatically is what stops that being a
 * trap: you get the room you asked for if anyone is there, and the whole pool
 * if they are not.
 */
const TOPIC_WIDEN_AFTER_MS = 20_000;

const BAND_ORDER = ["beginner", "intermediate", "advanced"];

const DEFAULTS = {
  /** How long a proposed pair has to both say yes before it is torn down. */
  proposalTimeoutMs: 12_000,
  /** How long a partner stays excluded from re-matching. */
  recentPartnerMs: 24 * 60 * 60 * 1000,
  /**
   * Whether a queued profile is still reachable.
   *
   * Injected because the queue itself knows nothing about sockets. Without it,
   * a browser that was killed rather than closed sits in the queue until the
   * next heartbeat and gets proposed to real users, who then wait out the full
   * proposal timeout against someone who will never answer.
   */
  isEligible: () => true,
};

function bandDistance(a, b) {
  return Math.abs(BAND_ORDER.indexOf(a) - BAND_ORDER.indexOf(b));
}

/**
 * Whether two people's chosen rooms can meet.
 *
 * ANY_TOPIC matches everything. Two different named rooms only meet once at
 * least one of them has waited out the widening window — so a named room is a
 * preference with a deadline, not a wall.
 */
function topicsCompatible(a, b, now) {
  if (a.topicId === ANY_TOPIC || b.topicId === ANY_TOPIC) return true;
  if (a.topicId === b.topicId) return true;

  const widened =
    now - a.enqueuedAt >= TOPIC_WIDEN_AFTER_MS ||
    now - b.enqueuedAt >= TOPIC_WIDEN_AFTER_MS;
  return widened;
}

function tierFor(waitedMs) {
  let scope = TIERS[0].scope;
  for (const tier of TIERS) {
    if (waitedMs >= tier.afterMs) scope = tier.scope;
  }
  return scope;
}

export class Matchmaker {
  #entries = new Map(); // profileId -> entry
  #proposals = new Map(); // proposalId -> proposal
  #pendingByProfile = new Map(); // profileId -> proposalId
  #now;
  #options;

  constructor(options = {}) {
    this.#options = { ...DEFAULTS, ...options };
    this.#now = options.now ?? (() => Date.now());
  }

  /**
   * Add someone to the queue and immediately try to pair them.
   *
   * Returns either a proposal (nobody is matched yet — both sides must ack) or
   * a queued acknowledgement. Never returns a confirmed match: a match that
   * one side never picks up would strand the other, so confirmation is always
   * a second step.
   */
  enqueue(entry) {
    const now = this.#now();

    if (this.#pendingByProfile.has(entry.profileId)) {
      return { status: "already-pending" };
    }

    const queued = {
      profileId: entry.profileId,
      cohortIds: entry.cohortIds,
      band: entry.band,
      ageBand: entry.ageBand,
      firstLanguage: entry.firstLanguage,
      /** What they are practising. Never crossed — a hard part of the key. */
      language: entry.language ?? "en",
      /** The room they asked for, or ANY_TOPIC. */
      topicId: entry.topicId ?? ANY_TOPIC,
      recentPartners: entry.recentPartners ?? {},
      // Preserved across a failed proposal so a ghosted user does not lose
      // their place in line.
      enqueuedAt: entry.enqueuedAt ?? now,
    };

    this.#entries.set(queued.profileId, queued);

    const partner = this.#findPartner(queued, now);
    if (!partner) return { status: "queued", waitingSince: queued.enqueuedAt };

    return { status: "proposed", proposal: this.#propose(queued, partner, now) };
  }

  #findPartner(seeker, now) {
    const scope = tierFor(now - seeker.enqueuedAt);
    if (scope === "ai-partner") return null;

    const candidates = [];

    for (const other of this.#entries.values()) {
      if (other.profileId === seeker.profileId) continue;
      if (this.#pendingByProfile.has(other.profileId)) continue;

      // Never propose a partner who is no longer reachable.
      if (!this.#options.isEligible(other.profileId)) {
        this.#entries.delete(other.profileId);
        continue;
      }

      /*
       * Defence in depth. Cohorts are single-age-band by construction, so this
       * should be unreachable — which is exactly why it is checked. This is
       * the one pairing that must never happen.
       */
      if (other.ageBand !== seeker.ageBand) continue;

      const sharedCohorts = other.cohortIds.filter((id) =>
        seeker.cohortIds.includes(id),
      );
      if (sharedCohorts.length === 0) continue;

      const lastPaired = seeker.recentPartners[other.profileId];
      if (lastPaired && now - lastPaired < this.#options.recentPartnerMs) {
        continue;
      }

      /*
       * Language is never crossed. Two people practising different languages
       * have no conversation to have, so unlike level or topic this one never
       * widens.
       */
      if (other.language !== seeker.language) continue;

      if (!topicsCompatible(seeker, other, now)) continue;

      const distance = bandDistance(seeker.band, other.band);
      if (scope === "adjacent-band" && distance > 1) continue;
      // "any-band" and "any-cohort" accept any distance within a shared cohort.

      candidates.push({
        other,
        distance,
        cohortId: sharedCohorts[0],
        isSameTopic: other.topicId === seeker.topicId,
      });
    }

    if (candidates.length === 0) return null;

    /*
     * Ordering, most significant first:
     *
     *  1. Different first language. Two Spanish speakers practising English
     *     drift back into Spanish and share the same interference errors, so a
     *     mixed pair is a materially better conversation.
     *  2. Closer level band.
     *  3. Longest wait. This is the fairness guarantee — without it a busy
     *     queue can starve someone indefinitely.
     */
    candidates.sort((a, b) => {
      // The room they asked for wins, when someone is in it.
      if (a.isSameTopic !== b.isSameTopic) return a.isSameTopic ? -1 : 1;

      const aSameL1 = a.other.firstLanguage === seeker.firstLanguage ? 1 : 0;
      const bSameL1 = b.other.firstLanguage === seeker.firstLanguage ? 1 : 0;
      if (aSameL1 !== bSameL1) return aSameL1 - bSameL1;
      if (a.distance !== b.distance) return a.distance - b.distance;
      return a.other.enqueuedAt - b.other.enqueuedAt;
    });

    return candidates[0];
  }

  #propose(seeker, candidate, now) {
    const proposal = {
      id: randomUUID(),
      sessionId: randomUUID(),
      cohortId: candidate.cohortId,
      createdAt: now,
      expiresAt: now + this.#options.proposalTimeoutMs,
      participants: [seeker, candidate.other].map((entry) => ({
        profileId: entry.profileId,
        band: entry.band,
        enqueuedAt: entry.enqueuedAt,
        acked: false,
      })),
    };

    this.#proposals.set(proposal.id, proposal);
    for (const participant of proposal.participants) {
      this.#pendingByProfile.set(participant.profileId, proposal.id);
      // Off the queue, but their entry is kept so a failed proposal can put
      // them back with the original enqueuedAt.
      this.#entries.delete(participant.profileId);
    }

    return proposal;
  }

  /**
   * One side says yes. The match only exists once both have.
   */
  ack(proposalId, profileId) {
    const proposal = this.#proposals.get(proposalId);
    if (!proposal) return { status: "unknown-proposal" };

    const participant = proposal.participants.find(
      (p) => p.profileId === profileId,
    );
    if (!participant) return { status: "not-a-participant" };

    participant.acked = true;

    if (!proposal.participants.every((p) => p.acked)) {
      return { status: "waiting-for-partner", proposal };
    }

    this.#proposals.delete(proposal.id);
    for (const p of proposal.participants) {
      this.#pendingByProfile.delete(p.profileId);
    }

    return { status: "confirmed", proposal };
  }

  /**
   * Sweep expired proposals. Call on a timer.
   *
   * The survivor — whoever did answer — goes back in the queue at their
   * ORIGINAL enqueue time. Losing your place because someone else walked away
   * is how a queue quietly starves its most patient users.
   */
  sweep() {
    const now = this.#now();
    const abandoned = [];

    for (const proposal of [...this.#proposals.values()]) {
      if (now < proposal.expiresAt) continue;

      this.#proposals.delete(proposal.id);

      const ghosts = proposal.participants.filter((p) => !p.acked);
      const survivors = proposal.participants.filter((p) => p.acked);

      for (const p of proposal.participants) {
        this.#pendingByProfile.delete(p.profileId);
      }

      abandoned.push({
        proposalId: proposal.id,
        ghosts: ghosts.map((p) => p.profileId),
        survivors: survivors.map((p) => p.profileId),
      });
    }

    return abandoned;
  }

  /** Put someone back after a failed proposal, keeping their place in line. */
  requeue(entry) {
    return this.enqueue(entry);
  }

  cancel(profileId) {
    this.#entries.delete(profileId);
    const proposalId = this.#pendingByProfile.get(profileId);
    if (proposalId) {
      const proposal = this.#proposals.get(proposalId);
      this.#proposals.delete(proposalId);
      this.#pendingByProfile.delete(profileId);
      if (proposal) {
        for (const p of proposal.participants) {
          this.#pendingByProfile.delete(p.profileId);
        }
        return {
          status: "cancelled-proposal",
          strandedProfileIds: proposal.participants
            .filter((p) => p.profileId !== profileId)
            .map((p) => p.profileId),
        };
      }
    }
    return { status: "cancelled" };
  }

  /** Who has waited long enough that we should offer them the AI partner. */
  dueForAiPartner() {
    const now = this.#now();
    const threshold = TIERS.find((t) => t.scope === "ai-partner").afterMs;
    return [...this.#entries.values()]
      .filter((entry) => now - entry.enqueuedAt >= threshold)
      .map((entry) => entry.profileId);
  }

  /**
   * Live count for the queue screen. Shown as a real number or not at all —
   * a fabricated "142 people practising" is a lie users eventually catch.
   */
  waitingCount(cohortIds) {
    return [...this.#entries.values()].filter((entry) =>
      entry.cohortIds.some((id) => cohortIds.includes(id)),
    ).length;
  }

  /**
   * Live counts per room, for the room list. Real numbers or none — a
   * fabricated "24 waiting" is a lie users eventually catch.
   */
  roomCounts(cohortIds, language) {
    const counts = new Map();
    for (const entry of this.#entries.values()) {
      if (entry.language !== language) continue;
      if (!entry.cohortIds.some((id) => cohortIds.includes(id))) continue;
      counts.set(entry.topicId, (counts.get(entry.topicId) ?? 0) + 1);
    }
    return Object.fromEntries(counts);
  }

  waitingSince(profileId) {
    return this.#entries.get(profileId)?.enqueuedAt ?? null;
  }

  get size() {
    return this.#entries.size;
  }
}
