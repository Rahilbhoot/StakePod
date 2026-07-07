import { useState, useEffect } from 'react'
import { useAuth } from '../AuthContext'
import { useNavigate } from '@tanstack/react-router'
import { apiFetch } from '../lib/api'
import type { Pod, Checkin, CheckinStatus, LedgerEntry, WindowStatus } from '../lib/types'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Shield,
  TrendingUp,
  Calendar,
  Users,
  DollarSign,
  Flame,
  Copy,
  Check,
  CreditCard,
  Timer,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

/* ─── helpers ─── */

function getISTTime(): string {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function getISTDate(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
}

function timeToSeconds(t: string): number {
  const [h, m, s] = t.split(':').map(Number)
  return h * 3600 + m * 60 + s
}

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0s'
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const parts: string[] = []
  if (h > 0) parts.push(`${h}h`)
  if (m > 0) parts.push(`${m}m`)
  parts.push(`${s}s`)
  return parts.join(' ')
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function getLast30Days(): string[] {
  const days: string[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' }))
  }
  return days
}

/* ─── animation variants ─── */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as any as any } },
}

const checkinVariants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
}

/* ─── skeleton loader ─── */

function Skeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* header skeleton */}
      <div className="glass-card p-6 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-slate-800" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-48 rounded bg-slate-800" />
            <div className="h-4 w-32 rounded bg-slate-800" />
          </div>
          <div className="h-8 w-20 rounded-full bg-slate-800" />
        </div>
        <div className="mt-6 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-slate-800" />
          <div className="h-10 w-40 rounded bg-slate-800" />
        </div>
      </div>

      {/* metrics skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="metric-card animate-pulse">
            <div className="h-10 w-10 rounded-full bg-slate-800" />
            <div className="h-8 w-20 rounded bg-slate-800 mt-2" />
            <div className="h-4 w-24 rounded bg-slate-800 mt-1" />
          </div>
        ))}
      </div>

      {/* grid skeleton */}
      <div className="glass-card p-6 animate-pulse space-y-3">
        <div className="h-5 w-36 rounded bg-slate-800" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-4 w-24 rounded bg-slate-800" />
              <div className="flex gap-1">
                {[...Array(15)].map((__, j) => (
                  <div key={j} className="h-4 w-4 rounded-sm bg-slate-800" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── main component ─── */

export default function PodDetail({ podId }: { podId: string }) {
  const { session, user } = useAuth()
  const navigate = useNavigate()
  const token = session?.access_token

  const [pod, setPod] = useState<Pod | null>(null)
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // check-in widget state
  const [windowStatus, setWindowStatus] = useState<WindowStatus>('before_window')
  const [countdown, setCountdown] = useState('')
  const [checkinNote, setCheckinNote] = useState('')
  const [isCheckingIn, setIsCheckingIn] = useState(false)
  const [isPaying, setIsPaying] = useState(false)

  // ui state
  const [copied, setCopied] = useState(false)
  const [ledgerExpanded, setLedgerExpanded] = useState(false)

  /* ─── data fetching ─── */

  const fetchAll = async () => {
    if (!token) return
    try {
      const [podData, checkinData, ledgerData] = await Promise.all([
        apiFetch(`/pods/${podId}`, token),
        apiFetch(`/pods/${podId}/checkins`, token),
        apiFetch(`/pods/${podId}/ledger`, token),
      ])
      setPod(podData)
      setCheckins(checkinData)
      setLedger(ledgerData)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load pod')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podId, token])

  /* ─── window ticker ─── */

  useEffect(() => {
    if (!pod) return

    const tick = () => {
      const now = timeToSeconds(getISTTime())
      const start = timeToSeconds(pod.check_in_window_start)
      const end = timeToSeconds(pod.check_in_window_end)

      if (now < start) {
        setWindowStatus('before_window')
        setCountdown(formatCountdown(start - now))
      } else if (now >= start && now <= end) {
        setWindowStatus('in_window')
        setCountdown(formatCountdown(end - now))
      } else {
        setWindowStatus('after_window')
        setCountdown('')
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [pod])

  /* ─── derived data ─── */

  const currentMember = pod?.pod_members.find((m) => m.user_id === user?.id)
  const hasPaid = currentMember?.stake_paid ?? false
  const paidMembers = pod?.pod_members.filter((m) => m.stake_paid).length ?? 0
  const totalPot = paidMembers * (pod?.stake_amount ?? 0)

  const todayIST = getISTDate()
  const todayCheckin = checkins.find(
    (c) => c.user_id === user?.id && c.date === todayIST && c.status === 'success'
  )

  // streak for a user
  const getStreak = (userId: string): number => {
    const userCheckins = checkins
      .filter((c) => c.user_id === userId && c.status === 'success')
      .map((c) => c.date)
      .sort()
      .reverse()

    let streak = 0
    const d = new Date()
    for (let i = 0; i < 365; i++) {
      const dateStr = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
      if (userCheckins.includes(dateStr)) {
        streak++
      } else if (i > 0) {
        break
      }
      d.setDate(d.getDate() - 1)
    }
    return streak
  }

  // failure count for a user
  const getFailureCount = (userId: string): number =>
    checkins.filter((c) => c.user_id === userId && c.status === 'failed').length

  // total forfeits (absolute sum of negative ledger amounts)
  const totalForfeits = ledger
    .filter((e) => e.type === 'forfeit')
    .reduce((sum, e) => sum + Math.abs(e.amount), 0)

  // days remaining
  const daysRemaining = pod
    ? Math.max(
        0,
        Math.ceil(
          (new Date(pod.cycle_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      )
    : 0

  const myStreak = user ? getStreak(user.id) : 0

  /* ─── actions ─── */

  const handleCheckin = async () => {
    if (!token) return
    setIsCheckingIn(true)
    try {
      await apiFetch(`/pods/${podId}/checkin`, token, {
        method: 'POST',
        body: JSON.stringify({ note: checkinNote || undefined }),
      })
      setCheckinNote('')
      await fetchAll()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Check-in failed')
    } finally {
      setIsCheckingIn(false)
    }
  }

  const handlePay = async () => {
    if (!token) return
    setIsPaying(true)
    try {
      const data = await apiFetch(`/pods/${podId}/pledge`, token, { method: 'POST' })
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Payment failed')
      setIsPaying(false)
    }
  }

  const handleCopyInvite = async () => {
    if (!pod) return
    const link = `${window.location.origin}/join/${pod.invite_code}`
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  /* ─── status badge ─── */



  /* ─── loading / error ─── */

  if (loading) return <Skeleton />

  if (error || !pod) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 inline-block"
        >
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <p className="text-slate-300 text-lg mb-4">{error || 'Pod not found'}</p>
          <button
            className="btn-primary"
            onClick={() => navigate({ to: '/dashboard' })}
          >
            <ArrowLeft className="w-4 h-4 inline mr-2" />
            Back to Dashboard
          </button>
        </motion.div>
      </div>
    )
  }

  /* ─── contribution grid data ─── */

  const last30 = getLast30Days()
  const checkinMap: Record<string, Record<string, CheckinStatus>> = {}
  for (const c of checkins) {
    if (!checkinMap[c.user_id]) checkinMap[c.user_id] = {}
    checkinMap[c.user_id][c.date] = c.status
  }

  const getSquareColor = (status: CheckinStatus | undefined): string => {
    switch (status) {
      case 'success':
        return 'bg-emerald-500'
      case 'failed':
        return 'bg-red-500'
      case 'pending':
        return 'bg-amber-400 animate-pulse'
      default:
        return 'bg-slate-800/60'
    }
  }

  /* ─── render ─── */

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-5xl mx-auto px-4 py-8 space-y-6"
    >
      {/* ═══ 1. HEADER ═══ */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-900/80 backdrop-blur-xl shadow-xl p-6 sm:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{ background: 'radial-gradient(circle at top right, rgba(16, 185, 129, 0.15), transparent 50%)' }}
        />
        
        <div className="relative">
          <button
            onClick={() => navigate({ to: '/dashboard' })}
            className="flex items-center gap-2 text-slate-400 hover:text-emerald-400 transition-colors mb-6 w-fit"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] items-start gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${pod.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                {pod.status} cycle · {pod.check_in_window_start}–{pod.check_in_window_end}
              </div>
              <h1 className="mt-3 truncate font-black text-4xl sm:text-6xl text-slate-100">
                {pod.name}
              </h1>
              <p className="mt-2 max-w-xl text-sm sm:text-base text-slate-400">
                {pod.goal}
              </p>
            </div>

            <div className="shrink-0 sm:text-right">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400 mb-1">Pot Size</div>
              <div className="font-black text-4xl sm:text-6xl text-gradient leading-none">
                {pod.currency}{totalPot.toLocaleString()}
              </div>
              <div className="mt-2 text-xs text-slate-500 font-mono">
                {pod.currency}{pod.stake_amount} × {paidMembers} paid members
              </div>
            </div>
          </div>
          
          <div className="mt-8 flex justify-end">
            <button onClick={handleCopyInvite} className="btn-secondary flex items-center gap-2 text-xs py-2 px-4 rounded-full">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Invite Link'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* ═══ 2. METRIC CARDS ═══ */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {[
          {
            icon: CreditCard,
            color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
            value: `${pod.currency}${pod.stake_amount}`,
            label: 'Your Stake',
          },
          {
            icon: Calendar,
            color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
            value: `${daysRemaining}`,
            label: 'Days Remaining',
          },
          {
            icon: Flame,
            color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
            value: `${myStreak}`,
            label: 'Current Streak',
          },
          {
            icon: TrendingUp,
            color: 'text-red-400 bg-red-500/10 border-red-500/20',
            value: `${pod.currency}${totalForfeits.toLocaleString()}`,
            label: 'Total Forfeits',
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            variants={itemVariants}
            custom={i}
            className="metric-card"
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center border ${card.color}`}
            >
              <card.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-slate-100 mt-2">{card.value}</p>
            <p className="label-text">{card.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* ═══ 3. CHECK-IN WIDGET ═══ */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-900/80 backdrop-blur-xl shadow-xl p-6 sm:p-10">
        <div className="flex items-center justify-between mb-8">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
            Today's Check-in
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-mono uppercase tracking-wider ${
              !hasPaid
                ? 'bg-slate-800 text-slate-400'
                : windowStatus === 'in_window'
                  ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30'
                  : 'bg-slate-800/60 text-slate-300 ring-1 ring-slate-700/50'
            }`}
          >
            {!hasPaid
              ? 'Locked'
              : windowStatus === 'in_window'
                ? 'Open Now'
                : windowStatus === 'before_window'
                  ? 'Waiting'
                  : 'Closed'}
          </span>
        </div>

        <AnimatePresence mode="wait">
          {!hasPaid ? (
            <motion.div
              key="unpaid"
              variants={checkinVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="text-center py-6"
            >
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-slate-800/80 text-slate-400 mb-4">
                <Shield className="h-7 w-7" />
              </div>
              <h3 className="font-black text-2xl text-slate-100">Pledge your stake to unlock</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400 mb-6">
                Your check-ins won't count until your stake is paid. Skin in the game is the whole point.
              </p>
              <button
                className="btn-primary"
                onClick={handlePay}
                disabled={isPaying}
              >
                {isPaying ? 'Processing...' : 'Pay Stake via Stripe'}
              </button>
            </motion.div>
          ) : todayCheckin ? (
            <motion.div
              key="done"
              variants={checkinVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="text-center py-8"
            >
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400 mb-4 glow-emerald">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="font-black text-2xl text-slate-100">Checked in!</h3>
              <p className="mt-2 text-emerald-400 font-medium">You're safe for today.</p>
              {todayCheckin.note && (
                <p className="mt-4 p-4 rounded-xl bg-slate-800/50 text-slate-300 text-sm italic max-w-md mx-auto">
                  "{todayCheckin.note}"
                </p>
              )}
            </motion.div>
          ) : windowStatus === 'before_window' ? (
            <motion.div
              key="waiting"
              variants={checkinVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="text-center py-6"
            >
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-slate-800/80 text-slate-400 mb-4">
                <Timer className="h-7 w-7" />
              </div>
              <h3 className="font-black text-2xl text-slate-100">Window opens in {countdown}</h3>
              <p className="mt-2 text-slate-400 text-sm">
                Check back between {pod.check_in_window_start} and {pod.check_in_window_end} (IST).
              </p>
            </motion.div>
          ) : windowStatus === 'in_window' ? (
            <motion.div
              key="active"
              variants={checkinVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="max-w-md mx-auto text-center"
            >
              <textarea
                value={checkinNote}
                onChange={(e) => setCheckinNote(e.target.value)}
                placeholder="Optional: Add a note about your progress..."
                className="input-field min-h-[100px] mb-4 resize-none"
              />
              <button
                className="btn-primary w-full py-4 text-lg font-bold flex items-center justify-center gap-2 glow-emerald"
                onClick={handleCheckin}
                disabled={isCheckingIn}
              >
                <CheckCircle2 className="w-6 h-6" />
                {isCheckingIn ? 'Checking In...' : 'Check In Now'}
              </button>
              <p className="text-slate-400 text-sm font-mono mt-4">
                Closes in {countdown}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="missed"
              variants={checkinVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="text-center py-6"
            >
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-500/15 text-red-400 mb-4">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <h3 className="font-black text-2xl text-slate-100">Window Closed</h3>
              <p className="mt-2 text-red-400 font-medium">You missed today's check-in.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ═══ 4. CONTRIBUTION GRID ═══ */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-900/80 backdrop-blur-xl shadow-xl p-6 sm:p-10">
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] items-start gap-4 mb-8">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Last 30 Days</div>
            <h2 className="mt-1 font-black text-3xl sm:text-4xl text-slate-100">
              Pod Activity
            </h2>
          </div>
          
          <div className="flex shrink-0 items-center gap-4 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-emerald-500" /> Success</div>
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-red-500" /> Missed</div>
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-amber-400" /> Pending</div>
          </div>
        </div>

        <div className="space-y-4 overflow-x-auto pb-4">
          {pod.pod_members.map((member) => {
            let failCounter = 0
            return (
              <div key={member.user_id} className="flex items-center gap-4 min-w-[600px]">
                <div className="w-32 shrink-0 truncate">
                  <span className="text-sm font-semibold text-slate-200">
                    {member.users?.name || member.users?.email?.split('@')[0] || 'User'}
                  </span>
                  {member.stake_paid && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Paid
                    </span>
                  )}
                </div>

                <div className="flex-1 flex gap-1.5 justify-end">
                  {last30.map((day) => {
                    const status = checkinMap[member.user_id]?.[day] as CheckinStatus | undefined
                    const isFailed = status === 'failed'
                    let usedFreeStrike = false
                    if (isFailed) {
                      failCounter++
                      if (failCounter <= pod.free_strikes) usedFreeStrike = true
                    }

                    return (
                      <div key={day} className="group relative">
                        <div
                          className={`w-[14px] h-[14px] rounded-[3px] ${getSquareColor(status)} transition-all hover:ring-2 hover:ring-white/40 hover:scale-110 relative`}
                        >
                          {usedFreeStrike && (
                            <Shield className="w-2.5 h-2.5 text-white absolute -top-0.5 -right-0.5 drop-shadow" />
                          )}
                        </div>
                        <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-mono text-slate-300 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                          {day.split('-').slice(1).join('/')} · {status || 'none'}
                          {usedFreeStrike && ' (free strike)'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-500 font-mono">
          <span>{last30[0].split('-').slice(1).join('/')}</span>
          <span>Today</span>
        </div>
      </motion.div>

      {/* ═══ 5. MEMBERS LIST ═══ */}
      <motion.div variants={itemVariants} className="glass-card p-6">
        <h2 className="text-lg font-bold text-slate-100 mb-5 flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-400" />
          Pod Members
          <span className="badge-neutral text-[10px] ml-1">
            {pod.pod_members.length}
          </span>
        </h2>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-2"
        >
          {pod.pod_members.map((member, i) => {
            const streak = getStreak(member.user_id)
            const fails = getFailureCount(member.user_id)
            const freeStrikesLeft = Math.max(0, pod.free_strikes - fails)
            const isCurrentUser = member.user_id === user?.id

            return (
              <motion.div
                key={member.user_id}
                variants={itemVariants}
                custom={i}
                className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                  isCurrentUser
                    ? 'bg-emerald-500/5 border border-emerald-500/10'
                    : 'bg-slate-800/30 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                      isCurrentUser
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {(
                      member.users?.name?.[0] ||
                      member.users?.email?.[0] ||
                      '?'
                    ).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-200 truncate">
                      {member.users?.name || member.users?.email?.split('@')[0] || 'User'}
                      {isCurrentUser && (
                        <span className="text-emerald-400 text-xs ml-1.5">(You)</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {member.users?.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Streak */}
                  <div className="flex items-center gap-1 text-orange-400" title="Streak">
                    <Flame className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold">{streak}</span>
                  </div>

                  {/* Free Strikes */}
                  <div
                    className="flex items-center gap-1 text-slate-400"
                    title="Free strikes remaining"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold">{freeStrikesLeft}</span>
                  </div>

                  {/* Stake status */}
                  <span
                    className={
                      member.stake_paid ? 'badge-success' : 'badge-warning'
                    }
                  >
                    {member.stake_paid ? 'Paid' : 'Pending'}
                  </span>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      </motion.div>

      {/* ═══ 6. LEDGER TIMELINE ═══ */}
      <motion.div variants={itemVariants} className="glass-card p-6">
        <button
          onClick={() => setLedgerExpanded(!ledgerExpanded)}
          className="flex items-center justify-between w-full text-left"
        >
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            Financial Ledger
            {ledger.length > 0 && (
              <span className="badge-neutral text-[10px] ml-1">
                {ledger.length}
              </span>
            )}
          </h2>
          {ledger.length > 5 && (
            <span className="text-slate-400 hover:text-emerald-400 transition-colors">
              {ledgerExpanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </span>
          )}
        </button>

        <div className="mt-5">
          {ledger.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No financial activity yet</p>
            </div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {(ledgerExpanded ? ledger : ledger.slice(0, 5)).map((entry, i) => {
                const typeConfig = {
                  stake: {
                    icon: CreditCard,
                    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                    desc: 'Pledged stake',
                  },
                  forfeit: {
                    icon: AlertTriangle,
                    color: 'text-red-400 bg-red-500/10 border-red-500/20',
                    desc: 'Forfeit penalty',
                  },
                  payout: {
                    icon: TrendingUp,
                    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                    desc: 'Payout received',
                  },
                }
                const config = typeConfig[entry.type]
                const Icon = config.icon

                return (
                  <motion.div
                    key={entry.id}
                    variants={itemVariants}
                    custom={i}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center border shrink-0 ${config.color}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-200 truncate">
                        {entry.users?.name ||
                          entry.users?.email?.split('@')[0] ||
                          'User'}
                      </p>
                      <p className="text-xs text-slate-500">{config.desc}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <p
                        className={`text-sm font-bold ${
                          entry.amount < 0 ? 'text-red-400' : 'text-emerald-400'
                        }`}
                      >
                        {entry.amount < 0 ? '-' : '+'}
                        {pod.currency}
                        {Math.abs(entry.amount).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-600">
                        {relativeTime(entry.created_at)}
                      </p>
                    </div>
                  </motion.div>
                )
              })}

              {!ledgerExpanded && ledger.length > 5 && (
                <button
                  onClick={() => setLedgerExpanded(true)}
                  className="w-full text-center text-sm text-slate-500 hover:text-emerald-400 transition-colors py-2"
                >
                  Show {ledger.length - 5} more entries
                </button>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
