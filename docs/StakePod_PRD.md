# Product Requirements Document: StakePod

**Tagline:** Put your money where your habit is.
**Version:** 1.0
**Author:** Rahil
**Date:** July 2026
**Status:** Draft — Pre-Development

---

## 1. Problem Statement

Habit trackers fail because there's no real cost to failure. Streaks reset silently, nobody's watching, and quitting is free. StakePod fixes this by putting real (but small, test-mode-safe) money on the line in small accountability pods — if you don't check in, your stake gets redistributed to the people who did. Loss aversion, not willpower, drives retention.

## 2. Goals & Non-Goals

**Goals**
- Let 3–5 people form a pod around a shared goal (e.g., "gym 5x/week," "no smoking," "sleep by 11pm")
- Each member pledges a fixed stake into a pooled pot at pod creation
- Daily/scheduled check-in windows; missed check-in = forfeit stake
- At pod cycle end, forfeited stakes are split among members who completed all check-ins
- Simple, low-friction React UI for daily check-ins

**Non-Goals (v1)**
- No AI-based proof verification (explicitly deferred — see Section 10)
- No real payment gateway in production (Razorpay/Stripe **test mode only**)
- No public/social discovery of pods (invite-only via link/code)
- No mobile app (responsive web only)

## 3. Target User

Early adopters who already track habits but abandon trackers after 1–2 weeks — likely students, freelancers, and small friend/coworker groups (your GDSC/CodeX network is a natural first test cohort).

## 4. Core User Flows

### 4.1 Pod Creation
1. User A creates a pod: sets goal description, check-in frequency (daily/custom days), stake amount, cycle duration (e.g., 21 days), and check-in window (e.g., 6am–11pm).
2. Pod gets an invite link/code.
3. User A automatically becomes first member and must also pledge stake to activate.

### 4.2 Joining a Pod
1. Invitee opens link, sees goal + stake amount + duration.
2. Confirms → redirected to Stripe/Razorpay test-mode checkout → stake recorded.
3. Pod is "active" once 3–5 members have joined and pledged (configurable minimum).

### 4.3 Daily Check-In
1. Within the check-in window, member opens app, hits "Check In" (optionally attaches a text note or photo — stored, not verified in v1).
2. Missed window = check-in marked `failed` automatically via scheduled job.
3. Dashboard shows pod-wide check-in grid (like a GitHub contributions graph) for social visibility/pressure.

### 4.4 Cycle Completion & Payout
1. On cycle end date, a scheduled job tallies each member's completion rate.
2. Members split the pooled forfeited amount from members who failed check-ins, according to the pod's `split_type` and forfeit rules (see Section 4.5).
3. Payout shown in-app as a ledger entry (test-mode; real money movement optional/future).
4. Pod is archived; members can start a new cycle or dissolve.

### 4.5 Forfeit Logic — Per-Day with Strike Threshold (default model)

A missed check-in does **not** automatically forfeit the member's entire stake. Instead:

1. **Stake is divided across total check-ins in the cycle.**
   `per_day_value = stake_amount / total_check_ins`
   e.g. ₹210 stake over a 21-day cycle → ₹10 per check-in.

2. **Free strikes.** Each member gets a configurable number of penalty-free misses (default: 2). Missing a check-in within this allowance costs nothing.

3. **Per-day forfeit after strikes are used up.** From the 3rd miss onward, that day's `per_day_value` is forfeited into the pod's shared pot.

4. **Full-stake forfeit past a failure threshold.** If a member's total misses exceed 50% of check-ins in the cycle, their *entire remaining* stake is forfeited (not just the per-day amounts) — this stops someone from "gaming" the system by treating every miss as a cheap, acceptable loss.

