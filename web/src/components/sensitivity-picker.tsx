import { SENSITIVITY_LEVELS } from "@/lib/constants";
import { Label } from "@/components/ui/label";
import { capitalize, selectClass } from "@/lib/utils";

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
            {capitalize(s)}
          </option>
        ))}
      </select>
    </div>
  );
}
