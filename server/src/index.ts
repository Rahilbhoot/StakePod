import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { getISTDate, getISTTimeString, getWindowStatus } from './lib/timeUtils';
import { startAutoFailCron, runStartupCatchup } from './jobs/autoFail';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'dummy_anon';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_service';
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

// Initialize Stripe in test mode (never use live keys in this project)
const stripeSecretKey = process.env.STRIPE_TEST_SECRET_KEY || 'sk_test_placeholder';
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder';
const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-06-24.dahlia' });

// Service role client bypasses RLS (used for administrative tasks like counting members, webhook updates)
const supabaseService = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

// ─── CRITICAL: Stripe webhook route must receive raw body bytes BEFORE any json() middleware
// If express.json() runs first, it consumes and re-parses the body, breaking HMAC verification
app.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;

    let event: Stripe.Event;

    // ── WEBHOOK SIGNATURE VERIFICATION ──────────────────────────────────────
    // Without this, any anonymous HTTP request to /webhooks/stripe with a
    // crafted JSON body (e.g. { type: 'checkout.session.completed', metadata: { user_id: '...' } })
    // would trick our server into marking stake_status = 'paid' for free.
    // stripe.webhooks.constructEvent verifies the HMAC-SHA256 signature
    // Stripe signs every event with your webhook secret — we re-verify it here.
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
    } catch (err: any) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    // ────────────────────────────────────────────────────────────────────────

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const { pod_id, user_id } = session.metadata || {};

      if (!pod_id || !user_id) {
        console.error('Webhook received checkout.session.completed without pod_id/user_id metadata');
        return res.status(400).json({ error: 'Missing metadata' });
      }

      // Fetch the pod to get the stake_amount for the ledger row
      const { data: pod, error: podError } = await supabaseService
        .from('pods')
        .select('stake_amount')
        .eq('id', pod_id)
        .single();

      if (podError || !pod) {
        console.error(`Webhook: pod not found for pod_id=${pod_id}`);
        return res.status(500).json({ error: 'Pod not found' });
      }

      // Update pod_members: stake_status → 'paid', stake_paid → true
      const { error: updateError } = await supabaseService
        .from('pod_members')
        .update({ stake_status: 'paid', stake_paid: true })
        .eq('pod_id', pod_id)
        .eq('user_id', user_id);

      if (updateError) {
        console.error(`Webhook: failed to update pod_members: ${updateError.message}`);
        return res.status(500).json({ error: updateError.message });
      }

      // Write an append-only ledger entry (negative = money going into the pot)
      // Per Hard Rule #4: never update/delete ledger rows, only INSERT
      const { error: ledgerError } = await supabaseService
        .from('ledger')
        .insert({
          pod_id,
          user_id,
          type: 'stake',
          amount: -pod.stake_amount   // negative: funds leaving the member's wallet into the pot
        });

      if (ledgerError) {
        console.error(`Webhook: failed to write ledger row: ${ledgerError.message}`);
        // Don't return 500 here — the pod_members update already succeeded.
        // Log the error and alert; manually reconcile the ledger if needed.
      }

      console.log(`✅ Stake paid: pod=${pod_id} user=${user_id} amount=${pod.stake_amount}`);
    }

    // If checkout is abandoned or payment fails, Stripe fires checkout.session.expired or
    // payment_intent.payment_failed instead. We intentionally leave stake_status as 'pending'
    // in those cases — the user can re-attempt via the pledge button again.
    if (event.type === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session;
      const { pod_id, user_id } = session.metadata || {};
      if (pod_id && user_id) {
        // Explicitly mark as 'abandoned' so the frontend can prompt a retry
        await supabaseService
          .from('pod_members')
          .update({ stake_status: 'abandoned' })
          .eq('pod_id', pod_id)
          .eq('user_id', user_id);
        console.log(`⚠️  Checkout abandoned: pod=${pod_id} user=${user_id}`);
      }
    }

    res.json({ received: true });
  }
);

// Mount JSON middleware AFTER the raw webhook route
app.use(cors());
app.use(express.json());

