import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Bell, Check, ListChecks, MapPin, Plus, Repeat, Tag as TagIcon, X } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form'

import { useCategories, useConflicts, useCreateCategory, useTags } from '../../api/hooks'
import type { Priority, TaskStatus } from '../../api/types'
import { PRIORITY, REMINDER_OPTIONS, STATUS, WEEKDAYS, reminderLabel } from '../../i18n/he'
import { formatTime, parseLocal, toLocalISO } from '../../lib/dates'
import { useDebounced } from '../../lib/useDebounced'
import type { TaskFormValues } from './formModel'

export function Section({ icon, title, children }: { icon?: ReactNode; title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      {title && (
        <h3 className="text-muted flex items-center gap-1.5 text-xs font-semibold tracking-wide">
          {icon}
          {title}
        </h3>
      )}
      {children}
    </section>
  )
}

function FieldError({ message }: { message?: string }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="text-xs text-rose-600"
          role="alert"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-brand-600' : 'bg-[var(--border)]',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 600, damping: 35 }}
          className={clsx('absolute top-0.5 size-5 rounded-full bg-white shadow', checked ? 'start-[1.375rem]' : 'start-0.5')}
        />
      </button>
    </label>
  )
}

function Chip({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: ReactNode; color?: string }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'rounded-full border px-3 py-1.5 text-sm transition-colors',
        active ? 'border-transparent text-white' : 'border-[var(--border)] hover:bg-[var(--surface-2)]',
      )}
      style={active ? { background: color ?? 'var(--color-brand-600)' } : undefined}
    >
      {children}
    </motion.button>
  )
}

// ---------------------------------------------------------------- dates

export function DateFields({ taskId }: { taskId?: number }) {
  const { register, control, setValue, getValues, formState: { errors } } = useFormContext<TaskFormValues>()
  const [allDay, start, end, dueOnly] = useWatch({ control, name: ['allDay', 'start', 'end', 'dueOnly'] })

  const toggleAllDay = (next: boolean) => {
    const convert = (v: string) => (!v ? '' : next ? v.slice(0, 10) : `${v.slice(0, 10)}T09:00`)
    setValue('start', convert(getValues('start')))
    setValue('end', convert(getValues('end')))
    setValue('allDay', next, { shouldDirty: true })
  }

  const type = allDay ? 'date' : 'datetime-local'
  return (
    <Section>
      <Toggle checked={allDay} onChange={toggleAllDay} label="כל היום" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{dueOnly && !end ? 'יעד' : allDay ? 'תאריך' : 'התחלה'}</span>
          <input type={type} className="field" {...register('start')} />
          <FieldError message={errors.start?.message} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{allDay ? 'עד תאריך (לא חובה)' : 'סיום / יעד (לא חובה)'}</span>
          <input type={type} className="field" min={start || undefined} {...register('end')} />
          <FieldError message={errors.end?.message} />
        </label>
      </div>
      {!allDay && <ConflictWarning start={start} end={end} taskId={taskId} />}
    </Section>
  )
}

