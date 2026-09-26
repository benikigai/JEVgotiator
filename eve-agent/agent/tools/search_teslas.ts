import { defineTool } from "eve/tools";
import { z } from "zod";
import { callApi } from "../lib/api";
import { briefSchema, publicSearch, searchResponseSchema } from "../lib/contracts";
import { searchState } from "../lib/state";

export default defineTool({
  description: "Search a buyer-confirmed Tesla brief in San Francisco. Saves this conversation's numbered shortlist privately. Do not search before the buyer confirms the interpreted brief.",
  availableInSubagents: false,
  inputSchema: z.object({ brief: briefSchema, buyer_confirmed: z.literal(true) }),
  async execute({ brief }) {
    // Clear the prior mapping so failed searches cannot leave a stale shortlist active.
    searchState.update(() => ({ snapshot: null }));
    const snapshot = searchResponseSchema.parse(await callApi("search", { brief }));
    searchState.update(() => ({ snapshot }));
    return publicSearch(snapshot);
  },
});
