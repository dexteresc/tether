import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { getLlmClient } from "@/services/llm/LlmClient";
import { useAuth } from "@/hooks/use-auth";
import { capitalize } from "@/lib/utils";

interface BriefingData {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  summary: string;
  briefing_text: string;
  sections: {
    identifiers?: Array<{ type: string; value: string }>;
    attributes?: Array<{ key: string; value: string; valid_from?: string }>;
    relationship_to_user?: {
      path: Array<{ entity_id: string; name: string }>;
      relation_types: string[];
    } | null;
    mutual_connections?: Array<{ entity_id: string; name: string }>;
    recent_interactions?: Array<{ type: string; occurred_at: string; description: string }>;
    key_dates?: Array<{ label: string; date: string }>;
  };
  connection_count: number;
}

interface EntityBriefingProps {
  entityId: string;
  entityName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EntityBriefing({ entityId, entityName, open, onOpenChange }: EntityBriefingProps) {
  const [briefing, setBriefing] = useState<BriefingData | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const { session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open || briefing) return;
    async function fetchBriefing() {
      setLoading(true);
      setError(undefined);
      try {
        const client = getLlmClient();
        const token = session?.access_token;
        const data = await client.getBriefing(entityId, token);
        setBriefing(data as BriefingData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate briefing");
      } finally {
        setLoading(false);
      }
    }
    fetchBriefing();
  }, [open, briefing, entityId, session?.access_token]);

  async function loadBriefing() {
    setLoading(true);
    setError(undefined);
    try {
      const client = getLlmClient();
      const token = session?.access_token;
      const data = await client.getBriefing(entityId, token);
      setBriefing(data as BriefingData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate briefing");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Briefing: {entityName}</SheetTitle>
          <SheetDescription>Meeting prep dossier</SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="p-6 text-center text-muted-foreground">
            <div className="animate-pulse mb-2">Generating briefing...</div>
            <p className="text-xs">This may take a moment as we gather and analyze data.</p>
          </div>
        )}

        {error && (
          <div className="p-4">
            <div className="text-sm text-destructive mb-2">{error}</div>
            <Button size="sm" variant="outline" onClick={loadBriefing}>
              Retry
            </Button>
          </div>
        )}

        {briefing && (
          <div className="p-4 space-y-4">
            {briefing.briefing_text && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{briefing.briefing_text}</p>
                </CardContent>
              </Card>
            )}

            {briefing.sections.relationship_to_user?.path && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">How You're Connected</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {briefing.sections.relationship_to_user.path.map((step, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/entities/${step.entity_id}`)}
                          className="rounded px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary border border-primary/30 hover:opacity-80"
                        >
                          {step.name}
                        </button>
                        {i < (briefing.sections.relationship_to_user?.relation_types?.length ?? 0) && (
                          <span className="text-xs text-muted-foreground">
                            —{briefing.sections.relationship_to_user!.relation_types[i]}→
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {briefing.sections.mutual_connections && briefing.sections.mutual_connections.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Mutual Connections</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {briefing.sections.mutual_connections.map((m, i) => (
                      <button
                        key={i}
                        onClick={() => navigate(`/entities/${m.entity_id}`)}
                        className="rounded px-2 py-0.5 text-xs font-medium bg-muted hover:bg-muted/80"
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {briefing.sections.recent_interactions && briefing.sections.recent_interactions.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {briefing.sections.recent_interactions.slice(0, 5).map((i, idx) => (
                    <div key={idx} className="text-xs border-l-2 border-muted-foreground/30 pl-2">
                      {i.occurred_at && <span className="text-muted-foreground">[{i.occurred_at}] </span>}
                      <span>{i.description || i.type}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {briefing.sections.attributes && briefing.sections.attributes.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Key Facts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {briefing.sections.attributes.map((a, i) => (
                      <div key={i} className="text-xs flex justify-between">
                        <span className="text-muted-foreground">{capitalize(a.key.replace(/_/g, " "))}:</span>
                        <span className="font-medium">{a.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {briefing.sections.key_dates && briefing.sections.key_dates.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Key Dates</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {briefing.sections.key_dates.map((d, i) => (
                      <div key={i} className="text-xs flex justify-between">
                        <span className="text-muted-foreground">{d.label}</span>
                        <span className="font-medium">{d.date}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="text-xs text-muted-foreground text-center pt-2">
              {briefing.connection_count} total connections
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
