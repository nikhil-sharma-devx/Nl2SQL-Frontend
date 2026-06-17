import { clsx, type ClassValue } from "clsx";

/**
 * Merge class names. (clsx-based; safe for our controlled class strings.)
 * Mirrors the shadcn/ui `cn` helper API.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
