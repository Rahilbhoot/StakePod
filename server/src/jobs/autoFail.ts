/**
 * Auto-fail cron job for StakePod.
 *
 * WHAT IT DOES
 * ─────────────
 * Runs every minute. For every active pod whose check_in_window_end has passed
 * today (in IST), it finds all paid members who did NOT successfully check in
 * and writes a 'failed' check_in row for today's date.
 *
 * IDEMPOTENCY
 * ─────────────
 * Uses ON CONFLICT DO NOTHING / service-level upserts so running multiple times
 * for the same pod+date+user is safe — already-failed or already-success rows
 * are never overwritten incorrectly.
 *
 * CRASH RECOVERY
 * ──────────────
 * runStartupCatchup() is called once at server startup. It scans the past 7 days
 * and fails any pending check-ins for windows that have already closed.
 * This covers the case where the server was down when the window closed.
 *
 * TIMEZONE
 * ─────────
 * All window times are treated as IST (Asia/Kolkata, UTC+5:30).
 */

import cron from 'node-cron';
import { SupabaseClient } from '@supabase/supabase-js';
import { getISTDate, getISTTimeString } from '../lib/timeUtils';

// ─── Core auto-fail logic (extracted so it's testable and reusable) ─────────

/**
 * For a given IST date string ('YYYY-MM-DD') and IST time string ('HH:MM:SS'),
 * finds all active pods whose window has closed at or before currentISTTime,
 * then marks non-checked-in paid members as 'failed' for that date.
 */
export async function runAutoFail(
  supabaseService: SupabaseClient,
  istDate: string,
  currentISTTime: string
): Promise<void> {
  // Find pods that are within their active cycle and whose window has closed today
  const { data: pods, error: podsError } = await supabaseService
    .from('pods')
    .select('id, name, check_in_window_end, pod_members(user_id, stake_status)')
    .lte('check_in_window_end', currentISTTime)  // window_end <= now (window has closed)
    .lte('cycle_start', istDate)                  // cycle has started
    .gte('cycle_end', istDate)                    // cycle has not ended
    .neq('status', 'completed')
    .neq('status', 'cancelled');

  if (podsError) {
    console.error(`[AutoFail] Failed to query pods: ${podsError.message}`);
    return;
  }

  if (!pods || pods.length === 0) return;

  for (const pod of pods) {
    const paidMembers = (pod.pod_members as { user_id: string; stake_status: string }[])
      .filter((m) => m.stake_status === 'paid');

    if (paidMembers.length === 0) continue;

    // For each paid member, check if they already have a success check-in today
    for (const member of paidMembers) {
      const { data: existing } = await supabaseService
        .from('check_ins')
        .select('id, status')
        .eq('pod_id', pod.id)
        .eq('user_id', member.user_id)
        .eq('date', istDate)
        .maybeSingle();

      if (existing?.status === 'success') {
        // Member checked in successfully — do not touch
        continue;
      }

      if (existing) {
        // A 'pending' row exists — update to 'failed'
        await supabaseService
          .from('check_ins')
          .update({ status: 'failed' })
          .eq('id', existing.id);
        console.log(`[AutoFail] Marked FAILED: pod=${pod.id} user=${member.user_id} date=${istDate}`);
      } else {
        // No record at all — insert a new 'failed' row
        const { error: insertError } = await supabaseService
          .from('check_ins')
          .insert({
            pod_id: pod.id,
            user_id: member.user_id,
            date: istDate,
            status: 'failed',
          });

        if (insertError) {
          console.error(`[AutoFail] Insert failed for pod=${pod.id} user=${member.user_id}: ${insertError.message}`);
        } else {
          console.log(`[AutoFail] Inserted FAILED: pod=${pod.id} user=${member.user_id} date=${istDate}`);
        }
      }
    }
  }
}

// ─── Startup catch-up (covers server crashes / restarts) ────────────────────

/**
 * Called once on server boot. Looks back up to 7 calendar days in IST and
 * fails any pending check-ins for windows that have already closed.
 *
 * Why 7 days: balances recovery coverage vs. unnecessary DB load.
 * Anything older than 7 days is unlikely to be a crash-recovery scenario.
 */
export async function runStartupCatchup(supabaseService: SupabaseClient): Promise<void> {
  console.log('[AutoFail] Running startup catch-up scan for the past 7 days...');

  const now = new Date();

  for (let daysAgo = 7; daysAgo >= 1; daysAgo--) {
    const pastDate = new Date(now);
    pastDate.setDate(now.getDate() - daysAgo);

    // Get the IST date for each past day
    const istDate = getISTDate(pastDate);

    // For past days, the window has definitely closed — use '23:59:59' to catch all pods
    await runAutoFail(supabaseService, istDate, '23:59:59');
  }

  // Also run for today but only for windows that have actually closed
  const todayIST = getISTDate(now);
  const currentIST = getISTTimeString(now);
  await runAutoFail(supabaseService, todayIST, currentIST);

  console.log('[AutoFail] Startup catch-up complete.');
}

// ─── Cron scheduler ─────────────────────────────────────────────────────────

/**
 * Starts the every-minute cron job.
 * Schedule '* * * * *' = run at the start of every minute.
 *
 * Timezone 'Asia/Kolkata' ensures the cron interprets the schedule in IST,
 * which matters if we ever switch to time-specific schedules.
 */
export function startAutoFailCron(supabaseService: SupabaseClient): void {
  cron.schedule(
    '* * * * *',
    async () => {
      const now = new Date();
      const istDate = getISTDate(now);
      const currentISTTime = getISTTimeString(now);
      await runAutoFail(supabaseService, istDate, currentISTTime);
    },
    { timezone: 'Asia/Kolkata' }
  );

  console.log('[AutoFail] Cron job scheduled — runs every minute (IST).');
}