// Middleware to authenticate user using Supabase JWT and attach user-scoped client
const authenticateUser = async (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  // Create a user-scoped Supabase client that respects RLS
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` }
    },
    auth: { persistSession: false }
  });

  const { data: { user }, error } = await userClient.auth.getUser();

  if (error || !user) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  req.user = user;
  req.token = token;
  req.supabase = userClient;
  next();
};

// Helper to generate a unique random 8-character invite code
const generateInviteCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// 1. POST /pods - Create a new pod
app.post('/pods', authenticateUser, async (req: any, res: Response) => {
  const {
    name,
    goal,
    stake_amount,
    currency = 'INR',
    frequency,
    check_in_window_start,
    check_in_window_end,
    cycle_start,
    cycle_end,
    total_check_ins,
    free_strikes = 2,
    failure_threshold_pct = 50,
    split_type = 'equal'
  } = req.body;

  if (!name || !goal || !stake_amount || !frequency || !check_in_window_start || !check_in_window_end || !cycle_start || !cycle_end || !total_check_ins) {
    return res.status(400).json({ error: 'Missing required pod fields' });
  }

  const inviteCode = generateInviteCode();

  const { data: pod, error: podError } = await req.supabase
    .from('pods')
    .insert({
      name,
      goal,
      stake_amount: parseFloat(stake_amount),
      currency,
      frequency,
      check_in_window_start,
      check_in_window_end,
      cycle_start,
      cycle_end,
      total_check_ins: parseInt(total_check_ins),
      free_strikes: parseInt(free_strikes),
      failure_threshold_pct: parseInt(failure_threshold_pct),
      split_type,
      status: 'pending',
      created_by: req.user.id,
      invite_code: inviteCode
    })
    .select()
    .single();

  if (podError) {
    return res.status(500).json({ error: podError.message });
  }

  // Creator is automatically added as first member — stake still 'pending' until they pledge
  const { error: memberError } = await req.supabase
    .from('pod_members')
    .insert({
      pod_id: pod.id,
      user_id: req.user.id,
      stake_paid: false,
      stake_status: 'pending'
    });

  if (memberError) {
    await supabaseService.from('pods').delete().eq('id', pod.id);
    return res.status(500).json({ error: `Failed to add creator as member: ${memberError.message}` });
  }

  res.status(201).json({ pod, message: 'Pod created successfully' });
});

// 2. GET /pods/invite/:code - Preview pod details before joining
app.get('/pods/invite/:code', async (req: Request, res: Response) => {
  const { code } = req.params;

  const { data: pod, error } = await supabaseService
    .from('pods')
    .select('id, name, goal, stake_amount, currency, cycle_start, cycle_end, total_check_ins, status')
    .eq('invite_code', code)
    .single();

  if (error || !pod) {
    return res.status(404).json({ error: 'Invite link not found or invalid' });
  }

  res.json(pod);
});

// 3. POST /pods/:id/join - Join a pod (add to pod_members, stake still pending)
app.post('/pods/:id/join', authenticateUser, async (req: any, res: Response) => {
  const { id } = req.params;
  const userId = req.user.id;

  const { data: pod, error: podError } = await supabaseService
    .from('pods')
    .select('*')
    .eq('id', id)
    .single();

  if (podError || !pod) {
    return res.status(404).json({ error: 'Pod not found' });
  }

  const { data: existingMember } = await supabaseService
    .from('pod_members')
    .select('*')
    .eq('pod_id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (existingMember) {
    return res.status(400).json({ error: 'You are already a member of this pod' });
  }

  const { count, error: countError } = await supabaseService
    .from('pod_members')
    .select('*', { count: 'exact', head: true })
    .eq('pod_id', id);

  if (countError) {
    return res.status(500).json({ error: 'Failed to check pod capacity' });
  }

  if (count && count >= 5) {
    return res.status(400).json({ error: 'Pod is already full (max 5 members)' });
  }

  const { data: newMember, error: joinError } = await supabaseService
    .from('pod_members')
    .insert({
      pod_id: id,
      user_id: userId,
      stake_paid: false,
      stake_status: 'pending'
    })
    .select()
    .single();

  if (joinError) {
    return res.status(500).json({ error: joinError.message });
  }

  res.json({ message: 'Joined pod — proceed to stake pledge', member: newMember });
});

// ── PHASE 6: POST /pods/:id/settle (MANUAL TRIGGER FOR TESTING) ─────────
import { computePayouts, MemberMisses } from './lib/finance';

app.post('/pods/:id/settle', authenticateUser, async (req: any, res: Response) => {
  const { id } = req.params;

  // 1. Fetch Pod
  const { data: pod, error: podError } = await supabaseService
    .from('pods')
    .select('*')
    .eq('id', id)
    .single();

  if (podError || !pod) return res.status(404).json({ error: 'Pod not found' });
  if (pod.status === 'completed') return res.status(400).json({ error: 'Pod is already settled' });

  // 2. Fetch Members (who paid)
  const { data: members, error: memError } = await supabaseService
    .from('pod_members')
    .select('user_id')
    .eq('pod_id', id)
    .eq('stake_status', 'paid');

  if (memError || !members) return res.status(500).json({ error: memError?.message });

  // 3. Fetch all failed check-ins for this pod
  const { data: failedCheckIns, error: failError } = await supabaseService
    .from('check_ins')
    .select('user_id')
    .eq('pod_id', id)
    .eq('status', 'failed');

  if (failError) return res.status(500).json({ error: failError.message });

  // 4. Map missed days per member
  const memberMisses: MemberMisses[] = members.map(m => {
    const missedDays = failedCheckIns?.filter(ci => ci.user_id === m.user_id).length || 0;
    return { userId: m.user_id, missedDays };
  });

  // 5. Run Financial Engine
  const ledgerRows = computePayouts(
    pod.stake_amount,
    pod.total_check_ins,
    pod.free_strikes || 2, // Use DB default if missing
    pod.failure_threshold_pct || 50,
    pod.split_type || 'equal',
    memberMisses
  );

  // 6. Execute Atomic RPC Transaction
  const { error: rpcError } = await supabaseService.rpc('settle_pod_transaction', {
    p_pod_id: id,
    p_ledger_rows: ledgerRows
  });

  if (rpcError) {
    console.error('RPC Settlement Error:', rpcError);
    return res.status(500).json({ error: rpcError.message });
  }

  res.json({ message: 'Pod settled successfully', ledgerRows });
});

// ── PHASE 7: GET /pods/:id/dashboard (Dashboard UI Data) ─────────────────────────────────────────
// Creates a Stripe Checkout Session for the pod's stake_amount in TEST MODE.
// Returns the checkout URL for the client to redirect to.
app.post('/pods/:id/pledge', authenticateUser, async (req: any, res: Response) => {
  const { id } = req.params;
  const userId = req.user.id;

  // Verify the user is actually a member of this pod (prevent pledging for pods they haven't joined)
  const { data: member } = await supabaseService
    .from('pod_members')
    .select('stake_status')
    .eq('pod_id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!member) {
    return res.status(403).json({ error: 'You are not a member of this pod' });
  }

  if (member.stake_status === 'paid') {
    return res.status(400).json({ error: 'You have already paid your stake for this pod' });
  }

  // Fetch pod details to get stake_amount
  const { data: pod, error: podError } = await supabaseService
    .from('pods')
    .select('name, goal, stake_amount, currency')
    .eq('id', id)
    .single();

  if (podError || !pod) {
    return res.status(404).json({ error: 'Pod not found' });
  }

  // Convert stake_amount to smallest currency unit (paise for INR, cents for USD)
  // Stripe requires integer amounts in the smallest unit
  const amountInSmallestUnit = Math.round(pod.stake_amount * 100);

  // Map currency to Stripe-supported lowercase code
  const stripeCurrency = pod.currency?.toLowerCase() || 'inr';

  try {
    // Create Stripe Checkout Session — TEST MODE (key starts with sk_test_)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: stripeCurrency,
            product_data: {
              name: `StakePod: ${pod.name}`,
              description: `Stake pledge for habit: ${pod.goal}`,
            },
            unit_amount: amountInSmallestUnit,
          },
          quantity: 1,
        },
      ],
      // Metadata is attached to the Stripe event and is how our webhook
      // knows which pod_members row to update after payment completes
      metadata: {
        pod_id: id,
        user_id: userId,
      },
      // These URLs are where Stripe redirects the browser after checkout
      success_url: `${clientUrl}/pledge-success?pod_id=${id}`,
      cancel_url: `${clientUrl}/invite/cancelled?pod_id=${id}`,
    });

    res.json({ checkout_url: session.url });
  } catch (err: any) {
    console.error('Stripe session creation failed:', err.message);
    res.status(500).json({ error: `Stripe error: ${err.message}` });
  }
});

// 5. GET /pods/my-pods - List pods the logged-in user belongs to
app.get('/pods/my-pods', authenticateUser, async (req: any, res: Response) => {
  const { data: pods, error } = await req.supabase
    .from('pods')
    .select(`
      *,
      pod_members (
        id,
        user_id,
        stake_paid,
        stake_status,
        users (
          name,
          email
        )
      )
    `);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(pods);
});

// 6. GET /pods/:id - Get a single pod (for success page)
app.get('/pods/:id', authenticateUser, async (req: any, res: Response) => {
  const { id } = req.params;

  const { data: pod, error } = await req.supabase
    .from('pods')
    .select(`
      *,
      pod_members (
        id,
        user_id,
        stake_paid,
        stake_status,
        users (
          name,
          email
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error || !pod) {
    return res.status(404).json({ error: 'Pod not found or access denied' });
  }

  res.json(pod);
});

