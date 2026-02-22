import { observer } from "mobx-react-lite";
import { useEffect, useState, useCallback } from "react";
import { useRootStore } from "@/stores/RootStore";
import { StagedRowEditor, type IdLabel } from "@/components/staged-row-editor";
import { ResolutionReview } from "@/components/resolution-review";
import { getStagedExtractionsByInputId, bulkUpdateStagedStatus } from "@/lib/idb/staged";
import type { StagedExtraction } from "@/lib/sync/types";
import { commitStagedForInput } from "@/services/sync/stagingToOutbox";
import { getLlmClient } from "@/services/llm/LlmClient";
import type {
  EntityResolution,
  ClarificationRequest,
} from "@/services/llm/types";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type DialogState =
  | { type: "closed" }
  | { type: "confirm"; title: string; description: string; onConfirm: () => void }
  | { type: "info"; title: string; description: string };

type LlmStatus =
  | { state: "checking" }
  | { state: "connected"; provider: string; model: string }
  | { state: "disconnected" };

type LlmStatusBannerProps = {
  llmStatus: Exclude<LlmStatus, { state: "checking" }>;
  useAnthropic: boolean;
};

function LlmStatusBanner({ llmStatus, useAnthropic }: LlmStatusBannerProps) {
  let variant: "default" | "destructive" = "default";
  let title: string;
  let description: string | undefined;

  if (llmStatus.state === "disconnected") {
    if (useAnthropic) {
      title = "Using Anthropic (Claude)";
      description =
        "The local LLM service is not running. Extractions will use your Anthropic API key. Switch to Local LLM in Settings to use Ollama.";
    } else {
      variant = "destructive";
      title = "LLM service unavailable";
      description =
        "The LLM service is not running. Start it or switch to Anthropic in Settings.";
    }
  } else if (useAnthropic) {
    title = "Using Anthropic (Claude)";
    description = `Local LLM is also available (${llmStatus.provider}). Switch in Settings.`;
  } else {
    title = `Connected to ${llmStatus.provider} (${llmStatus.model})`;
  }

  return (
    <Alert variant={variant} className="mb-4">
      <AlertTitle>{title}</AlertTitle>
      {description && <AlertDescription>{description}</AlertDescription>}
    </Alert>
  );
}

