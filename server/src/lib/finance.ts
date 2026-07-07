/**
 * Financial Calculation Engine for StakePod
 *
 * Implements the logic defined in PRD Section 4.5.
 * All internal math is done in cents/paise (integers) to prevent floating point leaks.
 */

export interface MemberMisses {
  userId: string;
  missedDays: number;
}

export interface LedgerRow {
  user_id: string;
  type: 'forfeit' | 'payout';
  amount: number; // standard currency unit (e.g. 200.00), negative for forfeit
}

export function computePayouts(
  stakeAmount: number,
  totalCheckIns: number,
  freeStrikes: number,
  failureThresholdPct: number,
  splitType: 'equal' | 'pro_rata',
  memberMisses: MemberMisses[]
): LedgerRow[] {
  const ledger: LedgerRow[] = [];
  
  // 1. Convert to smallest integer unit to avoid floating point math errors
  const stakeCents = Math.round(stakeAmount * 100);
  const dailyForfeitCents = Math.floor(stakeCents / totalCheckIns);
  
  let totalPotCents = 0;
  const survivors: { userId: string; stakeCents: number }[] = [];

  // 2. Calculate Forfeits
  for (const member of memberMisses) {
    let forfeitCents = 0;
    const missPct = (member.missedDays * 100) / totalCheckIns;

    if (missPct > failureThresholdPct) {
      // Full forfeit: exceeded the allowed threshold
      forfeitCents = stakeCents;
    } else {
      // Per-day forfeit: deduct free strikes, then multiply by daily rate
      const penaltyDays = Math.max(0, member.missedDays - freeStrikes);
      forfeitCents = Math.min(stakeCents, penaltyDays * dailyForfeitCents);
      
      // A member is only eligible for the payout pool if they did not forfeit any money
      if (penaltyDays === 0) {
        survivors.push({ userId: member.userId, stakeCents: stakeCents });
      }
    }

    if (forfeitCents > 0) {
      totalPotCents += forfeitCents;
      ledger.push({
        user_id: member.userId,
        type: 'forfeit',
        amount: -(forfeitCents / 100) // Convert back to major unit
      });
    }
  }

  // 3. Calculate Payouts (Splitting the Pot)
  if (survivors.length > 0 && totalPotCents > 0) {
    // Sort survivors deterministically so remainder pennies are distributed consistently
    survivors.sort((a, b) => a.userId.localeCompare(b.userId));

    if (splitType === 'equal') {
      const baseShareCents = Math.floor(totalPotCents / survivors.length);
      let remainderCents = totalPotCents % survivors.length;

      for (const survivor of survivors) {
        let shareCents = baseShareCents;
        // Distribute exactly 1 cent to the first N users to perfectly clear the remainder
        if (remainderCents > 0) {
          shareCents += 1;
          remainderCents -= 1;
        }

        if (shareCents > 0) {
          ledger.push({
            user_id: survivor.userId,
            type: 'payout',
            amount: shareCents / 100
          });
        }
      }
    } else if (splitType === 'pro_rata') {
      const totalSurvivorStakeCents = survivors.reduce((sum, s) => sum + s.stakeCents, 0);
      let remainderCents = totalPotCents;
      
      const shares = survivors.map(s => {
        const share = Math.floor((s.stakeCents / totalSurvivorStakeCents) * totalPotCents);
        remainderCents -= share;
        return { ...s, shareCents: share };
      });

      for (const s of shares) {
        let finalShare = s.shareCents;
        if (remainderCents > 0) {
          finalShare += 1;
          remainderCents -= 1;
        }

        if (finalShare > 0) {
          ledger.push({
            user_id: s.userId,
            type: 'payout',
            amount: finalShare / 100
          });
        }
      }
    }
  }

  return ledger;
}
