import { Link } from "react-router";

const typeColors: Record<string, string> = {
  person: "text-blue-600 dark:text-blue-400",
  organization: "text-purple-600 dark:text-purple-400",
  group: "text-indigo-600 dark:text-indigo-400",
  location: "text-emerald-600 dark:text-emerald-400",
  event: "text-orange-600 dark:text-orange-400",
  project: "text-cyan-600 dark:text-cyan-400",
  asset: "text-pink-600 dark:text-pink-400",
};

export function EntityLink({
  id,
  name,
  type,
}: {
  id: string;
  name: string;
  type?: string;
}) {
  const color = type ? typeColors[type] ?? "" : "";
  return (
    <Link
      to={`/entities/${id}`}
      className={`font-medium hover:underline ${color}`}
    >
      {name}
    </Link>
  );
}
