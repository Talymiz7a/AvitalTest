import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, FolderOpen, ListTodo, Plus, Settings, Sun } from 'lucide-react'
import { NavLink, useLocation, useOutlet } from 'react-router-dom'

import { useTaskEditor } from '../features/editor/TaskEditor'

const NAV = [
  { to: '/', label: 'היום', icon: Sun },
  { to: '/calendar', label: 'לוח שנה', icon: CalendarDays },
  { to: '/tasks', label: 'משימות', icon: ListTodo },
  { to: '/files', label: 'קבצים', icon: FolderOpen },
  { to: '/settings', label: 'הגדרות', icon: Settings },
]

export function Layout() {
  const location = useLocation()
  const outlet = useOutlet()
  const openEditor = useTaskEditor()

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <nav className="surface hidden w-60 shrink-0 flex-col gap-1 border-y-0 border-s-0 p-4 md:flex" aria-label="ניווט ראשי">
        <div className="mb-6 flex items-center gap-2 px-2">
          <img src="/favicon.svg" alt="" className="size-8" />
          <span className="text-lg font-bold">המשימות שלי</span>
        </div>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className="relative rounded-xl px-3 py-2.5">
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl bg-brand-50 dark:bg-brand-500/15"
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                <span className={clsx('relative flex items-center gap-3 font-medium', isActive ? 'text-brand-700 dark:text-brand-100' : 'text-muted')}>
                  <Icon className="size-5" /> {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => openEditor()}
          className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-brand-600 to-purple-500 px-4 py-3 font-medium text-white shadow-lg shadow-brand-600/30"
        >
          <Plus className="size-5" /> משימה חדשה
        </motion.button>
      </nav>

      <main className="min-w-0 flex-1 overflow-y-auto pb-24 md:pb-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="mx-auto h-full max-w-6xl px-4 py-5 md:px-8 md:py-8"
          >
            {outlet}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile: floating add button + bottom bar */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.2 }}
        onClick={() => openEditor()}
        aria-label="משימה חדשה"
        className="fixed bottom-20 start-4 z-30 grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-purple-500 text-white shadow-xl shadow-brand-600/40 md:hidden"
      >
        <Plus className="size-7" />
      </motion.button>
      <nav
        className="surface fixed inset-x-0 bottom-0 z-30 flex justify-around border-x-0 border-b-0 px-2 pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))] md:hidden"
        aria-label="ניווט ראשי"
      >
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className="relative flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px]">
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span layoutId="nav-active-m" className="absolute -top-1.5 h-1 w-8 rounded-full bg-brand-600" />
                )}
                <Icon className={clsx('size-5', isActive ? 'text-brand-600' : 'text-muted')} />
                <span className={isActive ? 'font-medium text-brand-600' : 'text-muted'}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        {subtitle && <p className="text-muted mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