export const NLInputPage = observer(function NLInputPage() {
  const { nlQueue, replica } = useRootStore();
  const [inputText, setInputText] = useState("");
  const [selectedInputId, setSelectedInputId] = useState<string | null>(
    null
  );
  const [stagedRows, setStagedRows] = useState<StagedExtraction[]>([]);
  const [isCommitting, setIsCommitting] = useState(false);
  const [idLabels, setIdLabels] = useState<Map<string, IdLabel>>(new Map());
  const [dialog, setDialog] = useState<DialogState>({ type: "closed" });
  const [llmStatus, setLlmStatus] = useState<LlmStatus>({ state: "checking" });

  const useAnthropic =
    localStorage.getItem("tether_llm_provider") === "anthropic" &&
    Boolean(localStorage.getItem("tether_anthropic_api_key"));

  const checkHealth = useCallback(async () => {
    try {
      const health = await getLlmClient().health();
      setLlmStatus({ state: "connected", provider: health.provider, model: health.model });
    } catch {
      setLlmStatus({ state: "disconnected" });
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  useEffect(() => {
    nlQueue.refresh();
  }, [nlQueue]);

  const selectedItemStatus = nlQueue.items.find(
    (i) => i.input_id === selectedInputId
  )?.status;

  useEffect(() => {
    if (selectedInputId) {
      loadStagedRows(selectedInputId);
    } else {
      setStagedRows([]);
    }
  }, [selectedInputId, selectedItemStatus]);

  const loadStagedRows = async (inputId: string) => {
    let rows = await getStagedExtractionsByInputId(inputId);

    // If IDB has no staged rows, reconstruct from the snapshot saved in the result
    if (rows.length === 0) {
      const item = nlQueue.items.find((i) => i.input_id === inputId);
      const res = item?.result as {
        committed_rows?: Array<{ table: string; proposed_row: unknown; origin_label: string | null }>;
        rejected_rows?: Array<{ table: string; proposed_row: unknown; origin_label: string | null }>;
      } | null;

      const synthetics: StagedExtraction[] = [];
      for (const r of res?.committed_rows ?? []) {
        synthetics.push({
          staged_id: crypto.randomUUID(),
          created_at: item?.created_at ?? new Date().toISOString(),
          input_id: inputId,
          table: r.table as StagedExtraction["table"],
          proposed_row: r.proposed_row,
          status: "committed",
          validation_errors: null,
          origin_label: r.origin_label,
        });
      }
      for (const r of res?.rejected_rows ?? []) {
        synthetics.push({
          staged_id: crypto.randomUUID(),
          created_at: item?.created_at ?? new Date().toISOString(),
          input_id: inputId,
          table: r.table as StagedExtraction["table"],
          proposed_row: r.proposed_row,
          status: "rejected",
          validation_errors: null,
          origin_label: r.origin_label,
        });
      }
      rows = synthetics;
    }

    setStagedRows(rows);

    // Build ID labels from staged rows + replica lookups
    const labels = new Map<string, IdLabel>();

    // Labels from staged rows themselves
    for (const row of rows) {
      const proposed = row.proposed_row as Record<string, unknown>;
      const data = proposed.data as Record<string, unknown> | undefined;
      if (row.table === "entities" && data?.name) {
        labels.set(proposed.id as string, {
          label: data.name as string,
          type: proposed.type as string,
        });
      } else if (row.table === "intel" && data?.description) {
        const desc = data.description as string;
        labels.set(proposed.id as string, {
          label: desc.length > 50 ? desc.slice(0, 50) + "..." : desc,
          type: proposed.type as string,
        });
      }
    }

    // Labels from resolution results
    const item = nlQueue.items.find((i) => i.input_id === inputId);
    const res = item?.result as {
      resolutions?: EntityResolution[];
    } | null;
    if (res?.resolutions) {
      for (const r of res.resolutions) {
        if (r.resolved_entity_id && !labels.has(r.resolved_entity_id)) {
          labels.set(r.resolved_entity_id, {
            label: r.entity_ref,
            type: undefined,
          });
        }
      }
    }

    // Collect any remaining unknown IDs and look them up from the replica
    const unknownIds = new Set<string>();
    for (const row of rows) {
      const proposed = row.proposed_row as Record<string, unknown>;
      for (const [key, val] of Object.entries(proposed)) {
        if (key.endsWith("_id") && typeof val === "string" && !labels.has(val)) {
          unknownIds.add(val);
        }
      }
    }
    for (const id of unknownIds) {
      const entity = await replica.getById("entities", id);
      if (entity) {
        const eData = entity.data as Record<string, unknown> | undefined;
        labels.set(id, {
          label: (eData?.name as string) ?? "Unnamed",
          type: entity.type,
        });
        continue;
      }
      const intel = await replica.getById("intel", id);
      if (intel) {
        const iData = intel.data as Record<string, unknown> | undefined;
        const desc = (iData?.description as string) ?? intel.type;
        labels.set(id, {
          label: desc.length > 50 ? desc.slice(0, 50) + "..." : desc,
          type: intel.type,
        });
      }
    }

    setIdLabels(labels);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const item = await nlQueue.enqueue(inputText.trim(), null);
    setInputText("");
    setSelectedInputId(item.input_id);
  };

  const handleCancel = (inputId: string) => {
    setDialog({
      type: "confirm",
      title: "Cancel item",
      description: "Are you sure you want to cancel this item?",
      onConfirm: async () => {
        await nlQueue.cancel(inputId);
        if (selectedInputId === inputId) {
          setSelectedInputId(null);
        }
        setDialog({ type: "closed" });
      },
    });
  };

  const handleRetry = async (inputId: string) => {
    await nlQueue.retry(inputId);
  };

  const handleCommit = () => {
    if (!selectedInputId) return;

    const acceptedCount = stagedRows.filter(
      (r) => r.status === "accepted" || r.status === "edited"
    ).length;

    if (acceptedCount === 0) {
      setDialog({
        type: "info",
        title: "Nothing to commit",
        description: "No accepted rows to commit. Please accept at least one row.",
      });
      return;
    }

    setDialog({
      type: "confirm",
      title: "Commit to database",
      description: `Commit ${acceptedCount} accepted row(s) to the database?`,
      onConfirm: async () => {
        setDialog({ type: "closed" });
        setIsCommitting(true);
        try {
          await commitStagedForInput(selectedInputId);
          await nlQueue.refresh();
          await loadStagedRows(selectedInputId);
          setDialog({
            type: "info",
            title: "Committed",
            description: "Successfully committed to outbox. Sync will process these changes.",
          });
        } catch (error) {
          setDialog({
            type: "info",
            title: "Commit failed",
            description: error instanceof Error ? error.message : "Unknown error",
          });
        } finally {
          setIsCommitting(false);
        }
      },
    });
  };

  const formatDuration = (seconds: number | null): string => {
    if (seconds === null) return "?";
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const currentlyProcessing = nlQueue.currentlyProcessing;
  const pendingQueue = nlQueue.pendingQueue;
  const completed = nlQueue.completed;
  const failed = nlQueue.failed;

  const selectedItem = completed.find(
    (i) => i.input_id === selectedInputId
  );
  const result = selectedItem?.result as {
    resolutions?: EntityResolution[];
    clarifications?: ClarificationRequest[];
  } | null;

  return (
    <div>
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-xl font-bold">Natural Language Input</h2>
      </div>

      <div className="p-4">
        {/* LLM Status */}
        {llmStatus.state !== "checking" && (
          <LlmStatusBanner llmStatus={llmStatus} useAnthropic={useAnthropic} />
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="mb-3">
            <label className="block mb-2 text-sm font-medium">
              Enter intelligence text:
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Example: John Doe met Jane Smith at the Hilton Hotel on March 15, 2024..."
              className="w-full min-h-[120px] p-3 text-sm border rounded-md bg-background"
            />
          </div>
          <Button type="submit" disabled={!inputText.trim()}>
            Submit
          </Button>
        </form>

        {/* Queue Status */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Processing", value: currentlyProcessing ? 1 : 0 },
            { label: "Pending", value: pendingQueue.length },
            { label: "Completed", value: completed.length },
            { label: "Failed", value: failed.length },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground mb-1">
                  {stat.label}
                </div>
                <div className="text-2xl font-semibold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

      {/* Currently Processing */}
      {currentlyProcessing && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">
            Currently Processing
          </h2>
          <Card className="border-primary">
            <CardContent className="pt-4">
              <div className="text-sm mb-2">
                <strong>Text:</strong>{" "}
                {currentlyProcessing.text.substring(0, 100)}
                {currentlyProcessing.text.length > 100 ? "..." : ""}
              </div>
              <div className="text-xs text-muted-foreground">
                Processing...
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pending Queue */}
      {pendingQueue.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Pending Queue</h2>
          {pendingQueue.map((item) => (
            <Card key={item.input_id} className="mb-2">
              <CardContent className="pt-4">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="text-sm mb-1">
                      <strong>Position {item.queuePosition}:</strong>{" "}
                      {item.text.substring(0, 80)}
                      {item.text.length > 80 ? "..." : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Estimated wait:{" "}
                      {formatDuration(item.estimatedWaitSeconds)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleCancel(item.input_id)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Completed Items */}
      {completed.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">
            Completed Extractions
          </h2>
          {completed.map((item) => (
            <Card
              key={item.input_id}
              className={`mb-2 cursor-pointer transition-colors hover:bg-muted/50 ${
                selectedInputId === item.input_id
                  ? "border-primary bg-primary/5"
                  : ""
              }`}
              onClick={() => setSelectedInputId(item.input_id)}
            >
              <CardContent className="pt-4">
                <div className="text-sm mb-1">
                  <strong>Text:</strong>{" "}
                  {item.text.substring(0, 100)}
                  {item.text.length > 100 ? "..." : ""}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(item.created_at).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Failed Items */}
      {failed.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">
            Failed Extractions
          </h2>
          {failed.map((item) => (
            <Card
              key={item.input_id}
              className="mb-2 border-destructive"
            >
              <CardContent className="pt-4">
                <div className="text-sm mb-1">
                  <strong>Text:</strong>{" "}
                  {item.text.substring(0, 100)}
                  {item.text.length > 100 ? "..." : ""}
                </div>
                <div className="text-xs text-destructive mb-2">
                  <strong>Error:</strong> {item.error}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRetry(item.input_id)}
                >
                  Retry
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Staged Rows Review */}
      {selectedInputId && (
        <div className="mb-6">
          {(() => {
            const committedCount = stagedRows.filter((r) => r.status === "committed").length;
            const isFullyCommitted = committedCount > 0 && stagedRows.every((r) => r.status === "committed" || r.status === "rejected");
            const hasProposed = stagedRows.some((r) => r.status === "proposed");
            const canCommit = stagedRows.some((r) => r.status !== "committed" && r.status !== "rejected");

            return (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold m-0">
                    {isFullyCommitted ? "Committed Data" : "Review Extracted Data"}
                  </h2>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setSelectedInputId(null)}
                    >
                      Close
                    </Button>
                    {canCommit && (
                      <Button onClick={handleCommit} disabled={isCommitting}>
                        {isCommitting
                          ? "Committing..."
                          : "Commit to Database"}
                      </Button>
                    )}
                  </div>
                </div>

                {result && (
                  <ResolutionReview
                    resolutions={result.resolutions}
                    clarifications={result.clarifications}
                  />
                )}

                <div className="flex items-center justify-between mb-4">
                  <div className="text-xs text-muted-foreground">
                    {(() => {
                      const accepted = stagedRows.filter((r) => r.status === "accepted" || r.status === "edited").length;
                      const rejected = stagedRows.filter((r) => r.status === "rejected").length;
                      if (committedCount > 0) {
                        return `${committedCount} committed${rejected > 0 ? `, ${rejected} rejected` : ""}`;
                      }
                      if (stagedRows.length === 0) {
                        return "No extraction data";
                      }
                      return `${accepted} of ${stagedRows.length} rows accepted`;
                    })()}
                  </div>
                  {hasProposed && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs"
                        onClick={async () => {
                          await bulkUpdateStagedStatus(selectedInputId, ["proposed"], "accepted");
                          loadStagedRows(selectedInputId);
                        }}
                      >
                        Accept All
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground hover:text-destructive"
                        onClick={async () => {
                          await bulkUpdateStagedStatus(selectedInputId, ["proposed"], "rejected");
                          loadStagedRows(selectedInputId);
                        }}
                      >
                        Reject All
                      </Button>
                    </div>
                  )}
                </div>

                {stagedRows.map((staged) => (
                  <StagedRowEditor
                    key={staged.staged_id}
                    staged={staged}
                    idLabels={idLabels}
                    onStatusChange={() =>
                      loadStagedRows(selectedInputId)
                    }
                  />
                ))}
              </>
            );
          })()}
        </div>
      )}
      </div>

      <AlertDialog
        open={dialog.type !== "closed"}
        onOpenChange={(open) => {
          if (!open) setDialog({ type: "closed" });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog.type !== "closed" ? dialog.title : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog.type !== "closed" ? dialog.description : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {dialog.type === "confirm" ? (
              <>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={dialog.onConfirm}>
                  Confirm
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction onClick={() => setDialog({ type: "closed" })}>
                OK
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
