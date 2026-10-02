import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { api } from './client'
import type { Agenda, CalendarEvent, Scope, TaskFilters, TaskInput, TaskStatus } from './types'

const PAGE = 50

export const keys = {
  calendar: (start: string, end: string) => ['calendar', start, end] as const,
  agenda: ['agenda'] as const,
  tasks: (f: TaskFilters) => ['tasks', f] as const,
  task: (id: number) => ['task', id] as const,
  categories: ['categories'] as const,
  tags: ['tags'] as const,
}

/** Everything that shows tasks; refreshed after any change. */
const TASK_VIEWS = [['calendar'], ['agenda'], ['tasks'], ['task'], ['tags']]

export function useInvalidateTasks() {
  const qc = useQueryClient()
  return () => Promise.all(TASK_VIEWS.map((queryKey) => qc.invalidateQueries({ queryKey })))
}

export const useCalendar = (start: string, end: string) =>
  useQuery({
    queryKey: keys.calendar(start, end),
    queryFn: () => api.calendar(start, end),
    placeholderData: keepPreviousData,
    enabled: Boolean(start && end),
  })

export const useAgenda = () => useQuery({ queryKey: keys.agenda, queryFn: api.agenda, refetchInterval: 60_000 })

export const useTask = (id: number | undefined) =>
  useQuery({ queryKey: keys.task(id ?? 0), queryFn: () => api.getTask(id!), enabled: Boolean(id) })

export const useTaskList = (filters: TaskFilters) =>
  useInfiniteQuery({
    queryKey: keys.tasks(filters),
    queryFn: ({ pageParam }) => api.listTasks({ ...filters, limit: PAGE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0)
      return loaded < last.total ? loaded : undefined
    },
    placeholderData: keepPreviousData,
  })

export const useCategories = () =>
  useQuery({ queryKey: keys.categories, queryFn: api.categories, staleTime: 5 * 60_000 })

export const useTags = () => useQuery({ queryKey: keys.tags, queryFn: api.tags, staleTime: 5 * 60_000 })

export const useConflicts = (start: string | null, end: string | null, excludeId?: number) =>
  useQuery({
    queryKey: ['conflicts', start, end, excludeId],
    queryFn: () => api.conflicts(start!, end!, excludeId),
    enabled: Boolean(start && end && start < end),
    staleTime: 30_000,
  })

function onError(err: Error) {
  toast.error(err.message)
}

export function useSaveTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (v: { id?: number; data: Partial<TaskInput>; scope?: Scope; occurrence?: string | null }) =>
      v.id ? api.updateTask(v.id, v.data, v.scope, v.occurrence) : api.createTask(v.data as TaskInput),
    onSuccess: invalidate,
    onError,
  })
}

export function useMoveTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (v: { id: number; data: Partial<TaskInput>; scope?: Scope; occurrence?: string | null }) =>
      api.updateTask(v.id, v.data, v.scope, v.occurrence),
    onSettled: invalidate,
    onError,
  })
}

export function useDeleteTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (v: { id: number; scope?: Scope; occurrence?: string | null }) =>
      api.deleteTask(v.id, v.scope, v.occurrence),
    onSuccess: () => {
      toast.success('המשימה נמחקה')
      return invalidate()
    },
    onError,
  })
}

/** Marks a task (or one repeat of it) done/undone, updating every visible list instantly. */
export function useSetStatus() {
  const qc = useQueryClient()
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (v: { id: number; status: TaskStatus; occurrence: string | null }) =>
      api.setStatus(v.id, v.status, v.occurrence),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['agenda'] })
      await qc.cancelQueries({ queryKey: ['calendar'] })
      const patch = (e: CalendarEvent) =>
        e.task_id === v.id && e.occurrence === v.occurrence ? { ...e, status: v.status } : e
      const snapshot = [
        ...qc.getQueriesData<Agenda>({ queryKey: ['agenda'] }),
        ...qc.getQueriesData<CalendarEvent[]>({ queryKey: ['calendar'] }),
      ]
      qc.setQueriesData<Agenda>({ queryKey: ['agenda'] }, (a) =>
        a && { overdue: a.overdue.map(patch), today: a.today.map(patch), upcoming: a.upcoming.map(patch) },
      )
      qc.setQueriesData<CalendarEvent[]>({ queryKey: ['calendar'] }, (list) => list?.map(patch))
      return snapshot
    },
    onError: (err, _v, snapshot) => {
      snapshot?.forEach(([key, data]) => qc.setQueryData(key, data))
      onError(err)
    },
    onSettled: invalidate,
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.categories }),
    onError,
  })
}
