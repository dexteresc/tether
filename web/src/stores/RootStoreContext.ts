import { createContext } from "react";
import type { RootStore } from "./RootStore";

export const RootStoreContext = createContext<RootStore | null>(null);