5. **Payout distribution.** At cycle end, the total forfeited pool is split among members who completed 100% of their check-ins (or, alternatively, split pro-rata by each finisher's own stake size — configurable via `split_type`: `equal` vs `pro_rata`).

**Worked example:**
Pod: 4 members, ₹200 stake each, 20-day cycle, 2 free strikes.
- Member A: 0 misses → full finisher.
- Member B: 1 miss → within free strikes, no forfeit.
- Member C: 5 misses → 2 free, 3 penalized at ₹10/day = ₹30 forfeited into pot.
- Member D: 12 misses (>50% of 20 days) → entire remaining stake (₹200 minus whatever's already been check-in-earned, effectively full ₹200) forfeited.
- Pot to distribute: ₹30 (from C) + ₹200 (from D) = ₹230, split between A and B (the two who stayed under the failure threshold) per `split_type`.

This keeps early slip-ups low-stakes (so people don't quit on day 2) while still making sustained failure genuinely costly — which is what drives the loss-aversion effect the product depends on.

## 5. Functional Requirements

| ID | Requirement | Priority |
|----|------------|----------|
| FR1 | User auth (Supabase Auth — email/OTP or Google) | Must |
| FR2 | Create pod with goal, stake, duration, frequency, window | Must |
| FR3 | Join pod via invite link/code | Must |
| FR4 | Stripe/Razorpay test-mode checkout for stake pledge | Must |
| FR5 | Daily check-in action with timestamp validation against window | Must |
| FR6 | Scheduled job to auto-mark missed check-ins | Must |
| FR7 | Pod dashboard: contribution grid, member statuses, pot size | Must |
| FR8 | Cycle-end payout calculation + ledger | Must |
| FR8a | Per-day forfeit calculation with configurable free-strike allowance | Must |
| FR8b | Full-stake forfeit trigger past failure threshold (default: >50% misses) | Must |
| FR8c | Configurable payout split type: equal vs pro-rata by stake | Must |
| FR9 | Optional text/photo attachment on check-in (unverified) | Should |
| FR10 | Email/push notification before check-in window closes | Should |
| FR11 | Pod chat/comments for accountability banter | Could |
| FR12 | Multiple concurrent pods per user | Could |

## 6. Non-Functional Requirements

- **Reliability:** Scheduled check-in evaluation must run with zero missed cycles (cron via Supabase Edge Functions or node-cron on Express server).
- **Security:** No real payment credentials stored; only test-mode tokens. RLS (Row Level Security) enforced on all Supabase tables so users only see their own pods' data.
- **Performance:** Dashboard loads pod state in <1s for pods up to 5 members.
- **Auditability:** Every stake, check-in, and payout event is an immutable ledger row (append-only), not just a status flag — needed for trust and future dispute handling.

## 7. Tech Architecture

**Frontend:** React (Vite), TanStack Router, Tailwind
**Backend:** Express.js (REST API) — handles payout logic, scheduled jobs, webhook receivers for Stripe/Razorpay test mode
**Database/Auth/Storage:** Supabase (Postgres + Auth + Storage for optional check-in photos)
**Scheduling:** node-cron inside Express, or Supabase Edge Functions + pg_cron for check-in window closing and payout triggers
**Payments:** Stripe Test Mode or Razorpay Test Mode (pick one — Stripe has better docs/sandbox for a solo dev)

### 7.1 Core Data Model (Supabase/Postgres)

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

### 7.2 Key Backend Jobs (Express + cron)
1. **Window closer** — runs at each pod's `check_in_window_end`, marks any `pending` check-ins as `failed`.
2. **Cycle settler** — runs at `cycle_end`, computes forfeits vs payouts, writes ledger rows, updates pod status to `completed`.

## 8. Success Metrics (v1)

- % of pod members completing full cycle (target: >40%, vs. typical <10% for free habit apps)
- Average pod size at activation (target: 4)
- Day-7 and Day-21 retention within a pod cycle
- Number of pods that trigger a second cycle (repeat usage signal)

## 9. Risks & Open Questions

- **Cheating on check-ins** — no verification in v1, relies on honor system + peer visibility. Mitigated partially by public contribution grid (social pressure).
- **Real-money legal/compliance concerns** — v1 stays entirely in test-mode sandboxes to avoid handling real transactions, escrow, or regulatory issues (money transmission laws) until validated.
- **Cold-start problem** — pods need 3–5 committed people; solve by seeding with your own GDSC/CodeX network first.
- **Dispute handling** — what if someone claims a check-in failed due to a bug? v1: manual override by pod creator; no automated resolution yet.

## 10. Future Roadmap (Post-AI-Learning)

Once you're through the agentic AI phase of your roadmap, this is the natural extension layer — and it maps directly onto what you're studying (RAG, vision, agents):

| Feature | AI Technique |
|---|---|
| **Proof-of-completion verification** | Vision model (Gemini/Groq multimodal) checks uploaded photo matches goal context (e.g., gym selfie, book page) |
| **Fake check-in detection** | Anomaly detection agent flags suspicious patterns (same photo reused, check-in timing bursts) |
| **Smart nudges** | Agent sends personalized reminder messages based on a member's historical slip patterns |
| **Dispute resolution assistant** | Agent reviews evidence and suggests a ruling to the pod creator instead of blind manual override |
| **Natural language pod creation** | "Create a pod for 5 people to read 20 pages a day for 30 days, ₹200 stake" → agent parses this into the pod config automatically |

This gives you a clean v1 → v2 story for your portfolio: "shipped a working transactional app first, then layered in an agentic verification system" — which is a much stronger narrative than starting AI-first.

## 11. MVP Scope Cut (build this first)

If you want the fastest path to a demo-able product:
1. Auth + pod creation + join via link (FR1–FR3)
2. Stripe test-mode stake pledge (FR4)
3. Manual check-in button + window-based auto-fail (FR5–FR6)
4. Basic dashboard grid (FR7)
5. Cycle-end payout math + ledger (FR8)

Skip notifications, chat, and photo proof for MVP — add those in v1.1.

---

**Next concrete step:** scaffold the Supabase schema (Section 7.1) and Express project structure — want me to generate that now?
