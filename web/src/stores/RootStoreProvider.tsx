import type { PropsWithChildren } from "react";
import type { RootStore } from "./RootStore";
import { RootStoreContext } from "./RootStoreContext";

export function RootStoreProvider({
  store,
  children,
}: PropsWithChildren<{ store: RootStore }>) {
  return (
    <RootStoreContext.Provider value={store}>
      {children}
    </RootStoreContext.Provider>
  );
}
