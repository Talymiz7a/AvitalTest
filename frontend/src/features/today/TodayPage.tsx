import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, CalendarClock, PartyPopper, Sun, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'

import { useAgenda } from '../../api/hooks'
import type { CalendarEvent } from '../../api/types'
import { PageHeader } from '../../components/Layout'
import { EventRow } from '../../components/TaskRow'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב'
}

const longDate = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })

export default function TodayPage() {
  const { data, isLoading, isError, refetch } = useAgenda()
  const today = data?.today ?? []
  const done = today.filter((e) => e.status === 'done').length

  return (
    <>
      <PageHeader title={greeting()} subtitle={longDate.format(new Date())}>
        {today.length > 0 && <ProgressRing done={done} total={today.length} />}
      </PageHeader>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
          ))}
        </div>
      ) : isError || !data ? (
        <div className="flex flex-col items-center gap-3">
          <EmptyState icon={<WifiOff />} title="לא הצלחנו לטעון את המשימות" hint="ודאו שהשרת פועל (./dev.sh) ונסו שוב" />
          <Button onClick={() => refetch()}>נסו שוב</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {data.overdue.length > 0 && (
            <Group title="באיחור" icon={<AlertCircle className="size-4 text-rose-500" />} events={data.overdue} />
          )}
          <Group title="היום" icon={<Sun className="size-4 text-amber-500" />} events={today}>
            <EmptyState icon={<PartyPopper />} title="אין משימות להיום" hint="אפשר להוסיף משימה בכפתור +" />
          </Group>
          <Group title="בשבוע הקרוב" icon={<CalendarClock className="size-4 text-brand-500" />} events={data.upcoming}>
            <p className="text-muted text-sm">אין משימות מתוכננות לשבוע הקרוב.</p>
          </Group>
        </div>
      )}
    </>
  )
}

function Group({ title, icon, events, children }: { title: string; icon: ReactNode; events: CalendarEvent[]; children?: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        {icon} {title}
        <span className="text-muted text-sm font-normal">{events.length || ''}</span>
      </h2>
      {events.length === 0 ? (
        children
      ) : (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {events.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  )
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 22
  const c = 2 * Math.PI * r
  const pct = total ? done / total : 0
  return (
    <div className="flex items-center gap-3" aria-label={`בוצעו ${done} מתוך ${total}`}>
      <svg viewBox="0 0 52 52" className="size-14 -rotate-90">
        <circle cx="26" cy="26" r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
        <motion.circle
          cx="26" cy="26" r={r} fill="none" stroke="url(#ring)" strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ type: 'spring', stiffness: 80, damping: 20 }}
        />
        <defs>
          <linearGradient id="ring"><stop offset="0" stopColor="#6366f1" /><stop offset="1" stopColor="#a855f7" /></linearGradient>
        </defs>
      </svg>
      <div className="text-sm">
        <p className="font-semibold">{done}/{total}</p>
        <p className="text-muted">בוצעו היום</p>
      </div>
    </div>
  )
}
