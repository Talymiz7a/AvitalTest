import type {
  DateSelectArg, DatesSetArg, EventClickArg, EventContentArg, EventDropArg, EventInput,
} from '@fullcalendar/core'
import heLocale from '@fullcalendar/core/locales/he'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, { type EventResizeDoneArg } from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Paperclip, Repeat } from 'lucide-react'
import { useMemo, useState } from 'react'

import { api } from '../../api/client'
import { keys, useCalendar, useMoveTask } from '../../api/hooks'
import type { CalendarEvent, Scope } from '../../api/types'
import { useAskScope } from '../../components/ScopeDialog'
import { PRIORITY } from '../../i18n/he'
import { addDays, parseLocal, toLocalISO } from '../../lib/dates'
import { useIsMobile } from '../../lib/useMediaQuery'
import { useTaskEditor } from '../editor/TaskEditor'

function toInput(e: CalendarEvent): EventInput {
  const color = e.color ?? PRIORITY[e.priority].dot
  return {
    id: e.id,
    title: e.title,
    start: e.start,
    // FullCalendar's all-day end is exclusive; ours is the last day itself.
    end: e.end ? (e.all_day ? toLocalISO(addDays(parseLocal(e.end), 1)) : e.end) : undefined,
    allDay: e.all_day,
    backgroundColor: color,
    borderColor: color,
    classNames: e.status === 'done' || e.status === 'cancelled' ? ['ev-done'] : [],
    extendedProps: { source: e },
  }
}

function EventContent({ event, timeText, view }: EventContentArg) {
  const e = event.extendedProps.source as CalendarEvent
  // List view draws events on the page background; the other views on a colored block.
  const onColor = !view.type.startsWith('list')
  return (
    <div className={clsx('flex items-center gap-1 overflow-hidden', onColor && 'text-white')}>
      {timeText && <span className="shrink-0 text-[0.7rem] opacity-80">{timeText}</span>}
      <span className="fc-event-title truncate font-medium">{event.title}</span>
      {e.recurring && <Repeat className="size-3 shrink-0 opacity-80" />}
      {e.has_attachments && <Paperclip className="size-3 shrink-0 opacity-80" />}
    </div>
  )
}

export default function CalendarPage() {
  const isMobile = useIsMobile()
  const [range, setRange] = useState({ start: '', end: '' })
  const { data } = useCalendar(range.start, range.end)
  const events = useMemo(() => (data ?? []).map(toInput), [data])
  const openEditor = useTaskEditor()
  const askScope = useAskScope()
  const move = useMoveTask()
  const qc = useQueryClient()

  const onDatesSet = (arg: DatesSetArg) => setRange({ start: toLocalISO(arg.start), end: toLocalISO(arg.end) })

  const onSelect = (arg: DateSelectArg) => {
    arg.view.calendar.unselect()
    openEditor({ defaults: { start: arg.start, end: arg.end, allDay: arg.allDay } })
  }

  const onClick = (arg: EventClickArg) => {
    const e = arg.event.extendedProps.source as CalendarEvent
    openEditor({ taskId: e.task_id, occurrence: e })
  }

  /** Drag to a new time, or drag the edge to change the length. */
  const onChange = async (arg: EventDropArg | EventResizeDoneArg) => {
    const e = arg.event.extendedProps.source as CalendarEvent
    const allDay = arg.event.allDay
    const newStart = arg.event.start!
    const rawEnd = arg.event.end
    const newEnd = rawEnd ? (allDay ? addDays(rawEnd, -1) : rawEnd) : null

    let scope: Scope = 'all'
    if (e.recurring) {
      const chosen = await askScope('edit')
      if (!chosen) return arg.revert()
      scope = chosen
    }
    const task = await qc.fetchQuery({ queryKey: keys.task(e.task_id), queryFn: () => api.getTask(e.task_id) })
    const delta = newStart.getTime() - parseLocal(e.start).getTime()
    const shift = (iso: string | null) => (iso ? toLocalISO(new Date(parseLocal(iso).getTime() + delta)) : null)
    const endISO = newEnd ? toLocalISO(newEnd) : null

    let data
    if (scope === 'all' && e.recurring) {
      // Shift the whole series by the same amount (and apply a resize to its length).
      const start = shift(task.start_at)
      const due = task.start_at && task.due_at && endISO
        ? toLocalISO(new Date(parseLocal(start!).getTime() + newEnd!.getTime() - newStart.getTime()))
        : shift(task.due_at)
      data = { start_at: start, due_at: due }
    } else if (!task.start_at) {
      // A task with only a due date (a single moved repeat is stored as a new start).
      data = scope === 'this' && e.recurring ? { start_at: toLocalISO(newStart) } : { due_at: toLocalISO(newStart) }
    } else {
      data = { start_at: toLocalISO(newStart), due_at: task.due_at ? endISO : null }
    }
    if (allDay !== e.all_day) Object.assign(data, { all_day: allDay })
    move.mutate({ id: e.task_id, data, scope, occurrence: e.occurrence }, { onError: () => arg.revert() })
  }

  return (
    <div className="surface h-[calc(100dvh-8.5rem)] rounded-3xl p-3 shadow-sm md:h-[calc(100dvh-4rem)] md:p-5">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        locale={heLocale}
        direction="rtl"
        height="100%"
        initialView={isMobile ? 'listWeek' : 'dayGridMonth'}
        headerToolbar={
          isMobile
            ? { start: 'title', center: '', end: 'prev,today,next' }
            : { start: 'prev,next today', center: 'title', end: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' }
        }
        footerToolbar={isMobile ? { center: 'listWeek,timeGridDay,dayGridMonth' } : undefined}
        buttonText={{ listWeek: 'רשימה' }}
        events={events}
        eventContent={EventContent}
        eventDisplay="block"
        datesSet={onDatesSet}
        selectable
        selectMirror
        editable
        eventDurationEditable
        longPressDelay={350}
        select={onSelect}
        eventClick={onClick}
        eventDrop={onChange}
        eventResize={onChange}
        nowIndicator
        dayMaxEvents={3}
        scrollTime="07:00:00"
        firstDay={0}
        slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
      />
    </div>
  )
}
