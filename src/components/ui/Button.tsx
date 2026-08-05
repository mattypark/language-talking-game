import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger-ghost"
  | "danger";

type ButtonSize = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isBlock?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  isBlock = false,
  className,
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={cn(
        "btn",
        `btn--${variant}`,
        `btn--${size}`,
        isBlock && "btn--block",
        className,
      )}
      {...rest}
    />
  );
}
