import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { ListTodo, Paperclip, Repeat, Search } from 'lucide-react'
import { memo, useState } from 'react'

import { useCategories, useSetStatus, useTaskList } from '../../api/hooks'
import type { Priority, Task, TaskFilters, TaskStatus } from '../../api/types'
import { PageHeader } from '../../components/Layout'
import { CategoryDot, PriorityBadge } from '../../components/ui/Badges'
import { Button } from '../../components/ui/Button'
import { CheckButton } from '../../components/ui/CheckButton'
import { EmptyState } from '../../components/ui/EmptyState'
import { PRIORITY, STATUS } from '../../i18n/he'
import { formatWhen } from '../../lib/dates'
import { describeRRule } from '../../lib/recurrence'
import { useDebounced } from '../../lib/useDebounced'
import { useTaskEditor } from '../editor/TaskEditor'

const SORTS = { anchor: 'לפי תאריך', priority: 'לפי עדיפות', created: 'החדשות ביותר', title: 'לפי שם' } as const

export default function TasksPage() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<TaskStatus[]>(['todo', 'in_progress'])
  const [priority, setPriority] = useState<Priority[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [sort, setSort] = useState<NonNullable<TaskFilters['sort']>>('anchor')
  const { data: categories = [] } = useCategories()

  const filters: TaskFilters = {
    q: useDebounced(q.trim(), 300) || undefined,
    status,
    priority,
    category_id: categoryId ? Number(categoryId) : undefined,
    sort,
  }
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useTaskList(filters)
  const tasks = data?.pages.flatMap((p) => p.items) ?? []
  const total = data?.pages[0]?.total ?? 0

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  return (
    <>
      <PageHeader title="כל המשימות" subtitle={data ? `${total} משימות` : undefined} />

      <div className="surface mb-5 flex flex-col gap-3 rounded-2xl p-4 shadow-sm">
        <div className="relative">
          <Search className="text-muted pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
          <input className="field !ps-9" placeholder="חיפוש משימות…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(STATUS) as TaskStatus[]).map((s) => (
            <FilterChip key={s} active={status.includes(s)} onClick={() => setStatus(toggle(status, s))}>
              {STATUS[s]}
            </FilterChip>
          ))}
          <span className="mx-1 h-5 w-px bg-[var(--border)]" />
          {(Object.keys(PRIORITY) as Priority[]).map((p) => (
            <FilterChip key={p} active={priority.includes(p)} color={PRIORITY[p].dot} onClick={() => setPriority(toggle(priority, p))}>
              {PRIORITY[p].label}
            </FilterChip>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="קטגוריה">
            <option value="">כל הקטגוריות</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select className="field" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="מיון">
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState icon={<ListTodo />} title="לא נמצאו משימות" hint="נסו לשנות את הסינון או להוסיף משימה חדשה" />
      ) : (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {tasks.map((t) => (
              <TaskListRow key={t.id} task={t} />
            ))}
          </AnimatePresence>
        </ul>
      )}
      {hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'טוען…' : 'טעינת עוד'}
          </Button>
        </div>
      )}
    </>
  )
}

function FilterChip({ active, onClick, color, children }: { active: boolean; onClick: () => void; color?: string; children: React.ReactNode }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.93 }}
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
        active ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100' : 'border-[var(--border)] text-muted',
      )}
    >
      {color && <span className="size-2 rounded-full" style={{ background: color }} />}
      {children}
    </motion.button>
  )
}

const TaskListRow = memo(function TaskListRow({ task }: { task: Task }) {
  const openEditor = useTaskEditor()
  const setStatus = useSetStatus()
  const done = task.status === 'done'
  const repeat = describeRRule(task.rrule)
  const color = task.category?.color ?? PRIORITY[task.priority].dot
  const checklistDone = task.checklist.filter((c) => c.done).length

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      onClick={() => openEditor({ taskId: task.id })}
      className="surface lazy-row flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 shadow-sm transition-shadow hover:shadow-md"
    >
      {task.rrule ? (
        <span className="grid size-6 shrink-0 place-items-center text-brand-500" title="משימה חוזרת – סימון ביצוע דרך היום / לוח השנה">
          <Repeat className="size-4" />
        </span>
      ) : (
        <CheckButton
          checked={done}
          color={color}
          label={done ? 'סימון כלא בוצע' : 'סימון כבוצע'}
          onChange={(c) => setStatus.mutate({ id: task.id, occurrence: null, status: c ? 'done' : 'todo' })}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className={done ? 'text-muted truncate line-through' : 'truncate font-medium'}>{task.title}</p>
        <div className="text-muted mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span>{formatWhen(task.start_at ?? task.due_at, task.all_day)}</span>
          {repeat && <span>· {repeat}</span>}
          {task.category && (
            <span className="flex items-center gap-1">
              <CategoryDot color={task.category.color} /> {task.category.name}
            </span>
          )}
          {task.checklist.length > 0 && <span>☑ {checklistDone}/{task.checklist.length}</span>}
          {task.attachments.length > 0 && (
            <span className="flex items-center gap-0.5"><Paperclip className="size-3" />{task.attachments.length}</span>
          )}
          {task.tags.map((t) => (
            <span key={t.id} className="text-brand-600">#{t.name}</span>
          ))}
        </div>
      </div>
      <PriorityBadge priority={task.priority} />
    </motion.li>
  )
})
