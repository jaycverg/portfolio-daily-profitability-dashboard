# Daily Profitability Dashboard

A daily P&L dashboard for a multi-unit operations business. It turns raw daily financial and operational rows into the numbers an operator actually steers by — gross margin, operating profit, profit per unit, profit per labor hour — and shows them as stat cards, an operating-profit trend, a profit waterfall, per-unit sparklines, and a date-range/unit drill-down. No Docker, no external services, no API keys: clone, seed, and it works.

The signature feature is a **pure, fully unit-tested Daily P&L engine** (`src/lib/profitability.ts`). Every margin, ratio, roll-up, and waterfall is computed by framework-free functions that take plain rows and return plain metrics — so the math is testable in milliseconds and the UI is just a thin renderer over it.

## Features

- **Profitability Overview** — Top-line stat cards (revenue, gross margin, operating profit, profit/unit) with day-over-day deltas, an operating-profit trend chart, a profit waterfall for the latest day, and a per-business-unit table.
- **Daily P&L engine** — Revenue, COGS, gross profit, gross margin %, contribution margin, operating profit, operating margin %, profit-per-unit, and profit-per-labor-hour, computed per day, per business unit, and as a range aggregate.
- **Profit waterfall** — Revenue → COGS → Gross Profit → Opex → Operating Profit, with signed deltas and running totals that always reconcile to operating profit.
- **Inline-SVG charts** — Line/area trend, waterfall, and in-table sparklines. Hand-rolled SVG, zero charting dependencies, fully server-rendered.
- **Drill-down** — Recompute the entire P&L and waterfall for any date range and any (or all) business unit, driven by URL search params.
- **Defensive math** — Every ratio is divide-by-zero safe, so zero-revenue / zero-unit / zero-hour days never produce `NaN` or `Infinity`.
- **Realistic seed** — 90 days × 4 business units (360 financial + 360 operational rows), generated with seasonality, trend, and bounded noise so charts have real texture (peaks, dips, and a few loss-making days).

## Tech Stack

| Category    | Technology                                  |
| ----------- | ------------------------------------------- |
| Framework   | Next.js 15 (App Router) + React 19          |
| Language    | TypeScript 5.7 (strict)                     |
| Database    | SQLite + Prisma 6 ORM                        |
| Styling     | Tailwind CSS 3 (emerald accent)             |
| Icons       | lucide-react                                |
| Validation  | Zod                                         |
| Dates       | date-fns                                    |
| Unit tests  | Vitest (+ @vitest/coverage-v8)              |
| E2E tests   | Playwright (one smoke spec)                 |

## Getting Started

No Docker, no external services, no API keys. A reviewer can run:

```bash
npm install      # installs deps; postinstall runs `prisma generate`
npm run db:push  # create the SQLite schema (dev.db)
npm run db:seed  # 90 days × 4 business units of realistic data
npm run dev      # http://localhost:3000 — works immediately, with seeded data
```

### Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable       | Description                                  |
| -------------- | -------------------------------------------- |
| `DATABASE_URL` | SQLite connection string (`file:./dev.db`)   |

### Other scripts

```bash
npm run test      # vitest — the P&L engine unit suite
npm run build     # production build
npm run test:e2e  # Playwright smoke test (boots dev server, checks seeded render)
npm run db:studio # browse the SQLite data in Prisma Studio
```

## Data Model

Money is stored as **integer cents** throughout to avoid floating-point drift; operational metrics use their natural numeric type. SQLite has no native enums, so "enum-like" fields are modeled as `String`.

- **`BusinessUnit`** — `id`, `name` (unique), `productLine`. The 3–4 operating units (Precision Machining, Consumer Bottling, Custom Packaging, Specialty Coatings).
- **`DailyFinancials`** — one row per `(date, businessUnit)`: `revenueCents`, `cogsCents`, `opexCents`. Unique on `(date, businessUnitId)`, indexed on `date`.
- **`DailyOperations`** — one row per `(date, businessUnit)`: `unitsProduced` (Int), `laborHours` (Float), `utilizationPct` (Float). Same unique/index.

The two daily tables are deliberately split (financial vs. operational) and joined back together by the engine on `(date, businessUnitId)`, mirroring how those two data feeds usually arrive from different systems.

## Architecture — the P&L engine

The whole point of the project is that the numbers live in one pure module, not scattered through React components or SQL.

**`src/lib/profitability.ts`** — pure, framework-free, no Prisma, no React. It takes plain `FinancialRow[]` and `OperationsRow[]` and exposes:

- `computeAggregate(fin, ops)` — one `ProfitMetrics` across every supplied row (top-line stat cards over a range).
- `computeDailyMetrics(fin, ops)` — per-day metrics, collapsing business units within a day, sorted ascending (the trend chart).
- `computeBusinessUnitMetrics(fin, ops)` — per-unit roll-ups sorted by operating profit, each carrying a daily operating-profit series for sparklines.
- `computeWaterfall(metrics)` — Revenue → COGS → Gross Profit → Opex → Operating Profit, with signed deltas, running totals, and total-bar flags.
- `computeDeltaSummary(daily)` — day-over-day deltas (revenue %, gross-margin points, operating-profit %, profit/unit %) with safe `null` handling when history is thin.

Every formula funnels through a single private `metricsFromBucket()` so there is exactly one source of truth for each margin and per-X ratio. `safeRatio()` guarantees no `NaN`/`Infinity` ever escapes.

**`src/lib/metrics.ts`** — the thin data-access seam. It loads Prisma rows, maps them into the engine's plain shapes, and calls the pure functions. Server components (`/`, `/drill-down`) and the route handlers under `src/app/api/*` call these helpers; none of them do margin math themselves.

**Charts** (`src/components/charts/*`) are hand-written inline SVG (area/line, waterfall, sparkline) — no charting library — so they render on the server and stay dependency-light.

### Testing strategy

Because all the math is pure, the unit suite (`src/lib/__tests__/profitability.test.ts`, 12 tests) hits it directly with fixtures: margin math, profit-per-unit / per-labor-hour, utilization averaging, divide-by-zero safety, daily/per-unit roll-ups, sparkline series, waterfall reconciliation, and delta-summary edge cases. The single Playwright smoke spec just confirms the seeded app boots and renders.

## What I'd add next

- **Budget vs. actual & variance** — overlay a budget series and surface variance per unit/day on the waterfall.
- **CSV / API ingestion** — replace the seed with an upload or scheduled pull so it works on real feeds, with Zod-validated row parsing.
- **Anomaly flags** — highlight statistically unusual margin/cost days (z-score on the daily series) instead of leaving the operator to eyeball the chart.
- **Cost driver breakdown** — split COGS and opex into sub-categories to make the waterfall multi-step and more diagnostic.
- **Saved views & export** — shareable drill-down URLs (already param-driven) plus PNG/PDF export of a board-ready summary.
