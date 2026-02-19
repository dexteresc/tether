import { describe, it, expect, beforeEach } from "vitest";
import type { Entity, Intel } from "@/types/models";
import {
  entityStore,
  intelStore,
  clearAllStores,
  deleteDatabase,
} from "./indexeddb";

const makeEntity = (overrides: Partial<Entity> = {}): Entity => ({
  id: "entity-1",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  type: "person",
  ...overrides,
});

const makeIntel = (overrides: Partial<Intel> = {}): Intel => ({
  id: "intel-1",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  type: "event",
  title: "Test Intel",
  content: "Some intelligence content",
  classification: "confidential",
  entityIds: ["entity-1"],
  ...overrides,
});

describe("IndexedDB Storage", () => {
  beforeEach(async () => {
    await deleteDatabase();
  });

  describe("entityStore", () => {
    it("should store and retrieve an entity", async () => {
      const entity = makeEntity();
      await entityStore.put(entity);

      const result = await entityStore.getById("entity-1");
      expect(result).toEqual(entity);
    });

    it("should return undefined for non-existent entity", async () => {
      const result = await entityStore.getById("nonexistent");
      expect(result).toBeUndefined();
    });

    it("should retrieve all entities", async () => {
      const entities = [
        makeEntity({ id: "e1", type: "person" }),
        makeEntity({ id: "e2", type: "organization" }),
        makeEntity({ id: "e3", type: "vehicle" }),
      ];
      await entityStore.putMany(entities);

      const results = await entityStore.getAll();
      expect(results).toHaveLength(3);
      expect(results.map((e) => e.id).sort()).toEqual(["e1", "e2", "e3"]);
    });

    it("should filter entities by type", async () => {
      await entityStore.putMany([
        makeEntity({ id: "p1", type: "person" }),
        makeEntity({ id: "p2", type: "person" }),
        makeEntity({ id: "o1", type: "organization" }),
      ]);

      const people = await entityStore.getByType("person");
      expect(people).toHaveLength(2);
      expect(people.every((e) => e.type === "person")).toBe(true);

      const orgs = await entityStore.getByType("organization");
      expect(orgs).toHaveLength(1);
      expect(orgs[0].id).toBe("o1");
    });

    it("should update an existing entity via put", async () => {
      const entity = makeEntity({ id: "e1", type: "person" });
      await entityStore.put(entity);

      const updated = makeEntity({
        id: "e1",
        type: "person",
        data: { name: "Updated" },
      });
      await entityStore.put(updated);

      const result = await entityStore.getById("e1");
      expect(result?.data).toEqual({ name: "Updated" });

      const all = await entityStore.getAll();
      expect(all).toHaveLength(1);
    });

    it("should delete an entity", async () => {
      await entityStore.put(makeEntity({ id: "e1" }));
      await entityStore.put(makeEntity({ id: "e2" }));

      await entityStore.delete("e1");

      const result = await entityStore.getById("e1");
      expect(result).toBeUndefined();

      const remaining = await entityStore.getAll();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe("e2");
    });

    it("should clear all entities", async () => {
      await entityStore.putMany([
        makeEntity({ id: "e1" }),
        makeEntity({ id: "e2" }),
        makeEntity({ id: "e3" }),
      ]);

      await entityStore.clear();

      const results = await entityStore.getAll();
      expect(results).toHaveLength(0);
    });

    it("should handle putMany with empty array", async () => {
      await entityStore.putMany([]);
      const results = await entityStore.getAll();
      expect(results).toHaveLength(0);
    });

    it("should handle all entity types", async () => {
      const types: Entity["type"][] = [
        "person",
        "organization",
        "vehicle",
        "location",
        "group",
      ];

      for (const type of types) {
        await entityStore.put(makeEntity({ id: `entity-${type}`, type }));
      }

      for (const type of types) {
        const results = await entityStore.getByType(type);
        expect(results).toHaveLength(1);
        expect(results[0].type).toBe(type);
      }
    });
  });

  describe("intelStore", () => {
    it("should store and retrieve intel", async () => {
      const intel = makeIntel();
      await intelStore.put(intel);

      const result = await intelStore.getById("intel-1");
      expect(result).toEqual(intel);
    });

    it("should return undefined for non-existent intel", async () => {
      const result = await intelStore.getById("nonexistent");
      expect(result).toBeUndefined();
    });

    it("should retrieve all intel items", async () => {
      const items = [
        makeIntel({ id: "i1", type: "event" }),
        makeIntel({ id: "i2", type: "sighting" }),
        makeIntel({ id: "i3", type: "communication" }),
      ];
      await intelStore.putMany(items);

      const results = await intelStore.getAll();
      expect(results).toHaveLength(3);
    });

    it("should filter intel by type", async () => {
      await intelStore.putMany([
        makeIntel({ id: "i1", type: "event" }),
        makeIntel({ id: "i2", type: "event" }),
        makeIntel({ id: "i3", type: "sighting" }),
      ]);

      const events = await intelStore.getByType("event");
      expect(events).toHaveLength(2);

      const sightings = await intelStore.getByType("sighting");
      expect(sightings).toHaveLength(1);
    });

    it("should filter intel by classification", async () => {
      await intelStore.putMany([
        makeIntel({ id: "i1", classification: "public" }),
        makeIntel({ id: "i2", classification: "confidential" }),
        makeIntel({ id: "i3", classification: "secret" }),
        makeIntel({ id: "i4", classification: "top-secret" }),
      ]);

      const publicItems = await intelStore.getByClassification("public");
      expect(publicItems).toHaveLength(1);
      expect(publicItems[0].id).toBe("i1");

      const secret = await intelStore.getByClassification("secret");
      expect(secret).toHaveLength(1);
      expect(secret[0].id).toBe("i3");
    });

    it("should update existing intel via put", async () => {
      await intelStore.put(makeIntel({ id: "i1", title: "Original" }));
      await intelStore.put(makeIntel({ id: "i1", title: "Updated" }));

      const result = await intelStore.getById("i1");
      expect(result?.title).toBe("Updated");

      const all = await intelStore.getAll();
      expect(all).toHaveLength(1);
    });

    it("should delete intel", async () => {
      await intelStore.put(makeIntel({ id: "i1" }));
      await intelStore.put(makeIntel({ id: "i2" }));

      await intelStore.delete("i1");

      const result = await intelStore.getById("i1");
      expect(result).toBeUndefined();

      const remaining = await intelStore.getAll();
      expect(remaining).toHaveLength(1);
    });

    it("should clear all intel", async () => {
      await intelStore.putMany([
        makeIntel({ id: "i1" }),
        makeIntel({ id: "i2" }),
      ]);

      await intelStore.clear();

      const results = await intelStore.getAll();
      expect(results).toHaveLength(0);
    });
  });

  describe("clearAllStores", () => {
    it("should clear both entity and intel stores", async () => {
      await entityStore.putMany([
        makeEntity({ id: "e1" }),
        makeEntity({ id: "e2" }),
      ]);
      await intelStore.putMany([
        makeIntel({ id: "i1" }),
        makeIntel({ id: "i2" }),
      ]);

      await clearAllStores();

      const entities = await entityStore.getAll();
      const intel = await intelStore.getAll();
      expect(entities).toHaveLength(0);
      expect(intel).toHaveLength(0);
    });
  });

  describe("deleteDatabase", () => {
    it("should delete the database and allow recreation", async () => {
      await entityStore.put(makeEntity({ id: "e1" }));

      await deleteDatabase();

      // After deletion, a new DB is created on next access
      const results = await entityStore.getAll();
      expect(results).toHaveLength(0);

      // Can still write to the recreated DB
      await entityStore.put(makeEntity({ id: "e2" }));
      const result = await entityStore.getById("e2");
      expect(result?.id).toBe("e2");
    });
  });
});
