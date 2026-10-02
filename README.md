# Personal portfolio — GitHub + Cloudflare

Next.js App Router, TypeScript, Tailwind, Recharts, OpenNext, one Cloudflare Worker, direct D1 SQL and Twelve Data. There is no PostgreSQL, Prisma, Vercel, always-running server, queue or Redis. The same Worker handles HTTP and cron. Dynamic pages avoid introducing an external Next.js cache.

## First-time local setup

Install Node.js 22.13 (or newer), npm and Git. From this repository directory:

```sh
npm ci
cp .dev.vars.example .dev.vars
npm run db:migrate
npm run db:seed
npm run dev
```

Edit `.dev.vars`: set `TWELVE_DATA_API_KEY`, `CRON_SECRET` (at least 32 characters; generate with `openssl rand -hex 32`) and `ADMIN_PASSWORD` (at least 16 characters). Open http://localhost:3000 and log in. `.env.example` documents the same secret names; Wrangler uses `.dev.vars` for local bindings. Never use a `NEXT_PUBLIC_` prefix for secrets. Local migrations, seed and the development app share `.wrangler/state`; keep commands in the repository root. No Cloudflare login or remote database is needed for local D1.

The demo seed contains synthetic September 2026 AAPL prices; never seed production. Remove demo rows before using real data. `.env.local`, all environment files except examples, `.dev.vars`, build output and local database files are ignored by Git.

```sh
npm test
npm run typecheck
npm run sync
npm run recalculate -- 2026-09-30
npm run db -- --command "SELECT * FROM portfolio_daily ORDER BY date"
npm run preview
```

`sync` calls the authenticated local endpoint while `dev` is running. `recalculate` uses cached exact-date prices and never calls the provider. `preview` builds and runs the real Workers runtime on port 8787; set `APP_URL=http://localhost:8787` for the admin scripts. Next's development server is a local tool only.

## Transactions and valuation

Transactions are the source of truth. Log in and use **添加交易** to select a stock/ETF or crypto, enter its ticker (e.g. `AAPL` or `BTC/USD`), quantity in units and trade date. BUY increases holdings; SELL reduces them. Click **同步最新价格** to fetch closes and calculate net worth. The chart accumulates one point per successful daily sync; it does not fabricate missing history. The write API requires an admin session. For maintenance, you can also use Wrangler D1 commands, inserting the asset type first:

```sh
npm run db -- --command "INSERT INTO assets(ticker,kind) VALUES('MSFT','stock')"
npm run db -- --command "INSERT INTO transactions(id,ticker,transaction_date,type,quantity_delta) VALUES('buy-001','MSFT','2026-09-30','BUY','2.5')"
```

Use uppercase Twelve Data symbols for US USD equities/ETFs. BUY is positive, SELL negative; ADJUSTMENT represents transfers or split share changes. Dates are trade dates, in `YYYY-MM-DD`. Include opening holdings as transactions. Do not use current holdings for past dates. Values exclude cash, fees, dividends and total-return performance. Short positions are rejected. Unadjusted closes (`adjust=none`) are paired with actual shares; enter split adjustments on their effective dates. Decimal strings preserve quantity/price precision; totals round to cents only at the end.

D1 triggers invalidate all portfolio values affected by transaction edits. Recalculate each affected date after editing; missing cached prices fail rather than silently valuing a holding at zero. This starter syncs the latest date, not historical backfills: historical prices must be imported into `daily_prices` with the same unadjusted convention before recalculating those dates. The dashboard only charts stored dates and does not fabricate missing days. A revision counter rejects the entire write batch if transactions changed during valuation; retry the operation after editing completes.

## Deploy for the first time

1. **Create GitHub repository.** In GitHub, create an empty repository (private is recommended for a personal tracker; no generated README). This project already has a Git repository on branch `main`; after cloning Git initialization is unnecessary.

   ```sh
   git status --short
   git add .
   git diff --cached --stat
   git commit -m "Set up Cloudflare portfolio tracker"
   git remote add origin https://github.com/YOUR_USER/YOUR_REPOSITORY.git
   git push -u origin main
   ```

   Inspect staged content before committing; never commit real keys, tokens, `.env.local`, `.dev.vars`, database exports or credentials. GitHub CI runs tests, typechecking and the Worker build without market credentials.

2. **Log in to Cloudflare and create D1.**

   ```sh
   npx wrangler login
   npx wrangler d1 create portfolio
   ```

   Copy the returned database ID into `wrangler.jsonc`, replacing the all-zero placeholder. `DB` is the application's binding name. A D1 database ID is an identifier, not a password; D1 access is granted through the Worker binding. If renaming the database or Worker, update the config and npm scripts consistently.

3. **Apply production schema.**

   ```sh
   npm run db:migrate:remote
   ```

   Do not run demo seeds remotely. Add real transactions using `npx wrangler d1 execute portfolio --remote --command "..."` or the Cloudflare D1 console. Migrations are tracked by Wrangler and repeat safely.

4. **Create the Worker application.** In Cloudflare Workers & Pages, create a Worker named `personal-portfolio` (matching Wrangler); deploy the initial dashboard placeholder if required. This uses Workers, not the legacy Next.js Pages adapter.

5. **Set production runtime secrets before deploying the app.**

   ```sh
   npx wrangler secret put TWELVE_DATA_API_KEY
   npx wrangler secret put CRON_SECRET
   npx wrangler secret put ADMIN_PASSWORD
   ```

   Paste values at the prompts. Use a different strong production `CRON_SECRET`. Alternatively add encrypted secrets under Worker Settings → Variables and Secrets. These are runtime secrets, not browser variables or GitHub source files. `EOD_READY_UTC_HOUR=23` is a nonsecret Wrangler variable.

