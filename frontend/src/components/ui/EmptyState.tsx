import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-muted flex flex-col items-center gap-2 py-10 text-center"
    >
      <div className="grid size-14 place-items-center rounded-2xl bg-[var(--surface-2)] text-brand-500">{icon}</div>
      <p className="font-medium text-[var(--text)]">{title}</p>
      {hint && <p className="text-sm">{hint}</p>}
    </motion.div>
  )
}
