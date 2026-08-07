"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { ANY_TOPIC, TARGET_LANGUAGES } from "@/lib/domain";
import type { Topic } from "@/lib/matchmaker-protocol";

type Props = {
  cohortIds: string[];
  defaultLanguage: string;
};

type Rooms = Record<string, number>;

/**
 * Pick what you're practising, then which room to join.
 *
 * Two things fight here. Named rooms make a queue feel alive — you can see
 * where people are — but every room halves the pool you can be matched from,
 * and a thin pool is what makes a matching product feel dead.
 *
 * So "Any room" is the default and matches across all of them, and choosing a
 * named room widens back to the whole pool after twenty seconds. You get the
 * room you asked for when someone is in it, and everyone else when they are
 * not.
 */
export function RoomChooser({ cohortIds, defaultLanguage }: Props) {
  const router = useRouter();

  const [language, setLanguage] = useState(defaultLanguage);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [rooms, setRooms] = useState<Rooms>({});
  const [selected, setSelected] = useState<string>(ANY_TOPIC);
  const [isTopicsUnavailable, setIsTopicsUnavailable] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/topics");
        if (!response.ok) throw new Error("unavailable");
        const body = (await response.json()) as { topics: Topic[] };
        setTopics(body.topics);
      } catch {
        setIsTopicsUnavailable(true);
      }
    })();
  }, []);

  const loadRooms = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        cohorts: cohortIds.join(","),
        language,
      });
      const response = await fetch(`/api/rooms?${params}`);
      if (!response.ok) return;
      const body = (await response.json()) as { rooms: Rooms };
      setRooms(body.rooms ?? {});
    } catch {
      // Counts are a nicety. Never block joining on them.
    }
  }, [cohortIds, language]);

  // First load is deferred a tick so no state is written synchronously from
  // the effect; after that it just polls.
  useEffect(() => {
    const first = setTimeout(() => void loadRooms(), 0);
    const timer = setInterval(() => void loadRooms(), 5000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [loadRooms]);

  const join = () => {
    const params = new URLSearchParams({ language, topic: selected });
    router.push(`/practice/live?${params}`);
  };

  const totalWaiting = Object.values(rooms).reduce((sum, n) => sum + n, 0);

  return (
    <div>
      <section className="mb-10">
        <h2 className="t-title-3 mb-1">What are you practising?</h2>
        <p className="t-caption mb-4 text-ink-muted">
          You&rsquo;ll only ever be matched with someone practising the same one.
        </p>

        <div className="flex flex-wrap gap-2">
          {TARGET_LANGUAGES.map((option) => {
            const isActive = option.code === language;
            return (
              <button
                key={option.code}
                type="button"
                onClick={() => setLanguage(option.code)}
                aria-pressed={isActive}
                className={cn(
                  "btn btn--md",
                  isActive ? "btn--primary" : "btn--secondary",
                )}
              >
                {option.label}
                <span className="opacity-70">{option.nativeLabel}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="t-title-3">Pick a room</h2>
          {totalWaiting > 0 ? (
            <span className="tabular t-caption text-ink-muted">
              {totalWaiting} waiting
            </span>
          ) : null}
        </div>

        <div className="space-y-2">
          <RoomRow
            title="Any room"
            detail="Matched fastest. Your topic is picked for you once you're paired."
            count={rooms[ANY_TOPIC] ?? 0}
            isSelected={selected === ANY_TOPIC}
            isRecommended
            onSelect={() => setSelected(ANY_TOPIC)}
          />

          {isTopicsUnavailable ? (
            <Card tone="sunken" className="p-4">
              <p className="t-caption text-ink-muted">
                Rooms are unavailable — the matchmaker isn&rsquo;t running. You
                can still join the any room.
              </p>
            </Card>
          ) : null}

          {topics.map((topic) => (
            <RoomRow
              key={topic.id}
              title={topic.prompt}
              detail={topic.nudges[0] ?? ""}
              count={rooms[topic.id] ?? 0}
              isSelected={selected === topic.id}
              onSelect={() => setSelected(topic.id)}
            />
          ))}
        </div>

        {selected !== ANY_TOPIC ? (
          <p className="t-caption mt-4 text-ink-muted">
            If nobody&rsquo;s in this room after twenty seconds, we&rsquo;ll
            widen the search rather than leave you waiting.
          </p>
        ) : null}
      </section>

      <Button variant="primary" size="lg" isBlock onClick={join}>
        Join a room
      </Button>
    </div>
  );
}

function RoomRow({
  title,
  detail,
  count,
  isSelected,
  isRecommended = false,
  onSelect,
}: {
  title: string;
  detail: string;
  count: number;
  isSelected: boolean;
  isRecommended?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={cn("choice w-full text-left", isSelected && "choice--selected")}
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="t-label">{title}</span>
        {/* A real number or nothing. A fabricated count is a lie users catch. */}
        {count > 0 ? (
          <span className="tabular t-caption text-live-ink">{count} here</span>
        ) : null}
      </span>

      {detail ? (
        <span className="t-caption mt-1 block text-ink-muted">{detail}</span>
      ) : null}

      <span className="mt-2 flex items-center gap-2">
        {isRecommended ? <Badge tone="live">Fastest</Badge> : null}
        {isSelected ? <Badge tone="accent">Selected</Badge> : null}
      </span>
    </button>
  );
}
