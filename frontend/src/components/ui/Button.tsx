import clsx from 'clsx'
import { motion, type HTMLMotionProps } from 'framer-motion'

type Variant = 'primary' | 'ghost' | 'danger' | 'soft'

const styles: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white shadow-md shadow-brand-600/25 hover:bg-brand-700',
  soft: 'bg-[var(--surface-2)] hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-500/15 dark:hover:text-brand-100',
  ghost: 'hover:bg-[var(--surface-2)]',
  danger: 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10',
}

export function Button({ variant = 'soft', className, ...props }: HTMLMotionProps<'button'> & { variant?: Variant }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
        styles[variant],
        className,
      )}
      {...props}
    />
  )
}
