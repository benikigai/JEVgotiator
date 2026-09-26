# dara-sample · AutoMuse

An interactive JEVathon demo: a Tesla finder that shows a clearly synthetic buyer profile, five ranked vehicle choices, condition evidence, and controls for re-ranking the matches.

## Live inventory

`api/listings.js` is a Vercel serverless function. It queries MarketCheck on the server and returns only the listing fields the dashboard needs. The browser never receives the MarketCheck key.

Set `MARKETCHECK_API_KEY` in your Vercel project's environment settings, then deploy this directory. For a local Vercel preview, add the same variable to an untracked `.env.local` file and run `vercel dev` from this directory.

Without the API route, the dashboard keeps working with clearly marked synthetic listings. A live MarketCheck listing can show price, mileage, photos, seller, and title-history hints; it cannot prove battery condition, accident history, or hidden damage. The code therefore marks all live vehicles `INSPECT` until verified evidence is available.
