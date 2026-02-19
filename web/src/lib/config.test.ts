import { describe, it, expect } from "vitest";
import config from "./config";

describe("config", () => {
  it("should have API_BASE_URL defaulting to /api", () => {
    expect(config.API_BASE_URL).toBe("/api");
  });

  it("should be an object with expected keys", () => {
    expect(config).toHaveProperty("API_BASE_URL");
    expect(typeof config.API_BASE_URL).toBe("string");
  });
});
