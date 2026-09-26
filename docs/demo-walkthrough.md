# Two-minute JEVgotiator demo

Status: dashboard/API smoke tests passed on `ecfd8ca`. Eve production `4211660` passed a real three-turn HTTP operator flow: clarify → five search results → plan for option one. The Photon webhook is created and its signing secret stored. The new Activity deployment and real iMessage round trip still need verification. Rehearse this flow before presenting it as live.

## Before presenting

Open [jevgotiator.vercel.app](https://jevgotiator.vercel.app), sign in, and select **Activity**. Use the Photon-registered personal sender to text **+1 (415) 605-7073**. Keep the personal sender number, access code, and credentials off the shared screen and out of the repo. Confirm the feed connects and identifies the test conversation as **Photon iMessage**, not an HTTP operator test.

## Presentation

| Time | Action | What to explain |
| --- | --- | --- |
| 0:00–0:20 | Text: “Find me a Model Y under $35,000 in San Francisco, under 60,000 miles.” | “The buyer starts in iMessage. Eve turns the request into a structured brief.” |
| 0:20–0:40 | Answer clarification if needed, then explicitly confirm Eve's brief. Show the same conversation in Activity. | “The buyer confirms constraints before search. This feed reads durable Eve records and refreshes every three seconds.” |
| 0:40–1:10 | Show the observed search tool, actual filter counts, and numbered results. Open **Inspect this conversation's Jev trace**. | “Code enforces the hard filters. Jev scores buyer fit and maintenance evidence on at most 30 candidates. The trace shows exact questions, returned scores, and the code's final weights.” |
| 1:10–1:35 | Reply “I'm interested in 1 and 3. Prepare a plan.” Use only available positions. | “Selection stays inside this conversation's shortlist. The agent prepares a plan for the selected cars.” |
| 1:35–2:00 | Show the plan appearing in Activity and the reply arriving on the phone. | “These are seller questions and a draft opening message. No seller was contacted, and no purchase happened.” |

Wait for real replies and use the current counts. Do not claim the timing or the earlier 1,000 → 82 → 30 → five result counts are guaranteed for this request.

## Evidence to show

- **Live transport:** the sent iMessage, a Photon-labeled conversation, its corresponding tool events, and the reply visible on the sender's phone. A generated reply in Activity alone does not prove delivery.
- **Live inference:** `ranking.mode: live_jev`, the returned model, real score answers, latency, and usage. `unscored_fallback` means Jev scoring did not complete.
- **Fixture inventory:** all 1,000 bundled cars are synthetic and remain labeled. Live Jev inference does not make them real listings.
- **Planning:** selected-car questions and the opening message are prepared locally. Dara's live negotiation, real catalog, seller quotes, and purchases are not part of the verified flow yet.

If the iMessage or Activity connection fails, switch to the verified dashboard search and call it a dashboard demo. Never substitute a stored HTTP test or another conversation while describing a live Photon result.
