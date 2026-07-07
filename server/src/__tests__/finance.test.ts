import { computePayouts, MemberMisses } from '../lib/finance';

describe('Financial Engine (computePayouts)', () => {
  const defaultPod = {
    stakeAmount: 200,
    totalCheckIns: 20,
    freeStrikes: 2,
    failureThresholdPct: 50, // 10 missed days out of 20 = threshold
    splitType: 'equal' as const,
  };

  test('Hard Rule #7: A user failing a check-in but having a free strike available (no money lost)', () => {
    const members: MemberMisses[] = [
      { userId: 'A', missedDays: 0 },
      { userId: 'B', missedDays: 1 }, // 1 miss <= 2 free strikes
      { userId: 'C', missedDays: 2 }, // 2 misses <= 2 free strikes
    ];

    const ledger = computePayouts(
      defaultPod.stakeAmount,
      defaultPod.totalCheckIns,
      defaultPod.freeStrikes,
      defaultPod.failureThresholdPct,
      defaultPod.splitType,
      members
    );

    // No forfeits should occur, hence no payouts, so ledger should be empty
    expect(ledger).toHaveLength(0);
  });

  test('Hard Rule #7: A user failing a check-in with 0 free strikes left (exact forfeit amount deducted)', () => {
    const members: MemberMisses[] = [
      { userId: 'A', missedDays: 0 },
      { userId: 'B', missedDays: 5 }, // 5 misses, 2 free -> 3 penalized days
    ];

    // Daily forfeit = 200 / 20 = 10
    // Penalized days = 3
    // Expected forfeit = 3 * 10 = 30
    
    const ledger = computePayouts(
      defaultPod.stakeAmount,
      defaultPod.totalCheckIns,
      defaultPod.freeStrikes,
      defaultPod.failureThresholdPct,
      defaultPod.splitType,
      members
    );

    // Member B forfeits 30
    const forfeitB = ledger.find(l => l.user_id === 'B' && l.type === 'forfeit');
    expect(forfeitB).toBeDefined();
    expect(forfeitB?.amount).toBe(-30);

    // Member A (survivor) gets the 30
    const payoutA = ledger.find(l => l.user_id === 'A' && l.type === 'payout');
    expect(payoutA).toBeDefined();
    expect(payoutA?.amount).toBe(30);
    
    // Total rows: 1 forfeit, 1 payout
    expect(ledger).toHaveLength(2);
  });

  test('Hard Rule #7: Full failure threshold triggers 100% forfeit', () => {
    const members: MemberMisses[] = [
      { userId: 'A', missedDays: 0 },
      { userId: 'B', missedDays: 12 }, // 12 misses > 50% of 20 (10) -> Full forfeit
    ];
    
    const ledger = computePayouts(
      defaultPod.stakeAmount,
      defaultPod.totalCheckIns,
      defaultPod.freeStrikes,
      defaultPod.failureThresholdPct,
      defaultPod.splitType,
      members
    );

    // Member B loses everything (200)
    const forfeitB = ledger.find(l => l.user_id === 'B' && l.type === 'forfeit');
    expect(forfeitB?.amount).toBe(-200);

    // Member A gets everything
    const payoutA = ledger.find(l => l.user_id === 'A' && l.type === 'payout');
    expect(payoutA?.amount).toBe(200);
  });

  test('Hard Rule #7: The final pot splitting calculation exactly preserves pennies', () => {
    // 4 Members, Stake = 200. Total check-ins = 21. 
    // Daily forfeit = floor(20000 / 21) = 952 cents = 9.52
    
    const members: MemberMisses[] = [
      { userId: 'user_0_miss', missedDays: 0 }, // 0 penalties -> survivor
      { userId: 'user_1_miss', missedDays: 1 }, // 1 miss <= 2 free strikes -> survivor
      { userId: 'user_forfeit', missedDays: 3 }, // 3 misses, 2 free -> 1 penalized day -> forfeits 9.52
      { userId: 'user_full_dq', missedDays: 12 }, // 12 misses (> 50% of 21) -> full forfeit 200.00
    ];
    
    const ledger = computePayouts(
      200, // stake
      21,  // total check-ins
      2,   // free strikes
      50,  // threshold
      'equal',
      members
    );

    // Forfeits
    const forfeit1 = ledger.find(l => l.user_id === 'user_forfeit' && l.type === 'forfeit');
    expect(forfeit1?.amount).toBe(-9.52);

    const forfeitDQ = ledger.find(l => l.user_id === 'user_full_dq' && l.type === 'forfeit');
    expect(forfeitDQ?.amount).toBe(-200.00);

    // Total pot = 209.52
    // Survivors = user_0_miss and user_1_miss
    // 209.52 / 2 = 104.76 exactly for each

    const payout0 = ledger.find(l => l.user_id === 'user_0_miss' && l.type === 'payout');
    const payout1 = ledger.find(l => l.user_id === 'user_1_miss' && l.type === 'payout');
    
    expect(payout0?.amount).toBe(104.76);
    expect(payout1?.amount).toBe(104.76);
    
    // Math verification: Total forfeits + Total payouts MUST exactly equal 0
    const netSum = ledger.reduce((sum, row) => sum + row.amount, 0);
    // JS floats can be annoying, round to nearest cent for test safely
    expect(Math.round(netSum * 100)).toBe(0);
  });

  test('Penny remainder distribution logic (uneven split)', () => {
    // Total pot = 100 cents (1.00). 3 survivors.
    // 100 / 3 = 33 cents each, 1 cent remainder.
    // user_A gets 34, user_B gets 33, user_C gets 33.
    
    const members: MemberMisses[] = [
      { userId: 'user_A', missedDays: 0 },
      { userId: 'user_B', missedDays: 0 },
      { userId: 'user_C', missedDays: 0 },
      { userId: 'user_D', missedDays: 20 }, // Complete DQ, forfeits 1.00
    ];

    const ledger = computePayouts(
      1.00, // stake
      20,
      0,
      50,
      'equal',
      members
    );

    const payouts = ledger.filter(l => l.type === 'payout').sort((a, b) => a.user_id.localeCompare(b.user_id));
    
    expect(payouts).toHaveLength(3);
    // Sorted by ID: user_A gets the remainder cent
    expect(payouts[0].amount).toBe(0.34); 
    expect(payouts[1].amount).toBe(0.33);
    expect(payouts[2].amount).toBe(0.33);

    const netSum = ledger.reduce((sum, row) => sum + row.amount, 0);
    expect(Math.round(netSum * 100)).toBe(0);
  });
});
