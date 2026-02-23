import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function formatLabel(str: string): string {
  return capitalize(str.replace(/_/g, " "));
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...";
}

export function isRecord(data: unknown): data is Record<string, unknown> {
  return !!data && typeof data === "object" && !Array.isArray(data);
}

/** Safely extract a string from an unknown value. */
export function str(val: unknown, fallback = ""): string {
  return typeof val === "string" ? val : fallback;
}

export function getDataString(data: unknown, field: string): string | undefined {
  if (!isRecord(data)) return undefined;
  const value = data[field];
  return typeof value === "string" && value ? value : undefined;
}

export const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export const TYPE_COLORS: Record<string, string> = {
  person: "#3b82f6",
  organization: "#8b5cf6",
  group: "#6366f1",
  location: "#10b981",
  event: "#f97316",
  project: "#06b6d4",
  asset: "#ec4899",
  intel: "#ef4444",
};

export const CONFIDENCE_COLORS: Record<string, string> = {
  confirmed: "text-emerald-600",
  high: "text-emerald-500",
  medium: "text-amber-500",
  low: "text-orange-500",
  unconfirmed: "text-muted-foreground",
};

export const CONFIDENCE_DOT_COLORS: Record<string, string> = {
  confirmed: "bg-emerald-500",
  high: "bg-emerald-400",
  medium: "bg-amber-400",
  low: "bg-orange-400",
  unconfirmed: "bg-gray-400",
};
