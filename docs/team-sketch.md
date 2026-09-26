# Team sketch interpretation

Source: Ben's handwritten notes shared September 26, 2026. This is a sanitized interpretation, not a verbatim transcription. The original image includes personal contact details and is not included in the repository.

## Intended flow

1. A client agent or Photon iMessage sends a buyer request to the API.
2. Clarification turns the request into a structured search brief. The example includes a black car; nearby numeric values need labels and units before use.
3. The master database combines retailer listings, Facebook Marketplace and local car dealers. The top retailer name is unclear.
4. Filter 1 applies basic search criteria. Filter 2 uses Jev to score and rank candidates.
5. Return up to five cars. The buyer selects cars of interest or changes the request. Ben's preceding verbal outline specifies one to three selections.
6. The intelligence/optimization layer handles next steps, seller calls or messages, and pricing negotiation within approved scope.
7. Return the negotiated prices to the buyer. The buyer chooses the final car, then confirms purchase terms before execution. Purchase and follow-up are the eventual product direction; the initial demo stops at a purchase handoff.

## Data mapping

| Sketch item | Canonical field |
| --- | --- |
| Mileage | `CarListing.mileage_miles` |
| Make, model, year | `make`, `model`, `year` |
| Black car example | `exterior_color`; buyer `required.exterior_colors` or a soft preference |
| Photos | `photos[]` |
| Accident history; label appears to be CARFAX | `history.accident_status`, `history.history_reports[]`, and evidence |
| Location | `location` |
| Price | `price.advertised_price_cents`; final negotiated totals belong to applicable quotes |
| Seller/dealer details | `seller`, restricted contact record and source evidence |
| Source | `source.provider`, `source.listing_id`, `source.url` |
| Required timeline | Buyer `needed_by`, separately from seller `availability.available_from` |

Maintenance remains in the contract because Ben explicitly included it in the verbal outline, even though it is not clearly separate in the handwritten list.

## Unresolved handwriting

- Do not infer a required candidate count from the intermediate number beside Filter 1. The spec's 30-candidate cap is a proposed demo limit, not a requirement from the sketch.
- Do not turn the unlabeled request numbers into a budget, mileage cap, or year.
- Confirm the retailer name before naming or implementing that source adapter.
- The history label appears to say CARFAX. This does not establish report access or verified vehicle history.

The sketch supplies product context, not permission to contact teammates, sellers, or spend money. No contact details from the image are copied here.
