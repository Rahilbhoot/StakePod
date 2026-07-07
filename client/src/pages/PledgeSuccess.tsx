import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, ArrowRight, Users, Loader2 } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { API_URL } from '../lib/api'
import { useNavigate } from '@tanstack/react-router'
import type { Pod, Member } from '../lib/types'

function getStakeBadge(status: string, paid: boolean): { className: string; label: string } {
  if (paid || status === 'paid') {
    return { className: 'badge-success', label: 'Paid' }
  }
  if (status === 'pending') {
    return { className: 'badge-warning animate-pulse', label: 'Pending' }
  }
  return { className: 'badge-neutral', label: status || 'Unknown' }
}

export default function PledgeSuccess() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [pod, setPod] = useState<Pod | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const podId = new URLSearchParams(window.location.search).get('pod_id')

  useEffect(() => {
    if (!podId || !session?.access_token) {
      setLoading(false)
      return
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/pods/${podId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to fetch pod')
        setPod(data)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load pod details'
        setError(message)
      } finally {
        setLoading(false)
      }
    }, 2500)

    return () => clearTimeout(timer)
  }, [podId, session?.access_token])

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 relative">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="glass-card p-8 w-full max-w-lg space-y-6 relative"
      >
        {/* Animated success icon */}
        <div className="flex flex-col items-center space-y-4">
          <motion.div
            className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center glow-emerald"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 15 }}
          >
            <motion.div
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.35, type: 'spring', stiffness: 250 }}
            >
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </motion.div>
          </motion.div>

          <motion.div
            className="text-center space-y-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <h1 className="text-2xl font-bold text-slate-100">Payment Complete!</h1>
            <p className="text-sm text-slate-400">
              Your stake has been secured. You&apos;re in the game now.
            </p>
          </motion.div>
        </div>

        {/* Pod details */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="space-y-4"
        >
          {loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading pod details...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {pod && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Pod name and stake */}
              <div className="bg-slate-800/50 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-100">{pod.name}</h3>
                  <span className="text-emerald-400 font-bold text-lg">
                    ${pod.stake_amount}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{pod.goal}</p>
              </div>

              {/* Members list */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Users className="w-4 h-4" />
                  <span className="font-medium">Pod Members</span>
                </div>
                <div className="space-y-2">
                  {pod.pod_members.map((member: Member) => {
                    const badge = getStakeBadge(member.stake_status, member.stake_paid)
                    return (
                      <div
                        key={member.id}
                        className="bg-slate-800/30 rounded-lg px-4 py-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                            {(member.users?.name || member.users?.email || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-200">
                              {member.users?.name || member.users?.email || 'Unknown User'}
                            </p>
                            {member.users?.name && (
                              <p className="text-xs text-slate-600">{member.users?.email}</p>
                            )}
                          </div>
                        </div>
                        <span className={badge.className}>{badge.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* CTA */}
        <motion.button
          className="btn-primary w-full flex items-center justify-center gap-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate({ to: '/dashboard' })}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          Go to Dashboard
          <ArrowRight className="w-4 h-4" />
        </motion.button>
      </motion.div>
    </div>
  )
}
