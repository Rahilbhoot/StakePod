import { useState, useEffect } from 'react'
import { useAuth } from '../AuthContext'
import { useNavigate } from '@tanstack/react-router'
import { API_URL } from '../lib/api'
import type { Pod, Member } from '../lib/types'
import { motion } from 'framer-motion'
import {
  Plus,
  LogOut,
  Copy,
  Check,
  ArrowRight,
  Zap,
  Calendar,
  Users,
  Target,
} from 'lucide-react'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as any } },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function memberDisplayName(m: Member) {
  return m.users?.name || m.users?.email?.split('@')[0] || 'Member'
}

export default function Dashboard() {
  const { session, user, signOut } = useAuth()
  const navigate = useNavigate()

  const [pods, setPods] = useState<Pod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedPodId, setCopiedPodId] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.access_token) return
    setLoading(true)
    fetch(`${API_URL}/pods/my-pods`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPods(data)
        else if (data.error) setError(data.error)
        else setPods([])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [session?.access_token])

  const copyInvite = async (pod: Pod) => {
    const url = `${window.location.origin}/invite/${pod.invite_code}`
    await navigator.clipboard.writeText(url)
    setCopiedPodId(pod.id)
    setTimeout(() => setCopiedPodId(null), 2000)
  }

  // --- Not logged in ---
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-10 text-center max-w-sm space-y-4"
        >
          <Target className="w-12 h-12 text-emerald-400 mx-auto" />
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-slate-400 text-sm">Please log in to view your pods.</p>
          <button
            className="btn-primary w-full"
            onClick={() => navigate({ to: '/login' })}
          >
            Log In
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* ── Navbar ──────────────────────────────────────────── */}
      <nav className="glass-card sticky top-0 z-50 border-x-0 border-t-0 rounded-none px-6 py-3 flex items-center justify-between">
        <span className="text-gradient font-black text-xl tracking-tight select-none">
          StakePod
        </span>

        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400 hidden sm:inline">
            {user.email}
          </span>
          <button
            className="btn-primary flex items-center gap-2 text-sm"
            onClick={() => navigate({ to: '/create-pod' })}
          >
            <Plus className="w-4 h-4" />
            Create Pod
          </button>
          <button
            className="btn-secondary flex items-center gap-2 text-sm"
            onClick={signOut}
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        <motion.h1
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-black tracking-tight"
        >
          Your Pods
        </motion.h1>

        {error && (
          <div className="badge-danger text-sm px-4 py-2 rounded-xl">{error}</div>
        )}

        {/* ── Loading skeletons ─────────────────────────────── */}
        {loading && (
          <div className="grid gap-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass-card p-6 animate-pulse space-y-4">
                <div className="flex justify-between">
                  <div className="h-5 w-40 bg-slate-800 rounded-lg" />
                  <div className="h-6 w-24 bg-slate-800 rounded-lg" />
                </div>
                <div className="h-4 w-56 bg-slate-800 rounded-lg" />
                <div className="grid grid-cols-4 gap-3">
                  {[0, 1, 2, 3].map((j) => (
                    <div key={j} className="h-16 bg-slate-800/60 rounded-xl" />
                  ))}
                </div>
                <div className="flex gap-2">
                  <div className="h-7 w-20 bg-slate-800 rounded-full" />
                  <div className="h-7 w-20 bg-slate-800 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Empty state ──────────────────────────────────── */}
        {!loading && pods.length === 0 && !error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-14 text-center space-y-5"
          >
            <Target className="w-16 h-16 text-emerald-400/60 mx-auto" />
            <h2 className="text-xl font-bold">No pods yet</h2>
            <p className="text-slate-400 text-sm max-w-xs mx-auto">
              Create your first accountability pod and invite friends to stake on
              building better habits together.
            </p>
            <button
              className="btn-primary inline-flex items-center gap-2"
              onClick={() => navigate({ to: '/create-pod' })}
            >
              <Plus className="w-4 h-4" />
              Create Your First Pod
            </button>
          </motion.div>
        )}

        {/* ── Pod cards ────────────────────────────────────── */}
        {!loading && pods.length > 0 && (
          <motion.div
            className="grid gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {pods.map((pod) => (
              <motion.div
                key={pod.id}
                variants={cardVariants}
                className="glass-card-hover p-6 space-y-5"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-lg">{pod.name}</h3>
                    <p className="text-emerald-400 text-sm mt-0.5">{pod.goal}</p>
                  </div>
                  <div className="badge-info shrink-0">
                    <span className="text-gradient font-black text-xl leading-none">
                      {pod.currency === 'inr' ? '₹' : '$'}
                      {pod.stake_amount}
                    </span>
                  </div>
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="metric-card">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Zap className="w-3.5 h-3.5" />
                      <span className="label-text">Frequency</span>
                    </div>
                    <p className="text-sm font-semibold capitalize">{pod.frequency}</p>
                  </div>
                  <div className="metric-card">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="label-text">Duration</span>
                    </div>
                    <p className="text-sm font-semibold">
                      {formatDate(pod.cycle_start)} – {formatDate(pod.cycle_end)}
                    </p>
                  </div>
                  <div className="metric-card">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Target className="w-3.5 h-3.5" />
                      <span className="label-text">Check-ins</span>
                    </div>
                    <p className="text-sm font-semibold">{pod.total_check_ins}</p>
                  </div>
                  <div className="metric-card">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Users className="w-3.5 h-3.5" />
                      <span className="label-text">Members</span>
                    </div>
                    <p className="text-sm font-semibold">
                      {pod.pod_members?.length ?? 0}/5
                    </p>
                  </div>
                </div>

                {/* Members roster */}
                {pod.pod_members && pod.pod_members.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {pod.pod_members.map((m) => (
                      <span
                        key={m.id}
                        className={
                          m.stake_status === 'paid'
                            ? 'badge-success'
                            : 'badge-warning'
                        }
                      >
                        {memberDisplayName(m)}
                        <span className="opacity-60 text-[10px] uppercase ml-1">
                          {m.stake_status}
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    className="btn-secondary flex items-center gap-2 text-sm"
                    onClick={() => copyInvite(pod)}
                  >
                    {copiedPodId === pod.id ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy Invite Link
                      </>
                    )}
                  </button>
                  <button
                    className="btn-primary flex items-center gap-2 text-sm"
                    onClick={() => navigate({ to: '/pods/$podId', params: { podId: pod.id } })}
                  >
                    View Pod
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  )
}
