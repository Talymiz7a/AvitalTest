import type {
  Agenda, CalendarEvent, Category, Scope, Tag, Task, TaskFilters, TaskInput, TaskPage, TaskStatus,
} from './types'

export class ApiError extends Error {}

type Params = Record<string, string | number | boolean | string[] | null | undefined>

function query(params?: Params): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) value.forEach((v) => qs.append(key, v))
    else qs.append(key, String(value))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

async function request<T>(method: string, path: string, body?: unknown, params?: Params): Promise<T> {
  const res = await fetch(`/api${path}${query(params)}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    let message = `שגיאה (${res.status})`
    try {
      const data = await res.json()
      if (typeof data.detail === 'string') message = data.detail
      else if (Array.isArray(data.detail)) message = data.detail.map((d: { msg: string }) => d.msg).join(', ')
    } catch {
      /* not JSON */
    }
    throw new ApiError(message)
  }
  if (res.status === 204) return undefined as T
  if (!res.headers.get('content-type')?.includes('application/json')) throw new ApiError('השרת לא זמין')
  return res.json()
}

const occurrenceParams = (scope?: Scope, occurrence?: string | null): Params => ({
  scope,
  occurrence: occurrence ?? undefined,
})

export const api = {
  listTasks: (f: TaskFilters & { limit?: number; offset?: number }) =>
    request<TaskPage>('GET', '/tasks', undefined, { ...f }),
  getTask: (id: number) => request<Task>('GET', `/tasks/${id}`),
  createTask: (data: TaskInput) => request<Task>('POST', '/tasks', data),
  updateTask: (id: number, data: Partial<TaskInput>, scope?: Scope, occurrence?: string | null) =>
    request<Task>('PATCH', `/tasks/${id}`, data, occurrenceParams(scope, occurrence)),
  deleteTask: (id: number, scope?: Scope, occurrence?: string | null) =>
    request<void>('DELETE', `/tasks/${id}`, undefined, occurrenceParams(scope, occurrence)),
  setStatus: (id: number, status: TaskStatus, occurrence?: string | null) =>
    request<Task>('POST', `/tasks/${id}/status`, { status, occurrence }),

  calendar: (start: string, end: string) => request<CalendarEvent[]>('GET', '/calendar', undefined, { start, end }),
  conflicts: (start: string, end: string, exclude_task_id?: number) =>
    request<CalendarEvent[]>('GET', '/calendar/conflicts', undefined, { start, end, exclude_task_id }),
  agenda: () => request<Agenda>('GET', '/agenda'),

  categories: () => request<Category[]>('GET', '/categories'),
  createCategory: (data: { name: string; color: string }) => request<Category>('POST', '/categories', data),
  tags: () => request<Tag[]>('GET', '/tags'),
}
