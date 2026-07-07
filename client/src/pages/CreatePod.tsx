import { useState } from 'react'
import { useAuth } from '../AuthContext'
import { useNavigate } from '@tanstack/react-router'
import { API_URL } from '../lib/api'
import { motion } from 'framer-motion'
import { ArrowLeft, Rocket, Zap } from 'lucide-react'

interface FormState {
  name: string
  goal: string
  stake_amount: string
  currency: string
  frequency: string
  check_in_window_start: string
  check_in_window_end: string
  cycle_start: string
  cycle_end: string
  total_check_ins: string
  free_strikes: string
  failure_threshold_pct: string
  split_type: string
}

const initial: FormState = {
  name: '',
  goal: '',
  stake_amount: '',
  currency: 'inr',
  frequency: 'daily',
  check_in_window_start: '06:00',
  check_in_window_end: '22:00',
  cycle_start: '',
  cycle_end: '',
  total_check_ins: '',
  free_strikes: '2',
  failure_threshold_pct: '50',
  split_type: 'equal',
}

export default function CreatePod() {
  const { session } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState<FormState>(initial)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.access_token) return
    setSubmitting(true)
    setError('')

    try {
      // 1. Create pod
      const podRes = await fetch(`${API_URL}/pods`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name,
          goal: form.goal,
          stake_amount: Number(form.stake_amount),
          currency: form.currency,
          frequency: form.frequency,
          check_in_window_start: form.check_in_window_start,
          check_in_window_end: form.check_in_window_end,
          cycle_start: form.cycle_start,
          cycle_end: form.cycle_end,
          total_check_ins: Number(form.total_check_ins),
          free_strikes: Number(form.free_strikes),
          failure_threshold_pct: Number(form.failure_threshold_pct),
          split_type: form.split_type,
        }),
      })
      const pod = await podRes.json()
      if (!podRes.ok) throw new Error(pod.error || 'Failed to create pod')

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
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="glass-card p-8 w-full max-w-2xl space-y-8"
      >
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="btn-secondary p-2.5"
            onClick={() => navigate({ to: '/dashboard' })}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Rocket className="w-6 h-6 text-emerald-400" />
            <h1 className="text-2xl font-black tracking-tight">Launch a Pod</h1>
          </div>
        </div>

        {error && (
          <div className="badge-danger text-sm px-4 py-2 rounded-xl w-full block">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Row 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="label-text">Pod Name</label>
              <input
                className="input-field"
                placeholder="e.g. Morning Runners"
                value={form.name}
                onChange={set('name')}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="label-text">Habit Goal</label>
              <input
                className="input-field"
                placeholder="e.g. Run 5k every morning"
                value={form.goal}
                onChange={set('goal')}
                required
              />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="label-text">Stake Amount (INR)</label>
              <input
                className="input-field"
                type="number"
                min="1"
                placeholder="500"
                value={form.stake_amount}
                onChange={set('stake_amount')}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="label-text">Frequency</label>
              <select
                className="input-field"
                value={form.frequency}
                onChange={set('frequency')}
              >
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays</option>
                <option value="weekends">Weekends</option>
              </select>
            </div>
          </div>

          {/* Row 3 — Time windows */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="label-text">Window Opens</label>
              <input
                className="input-field"
                type="time"
                value={form.check_in_window_start}
                onChange={set('check_in_window_start')}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="label-text">Window Closes</label>
              <input
                className="input-field"
                type="time"
                value={form.check_in_window_end}
                onChange={set('check_in_window_end')}
                required
              />
            </div>
          </div>

          {/* Row 4 — Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="label-text">Cycle Start</label>
              <input
                className="input-field"
                type="date"
                value={form.cycle_start}
                onChange={set('cycle_start')}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="label-text">Cycle End</label>
              <input
                className="input-field"
                type="date"
                value={form.cycle_end}
                onChange={set('cycle_end')}
                required
              />
            </div>
          </div>

          {/* Row 5 — Numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="label-text">Total Check-ins</label>
              <input
                className="input-field"
                type="number"
                min="1"
                placeholder="30"
                value={form.total_check_ins}
                onChange={set('total_check_ins')}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="label-text">Free Strikes</label>
              <input
                className="input-field"
                type="number"
                min="0"
                value={form.free_strikes}
                onChange={set('free_strikes')}
                required
              />
            </div>
          </div>

          {/* Row 6 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="label-text">Failure Threshold %</label>
              <input
                className="input-field"
                type="number"
                min="1"
                max="100"
                value={form.failure_threshold_pct}
                onChange={set('failure_threshold_pct')}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="label-text">Split Type</label>
              <select
                className="input-field"
                value={form.split_type}
                onChange={set('split_type')}
              >
                <option value="equal">Equal</option>
                <option value="pro_rata">Pro Rata</option>
              </select>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn-primary w-full flex items-center justify-center gap-2 text-base py-3"
            disabled={submitting}
          >
            {submitting ? (
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
                Deploying…
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Deploy Pod
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
