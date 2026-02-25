import { useEffect, useState } from "react";
import { useRootStore } from "@/hooks/use-root-store";

export interface EntityNameEntry {
  name: string;
  type: string;
}

export function useEntityNames(): Map<string, EntityNameEntry> {
  const { replica } = useRootStore();
  const [nameMap, setNameMap] = useState<Map<string, EntityNameEntry>>(new Map());

  useEffect(() => {
    async function load() {
      const entities = await replica.listByUpdatedAt("entities", 10000);
      const identifiers = await replica.listByUpdatedAt("identifiers", 50000);

      const idNameMap = new Map<string, string>();
      for (const id of identifiers) {
        if (id.type === "name" && !idNameMap.has(id.entity_id)) {
          idNameMap.set(id.entity_id, id.value);
        }
      }

      const map = new Map<string, EntityNameEntry>();
      for (const entity of entities) {
        let name = idNameMap.get(entity.id);

        if (
          !name &&
          entity.data &&
          typeof entity.data === "object" &&
          !Array.isArray(entity.data)
        ) {
          const dataName = (entity.data as Record<string, unknown>).name;
          if (typeof dataName === "string") {
            name = dataName;
          }
        }

        if (!name) {
          name = entity.id.slice(0, 8) + "...";
        }

        map.set(entity.id, { name, type: entity.type });
      }
      setNameMap(map);
    }
    load();
  }, [replica]);

  return nameMap;
}
