import { describe, expect, it } from 'vitest'

import type { Task } from '../../api/types'
import { buildRRule, describeRRule, nthWeekday, parseRRule } from '../../lib/recurrence'
import { changedFields, emptyValues, shiftSeriesTimes, taskFormSchema, taskToValues, valuesToInput } from './formModel'

const valid = () => ({ ...emptyValues(), title: 'לשלם חשמל' })
const errorsOf = (v: unknown) => {
  const r = taskFormSchema.safeParse(v)
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message]))
}

describe('task form validation', () => {
  it('requires a title', () => {
    expect(errorsOf({ ...valid(), title: '   ' })).toHaveProperty('title')
    expect(errorsOf(valid())).toEqual({})
  })

  it('rejects an end before the start', () => {
    expect(errorsOf({ ...valid(), start: '2026-10-06T10:00', end: '2026-10-06T09:00' })).toHaveProperty('end')
  })

  it('requires a date for repeating tasks', () => {
    const v = valid()
    v.repeat.freq = 'WEEKLY'
    expect(errorsOf(v)).toHaveProperty('start')
  })

  it('requires a valid repeat end date', () => {
    const v = { ...valid(), start: '2026-10-06T10:00' }
    v.repeat = { ...v.repeat, freq: 'DAILY', endMode: 'until', until: '' }
    expect(errorsOf(v)).toHaveProperty('repeat.until')
    v.repeat.until = '2026-10-01'
    expect(errorsOf(v)).toHaveProperty('repeat.until')
  })
})

describe('form ⇄ API conversion', () => {
  it('builds local ISO times and default reminders for a new task', () => {
    const input = valuesToInput({ ...valid(), start: '2026-10-06T10:00', end: '2026-10-06T11:30' })
    expect(input.start_at).toBe('2026-10-06T10:00:00')
    expect(input.due_at).toBe('2026-10-06T11:30:00')
    expect(input.reminders).toBeNull()
  })

  it('pre-fills an all-day calendar selection without an extra end day', () => {
    const v = emptyValues({ start: new Date(2026, 9, 6), end: new Date(2026, 9, 7), allDay: true })
    expect(v.start).toBe('2026-10-06')
    expect(v.end).toBe('')
  })

  it('only sends changed fields', () => {
    const before = valuesToInput(valid())
    const after = valuesToInput({ ...valid(), priority: 'high' })
    expect(changedFields(before, after)).toEqual({ priority: 'high' })
  })

  it('shifts a whole series when one repeat is moved with "all"', () => {
    const task = { start_at: '2026-10-05T08:00:00', due_at: '2026-10-05T09:00:00' } as Task
    const after = { start_at: '2026-10-08T10:00:00', due_at: '2026-10-08T12:00:00' } as never
    const diff = shiftSeriesTimes(task, '2026-10-08T08:00:00', after, { start_at: 'x' })
    expect(diff).toEqual({ start_at: '2026-10-05T10:00:00', due_at: '2026-10-05T12:00:00' })
  })

  it('shows the clicked repeat (not the series start) when editing one occurrence', () => {
    const task = {
      title: 'x', description: null, start_at: '2026-10-05T08:00:00', due_at: '2026-10-05T09:00:00', all_day: false,
      priority: 'medium', status: 'todo', category_id: null, tags: [], location: null, rollover: false,
      reminders: [], checklist: [], rrule: 'FREQ=DAILY',
    } as unknown as Task
    const v = taskToValues(task, { occurrence: '2026-10-08T08:00:00', start: '2026-10-08T08:00:00', end: '2026-10-08T09:00:00', status: 'done' })
    expect([v.start, v.end, v.status]).toEqual(['2026-10-08T08:00', '2026-10-08T09:00', 'done'])
  })
})

describe('tasks with only a due date', () => {
  const dueOnly = {
    title: 'x', description: null, start_at: null, due_at: '2026-10-06T17:00:00', all_day: false,
    priority: 'medium', status: 'todo', category_id: null, tags: [], location: null, rollover: false,
    reminders: [], checklist: [], rrule: null,
  } as unknown as Task

  it('moves the due date (not a new start) when the date is changed', () => {
    const before = taskToValues(dueOnly)
    expect(before.start).toBe('2026-10-06T17:00')
    const diff = changedFields(valuesToInput(before), valuesToInput({ ...before, start: '2026-10-08T12:00' }))
    expect(diff).toEqual({ due_at: '2026-10-08T12:00:00' })
  })

  it('becomes a start + end task when an end is added', () => {
    const before = taskToValues(dueOnly)
    const diff = changedFields(valuesToInput(before), valuesToInput({ ...before, end: '2026-10-06T18:00' }))
    expect(diff).toEqual({ start_at: '2026-10-06T17:00:00', due_at: '2026-10-06T18:00:00' })
  })

  it('shifts a due-only series when one repeat is moved with "all"', () => {
    const task = { ...dueOnly, rrule: 'FREQ=DAILY' }
    const after = { start_at: null, due_at: '2026-10-08T19:00:00' } as never
    const diff = shiftSeriesTimes(task, '2026-10-08T17:00:00', after, { due_at: '2026-10-08T19:00:00' })
    expect(diff).toEqual({ due_at: '2026-10-06T19:00:00' })
  })
})

describe('repeat rules', () => {
  it('round-trips weekly days, interval and count', () => {
    const fields = { ...parseRRule(null), freq: 'WEEKLY' as const, interval: 2, byday: ['MO', 'WE'], endMode: 'count' as const, count: 5 }
    const rule = buildRRule(fields, new Date(2026, 9, 5))
    expect(rule).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=5')
    expect(parseRRule(rule)).toMatchObject({ freq: 'WEEKLY', interval: 2, byday: ['MO', 'WE'], endMode: 'count', count: 5 })
    expect(describeRRule(rule)).toBe('כל 2 שבועות')
  })

  it('knows "last Friday" vs "2nd Tuesday"', () => {
    expect(nthWeekday(new Date(2026, 9, 30))).toBe('-1FR')
    expect(nthWeekday(new Date(2026, 9, 13))).toBe('2TU')
  })

  it('writes an inclusive end date', () => {
    const rule = buildRRule({ ...parseRRule(null), freq: 'DAILY', endMode: 'until', until: '2026-12-31' }, new Date())
    expect(rule).toBe('FREQ=DAILY;UNTIL=20261231T235959')
    expect(parseRRule(rule).until).toBe('2026-12-31')
  })
})
