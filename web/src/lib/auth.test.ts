import { describe, it, expect, vi, beforeEach } from "vitest";
import { authApi } from "./auth";

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

describe("authApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("login", () => {
    it("should post credentials and store token", async () => {
      const mockResponse = {
        token: "jwt-token-abc",
        user: { id: "u1", email: "test@test.com", entityId: "e1" },
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(mockResponse));

      const result = await authApi.login({
        email: "test@test.com",
        password: "password123",
      });

      expect(result.token).toBe("jwt-token-abc");
      expect(result.user.email).toBe("test@test.com");
      expect(localStorage.getItem("authToken")).toBe("jwt-token-abc");
    });

    it("should not store token if response has no token", async () => {
      const mockResponse = {
        token: "",
        user: { id: "u1", email: "test@test.com", entityId: "e1" },
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(mockResponse));

      await authApi.login({
        email: "test@test.com",
        password: "password123",
      });

      expect(localStorage.getItem("authToken")).toBeNull();
    });
  });

  describe("logout", () => {
    it("should remove token from localStorage", async () => {
      localStorage.setItem("authToken", "existing-token");
      mockFetch.mockResolvedValueOnce(jsonResponse(undefined));

      await authApi.logout();

      expect(localStorage.getItem("authToken")).toBeNull();
    });

    it("should remove token even if API call fails", async () => {
      localStorage.setItem("authToken", "existing-token");
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ message: "Server error" }),
      });

      // logout uses try/finally, so the error propagates but token is still removed
      await expect(authApi.logout()).rejects.toThrow("Server error");

      expect(localStorage.getItem("authToken")).toBeNull();
    });
  });

  describe("validate", () => {
    it("should return user data", async () => {
      const mockUser = { id: "u1", email: "test@test.com", entityId: "e1" };
      localStorage.setItem("authToken", "valid-token");
      mockFetch.mockResolvedValueOnce(jsonResponse(mockUser));

      const result = await authApi.validate();

      expect(result).toEqual(mockUser);
    });
  });

  describe("refresh", () => {
    it("should update stored token on refresh", async () => {
      localStorage.setItem("authToken", "old-token");
      const mockResponse = {
        token: "new-refreshed-token",
        user: { id: "u1", email: "test@test.com", entityId: "e1" },
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(mockResponse));

      const result = await authApi.refresh();

      expect(result.token).toBe("new-refreshed-token");
      expect(localStorage.getItem("authToken")).toBe("new-refreshed-token");
    });
  });
});
