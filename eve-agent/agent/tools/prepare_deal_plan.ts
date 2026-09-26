import { defineTool } from "eve/tools";
import { z } from "zod";
import { callApi } from "../lib/api";
import { planRequest, positionsSchema } from "../lib/contracts";
import { searchState } from "../lib/state";

export default defineTool({
  description: "Prepare questions and a nonbinding outreach draft for 1–3 positions from this conversation's latest shortlist. Never contacts a seller or purchases anything.",
  availableInSubagents: false,
  inputSchema: z.object({ positions: positionsSchema }),
  async execute({ positions }) {
    const request = planRequest(searchState.get().snapshot, positions);
    const result = z.object({
      id: z.string(), mode: z.literal("planning"), status: z.string(), summary: z.string(),
      plans: z.array(z.object({ listing_id: z.string(), title: z.string(), asking_price: z.number().nullable(), target_price: z.null(), questions: z.array(z.string()), opening_message: z.string() })),
      warning: z.string().nullable(),
    }).parse(await callApi("optimize", request));
    return { ...result, seller_contacted: false, purchase_authorized: false };
  },
});
