import { motion } from 'framer-motion'
import { Paperclip, Repeat } from 'lucide-react'
import { memo } from 'react'

import { useSetStatus } from '../api/hooks'
import type { CalendarEvent } from '../api/types'
import { useTaskEditor } from '../features/editor/TaskEditor'
import { PRIORITY } from '../i18n/he'
import { formatWhen } from '../lib/dates'
import { CheckButton } from './ui/CheckButton'
import { PriorityBadge } from './ui/Badges'

/** One task occurrence in a list (Today page). */
export const EventRow = memo(function EventRow({ event }: { event: CalendarEvent }) {
  const setStatus = useSetStatus()
  const openEditor = useTaskEditor()
  const done = event.status === 'done'

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -30, transition: { duration: 0.2 } }}
      whileHover={{ y: -1 }}
      onClick={() => openEditor({ taskId: event.task_id, occurrence: event })}
      className="surface lazy-row flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 shadow-sm transition-shadow hover:shadow-md"
      style={{ borderInlineStartWidth: 4, borderInlineStartColor: event.color ?? PRIORITY[event.priority].dot }}
    >
      <CheckButton
        checked={done}
        label={done ? 'סימון כלא בוצע' : 'סימון כבוצע'}
        color={event.color ?? PRIORITY[event.priority].dot}
        onChange={(checked) =>
          setStatus.mutate({ id: event.task_id, occurrence: event.occurrence, status: checked ? 'done' : 'todo' })
        }
      />
      <div className="min-w-0 flex-1">
        <p className={done ? 'text-muted truncate line-through' : 'truncate font-medium'}>{event.title}</p>
        <p className="text-muted flex items-center gap-1.5 text-xs">
          {formatWhen(event.start, event.all_day)}
          {event.recurring && <Repeat className="size-3" aria-label="חוזרת" />}
          {event.has_attachments && <Paperclip className="size-3" aria-label="יש קבצים" />}
        </p>
      </div>
      <PriorityBadge priority={event.priority} />
    </motion.li>
  )
})
