# GEMINI.md — StakePod Project Context

This file is persistent context for the coding agent. Read this before every session. Follow the hard rules exactly — they are not suggestions.

---

## Project

**Name:** StakePod
**One-liner:** Small accountability pods (3–5 people) pledge a money stake toward a shared habit goal. Daily check-ins are tracked; anyone who fails check-ins forfeits part or all of their stake to the members who succeeded.
**Full spec:** see `docs/PRD.md` in this repo — always defer to it for feature detail, data model, and business logic. This file is a summary + rules, not a replacement.

---

## Tech Stack (do not substitute without asking)

- **Frontend:** React (Vite) + TanStack Router + Tailwind CSS
- **Backend:** Express.js (REST API)
- **Database / Auth / Storage:** Supabase (Postgres, Supabase Auth, Supabase Storage for optional check-in photos)
- **Payments:** Stripe — **test mode only**, never live keys
- **Scheduling:** node-cron inside the Express server (or Supabase Edge Functions + pg_cron if simpler — ask before switching)
- **Language:** TypeScript on both frontend and backend

---

## Hard Rules (never break these without explicit confirmation from me)

1. **Never use real payment credentials.** Stripe must always run in test mode. If you ever see a live key format, stop and flag it instead of using it.
2. **Every Supabase table must have Row Level Security (RLS) enabled.** No table ships without RLS policies restricting access to a user's own data / their pod's data.
3. **Never touch payment or payout logic silently.** If a task involves `ledger`, `pod_members.stake_status`, or payout calculations, show me the diff and explain the logic in plain English before I approve it.
4. **The ledger table is append-only.** Never write code that updates or deletes ledger rows — only inserts. Corrections happen via new offsetting rows, never edits.
5. **Don't touch files outside the scope of the current task.** If a fix requires editing something unrelated, tell me first instead of doing it silently.
6. **No new dependencies without asking.** If a task seems to need a new npm package, ask before installing it.
7. **Write tests for time/date logic.** Check-in window validation and cron-based auto-fail logic must include test cases for: on-time check-in, late check-in, timezone edge cases, and the exact boundary of the window.
8. **One phase at a time.** Do not attempt to build multiple features across frontend + backend + payments in a single pass. Follow the build order below.

---

## Build Order (follow sequentially — do not skip ahead)

1. Project scaffold only (folder structure, configs, env files, no business logic)
2. Supabase schema + RLS policies + auth flow
3. Pod creation + join-via-link flow (backend routes, then UI)
4. Stripe test-mode stake pledge flow
5. Check-in logic + scheduled auto-fail cron job
6. Payout/forfeit calculation engine (see formula below)
7. Dashboard UI (contribution grid, pod status, pot size)

---

## Core Data Model (summary — full detail in PRD Section 7.1)

```
users            (id, email, name, created_at)
pods             (id, name, goal, stake_amount, currency, frequency,
                  check_in_window_start, check_in_window_end,
                  cycle_start, cycle_end, total_check_ins,
                  free_strikes, failure_threshold_pct, split_type,
                  status, created_by)
pod_members      (id, pod_id, user_id, stake_paid, stake_status, joined_at)
check_ins        (id, pod_id, user_id, date, status[pending/success/failed],
                  note, photo_url, checked_at)
ledger           (id, pod_id, user_id, type[stake/forfeit/payout], amount, created_at)
```

---

## Payout / Forfeit Formula (must match exactly — see PRD Section 4.5)

- `per_day_value = stake_amount / total_check_ins`
- Each member gets `free_strikes` penalty-free misses (default: 2)
- Misses beyond free strikes forfeit `per_day_value` per missed day into the pot
- If total misses exceed `failure_threshold_pct` (default: 50%) of check-ins, the member's **entire remaining stake** is forfeited, not just per-day amounts
- At cycle end, the forfeited pool is distributed among members who stayed under the failure threshold, per `split_type` (`equal` or `pro_rata` by stake)

---

## What "done" looks like for each phase

Before moving to the next build-order phase, the current phase must:
- Run without errors locally
- Have at least one passing test for its core logic (where applicable)
- Be committed to git with a clear commit message

Do not proceed to the next phase until I've confirmed the current one.
