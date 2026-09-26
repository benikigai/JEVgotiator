import { defineAgent } from "eve";

export default defineAgent({
  model: "openai/gpt-4.1-mini",
  defaultTools: false,
  limits: { maxInputTokensPerSession: 100000, maxOutputTokensPerSession: 10000 },
});
