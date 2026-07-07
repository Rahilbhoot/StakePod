# StakePod 🚀

> **Put your money where your habit is.**

StakePod is a habit-tracking application designed to solve the problem of abandoned trackers. Instead of relying purely on willpower, StakePod uses **loss aversion**. Users form small accountability pods, pledge a small monetary stake, and must check in daily. If they fail to check in, their stake is forfeited and redistributed to the pod members who succeeded. 

---

## 🏁 Current Progress (Completed through Phase 7)

The application has been fully developed through **Phase 7: Dashboard UI & UX Polish**. 
StakePod is now fully functional, transactionally safe, and visually complete with a premium frontend.

### 🟢 Completed Features

1. **Phase 1: Project Setup & DB Schema**
   - Supabase project initialized with PostgreSQL schema.
   - Tables created: `users`, `pods`, `pod_members`, `check_ins`, `ledger`.
   - Core API models and types established.

2. **Phase 2: Authentication & Core Backend**
   - Express server initialized with TypeScript.
   - Supabase Auth integrated (Sign up, Log in, Log out).
   - JWT-based protected backend routes.

3. **Phase 3: Pod Creation & Invites**
   - Endpoints for creating a Pod with habit goals, stake amounts, and cycle durations.
   - Secure, sharable invite links.
   - Ability for users to join pods via invite codes.

4. **Phase 4: Stripe Test-Mode Integration**
   - Stripe Checkout sessions integrated for pledging stakes.
   - Secure webhook listener running to process `checkout.session.completed` events.
   - Atomic database updates upon successful test payment.

5. **Phase 5: Daily Check-In Logic & Auto-Fail Cron**
   - Daily Check-in system using Indian Standard Time (IST) window validations.
   - Node-cron automated background jobs that run at midnight IST.
   - Auto-fail mechanism marks missed check-ins if the user failed to check in during their window.

6. **Phase 6: Forfeit & Payout Calculation Engine**
   - Mathematical payout engine implementing the exact PRD logic:
     - Free strikes allowance.
     - Per-day forfeiture calculations.
     - 50% failure threshold full-forfeit triggers.
   - Atomic `settle_pod_transaction` Supabase RPC to prevent race conditions during cycle payouts.
   - Unit tests written and validated for financial logic.

7. **Phase 7: Premium Dashboard UI & UX Polish**
   - Upgraded to a sleek, modern Glassmorphism dark-mode UI.
   - React router implementation via `@tanstack/react-router`.
   - `framer-motion` integrated for staggered page transitions, micro-animations, and dynamic check-in widget states.
   - `lucide-react` icons and Tailwind CSS utility classes used heavily.
   - **Pod Detail Dashboard** featuring:
     - 30-Day GitHub-style Contribution Grid with tooltips and free-strike indicators.
     - Live countdown check-in widget with 5 states (Not Paid, Before Window, Active, Checked In, Missed).
     - Financial Ledger timeline to track payouts and forfeitures.

---

## 🛠️ Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS (v3), Framer Motion, TanStack Router.
- **Backend:** Node.js, Express, TypeScript.
- **Database / Auth:** Supabase (PostgreSQL, Row Level Security, Auth).
- **Payments:** Stripe (Test Mode).

## 🚀 Running the App Locally

To start the application locally, ensure you have your `.env` files set up with Supabase and Stripe keys.

1. **Start the Backend Server:**
   ```bash
   cd server
   npm install
   npm run dev
   ```

2. **Start the Frontend Client:**
   ```bash
   cd client
   npm install
   npm run dev
   ```

3. **Start the Stripe Webhook Listener:**
   ```bash
   stripe listen --forward-to localhost:5000/webhooks/stripe
   ```

---
*Developed as part of the StakePod Phase 1-7 Build Order.*