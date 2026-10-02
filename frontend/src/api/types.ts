export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled'
export type Scope = 'this' | 'following' | 'all'

export interface Category {
  id: number
  name: string
  color: string
  icon: string | null
}

export interface Tag {
  id: number
  name: string
}

export interface ChecklistItem {
  id?: number
  text: string
  done: boolean
}

export interface AttachmentBrief {
  id: number
  original_name: string
  mime: string
  size: number
}

export interface Task {
  id: number
  title: string
  description: string | null
  start_at: string | null
  due_at: string | null
  all_day: boolean
  priority: Priority
  status: TaskStatus
  category_id: number | null
  category: Category | null
  tags: Tag[]
  rrule: string | null
  rollover: boolean
  location: string | null
  source: string
  reminders: number[]
  checklist: ChecklistItem[]
  attachments: AttachmentBrief[]
  created_at: string
  updated_at: string
}

export interface TaskInput {
  title: string
  description: string | null
  start_at: string | null
  due_at: string | null
  all_day: boolean
  priority: Priority
  status: TaskStatus
  category_id: number | null
  tags: string[]
  rrule: string | null
  rollover: boolean
  location: string | null
  checklist: { text: string; done: boolean }[]
  reminders: number[] | null
}

export interface CalendarEvent {
  id: string
  task_id: number
  occurrence: string | null
  title: string
  start: string
  end: string | null
  all_day: boolean
  status: TaskStatus
  priority: Priority
  color: string | null
  category_id: number | null
  recurring: boolean
  has_attachments: boolean
}

export interface Agenda {
  overdue: CalendarEvent[]
  today: CalendarEvent[]
  upcoming: CalendarEvent[]
}

export interface TaskPage {
  items: Task[]
  total: number
}

export interface TaskFilters {
  q?: string
  status?: TaskStatus[]
  priority?: Priority[]
  category_id?: number
  sort?: 'anchor' | 'priority' | 'created' | 'title'
}
