import { useState, FormEvent } from 'react'
import { motion } from 'framer-motion'
import { LogIn, Mail, Lock, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useNavigate } from '@tanstack/react-router'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) throw authError

      navigate({ to: '/dashboard' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to sign in'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 relative">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="glass-card p-8 w-full max-w-md space-y-6 relative"
      >
        {/* Header */}
        <div className="flex flex-col items-center space-y-3">
          <motion.div
            className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center glow-emerald"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
          >
            <LogIn className="w-7 h-7 text-emerald-400" />
          </motion.div>
          <h1 className="text-2xl font-bold text-slate-100">Welcome Back</h1>
          <p className="text-sm text-slate-500">Sign in to your StakePod account</p>
        </div>

        {/* Error display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400"
          >
            {error}
          </motion.div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="email" className="label-text flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input-field"
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="label-text flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-field"
              required
              autoComplete="current-password"
            />
          </div>

          <motion.button
            type="submit"
            className="btn-primary w-full flex items-center justify-center gap-2"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? (
              <motion.div
                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Sign In
              </>
            )}
          </motion.button>
        </form>

        {/* Links */}
        <div className="flex flex-col items-center gap-3 pt-2">
          <p className="text-sm text-slate-500">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => navigate({ to: '/signup' })}
              className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
            >
              Sign up
            </button>
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: '/' })}
            className="text-sm text-slate-600 hover:text-slate-400 flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to home
          </button>
        </div>
      </motion.div>
    </div>
  )
}