6. **Connect GitHub.** In the Worker's Settings → Builds, connect your GitHub account, select the repository and production branch `main`, root directory `/`. Save the updated database ID in Git and push it. Set Node version 22, build command `npm run build:worker`, deploy command `npm run deploy:ci`. Cloudflare installs dependencies from the lockfile. The deployment command applies remote migrations before deploying the generated Worker. Give the build's deployment token D1 edit and Workers deployment permission for this account if not already granted. Keep deployment credentials in Cloudflare's build settings.

   Disable non-production branch deployments for this simple setup; previews must not bind production D1 or run its cron. For previews later, create a separate database and environment. Configure GitHub branch protection to require the Checks workflow before merging to `main`.

7. **Deploy.** Trigger the Cloudflare build or push a commit. For an initial CLI deployment or recovery, run `npm run deploy` after remote migrations. The custom `worker.ts` forwards HTTP to OpenNext and exports the scheduled handler. The build must complete before Wrangler can resolve the generated module.

8. **Verify D1 binding and cron.** In Worker Settings → Bindings, confirm `DB` points to `portfolio`. Settings → Trigger Events should show `30 0 * * *`. The daily `00:30 UTC` schedule is 20:30 EDT / 19:30 EST on the previous US calendar date, leaving 4½ / 3½ hours after the regular close. It also follows the completed UTC crypto day. Exact-date provider data is still validated. Stock-only portfolios skip holidays and weekends; crypto portfolios continue daily.

9. **Verify the site.** Open the deployed `workers.dev` URL. The first page should show only the administrator password form; a private browser window must not show holdings or net worth. Log in, add a real holding, click **同步最新价格**, and check the holding and chart. The password stays on the server; sessions use an HttpOnly, Secure, SameSite cookie. You can also add Cloudflare Access for another security layer. API maintenance endpoints retain bearer-secret access.

10. **Verify EOD sync.** From a trusted shell, supply the production secret without saving it in source:

   ```sh
   read -s CRON_SECRET
   export CRON_SECRET
   curl --fail-with-body -X POST https://YOUR_WORKER.workers.dev/api/admin/sync -H "Authorization: Bearer $CRON_SECRET"
   unset CRON_SECRET
   npx wrangler d1 execute portfolio --remote --command "SELECT * FROM portfolio_daily ORDER BY date DESC LIMIT 5"
   npx wrangler tail
   ```

   A request without a bearer secret must return 401. Repeat a successful sync: row counts for that date must stay unchanged. In Cloudflare's logs / scheduled events, confirm the next actual cron run succeeds. Manual HTTP sync verifies the shared job; it does not prove scheduler delivery. If using Access, use its login/service-token mechanism as well.

11. **Normal workflow:** local development → test/typecheck → git commit → push/merge to GitHub `main` → Cloudflare build → D1 migrations → Worker deployment. No Twelve Data secret is needed during the build.

## EOD behavior and recovery

The calendar uses the NYSE's published 2026–2028 holiday dates in `src/calendar.ts`; review it annually and add extraordinary closures as announced. Unsupported years fail closed. Cron runs daily: stock-only portfolios skip closed market days, while crypto portfolios continue. Manual sync uses the latest completed US trading session for stocks and the latest completed UTC day for crypto; the current-day value is an estimate from those closes.

The job fetches every ticker used through that date, including closed positions, verifies the returned date, symbol, USD currency and positive close, computes historical holdings, then atomically upserts all prices and the total using D1 batch. Repeats update the same unique keys and can incorporate provider corrections. If any ticker fails, no partial portfolio value is published. Requests are sequential, spaced approximately eight seconds apart; inspect your Twelve Data plan's credit limits. Large portfolios, delisted instruments and missing historical data may require manual data maintenance. No automatic retry queue is used. Check failed scheduled events and run manual sync after delayed data becomes available; a missed older date needs explicit historical import and recalculation.

For cached-date recalculation in production, POST `{"date":"2026-09-30"}` as JSON to `/api/admin/recalculate` with the same bearer header. This never requests a new quote.

To exercise the actual local scheduled handler after `npm run preview`:

```sh
curl 'http://localhost:8787/__scheduled?cron=30+0+*+*+*'
```

This invokes with the current time and local secrets/database. On closed days it should skip. Run on an eligible evening to verify a real fetch. Tests use fixed clocks for holiday, weekend and cutoff cases.

## Operations and limits

The schema uses unique `(ticker,date)` prices and unique portfolio dates. `created_at` remains stable on upsert; portfolio `updated_at` changes on recalculation. D1 has no exposed database password. Keep migrations additive/backward-compatible for deployment; back up D1 before destructive changes. Reverting Worker code does not reverse a migration.

Watch Cloudflare Worker/D1 usage and Twelve Data credits. This is designed for small portfolios, but OpenNext bundle size and runtime limits may require a paid Workers plan; zero cost is not guaranteed. Check build/deployment size and account limits before production. No real account resources are created by checking out this repository.

## References

- [OpenNext custom Workers and scheduled handlers](https://opennext.js.org/cloudflare/howtos/custom-worker)
- [OpenNext Cloudflare setup](https://opennext.js.org/cloudflare/get-started)
- [Cloudflare Git builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Twelve Data API](https://twelvedata.com/docs)
- [NYSE holidays and trading hours](https://www.nyse.com/trade/hours-calendars)
