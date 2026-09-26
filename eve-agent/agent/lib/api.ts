const routes = new Set(["clarify", "search", "optimize"]);

export async function callApi(route: "clarify" | "search" | "optimize", body: unknown) {
  if (!routes.has(route)) throw new Error("Unsupported buying API operation.");
  const base = process.env.JEVGOTIATOR_API_URL;
  const credential = process.env.JEVGOTIATOR_API_KEY;
  if (!base || !credential) throw new Error("The buying API connection is not configured.");
  const url = new URL(base);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("The buying API requires HTTPS.");
  if (url.username || url.password || url.search || url.hash) throw new Error("The buying API URL must not contain credentials, a query, or a fragment.");
  if (route === "optimize" && (body as { action?: unknown })?.action !== "plan") throw new Error("This agent supports planning only. Contact and purchase actions are unavailable.");
  let response: Response;
  try {
    response = await fetch(new URL(`/api/v1/${route}`, url), {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(45000),
      headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
  } catch { throw new Error("The buying API did not respond. No result was confirmed; try the request again after checking the connection."); }
  if (!response.ok) throw new Error(`The buying API rejected this request (HTTP ${response.status}). Review the confirmed brief or run a fresh search.`);
  try { return await response.json() as unknown; }
  catch { throw new Error("The buying API returned an invalid response."); }
}
