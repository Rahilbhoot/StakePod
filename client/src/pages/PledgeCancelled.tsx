import { motion } from 'framer-motion'
import { AlertTriangle, ArrowLeft, Shield } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'

export default function PledgeCancelled() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 relative">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="glass-card p-8 w-full max-w-md space-y-6 text-center relative"
      >
        {/* Amber warning icon */}
        <motion.div
          className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto"
          style={{
            boxShadow:
              '0 0 20px rgba(245, 158, 11, 0.15), 0 0 60px rgba(245, 158, 11, 0.05)',
          }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 15 }}
        >
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 250 }}
          >
            <AlertTriangle className="w-10 h-10 text-amber-400" />
          </motion.div>
        </motion.div>

        {/* Heading */}
        <motion.div
          className="space-y-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <h1 className="text-2xl font-bold text-slate-100">Payment Cancelled</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Your payment was not completed. Don&apos;t worry — your spot in the pod is
            still reserved and your stake is marked as pending.
          </p>
        </motion.div>

        {/* Info card */}
        <motion.div
          className="bg-slate-800/40 rounded-xl p-4 space-y-3 text-left"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
        >
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-200">Your slot is reserved</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                You can complete the payment anytime from your dashboard. Your pod membership
                stays active, but your stake will remain in &quot;pending&quot; status until
                payment is finalized.
              </p>
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.button
          className="btn-secondary w-full flex items-center justify-center gap-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate({ to: '/dashboard' })}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </motion.button>
      </motion.div>
    </div>
  )
}
