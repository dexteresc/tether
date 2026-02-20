import type { Identifier, IdentifierType } from "@/types/database";

interface IdentifierGroupsProps {
  identifiers: Identifier[];
}

export function IdentifierGroups({ identifiers }: IdentifierGroupsProps) {
  const grouped = identifiers.reduce(
    (acc, id) => {
      if (!acc[id.type]) {
        acc[id.type] = [];
      }
      acc[id.type].push(id);
      return acc;
    },
    {} as Record<IdentifierType, Identifier[]>
  );

  const types = Object.keys(grouped).sort() as IdentifierType[];

  if (types.length === 0) {
    return (
      <div className="p-3 text-muted-foreground italic">
        No identifiers
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {types.map((type) => (
        <div key={type}>
          <h4 className="m-0 mb-2 text-sm font-semibold capitalize text-muted-foreground">
            {type}
          </h4>
          <div className="flex flex-col gap-1">
            {grouped[type].map((id) => (
              <div
                key={id.id}
                className="px-2.5 py-1.5 bg-muted rounded text-[13px] font-mono"
              >
                {id.value}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
