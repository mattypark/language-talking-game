type ClassValue = string | false | null | undefined;

/** Joins class names, dropping falsy entries. No dependency, no merge magic. */
export function cn(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(" ");
}
