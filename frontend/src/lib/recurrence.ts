/** Convert between the repeat fields in the task form and an iCalendar RRULE string. */

export type Freq = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
export type MonthlyMode = 'day' | 'weekday'
export type EndMode = 'never' | 'until' | 'count'

export interface RepeatFields {
  freq: Freq
  interval: number
  byday: string[]
  monthlyMode: MonthlyMode
  endMode: EndMode
  until: string // YYYY-MM-DD
  count: number
}

export const DEFAULT_REPEAT: RepeatFields = {
  freq: 'NONE',
  interval: 1,
  byday: [],
  monthlyMode: 'day',
  endMode: 'never',
  until: '',
  count: 10,
}

const CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

/** e.g. 2nd Tuesday → "2TU"; last Friday of the month → "-1FR". */
export function nthWeekday(date: Date): string {
  const code = CODES[date.getDay()]
  const nextWeek = new Date(date)
  nextWeek.setDate(date.getDate() + 7)
  if (nextWeek.getMonth() !== date.getMonth()) return `-1${code}`
  return `${Math.ceil(date.getDate() / 7)}${code}`
}

export function buildRRule(r: RepeatFields, start: Date | null): string | null {
  if (r.freq === 'NONE') return null
  const parts: string[] = [`FREQ=${r.freq}`]
  if (r.interval > 1) parts.push(`INTERVAL=${r.interval}`)
  if (r.freq === 'WEEKLY' && r.byday.length) parts.push(`BYDAY=${r.byday.join(',')}`)
  if (r.freq === 'MONTHLY' && r.monthlyMode === 'weekday' && start) parts.push(`BYDAY=${nthWeekday(start)}`)
  if (r.endMode === 'until' && r.until) parts.push(`UNTIL=${r.until.replaceAll('-', '')}T235959`)
  if (r.endMode === 'count' && r.count > 0) parts.push(`COUNT=${r.count}`)
  return parts.join(';')
}

export function parseRRule(rule: string | null): RepeatFields {
  if (!rule) return { ...DEFAULT_REPEAT }
  const p = Object.fromEntries(rule.split(';').map((kv) => kv.split('=') as [string, string]))
  const freq = (p.FREQ as Freq) ?? 'NONE'
  const byday = p.BYDAY ? p.BYDAY.split(',') : []
  const until = p.UNTIL ? `${p.UNTIL.slice(0, 4)}-${p.UNTIL.slice(4, 6)}-${p.UNTIL.slice(6, 8)}` : ''
  return {
    freq,
    interval: Number(p.INTERVAL ?? 1),
    byday: freq === 'WEEKLY' ? byday : [],
    monthlyMode: freq === 'MONTHLY' && byday.length ? 'weekday' : 'day',
    endMode: p.COUNT ? 'count' : until ? 'until' : 'never',
    until,
    count: Number(p.COUNT ?? 10),
  }
}

const FREQ_UNIT: Record<Exclude<Freq, 'NONE'>, [string, string]> = {
  DAILY: ['יום', 'ימים'],
  WEEKLY: ['שבוע', 'שבועות'],
  MONTHLY: ['חודש', 'חודשים'],
  YEARLY: ['שנה', 'שנים'],
}

/** Short Hebrew description, e.g. "כל 2 שבועות". */
export function describeRRule(rule: string | null): string | null {
  if (!rule) return null
  const r = parseRRule(rule)
  if (r.freq === 'NONE') return null
  const [one, many] = FREQ_UNIT[r.freq]
  return r.interval > 1 ? `כל ${r.interval} ${many}` : `כל ${one}`
}
