import { useState } from 'react'
import { motion } from 'framer-motion'
import { Users, Wallet, CheckCircle, ArrowRight, Sparkles } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { useNavigate } from '@tanstack/react-router'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.1 },
  },
}

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as any } },
}

const features = [
  {
    icon: Users,
    title: 'Accountability Pods',
    description:
      'Team up with friends or strangers who share your goals. Stay committed together in small, focused groups.',
  },
  {
    icon: Wallet,
    title: 'Real Stakes',
    description:
      'Put real money on the line. Miss your commitments and your stake gets split among those who showed up.',
  },
  {
    icon: CheckCircle,
    title: 'Daily Check-ins',
    description:
      'Simple daily check-ins keep you honest. Build streaks, earn your stake back, and watch your habits stick.',
  },
]

export default function Landing() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-16 overflow-hidden relative">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-4xl w-full flex flex-col items-center text-center space-y-10"
      >
        {/* Animated logo area */}
        <motion.div variants={item} className="relative">
          <motion.div
            className="w-28 h-28 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center glow-emerald"
            animate={{
              boxShadow: [
                '0 0 20px rgba(16,185,129,0.15), 0 0 60px rgba(16,185,129,0.05)',
                '0 0 30px rgba(16,185,129,0.25), 0 0 80px rgba(16,185,129,0.1)',
                '0 0 20px rgba(16,185,129,0.15), 0 0 60px rgba(16,185,129,0.05)',
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' as any }}
          >
            <span className="text-5xl" role="img" aria-label="seedling">
              🌱
            </span>
          </motion.div>
          <motion.div
            className="absolute -top-1 -right-1"
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' as any }}
          >
            <Sparkles className="w-5 h-5 text-emerald-400/60" />
          </motion.div>
        </motion.div>

        {/* Headline */}
        <motion.div variants={item} className="space-y-4">
          <h1 className="text-6xl sm:text-7xl font-black tracking-tight text-gradient">
            StakePod
          </h1>
          <p className="text-xl sm:text-2xl text-slate-400 font-medium max-w-lg mx-auto">
            Put your money where your habit is.
          </p>
        </motion.div>

        {/* Feature cards */}
        <motion.div
          variants={item}
          className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-3xl"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={feature.title}
                className="glass-card-hover p-6 flex flex-col items-center text-center space-y-3 cursor-default"
                onHoverStart={() => setHoveredFeature(index)}
                onHoverEnd={() => setHoveredFeature(null)}
                whileHover={{ scale: 1.03 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-300 ${
                    hoveredFeature === index
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-100">{feature.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{feature.description}</p>
              </motion.div>
            )
          })}
        </motion.div>

        {/* CTAs */}
        <motion.div variants={item} className="flex items-center gap-4 pt-2">
          {user ? (
            <motion.button
              className="btn-primary flex items-center gap-2 text-lg px-8 py-3"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate({ to: '/dashboard' })}
            >
              Go to Dashboard
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          ) : (
            <>
              <motion.button
                className="btn-primary flex items-center gap-2 text-lg px-8 py-3"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate({ to: '/signup' })}
              >
                Get Started
                <ArrowRight className="w-5 h-5" />
              </motion.button>
              <motion.button
                className="btn-secondary flex items-center gap-2 text-lg px-8 py-3"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate({ to: '/login' })}
              >
                Log In
              </motion.button>
            </>
          )}
        </motion.div>

        {/* Footer note */}
        <motion.p variants={item} className="text-xs text-slate-600 pt-4">
          Build better habits with skin in the game.
        </motion.p>
      </motion.div>
    </div>
  )
}
