import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type CardTone = "surface" | "sunken" | "topic";

type Props = HTMLAttributes<HTMLDivElement> & {
  tone?: CardTone;
};

const TONE_CLASS: Record<CardTone, string> = {
  surface: "card",
  sunken: "card card--sunken",
  topic: "card card--topic",
};

export function Card({ tone = "surface", className, ...rest }: Props) {
  return <div className={cn(TONE_CLASS[tone], className)} {...rest} />;
}
