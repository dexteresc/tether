import type {
  ClassifiedExtractionResponse,
  EntityResolution,
  EntityResolutionCandidate,
  ClarificationRequest,
  ExtractionRequest,
  HealthResponse,
} from "./types";
import config from "@/lib/config";

/**
 * Maps the API response shape to the frontend types.
 *
 * API returns entity_resolutions/clarification_requests at the top level
 * with field names like `input_reference`, `resolved: bool`, etc.
 * Frontend expects them nested inside `extraction` as `resolutions`/`clarifications`
 * with field names like `entity_ref`, `status: "resolved"|"new"|"ambiguous"`.
 */
function mapApiResponse(
  raw: Record<string, unknown>
): ClassifiedExtractionResponse {
  const apiResolutions = (raw.entity_resolutions ?? []) as Array<
    Record<string, unknown>
  >;
  const apiClarifications = (raw.clarification_requests ?? []) as Array<
    Record<string, unknown>
  >;

  const resolutions: EntityResolution[] = apiResolutions.map((r) => {
    let status: EntityResolution["status"];
    if (r.ambiguous) {
      status = "ambiguous";
    } else if (r.resolved) {
      status = "resolved";
    } else {
      status = "new";
    }

    return {
      entity_ref: r.input_reference as string,
      status,
      resolved_entity_id: (r.resolved_entity_id as string) ?? undefined,
      candidates: ((r.candidates as Array<Record<string, unknown>>) ?? []).map(
        (c) => ({
          entity_id: c.id as string,
          name: c.name as string,
          type: c.type as EntityResolutionCandidate["type"],
          match_score: (c.match_score ?? c.confidence ?? 0) as number,
          reasoning: (c.reasoning ?? "") as string,
        })
      ),
      reasoning: r.reasoning as string,
    };
  });

  const clarifications: ClarificationRequest[] = apiClarifications.map(
    (c) => ({
      question: c.question as string,
      context: c.context as string,
      options: c.options as string[] | undefined,
      related_entities: c.related_entities as string[] | undefined,
    })
  );

  const extraction = raw.extraction as Record<string, unknown>;

  return {
    classification: raw.classification as ClassifiedExtractionResponse["classification"],
    chain_of_thought: raw.chain_of_thought as string,
    extraction: {
      ...(extraction as unknown as ClassifiedExtractionResponse["extraction"]),
      resolutions,
      clarifications,
    },
    sync_results: (raw.sync_results as ClassifiedExtractionResponse["sync_results"]) ?? null,
  };
}

export class LlmClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? config.LLM_SERVICE_URL;
    if (!this.baseUrl) {
      throw new Error("VITE_LLM_SERVICE_URL is not configured");
    }
  }

  async health(): Promise<HealthResponse> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    return response.json();
  }

  async extract(
    request: ExtractionRequest,
    bearerToken?: string
  ): Promise<ClassifiedExtractionResponse> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (request.sync_to_db && bearerToken) {
      headers["Authorization"] = `Bearer ${bearerToken}`;
    }

    const provider = localStorage.getItem("tether_llm_provider") || "local";
    const anthropicApiKey =
      provider === "anthropic"
        ? localStorage.getItem("tether_anthropic_api_key")
        : null;

    const response = await fetch(`${this.baseUrl}/api/extract`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        text: request.text,
        context: request.context ?? null,
        source_code: request.source_code ?? "LLM",
        sync_to_db: request.sync_to_db ?? false,
        anthropic_api_key: anthropicApiKey || undefined,
      }),
    });

    if (!response.ok) {
      const errorText = await response
        .text()
        .catch(() => response.statusText);
      throw new Error(
        `Extraction failed (${response.status}): ${errorText}`
      );
    }

    const raw = await response.json();
    return mapApiResponse(raw);
  }
}

let llmClient: LlmClient | null = null;

export function getLlmClient(): LlmClient {
  if (!llmClient) {
    llmClient = new LlmClient();
  }
  return llmClient;
}
