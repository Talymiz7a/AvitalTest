/** Task form: validation schema and conversion between form values and the API shape. */
import { z } from 'zod'

import type { CalendarEvent, Task, TaskInput, TaskStatus } from '../../api/types'
import { addDays, parseLocal, toDateInput, toDateTimeInput, toLocalISO } from '../../lib/dates'
import { buildRRule, parseRRule } from '../../lib/recurrence'

export const taskFormSchema = z
  .object({
    title: z.string().trim().min(1, 'יש להזין כותרת').max(200),
    description: z.string(),
    allDay: z.boolean(),
    start: z.string(), // 'YYYY-MM-DD' when all day, else 'YYYY-MM-DDTHH:mm'; '' = no date
    end: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    status: z.enum(['todo', 'in_progress', 'done', 'cancelled']),
    categoryId: z.string(),
    tags: z.array(z.string()),
    location: z.string().max(300),
    rollover: z.boolean(),
    useDefaultReminders: z.boolean(),
    reminders: z.array(z.number()),
    checklist: z.array(z.object({ text: z.string().trim().min(1), done: z.boolean() })),
    repeat: z.object({
      freq: z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
      interval: z.number().int().min(1, 'לפחות 1').max(365),
      byday: z.array(z.string()),
      monthlyMode: z.enum(['day', 'weekday']),
      endMode: z.enum(['never', 'until', 'count']),
      until: z.string(),
      count: z.number().int().min(1).max(1000),
    }),
  })
  .superRefine((v, ctx) => {
    if (v.start && v.end && v.end < v.start)
      ctx.addIssue({ code: 'custom', path: ['end'], message: 'הסיום חייב להיות אחרי ההתחלה' })
    if (v.end && !v.start)
      ctx.addIssue({ code: 'custom', path: ['start'], message: 'יש לבחור גם מועד התחלה' })
    if (v.repeat.freq !== 'NONE' && !v.start)
      ctx.addIssue({ code: 'custom', path: ['start'], message: 'משימה חוזרת צריכה תאריך' })
    if (v.repeat.freq !== 'NONE' && v.repeat.endMode === 'until') {
      if (!v.repeat.until)
        ctx.addIssue({ code: 'custom', path: ['repeat', 'until'], message: 'יש לבחור תאריך סיום' })
      else if (v.start && v.repeat.until < v.start.slice(0, 10))
        ctx.addIssue({ code: 'custom', path: ['repeat', 'until'], message: 'תאריך הסיום לפני ההתחלה' })
    }
  })

export type TaskFormValues = z.infer<typeof taskFormSchema>

/** What the editor was opened with. */
export interface EditorTarget {
  taskId?: number
  /** For a repeat of a repeating task: which one was clicked. */
  occurrence?: Pick<CalendarEvent, 'occurrence' | 'start' | 'end' | 'status'>
  /** Pre-filled values for a new task (e.g. the calendar slot that was clicked). */
  defaults?: { start?: Date; end?: Date; allDay?: boolean }
}

const toInput = (iso: string | null, allDay: boolean) => {
  if (!iso) return ''
  const d = parseLocal(iso)
  return allDay ? toDateInput(d) : toDateTimeInput(d)
}

export function emptyValues(defaults?: EditorTarget['defaults']): TaskFormValues {
  const allDay = defaults?.allDay ?? false
  const fmt = (d?: Date) => (d ? (allDay ? toDateInput(d) : toDateTimeInput(d)) : '')
  // Calendar all-day selections end on the (exclusive) next day.
  const end = defaults?.end && allDay ? addDays(defaults.end, -1) : defaults?.end
  return {
    title: '',
    description: '',
    allDay,
    start: fmt(defaults?.start),
    end: allDay && end && defaults?.start && toDateInput(end) === toDateInput(defaults.start) ? '' : fmt(end),
    priority: 'medium',
    status: 'todo',
    categoryId: '',
    tags: [],
    location: '',
    rollover: false,
    useDefaultReminders: true,
    reminders: [],
    checklist: [],
    repeat: parseRRule(null),
  }
}

export function taskToValues(task: Task, occ?: EditorTarget['occurrence']): TaskFormValues {
  // When editing one repeat, show that repeat's own date and status.
  const hasBoth = Boolean(task.start_at && task.due_at)
  const start = occ ? occ.start : (task.start_at ?? task.due_at)
  const end = occ ? (hasBoth ? occ.end : null) : hasBoth ? task.due_at : null
  return {
    title: task.title,
    description: task.description ?? '',
    allDay: task.all_day,
    start: toInput(start, task.all_day),
    end: toInput(end, task.all_day),
    priority: task.priority,
    status: (occ?.status ?? task.status) as TaskStatus,
    categoryId: task.category_id ? String(task.category_id) : '',
    tags: task.tags.map((t) => t.name),
    location: task.location ?? '',
    rollover: task.rollover,
    useDefaultReminders: false,
    reminders: task.reminders,
    checklist: task.checklist.map(({ text, done }) => ({ text, done })),
    repeat: parseRRule(task.rrule),
  }
}

const fromInput = (v: string, allDay: boolean) => (v ? (allDay ? `${v}T00:00:00` : `${v}:00`) : null)

export function valuesToInput(v: TaskFormValues): TaskInput {
  const start = fromInput(v.start, v.allDay)
  return {
    title: v.title.trim(),
    description: v.description.trim() || null,
    start_at: start,
    due_at: fromInput(v.end, v.allDay),
    all_day: v.allDay,
    priority: v.priority,
    status: v.status,
    category_id: v.categoryId ? Number(v.categoryId) : null,
    tags: v.tags,
    rrule: buildRRule(v.repeat, start ? parseLocal(start) : null),
    rollover: v.rollover,
    location: v.location.trim() || null,
    checklist: v.checklist,
    reminders: v.useDefaultReminders ? null : v.reminders,
  }
}

/** Only the fields that changed, so editing one repeat stays a small, precise change. */
export function changedFields(before: TaskInput, after: TaskInput): Partial<TaskInput> {
  const diff: Partial<TaskInput> = {}
  for (const key of Object.keys(after) as (keyof TaskInput)[]) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      ;(diff as Record<string, unknown>)[key] = after[key]
    }
  }
  return diff
}

/**
 * For "all repeats" the form shows the clicked repeat's dates. Turn a date change there into
 * the same shift of the whole series (keeping the duration the user picked).
 */
export function shiftSeriesTimes(
  task: Task, occStart: string, after: TaskInput, diff: Partial<TaskInput>,
): Partial<TaskInput> {
  if (!('start_at' in diff) && !('due_at' in diff)) return diff
  if (!after.start_at) return diff
  const newStart = parseLocal(after.start_at).getTime()
  const anchor = parseLocal((task.start_at ?? task.due_at)!).getTime() + newStart - parseLocal(occStart).getTime()
  return {
    ...diff,
    start_at: toLocalISO(new Date(anchor)),
    due_at: after.due_at ? toLocalISO(new Date(anchor + parseLocal(after.due_at).getTime() - newStart)) : null,
  }
}
