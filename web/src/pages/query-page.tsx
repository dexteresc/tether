import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLlmClient } from "@/services/llm/LlmClient";
import { useAuth } from "@/hooks/use-auth";
import { TYPE_COLORS, capitalize, truncate, str, isRecord } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  data?: Array<Record<string, unknown>>;
  dataType?: string;
  intent?: string;
  loading?: boolean;
}

export function QueryPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { session } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    };

    const loadingMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      loading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput("");
    setLoading(true);

    try {
      const client = getLlmClient();
      const token = session?.access_token;
      const result = await client.query(question, undefined, token);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? {
                ...m,
                content: result.answer,
                data: result.data,
                dataType: result.data_type,
                intent: result.intent,
                loading: false,
              }
            : m
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? {
                ...m,
                content: err instanceof Error ? err.message : "Query failed",
                loading: false,
              }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex-shrink-0">
        <h2 className="text-xl font-bold">Ask Your Network</h2>
        <p className="text-sm text-muted-foreground">
          Ask questions about your contacts, relationships, and intel in natural language.
        </p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-12 space-y-2">
            <p className="text-lg font-medium">What would you like to know?</p>
            <div className="text-sm space-y-1">
              <p>"How am I connected to Elena Vasquez?"</p>
              <p>"When did I last talk to Sarah?"</p>
              <p>"Who do I know at Google?"</p>
              <p>"What happened at the tech meetup?"</p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {msg.loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="animate-pulse">Thinking...</div>
                </div>
              ) : (
                <>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.data && msg.data.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <ResultData
                        data={msg.data}
                        dataType={msg.dataType ?? "generic"}
                        onEntityClick={(id) => navigate(`/entities/${id}`)}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t flex gap-2 flex-shrink-0">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          disabled={loading}
          className="flex-1"
        />
        <Button type="submit" disabled={loading || !input.trim()}>
          Ask
        </Button>
      </form>
    </div>
  );
}

function ResultData({
  data,
  dataType,
  onEntityClick,
}: {
  data: Array<Record<string, unknown>>;
  dataType: string;
  onEntityClick: (id: string) => void;
}) {
  if (dataType === "entities") {
    return (
      <div className="flex flex-wrap gap-1.5">
        {data.slice(0, 10).map((r, i) => {
          const name = str(r.identifier_value) || str(r.name) || "Unknown";
          const type = str(r.entity_type) || str(r.type);
          const id = str(r.entity_id);
          return (
            <button
              key={i}
              onClick={() => id && onEntityClick(id)}
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium hover:opacity-80"
              style={{
                backgroundColor: (TYPE_COLORS[type] ?? "#888") + "20",
                color: TYPE_COLORS[type] ?? "#888",
                border: `1px solid ${TYPE_COLORS[type] ?? "#888"}`,
              }}
            >
              {name}
              <span className="opacity-60">{capitalize(type)}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (dataType === "path") {
    const row = data[0] ?? {};
    const path = Array.isArray(row.path) ? (row.path as Array<{ entity_id: string; name: string }>) : [];
    const relTypes = Array.isArray(row.relation_types) ? (row.relation_types as string[]) : [];
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {path.map((step, i) => (
          <div key={i} className="flex items-center gap-1">
            <button
              onClick={() => onEntityClick(step.entity_id)}
              className="rounded px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary border border-primary/30 hover:opacity-80"
            >
              {step.name}
            </button>
            {i < path.length - 1 && (
              <span className="text-xs text-muted-foreground">—{relTypes[i] ?? "?"}→</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (dataType === "intel") {
    return (
      <div className="space-y-1">
        {data.slice(0, 5).map((r, i) => {
          const d = isRecord(r.data) ? r.data : {};
          const desc = str(d.description) || str(d.content) || str(r.type);
          const date = str(r.occurred_at);
          return (
            <div key={i} className="text-xs border-l-2 border-muted-foreground/30 pl-2">
              {date && <span className="text-muted-foreground">[{date}] </span>}
              {truncate(desc, 100)}
            </div>
          );
        })}
      </div>
    );
  }

  if (dataType === "relations") {
    return (
      <div className="space-y-1">
        {data.slice(0, 10).map((r, i) => (
          <div key={i} className="text-xs">
            <button onClick={() => onEntityClick(str(r.source_id))} className="text-primary hover:underline">
              {str(r.source_name) || "?"}
            </button>
            <span className="text-muted-foreground"> —{str(r.type)}→ </span>
            <button onClick={() => onEntityClick(str(r.target_id))} className="text-primary hover:underline">
              {str(r.target_name) || "?"}
            </button>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
