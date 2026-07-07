export interface Member {
  id: string
  user_id: string
  stake_paid: boolean
  stake_status: string
  users: { name: string | null; email: string }
}

export interface Pod {
  id: string
  name: string
  goal: string
  stake_amount: number
  currency: string
  frequency: string
  cycle_start: string
  cycle_end: string
  check_in_window_start: string
  check_in_window_end: string
  invite_code: string
  created_by: string
  total_check_ins: number
  free_strikes: number
  failure_threshold_pct: number
  split_type: string
  status: string
  pod_members: Member[]
}

export type CheckinStatus = 'success' | 'failed' | 'pending' | 'none'

export interface Checkin {
  id: string
  user_id: string
  date: string
  status: CheckinStatus
  note: string | null
  checked_at: string | null
  users?: { name: string | null; email: string }
}

export interface LedgerEntry {
  id: string
  pod_id: string
  user_id: string
  type: 'stake' | 'forfeit' | 'payout'
  amount: number
  created_at: string
  users?: { name: string | null; email: string }
}

export type WindowStatus = 'before_window' | 'in_window' | 'after_window'
