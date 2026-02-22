import { SENSITIVITY_LEVELS } from "@/lib/constants";
import { Label } from "@/components/ui/label";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function SensitivityPicker({
  value,
  onChange,
  id = "sensitivity",
  label = "Sensitivity",
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className={selectClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {SENSITIVITY_LEVELS.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>
    </div>
  );
}
