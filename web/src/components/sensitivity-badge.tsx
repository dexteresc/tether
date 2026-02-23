import { SENSITIVITY_LEVELS, type SensitivityLevel } from "@/lib/constants";

const styles: Record<SensitivityLevel, string> = {
  open: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  internal: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  confidential: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  restricted: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

function isSensitivityLevel(val: string): val is SensitivityLevel {
  return (SENSITIVITY_LEVELS as readonly string[]).includes(val);
}

export function SensitivityBadge({ level }: { level: string }) {
  const cls = isSensitivityLevel(level) ? styles[level] : styles.open;
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {level}
    </span>
  );
}
