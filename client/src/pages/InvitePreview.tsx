import { useState, useEffect } from 'react'
import { useAuth } from '../AuthContext'
import { useNavigate } from '@tanstack/react-router'
import { API_URL } from '../lib/api'
import type { Pod } from '../lib/types'
import { motion } from 'framer-motion'
import { Handshake, Shield, ArrowRight } from 'lucide-react'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function InvitePreview({ code }: { code: string }) {
  const { session, user } = useAuth()
  const navigate = useNavigate()

  const [pod, setPod] = useState<Pod | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!code) return
    setLoading(true)
    fetch(`${API_URL}/pods/invite/${code}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setPod(data)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [code])

  const handleJoin = async () => {
    if (!session?.access_token || !pod) return
    setJoining(true)
    setError('')

    try {
      // 1. Join the pod (tolerate "already a member")
      const joinRes = await fetch(`${API_URL}/pods/${pod.id}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const joinData = await joinRes.json()
      if (!joinRes.ok && !joinData.error?.toLowerCase().includes('already')) {
        throw new Error(joinData.error || 'Failed to join pod')
      }

      // 2. Create pledge → Stripe checkout
      const pledgeRes = await fetch(`${API_URL}/pods/${pod.id}/pledge`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const pledge = await pledgeRes.json()
      if (!pledgeRes.ok) throw new Error(pledge.error || 'Failed to create pledge')

      if (pledge.checkout_url) {
        window.location.href = pledge.checkout_url
      } else {
        navigate({ to: '/pods/$podId', params: { podId: pod.id } })
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setJoining(false)
    }
  }

  // --- Loading ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-card p-10 max-w-md w-full animate-pulse space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full" />
          </div>
          <div className="h-6 w-48 bg-slate-800 rounded-lg mx-auto" />
          <div className="space-y-3">
            <div className="h-4 w-full bg-slate-800 rounded-lg" />
            <div className="h-4 w-3/4 bg-slate-800 rounded-lg" />
            <div className="h-4 w-1/2 bg-slate-800 rounded-lg" />
          </div>
          <div className="h-11 bg-slate-800 rounded-xl" />
        </div>
      </div>
    )
  }

  // --- Error (no pod) ---
  if (error && !pod) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-10 text-center max-w-sm space-y-4"
        >
          <Shield className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-bold">Invalid Invitation</h2>
          <p className="text-slate-400 text-sm">{error}</p>
          <button
            className="btn-secondary w-full"
            onClick={() => navigate({ to: '/dashboard' })}
          >
            Go to Dashboard
          </button>
        </motion.div>
      </div>
    )
  }

  if (!pod) return null

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="glass-card p-8 w-full max-w-md space-y-7"
      >
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Handshake className="w-8 h-8 text-emerald-400" />
          </div>
        </div>

        <h1 className="text-2xl font-black text-center tracking-tight">
          Pod Invitation
        </h1>

        {/* Pod details card */}
        <div className="glass-card p-5 space-y-4">
          <div className="space-y-1">
            <p className="label-text">Pod</p>
            <p className="font-bold text-lg">{pod.name}</p>
          </div>

          <div className="space-y-1">
            <p className="label-text">Goal</p>
            <p className="text-emerald-400 text-sm">{pod.goal}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="label-text">Stake</p>
              <p className="text-gradient font-black text-xl">
                {pod.currency === 'inr' ? '₹' : '$'}
                {pod.stake_amount}
              </p>
            </div>
            <div className="space-y-1">
              <p className="label-text">Frequency</p>
              <p className="font-semibold text-sm capitalize">{pod.frequency}</p>
            </div>
          </div>

          <div className="space-y-1">
            <p className="label-text">Cycle</p>
            <p className="text-sm font-semibold">
              {formatDate(pod.cycle_start)} – {formatDate(pod.cycle_end)}
            </p>
          </div>
        </div>

        {error && (
          <div className="badge-danger text-sm px-4 py-2 rounded-xl w-full block">
            {error}
          </div>
        )}

        {/* Actions */}
        {user ? (
          <button
            className="btn-primary w-full flex items-center justify-center gap-2 text-base py-3"
            onClick={handleJoin}
            disabled={joining}
          >
            {joining ? (
              <>
                <svg
                  className="animate-spin w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Joining…
              </>
            ) : (
              <>
                Join &amp; Pledge Stake
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              className="btn-primary flex items-center justify-center gap-2"
              onClick={() => navigate({ to: '/login' })}
            >
              Log In
            </button>
            <button
              className="btn-secondary flex items-center justify-center gap-2"
              onClick={() => navigate({ to: '/signup' })}
            >
              Sign Up
            </button>
          </div>
        )}

        <button
          className="w-full text-center text-sm text-slate-500 hover:text-slate-300 transition-colors"
          onClick={() => navigate({ to: '/dashboard' })}
        >
          Cancel
        </button>
      </motion.div>
    </div>
  )
}