// 7. POST /pods/:id/checkin — record a check-in for today within the window
// ─────────────────────────────────────────────────────────────────────────────
// TIMEZONE: All window times are stored and compared in IST (Asia/Kolkata).
// We convert the server's UTC clock to IST before comparing against window times.
app.post('/pods/:id/checkin', authenticateUser, async (req: any, res: Response) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { note } = req.body; // Optional text note (FR9); photo_url via direct upload handled later

  // Get current IST date and time
  const now = new Date();
  const istDate = getISTDate(now);
  const istTime = getISTTimeString(now);

  // Fetch pod to get window times and verify membership
  const { data: pod, error: podError } = await supabaseService
    .from('pods')
    .select('check_in_window_start, check_in_window_end, cycle_start, cycle_end')
    .eq('id', id)
    .single();

  if (podError || !pod) {
    return res.status(404).json({ error: 'Pod not found' });
  }

  // Verify user is a paid member of this pod
  const { data: member } = await supabaseService
    .from('pod_members')
    .select('stake_status')
    .eq('pod_id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!member) {
    return res.status(403).json({ error: 'You are not a member of this pod' });
  }

  if (member.stake_status !== 'paid') {
    return res.status(403).json({ error: 'Your stake payment is still pending. Complete payment before checking in.' });
  }

  // Validate cycle dates
  if (istDate < pod.cycle_start || istDate > pod.cycle_end) {
    return res.status(400).json({ error: 'Pod cycle is not active today.' });
  }

  // ── WINDOW VALIDATION (IST) ──────────────────────────────────────────────
  const windowStatus = getWindowStatus(
    pod.check_in_window_start,
    pod.check_in_window_end,
    istTime
  );

  if (windowStatus === 'before_window') {
    return res.status(400).json({
      error: `Check-in window hasn't opened yet. Window opens at ${pod.check_in_window_start} IST.`,
      window_status: windowStatus,
    });
  }

  if (windowStatus === 'after_window') {
    return res.status(400).json({
      error: `Check-in window has closed. Window was open until ${pod.check_in_window_end} IST.`,
      window_status: windowStatus,
    });
  }
  // ────────────────────────────────────────────────────────────────────────

  // Check if already checked in successfully today
  const { data: existing } = await supabaseService
    .from('check_ins')
    .select('id, status')
    .eq('pod_id', id)
    .eq('user_id', userId)
    .eq('date', istDate)
    .maybeSingle();

  if (existing?.status === 'success') {
    return res.status(400).json({ error: 'You have already checked in today.' });
  }

  if (existing) {
    // Update existing pending row to success
    const { data: updated, error: updateError } = await supabaseService
      .from('check_ins')
      .update({ status: 'success', note: note || null, checked_at: now.toISOString() })
      .eq('id', existing.id)
      .select()
      .single();

    if (updateError) return res.status(500).json({ error: updateError.message });
    return res.json({ checkin: updated, message: 'Check-in recorded!' });
  }

  // Insert a fresh success check-in row
  const { data: checkin, error: insertError } = await supabaseService
    .from('check_ins')
    .insert({
      pod_id: id,
      user_id: userId,
      date: istDate,
      status: 'success',
      note: note || null,
      checked_at: now.toISOString(),
    })
    .select()
    .single();

  if (insertError) return res.status(500).json({ error: insertError.message });
  return res.json({ checkin, message: 'Check-in recorded!' });
});

