import { EntityLink } from "@/components/entity-link";

export interface TimelineEvent {
  id: string;
  date: string;
  kind: "intel" | "attribute_start" | "attribute_end" | "relation_start" | "relation_end" | "lifecycle";
  title: string;
  description?: string;
  entityId?: string;
  entityName?: string;
  confidence?: string;
  sensitivity?: string;
}

interface TimelineViewProps {
  events: TimelineEvent[];
  loading?: boolean;
  emptyMessage?: string;
}

const KIND_COLORS: Record<string, string> = {
  intel: "border-blue-500 bg-blue-500",
  attribute_start: "border-emerald-500 bg-emerald-500",
  attribute_end: "border-emerald-300 bg-emerald-300",
  relation_start: "border-purple-500 bg-purple-500",
  relation_end: "border-purple-300 bg-purple-300",
  lifecycle: "border-gray-400 bg-gray-400",
};

const KIND_LABELS: Record<string, string> = {
  intel: "Intel",
  attribute_start: "Attribute Set",
  attribute_end: "Attribute Ended",
  relation_start: "Relation Started",
  relation_end: "Relation Ended",
  lifecycle: "Lifecycle",
};

function groupByDate(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));
  const groups = new Map<string, TimelineEvent[]>();
  for (const event of sorted) {
    const dateKey = event.date.slice(0, 10);
    const existing = groups.get(dateKey);
    if (existing) {
      existing.push(event);
    } else {
      groups.set(dateKey, [event]);
    }
  }
  return groups;
}

export function TimelineView({ events, loading, emptyMessage = "No events." }: TimelineViewProps) {
  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">Loading timeline...</div>;
  }

  if (events.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">{emptyMessage}</div>;
  }

  const groups = groupByDate(events);

  return (
    <div className="relative">
      {/* Vertical connecting line */}
      <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

      <div className="space-y-6">
        {Array.from(groups.entries()).map(([dateKey, dateEvents]) => (
          <div key={dateKey}>
            {/* Date header */}
            <div className="relative flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center z-10 text-xs font-medium">
                {new Date(dateKey + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                {new Date(dateKey + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
              </span>
            </div>

            {/* Events for this date */}
            <div className="space-y-2 ml-5 pl-8 border-l-2 border-transparent">
              {dateEvents.map((event) => {
                const colorClass = KIND_COLORS[event.kind] ?? "border-gray-400 bg-gray-400";
                const [borderColor, bgColor] = colorClass.split(" ");
                return (
                  <div key={event.id} className="relative flex gap-3">
                    {/* Dot indicator */}
                    <div className={`absolute -left-[25px] top-1.5 w-3 h-3 rounded-full ${bgColor} border-2 border-background`} />

                    <div className={`flex-1 rounded-md border-l-4 ${borderColor} bg-card p-3`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-muted">
                          {KIND_LABELS[event.kind] ?? event.kind}
                        </span>
                        {event.confidence && (
                          <span className="text-xs text-muted-foreground capitalize">{event.confidence}</span>
                        )}
                      </div>
                      <p className="text-sm font-medium mt-1">{event.title}</p>
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                      )}
                      {event.entityId && event.entityName && (
                        <div className="mt-1">
                          <EntityLink id={event.entityId} name={event.entityName} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
