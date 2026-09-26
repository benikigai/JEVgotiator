import { defineTool } from "eve/tools";
import { z } from "zod";
import { callApi } from "../lib/api";
import { planRequest, positionsSchema, planResponseSchema } from "../lib/contracts";
import { searchState } from "../lib/state";

export default defineTool({
  description: "Prepare questions and a nonbinding outreach draft for 1–3 positions from this conversation's latest shortlist. Includes a labeled negotiation simulation for synthetic listings only. Never contacts a seller or purchases anything.",
  availableInSubagents: false,
  inputSchema: z.object({ positions: positionsSchema }),
  async execute({ positions }) {
    const request = planRequest(searchState.get().snapshot, positions);
    const result = planResponseSchema.parse(await callApi("optimize", request));
    return { ...result, seller_contacted: false, purchase_authorized: false };
  },
});
