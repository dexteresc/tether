import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiClient } from "./client";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve(data),
  };
}

describe("ApiClient", () => {
  let client: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    client = new ApiClient();
  });

  describe("GET requests", () => {
    it("should make a GET request to the correct URL", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ id: "1" }));

      const result = await client.get("/entities");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/entities",
        expect.objectContaining({ method: "GET" })
      );
      expect(result).toEqual({ id: "1" });
    });

    it("should append query parameters", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));

      await client.get("/entities", { type: "person", limit: "10" });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/entities?type=person&limit=10",
        expect.anything()
      );
    });
  });

  describe("POST requests", () => {
    it("should send JSON body", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ id: "1" }));

      await client.post("/entities", { type: "person" });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/entities",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ type: "person" }),
        })
      );
    });

    it("should handle POST without body", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({}));

      await client.post("/auth/logout");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/auth/logout",
        expect.objectContaining({
          method: "POST",
          body: undefined,
        })
      );
    });
  });

  describe("PUT requests", () => {
    it("should send PUT with JSON body", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ id: "1" }));

      await client.put("/entities/1", { type: "organization" });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/entities/1",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ type: "organization" }),
        })
      );
    });
  });

  describe("PATCH requests", () => {
    it("should send PATCH with JSON body", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ id: "1" }));

      await client.patch("/entities/1", { data: { name: "Updated" } });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/entities/1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ data: { name: "Updated" } }),
        })
      );
    });
  });

  describe("DELETE requests", () => {
    it("should send DELETE request", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(undefined));

      await client.delete("/entities/1");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/entities/1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("Authorization", () => {
    it("should include auth token when present in localStorage", async () => {
      localStorage.setItem("authToken", "test-token-123");
      mockFetch.mockResolvedValueOnce(jsonResponse({}));

      await client.get("/auth/me");

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers).toEqual(
        expect.objectContaining({
          Authorization: "Bearer test-token-123",
        })
      );
    });

    it("should not include auth header when no token", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({}));

      await client.get("/auth/me");

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers).not.toHaveProperty("Authorization");
    });
  });

  describe("Error handling", () => {
    it("should throw and remove token on 401", async () => {
      localStorage.setItem("authToken", "expired-token");
      mockFetch.mockResolvedValueOnce(jsonResponse({}, 401));

      await expect(client.get("/auth/me")).rejects.toThrow("Unauthorized");
      expect(localStorage.getItem("authToken")).toBeNull();
    });

    it("should throw with server error message on non-OK response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ message: "Invalid request" }),
      });

      await expect(client.post("/entities", {})).rejects.toThrow(
        "Invalid request"
      );
    });

    it("should throw on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(client.get("/entities")).rejects.toThrow("Network error");
    });
  });
});