function ConflictWarning({ start, end, taskId }: { start: string; end: string; taskId?: number }) {
  const s = useDebounced(start ? `${start}:00` : null, 400)
  // Without an end time, check the first 30 minutes.
  const fallbackEnd = start ? toLocalISO(new Date(parseLocal(start).getTime() + 30 * 60_000)) : null
  const e = useDebounced(end ? `${end}:00` : fallbackEnd, 400)
  const { data } = useConflicts(s, e, taskId)
  return (
    <AnimatePresence>
      {data && data.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <AlertTriangle className="size-4 shrink-0" />
          <div>
            <p className="font-medium">חופף למשימות אחרות:</p>
            {data.slice(0, 3).map((c) => (
              <p key={c.id}>
                {c.title} · {formatTime(c.start)}
                {c.end && `–${formatTime(c.end)}`}
              </p>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------- repeat

const FREQS = [
  { value: 'NONE', label: 'ללא' },
  { value: 'DAILY', label: 'יומי' },
  { value: 'WEEKLY', label: 'שבועי' },
  { value: 'MONTHLY', label: 'חודשי' },
  { value: 'YEARLY', label: 'שנתי' },
] as const

const UNITS: Record<string, string> = { DAILY: 'ימים', WEEKLY: 'שבועות', MONTHLY: 'חודשים', YEARLY: 'שנים' }
const ORDINAL = ['', 'הראשון', 'השני', 'השלישי', 'הרביעי', 'החמישי']

export function RepeatFields() {
  const { register, control, setValue, formState: { errors } } = useFormContext<TaskFormValues>()
  const [repeat, start] = useWatch({ control, name: ['repeat', 'start'] })
  const startDate = start ? parseLocal(start.length === 10 ? start : `${start}:00`) : null

  const weekdayText = (() => {
    if (!startDate) return 'באותו יום בשבוע'
    const day = WEEKDAYS[startDate.getDay()].long
    const nextWeek = new Date(startDate)
    nextWeek.setDate(startDate.getDate() + 7)
    const nth = nextWeek.getMonth() !== startDate.getMonth() ? 'האחרון' : ORDINAL[Math.ceil(startDate.getDate() / 7)]
    return `ביום ${day} ${nth} בחודש`
  })()

  return (
    <Section icon={<Repeat className="size-3.5" />} title="חזרה">
      <div className="flex flex-wrap gap-2">
        {FREQS.map((f) => (
          <Chip key={f.value} active={repeat.freq === f.value} onClick={() => setValue('repeat.freq', f.value, { shouldDirty: true })}>
            {f.label}
          </Chip>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {repeat.freq !== 'NONE' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-3 overflow-hidden rounded-xl bg-[var(--surface-2)] p-3 text-sm"
          >
            <label className="flex items-center gap-2">
              כל
              <input type="number" min={1} max={365} className="field !w-20" {...register('repeat.interval', { valueAsNumber: true })} />
              {UNITS[repeat.freq]}
            </label>

            {repeat.freq === 'WEEKLY' && (
              <div className="flex flex-wrap gap-1.5" aria-label="ימים בשבוע">
                {WEEKDAYS.map((d) => {
                  const active = repeat.byday.includes(d.code)
                  return (
                    <motion.button
                      key={d.code}
                      type="button"
                      whileTap={{ scale: 0.9 }}
                      title={d.long}
                      aria-pressed={active}
                      onClick={() =>
                        setValue('repeat.byday', active ? repeat.byday.filter((x) => x !== d.code) : [...repeat.byday, d.code], { shouldDirty: true })
                      }
                      className={clsx(
                        'grid size-9 place-items-center rounded-full border text-sm transition-colors',
                        active ? 'border-transparent bg-brand-600 text-white' : 'border-[var(--border)] bg-[var(--surface)]',
                      )}
                    >
                      {d.short}
                    </motion.button>
                  )
                })}
              </div>
            )}

            {repeat.freq === 'MONTHLY' && (
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2">
                  <input type="radio" value="day" {...register('repeat.monthlyMode')} />
                  {startDate ? `ב-${startDate.getDate()} בכל חודש` : 'באותו תאריך בכל חודש'}
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" value="weekday" {...register('repeat.monthlyMode')} />
                  {weekdayText}
                </label>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="text-muted">מסתיים</span>
              <label className="flex items-center gap-2">
                <input type="radio" value="never" {...register('repeat.endMode')} /> אף פעם
              </label>
              <label className="flex flex-wrap items-center gap-2">
                <input type="radio" value="until" {...register('repeat.endMode')} /> בתאריך
                {repeat.endMode === 'until' && <input type="date" className="field !w-auto" {...register('repeat.until')} />}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" value="count" {...register('repeat.endMode')} /> אחרי
                {repeat.endMode === 'count' && (
                  <>
                    <input type="number" min={1} className="field !w-20" {...register('repeat.count', { valueAsNumber: true })} /> פעמים
                  </>
                )}
              </label>
              <FieldError message={errors.repeat?.until?.message ?? errors.repeat?.interval?.message} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  )
}

// ---------------------------------------------------------------- priority & status

export function PriorityStatusFields({ editing }: { editing: boolean }) {
  const { control, register } = useFormContext<TaskFormValues>()
  return (
    <Section title="עדיפות">
      <Controller
        control={control}
        name="priority"
        render={({ field }) => (
          <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-[var(--surface-2)] p-1" role="radiogroup">
            {(Object.keys(PRIORITY) as Priority[]).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={field.value === p}
                onClick={() => field.onChange(p)}
                className="relative rounded-lg py-2 text-sm font-medium"
              >
                {field.value === p && (
                  <motion.span
                    layoutId="priority-pill"
                    className="absolute inset-0 rounded-lg shadow-sm"
                    style={{ background: PRIORITY[p].dot }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className={clsx('relative', field.value === p && 'text-white')}>{PRIORITY[p].label}</span>
              </button>
            ))}
          </div>
        )}
      />
      {editing && (
        <label className="mt-1 flex flex-col gap-1 text-sm">
          <span className="text-muted">סטטוס</span>
          <select className="field" {...register('status')}>
            {(Object.keys(STATUS) as TaskStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS[s]}</option>
            ))}
          </select>
        </label>
      )}
    </Section>
  )
}

// ---------------------------------------------------------------- category & tags

const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#a855f7', '#64748b']

export function CategoryTagFields() {
  const { control, register, setValue } = useFormContext<TaskFormValues>()
  const { data: categories = [] } = useCategories()
  const { data: allTags = [] } = useTags()
  const createCategory = useCreateCategory()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PALETTE[0])
  const [tagText, setTagText] = useState('')
  const tags = useWatch({ control, name: 'tags' })

  const addCategory = async () => {
    if (!newName.trim()) return
    const c = await createCategory.mutateAsync({ name: newName.trim(), color: newColor })
    setValue('categoryId', String(c.id), { shouldDirty: true })
    setAdding(false)
    setNewName('')
  }
  const addTag = () => {
    const name = tagText.trim().replace(/,$/, '')
    if (name && !tags.includes(name)) setValue('tags', [...tags, name], { shouldDirty: true })
    setTagText('')
  }

  return (
    <Section icon={<TagIcon className="size-3.5" />} title="קטגוריה ותגיות">
      <div className="flex gap-2">
        <select className="field" {...register('categoryId')}>
          <option value="">ללא קטגוריה</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button type="button" onClick={() => setAdding((v) => !v)} className="field !w-auto" aria-label="קטגוריה חדשה">
          <Plus className="size-4" />
        </button>
      </div>
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-2 overflow-hidden"
          >
            <input
              className="field"
              placeholder="שם הקטגוריה"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory())}
            />
            <div className="flex items-center gap-2">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => setNewColor(c)}
                  className={clsx('size-7 rounded-full transition-transform', newColor === c && 'scale-110 ring-2 ring-offset-2 ring-[var(--text)] ring-offset-[var(--surface)]')}
                  style={{ background: c }}
                />
              ))}
              <button type="button" onClick={addCategory} className="ms-auto rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white">
                הוספה
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="field flex flex-wrap items-center gap-1.5 !py-2">
        <AnimatePresence initial={false}>
          {tags.map((t) => (
            <motion.span
              key={t}
              layout
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              className="flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-700 dark:bg-brand-500/20 dark:text-brand-100"
            >
              #{t}
              <button type="button" aria-label={`הסרת ${t}`} onClick={() => setValue('tags', tags.filter((x) => x !== t), { shouldDirty: true })}>
                <X className="size-3" />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        <input
          list="tag-suggestions"
          className="min-w-24 flex-1 bg-transparent outline-none"
          placeholder={tags.length ? '' : 'הוספת תגית ואנטר'}
          value={tagText}
          onChange={(e) => (e.target.value.endsWith(',') ? (setTagText(e.target.value), addTag()) : setTagText(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addTag()
            } else if (e.key === 'Backspace' && !tagText && tags.length) setValue('tags', tags.slice(0, -1))
          }}
          onBlur={addTag}
        />
        <datalist id="tag-suggestions">
          {allTags.filter((t) => !tags.includes(t.name)).map((t) => (
            <option key={t.id} value={t.name} />
          ))}
        </datalist>
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------- reminders

export function ReminderFields() {
  const { control, setValue } = useFormContext<TaskFormValues>()
  const [useDefault, reminders, priority] = useWatch({ control, name: ['useDefaultReminders', 'reminders', 'priority'] })
  const available = REMINDER_OPTIONS.filter((o) => !reminders.includes(o.minutes))

  return (
    <Section icon={<Bell className="size-3.5" />} title="תזכורות">
      {useDefault ? (
        <div className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-3 py-2 text-sm">
          <span>לפי ברירת המחדל לעדיפות "{PRIORITY[priority].label}"</span>
          <button type="button" className="text-brand-600" onClick={() => setValue('useDefaultReminders', false, { shouldDirty: true })}>
            התאמה אישית
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          <AnimatePresence initial={false}>
            {reminders.map((m) => (
              <motion.span
                key={m}
                layout
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                className="flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-sm"
              >
                {reminderLabel(m)}
                <button type="button" aria-label="הסרה" onClick={() => setValue('reminders', reminders.filter((x) => x !== m), { shouldDirty: true })}>
                  <X className="size-3.5" />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
          {available.length > 0 && (
            <select
              className="field !w-auto !py-1.5 text-sm"
              value=""
              aria-label="הוספת תזכורת"
              onChange={(e) => setValue('reminders', [...reminders, Number(e.target.value)].sort((a, b) => a - b), { shouldDirty: true })}
            >
              <option value="">+ תזכורת</option>
              {available.map((o) => (
                <option key={o.minutes} value={o.minutes}>{o.label}</option>
              ))}
            </select>
          )}
        </div>
      )}
    </Section>
  )
}

// ---------------------------------------------------------------- checklist

export function ChecklistField() {
  const { control, register } = useFormContext<TaskFormValues>()
  const { fields, append, remove, update } = useFieldArray({ control, name: 'checklist' })
  const items = useWatch({ control, name: 'checklist' })
  const [text, setText] = useState('')
  const done = items.filter((i) => i.done).length

  const add = () => {
    if (text.trim()) append({ text: text.trim(), done: false })
    setText('')
  }

  return (
    <Section icon={<ListChecks className="size-3.5" />} title={fields.length ? `צ'קליסט (${done}/${fields.length})` : "צ'קליסט"}>
      {fields.length > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
          <motion.div className="h-full rounded-full bg-emerald-500" animate={{ width: `${(done / fields.length) * 100}%` }} />
        </div>
      )}
      <ul className="flex flex-col gap-1">
        <AnimatePresence initial={false}>
          {fields.map((f, i) => (
            <motion.li
              key={f.id}
              layout
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-[var(--surface-2)]"
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={items[i]?.done}
                onClick={() => update(i, { text: items[i].text, done: !items[i].done })}
                className={clsx(
                  'grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors',
                  items[i]?.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-[var(--border)]',
                )}
              >
                {items[i]?.done && <Check className="size-3.5" strokeWidth={3} />}
              </button>
              <input
                className={clsx('flex-1 bg-transparent text-sm outline-none', items[i]?.done && 'text-muted line-through')}
                {...register(`checklist.${i}.text`)}
              />
              <button type="button" aria-label="מחיקת פריט" onClick={() => remove(i)} className="opacity-60 hover:opacity-100 md:opacity-0 md:group-hover:opacity-100">
                <X className="size-4" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <div className="flex gap-2">
        <input
          className="field"
          placeholder="פריט חדש…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
        />
        <button type="button" onClick={add} className="field !w-auto" aria-label="הוספת פריט">
          <Plus className="size-4" />
        </button>
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------- details

export function DetailFields() {
  const { register, control, setValue } = useFormContext<TaskFormValues>()
  const rollover = useWatch({ control, name: 'rollover' })
  return (
    <>
      <Section title="תיאור">
        <textarea rows={3} className="field resize-y" placeholder="פרטים נוספים…" {...register('description')} />
      </Section>
      <Section icon={<MapPin className="size-3.5" />} title="מיקום / קישור">
        <input className="field" placeholder="כתובת, קישור לפגישה…" {...register('location')} />
      </Section>
      <Toggle
        checked={rollover}
        onChange={(v) => setValue('rollover', v, { shouldDirty: true })}
        label="אם לא בוצעה בזמן – להעביר אוטומטית להיום"
      />
    </>
  )
}