// 8. GET /pods/:id/checkins — fetch all check-in history for a pod (for the contribution grid)
app.get('/pods/:id/checkins', authenticateUser, async (req: any, res: Response) => {
  const { id } = req.params;

  // Uses user-scoped client — RLS ensures they can only see check-ins for their pods
  const { data: checkins, error } = await req.supabase
    .from('check_ins')
    .select('id, user_id, date, status, note, checked_at, users(name, email)')
    .eq('pod_id', id)
    .order('date', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json(checkins);
});

// 9. GET /pods/:id/window-status — returns the current window status for the UI countdown
app.get('/pods/:id/window-status', authenticateUser, async (req: any, res: Response) => {
  const { id } = req.params;

  const { data: pod, error } = await supabaseService
    .from('pods')
    .select('check_in_window_start, check_in_window_end')
    .eq('id', id)
    .single();

  if (error || !pod) return res.status(404).json({ error: 'Pod not found' });

  const now = new Date();
  const istTime = getISTTimeString(now);
  const status = getWindowStatus(pod.check_in_window_start, pod.check_in_window_end, istTime);

  return res.json({
    current_ist_time: istTime,
    window_start: pod.check_in_window_start,
    window_end: pod.check_in_window_end,
    window_status: status,
  });
});
// 10. GET /pods/:id/ledger — fetch all ledger entries for a pod (for timeline feed)
app.get('/pods/:id/ledger', authenticateUser, async (req: any, res: Response) => {
  const { id } = req.params;

  const { data: ledger, error } = await supabaseService
    .from('ledger')
    .select('id, pod_id, user_id, type, amount, created_at, users(name, email)')
    .eq('pod_id', id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json(ledger);
});


app.listen(PORT, async () => {
  console.log(`StakePod server running on port ${PORT}`);

  // ── Phase 5: Start auto-fail cron + catch-up on boot ──────────────────
  await runStartupCatchup(supabaseService);
  startAutoFailCron(supabaseService);
  // ───────────────────────────────────────────────────────────────────────
});
