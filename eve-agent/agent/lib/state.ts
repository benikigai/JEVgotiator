import { defineState } from "eve/context";
import type { SearchSnapshot } from "./contracts";

// The framework handle is shared; its value belongs to the active durable Eve session.
export const searchState = defineState("jevgotiator.search.v1", () => ({ snapshot: null as SearchSnapshot | null }));
