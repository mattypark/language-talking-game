import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type FieldProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
};

export function Field({ label, htmlFor, hint, children }: FieldProps) {
  return (
    <div>
      <label className="field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="field__hint">{hint}</p> : null}
    </div>
  );
}

export function TextInput({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("input", className)} {...rest} />;
}

export function Select({
  className,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("input", className)} {...rest} />;
}

type ChoiceProps = {
  name: string;
  value: string;
  title: string;
  description?: string;
  aside?: string;
  defaultChecked?: boolean;
};

/** A radio rendered as a full-width card, so the whole block is the target. */
export function Choice({
  name,
  value,
  title,
  description,
  aside,
  defaultChecked,
}: ChoiceProps) {
  return (
    <label className="choice">
      <input
        className="choice__input"
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
      />
      <span className="flex items-baseline justify-between gap-3">
        <span className="t-label">{title}</span>
        {aside ? (
          <span className="tabular t-caption text-ink-muted">{aside}</span>
        ) : null}
      </span>
      {description ? (
        <span className="t-caption mt-1 block text-ink-muted">{description}</span>
      ) : null}
    </label>
  );
}

export function FormError({ message }: { message: string }) {
  return (
    <p className="form-error" role="alert">
      {message}
    </p>
  );
}
