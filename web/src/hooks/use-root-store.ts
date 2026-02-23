import { useContext } from "react";
import type { RootStore } from "@/stores/RootStore";
import { RootStoreContext } from "@/stores/RootStoreContext";

export function useRootStore(): RootStore {
  const store = useContext(RootStoreContext);
  if (!store)
    throw new Error(
      "useRootStore must be used within RootStoreProvider"
    );
  return store;
}
