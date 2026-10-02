import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'

interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
  color?: string
  label: string
}

/** Round checkbox with a little burst when ticked. */
export function CheckButton({ checked, onChange, color = '#6366f1', label }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      className="relative grid size-6 shrink-0 place-items-center"
    >
      <motion.span
        className={clsx('absolute inset-0 rounded-full border-2')}
        style={{ borderColor: color, background: checked ? color : 'transparent' }}
        animate={{ scale: checked ? [1, 1.25, 1] : 1 }}
        transition={{ duration: 0.3 }}
      />
      <svg viewBox="0 0 24 24" className="relative size-4" fill="none" stroke="white" strokeWidth={3.5}>
        <motion.path
          d="M5 12.5l4.5 4.5L19 7.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0 }}
          transition={{ duration: 0.25, delay: checked ? 0.08 : 0 }}
        />
      </svg>
      <AnimatePresence>
        {checked &&
          [0, 60, 120, 180, 240, 300].map((deg) => (
            <motion.span
              key={deg}
              className="absolute size-1.5 rounded-full"
              style={{ background: color }}
              initial={{ opacity: 1, x: 0, y: 0 }}
              animate={{
                opacity: 0,
                x: Math.cos((deg * Math.PI) / 180) * 16,
                y: Math.sin((deg * Math.PI) / 180) * 16,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            />
          ))}
      </AnimatePresence>
    </button>
  )
}
