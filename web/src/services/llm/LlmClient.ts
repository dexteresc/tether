import type {
  ClassifiedExtractionResponse,
  ExtractionRequest,
  HealthResponse,
} from "./types";
import config from "@/lib/config";

export class LlmClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? config.LLM_SERVICE_URL;
    if (!this.baseUrl) {
      throw new Error("VITE_LLM_SERVICE_URL is not configured");
    }
  }

  async health(): Promise<HealthResponse> {
    const response = await fetch(`${this.baseUrl}/api/health`);
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

    const response = await fetch(`${this.baseUrl}/api/extract`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        text: request.text,
        context: request.context ?? null,
        source_code: request.source_code ?? "LLM",
        sync_to_db: request.sync_to_db ?? false,
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

    return response.json();
  }
}

let llmClient: LlmClient | null = null;

export function getLlmClient(): LlmClient {
  if (!llmClient) {
    llmClient = new LlmClient();
  }
  return llmClient;
}
