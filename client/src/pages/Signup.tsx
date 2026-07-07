import { useState, FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UserPlus, Mail, Lock, User, CheckCircle, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useNavigate } from '@tanstack/react-router'

export default function Signup() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: name.trim() },
        },
      })

      if (authError) throw authError

      // If a session is returned, the user is auto-logged in
      if (data.session) {
        navigate({ to: '/dashboard' })
        return
      }

      // Otherwise show success state (email confirmation needed)
      setSuccess(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create account'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 relative">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <AnimatePresence mode="wait">
        {success ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
            className="glass-card p-8 w-full max-w-md space-y-6 text-center"
          >
            <motion.div
              className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto glow-emerald"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 250 }}
            >
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </motion.div>
            <h2 className="text-2xl font-bold text-slate-100">Account Created!</h2>
            <p className="text-sm text-slate-400">
              Check your email to confirm your account, then sign in to get started.
            </p>
            <motion.button
              className="btn-primary w-full flex items-center justify-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate({ to: '/login' })}
            >
              Go to Login
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
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
                <UserPlus className="w-7 h-7 text-emerald-400" />
              </motion.div>
              <h1 className="text-2xl font-bold text-slate-100">Create Account</h1>
              <p className="text-sm text-slate-500">Join StakePod and start building habits</p>
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
                <label htmlFor="name" className="label-text flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="input-field"
                  required
                  autoComplete="name"
                />
              </div>

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
                  minLength={6}
                  autoComplete="new-password"
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
                    <UserPlus className="w-4 h-4" />
                    Create Account
                  </>
                )}
              </motion.button>
            </form>

            {/* Links */}
            <div className="flex flex-col items-center gap-3 pt-2">
              <p className="text-sm text-slate-500">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => navigate({ to: '/login' })}
                  className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                >
                  Sign in
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
        )}
      </AnimatePresence>
    </div>
  )
}
