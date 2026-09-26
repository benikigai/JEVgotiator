import { defineTool } from "eve/tools";
import { z } from "zod";
import { callApi } from "../lib/api";

export default defineTool({
  description: "Extract a draft Tesla buying brief. Ask the buyer to confirm budget basis, model, and missing material constraints before searching.",
  availableInSubagents: false,
  inputSchema: z.object({ text: z.string().min(5).max(2000) }),
  async execute({ text }) {
    return z.object({ draft: z.record(z.string(), z.unknown()), questions: z.array(z.string().nullable()), mode: z.string(), scope: z.string(), warning: z.string().nullable() }).parse(await callApi("clarify", { text }));
  },
});
