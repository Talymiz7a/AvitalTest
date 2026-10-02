/** The backend stores local times without a timezone, so we always send "YYYY-MM-DDTHH:mm:ss". */

const pad = (n: number) => String(n).padStart(2, '0')

export const toLocalISO = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`

export const toDateInput = (d: Date) => toLocalISO(d).slice(0, 10)
export const toDateTimeInput = (d: Date) => toLocalISO(d).slice(0, 16)

/** Parse a backend/local ISO string as local time. */
export const parseLocal = (s: string) => new Date(s.length === 10 ? `${s}T00:00:00` : s)

export const addDays = (d: Date, n: number) => {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

const timeFmt = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat('he-IL', { weekday: 'short', day: 'numeric', month: 'short' })

export const formatTime = (s: string) => timeFmt.format(parseLocal(s))
export const formatDay = (s: string) => dayFmt.format(parseLocal(s))

export function formatWhen(start: string | null, allDay: boolean): string {
  if (!start) return 'ללא תאריך'
  const d = parseLocal(start)
  const today = startOfDay(new Date())
  const diff = Math.round((startOfDay(d).getTime() - today.getTime()) / 86_400_000)
  const day = diff === 0 ? 'היום' : diff === 1 ? 'מחר' : diff === -1 ? 'אתמול' : formatDay(start)
  return allDay ? day : `${day} · ${formatTime(start)}`
}
