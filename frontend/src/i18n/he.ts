import type { Priority, Scope, TaskStatus } from '../api/types'

export const PRIORITY: Record<Priority, { label: string; color: string; dot: string }> = {
  low: { label: 'נמוכה', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200', dot: '#94a3b8' },
  medium: { label: 'בינונית', color: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200', dot: '#0ea5e9' },
  high: { label: 'גבוהה', color: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200', dot: '#f59e0b' },
  urgent: { label: 'דחופה', color: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200', dot: '#f43f5e' },
}

export const STATUS: Record<TaskStatus, string> = {
  todo: 'לביצוע',
  in_progress: 'בתהליך',
  done: 'בוצע',
  cancelled: 'בוטל',
}

export const SCOPE: Record<Scope, string> = {
  this: 'רק המופע הזה',
  following: 'המופע הזה וכל הבאים',
  all: 'כל המופעים',
}

export const WEEKDAYS = [
  { code: 'SU', short: 'א׳', long: 'ראשון' },
  { code: 'MO', short: 'ב׳', long: 'שני' },
  { code: 'TU', short: 'ג׳', long: 'שלישי' },
  { code: 'WE', short: 'ד׳', long: 'רביעי' },
  { code: 'TH', short: 'ה׳', long: 'חמישי' },
  { code: 'FR', short: 'ו׳', long: 'שישי' },
  { code: 'SA', short: 'ש׳', long: 'שבת' },
] as const

export const REMINDER_OPTIONS = [
  { minutes: 0, label: 'בזמן המשימה' },
  { minutes: 5, label: '5 דקות לפני' },
  { minutes: 15, label: '15 דקות לפני' },
  { minutes: 30, label: '30 דקות לפני' },
  { minutes: 60, label: 'שעה לפני' },
  { minutes: 120, label: 'שעתיים לפני' },
  { minutes: 1440, label: 'יום לפני' },
  { minutes: 2880, label: 'יומיים לפני' },
  { minutes: 10080, label: 'שבוע לפני' },
]

export const reminderLabel = (m: number) =>
  REMINDER_OPTIONS.find((o) => o.minutes === m)?.label ?? `${m} דקות לפני`
