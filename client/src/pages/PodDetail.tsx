import { useState, useEffect } from 'react'
import { useAuth } from '../AuthContext'
import { useNavigate } from '@tanstack/react-router'
import { apiFetch } from '../lib/api'
import type { Pod, Checkin, CheckinStatus, LedgerEntry, WindowStatus } from '../lib/types'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
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
  Send,
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

  const statusBadgeClass =
    pod?.status === 'active'
      ? 'badge-success'
      : pod?.status === 'pending'
        ? 'badge-warning'
        : pod?.status === 'completed'
          ? 'badge-info'
          : 'badge-neutral'

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
      <motion.div variants={itemVariants} className="glass-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <button
            onClick={() => navigate({ to: '/dashboard' })}
            className="flex items-center gap-2 text-slate-400 hover:text-emerald-400 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-extrabold text-slate-100 truncate">
              {pod.name}
            </h1>
            <p className="text-emerald-400 text-sm font-medium truncate">
              {pod.goal}
            </p>
          </div>

          <span className={statusBadgeClass}>
            {pod.status === 'active' && <Zap className="w-3 h-3" />}
            {pod.status === 'pending' && <Clock className="w-3 h-3" />}
            {pod.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
            {pod.status.charAt(0).toUpperCase() + pod.status.slice(1)}
          </span>
        </div>

        {/* Total Pot + Invite */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <DollarSign className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-3xl font-extrabold text-gradient">
                {pod.currency}
                {totalPot.toLocaleString()}
              </p>
              <p className="label-text">Total Pot</p>
            </div>
          </div>

          <button onClick={handleCopyInvite} className="btn-secondary flex items-center gap-2">
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {copied ? 'Copied!' : 'Copy Invite Link'}
          </button>
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
      <motion.div variants={itemVariants} className="glass-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            Today's Check-In
          </h2>
          <span
            className={
              windowStatus === 'in_window'
                ? 'badge-success'
                : windowStatus === 'before_window'
                  ? 'badge-warning'
                  : 'badge-danger'
            }
          >
            {windowStatus === 'in_window'
              ? 'Window Open'
              : windowStatus === 'before_window'
                ? 'Upcoming'
                : 'Closed'}
          </span>
        </div>

        <AnimatePresence mode="wait">
          {/* ─ Not Paid ─ */}
          {!hasPaid && (
            <motion.div
              key="not-paid"
              variants={checkinVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-5"
            >
              <div className="flex items-start gap-3">
                <Shield className="w-6 h-6 text-amber-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-amber-300 font-semibold">
                    Complete stake payment
                  </p>
                  <p className="text-amber-400/70 text-sm mt-1">
                    You need to pay your stake to participate in check-ins.
                  </p>
                  <button
                    className="btn-primary mt-4 flex items-center gap-2"
                    onClick={handlePay}
                    disabled={isPaying}
                  >
                    <CreditCard className="w-4 h-4" />
                    {isPaying ? 'Redirecting...' : 'Pay Stake via Stripe'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─ Before Window ─ */}
          {hasPaid && windowStatus === 'before_window' && !todayCheckin && (
            <motion.div
              key="before-window"
              variants={checkinVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="text-center py-6"
            >
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-slate-800/80 mx-auto mb-4">
                <Timer className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-300 font-semibold text-lg">
                Opens in{' '}
                <span className="text-emerald-400 font-mono">{countdown}</span>
              </p>
              <p className="text-slate-500 text-sm mt-2">
                Window: {pod.check_in_window_start} – {pod.check_in_window_end} IST
              </p>
              <button className="btn-primary mt-5 opacity-50 cursor-not-allowed" disabled>
                <Clock className="w-4 h-4 inline mr-2" />
                Check-In Opens at {pod.check_in_window_start}
              </button>
            </motion.div>
          )}

          {/* ─ Active Window ─ */}
          {hasPaid && windowStatus === 'in_window' && !todayCheckin && (
            <motion.div
              key="active-window"
              variants={checkinVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-4"
            >
              <div className="text-center">
                <p className="text-slate-400 text-sm mb-1">
                  Closes in{' '}
                  <span className="text-amber-400 font-mono font-semibold">
                    {countdown}
                  </span>
                </p>
              </div>

              <textarea
                className="input-field resize-none"
                rows={2}
                placeholder="Optional note about your progress..."
                value={checkinNote}
                onChange={(e) => setCheckinNote(e.target.value)}
                maxLength={500}
              />

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-primary glow-emerald w-full flex items-center justify-center gap-2 py-3 text-lg font-bold"
                onClick={handleCheckin}
                disabled={isCheckingIn}
              >
                {isCheckingIn ? (
                  <>
                    <Send className="w-5 h-5 animate-pulse" />
                    Checking In...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Check In Now
                  </>
                )}
              </motion.button>
            </motion.div>
          )}

          {/* ─ Already Checked In ─ */}
          {hasPaid && todayCheckin && (
            <motion.div
              key="checked-in"
              variants={checkinVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-5"
            >
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/20 shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-emerald-300 font-bold text-lg">
                    Checked in for today! 🎉
                  </p>
                  {todayCheckin.note && (
                    <p className="text-emerald-400/70 text-sm mt-1 italic">
                      "{todayCheckin.note}"
                    </p>
                  )}
                  <p className="text-slate-500 text-xs mt-2">
                    {todayCheckin.checked_at
                      ? `at ${new Date(todayCheckin.checked_at).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })}`
                      : ''}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─ Missed / After Window ─ */}
          {hasPaid && windowStatus === 'after_window' && !todayCheckin && (
            <motion.div
              key="missed"
              variants={checkinVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="rounded-xl bg-red-500/10 border border-red-500/20 p-5"
            >
              <div className="flex items-start gap-3">
                <XCircle className="w-6 h-6 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-red-300 font-semibold">
                    Window closed — missed today
                  </p>
                  <p className="text-red-400/60 text-sm mt-1">
                    The check-in window ({pod.check_in_window_start} –{' '}
                    {pod.check_in_window_end} IST) has ended.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ═══ 4. CONTRIBUTION GRID ═══ */}
      <motion.div variants={itemVariants} className="glass-card p-6">
        <h2 className="text-lg font-bold text-slate-100 mb-5 flex items-center gap-2">
          <Zap className="w-5 h-5 text-emerald-400" />
          30-Day Activity
        </h2>

        <div className="space-y-3 overflow-x-auto">
          {pod.pod_members.map((member) => {

            let failCounter = 0

            return (
              <div key={member.user_id} className="flex items-center gap-3 min-w-0">
                <div className="w-28 shrink-0 truncate">
                  <span className="text-sm text-slate-300 font-medium">
                    {member.users?.name || member.users?.email?.split('@')[0] || 'User'}
                  </span>
                  {member.stake_paid && (
                    <span className="ml-1.5 badge-success text-[9px] py-0 px-1.5">
                      Paid
                    </span>
                  )}
                </div>

                <div className="flex gap-1 flex-wrap">
                  {last30.map((day) => {
                    const status = checkinMap[member.user_id]?.[day] as
                      | CheckinStatus
                      | undefined
                    const isFailed = status === 'failed'
                    let usedFreeStrike = false
                    if (isFailed) {
                      failCounter++
                      if (failCounter <= pod.free_strikes) {
                        usedFreeStrike = true
                      }
                    }

                    return (
                      <div key={day} className="group relative">
                        <div
                          className={`w-4 h-4 rounded-sm ${getSquareColor(status)} transition-all hover:ring-1 hover:ring-white/30 relative`}
                        >
                          {usedFreeStrike && (
                            <Shield className="w-2.5 h-2.5 text-white absolute -top-0.5 -right-0.5 drop-shadow" />
                          )}
                        </div>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-800 text-slate-300 text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-slate-700">
                          {day}: {status || 'none'}
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

        {/* Legend */}
        <div className="flex items-center gap-4 mt-5 pt-4 border-t border-slate-800/60">
          <span className="label-text">Legend:</span>
          {[
            { color: 'bg-emerald-500', label: 'Success' },
            { color: 'bg-red-500', label: 'Failed' },
            { color: 'bg-amber-400', label: 'Pending' },
            { color: 'bg-slate-800/60', label: 'None' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-sm ${item.color}`} />
              <span className="text-xs text-slate-500">{item.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-slate-400" />
            <span className="text-xs text-slate-500">Free Strike</span>
          </div>
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
