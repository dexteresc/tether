import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useRootStore } from "@/stores/RootStore";
import { StagedRowEditor } from "@/components/staged-row-editor";
import { ResolutionReview } from "@/components/resolution-review";
import { getStagedExtractionsByInputId } from "@/lib/idb/staged";
import type { StagedExtraction } from "@/lib/sync/types";
import { commitStagedForInput } from "@/services/sync/stagingToOutbox";
import type {
  EntityResolution,
  ClarificationRequest,
} from "@/services/llm/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const NLInputPage = observer(function NLInputPage() {
  const { nlQueue } = useRootStore();
  const [inputText, setInputText] = useState("");
  const [selectedInputId, setSelectedInputId] = useState<string | null>(
    null
  );
  const [stagedRows, setStagedRows] = useState<StagedExtraction[]>([]);
  const [isCommitting, setIsCommitting] = useState(false);

  useEffect(() => {
    nlQueue.refresh();
  }, [nlQueue]);

  useEffect(() => {
    if (selectedInputId) {
      loadStagedRows(selectedInputId);
    } else {
      setStagedRows([]);
    }
  }, [selectedInputId]);

  const loadStagedRows = async (inputId: string) => {
    const rows = await getStagedExtractionsByInputId(inputId);
    setStagedRows(rows);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const item = await nlQueue.enqueue(inputText.trim(), null);
    setInputText("");
    setSelectedInputId(item.input_id);
  };

  const handleCancel = async (inputId: string) => {
    if (confirm("Are you sure you want to cancel this item?")) {
      await nlQueue.cancel(inputId);
      if (selectedInputId === inputId) {
        setSelectedInputId(null);
      }
    }
  };

  const handleRetry = async (inputId: string) => {
    await nlQueue.retry(inputId);
  };

  const handleCommit = async () => {
    if (!selectedInputId) return;

    const acceptedCount = stagedRows.filter(
      (r) => r.status === "accepted" || r.status === "edited"
    ).length;

    if (acceptedCount === 0) {
      alert("No accepted rows to commit. Please accept at least one row.");
      return;
    }

    if (
      !confirm(`Commit ${acceptedCount} accepted row(s) to the database?`)
    ) {
      return;
    }

    setIsCommitting(true);
    try {
      await commitStagedForInput(selectedInputId);
      alert(
        "Successfully committed to outbox. Sync will process these changes."
      );
      setSelectedInputId(null);
    } catch (error) {
      alert(
        `Commit failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsCommitting(false);
    }
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
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="mb-6 text-2xl font-bold">
        Natural Language Input
      </h1>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="mb-8">
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
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-8">
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
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold m-0">
              Review Extracted Data
            </h2>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setSelectedInputId(null)}
              >
                Close
              </Button>
              <Button onClick={handleCommit} disabled={isCommitting}>
                {isCommitting
                  ? "Committing..."
                  : "Commit to Database"}
              </Button>
            </div>
          </div>

          {result && (
            <ResolutionReview
              resolutions={result.resolutions}
              clarifications={result.clarifications}
            />
          )}

          <div className="text-xs text-muted-foreground mb-4">
            {
              stagedRows.filter(
                (r) =>
                  r.status === "accepted" || r.status === "edited"
              ).length
            }{" "}
            of {stagedRows.length} rows accepted
          </div>

          {stagedRows.map((staged) => (
            <StagedRowEditor
              key={staged.staged_id}
              staged={staged}
              onStatusChange={() =>
                loadStagedRows(selectedInputId)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
});
