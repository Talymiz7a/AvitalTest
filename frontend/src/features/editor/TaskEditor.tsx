import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion } from 'framer-motion'
import { Repeat, Trash2, X } from 'lucide-react'
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { useDeleteTask, useSaveTask, useTask } from '../../api/hooks'
import type { Scope, Task } from '../../api/types'
import { useAskScope } from '../../components/ScopeDialog'
import { Button } from '../../components/ui/Button'
import { describeRRule } from '../../lib/recurrence'
import { useIsMobile } from '../../lib/useMediaQuery'
import {
  CategoryTagFields, ChecklistField, DateFields, DetailFields, PriorityStatusFields, ReminderFields, RepeatFields,
} from './TaskForm'
import {
  type EditorTarget, type TaskFormValues, changedFields, emptyValues, shiftSeriesTimes, taskFormSchema, taskToValues,
  valuesToInput,
} from './formModel'

const Ctx = createContext<(target?: EditorTarget) => void>(() => {})

/** `openEditor()` for a new task, `openEditor({ taskId, occurrence })` to edit. */
export const useTaskEditor = () => useContext(Ctx)

export function TaskEditorProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<EditorTarget | null>(null)
  const open = useCallback((t?: EditorTarget) => setTarget(t ?? {}), [])
  const close = useCallback(() => setTarget(null), [])

  return (
    <Ctx.Provider value={open}>
      {children}
      <AnimatePresence>{target && <Drawer key={target.taskId ?? 'new'} target={target} onClose={close} />}</AnimatePresence>
    </Ctx.Provider>
  )
}

function Drawer({ target, onClose }: { target: EditorTarget; onClose: () => void }) {
  const isMobile = useIsMobile()
  const { data: task, isLoading } = useTask(target.taskId)
  const hidden = isMobile ? { y: '100%' } : { x: '-100%' } // RTL: the panel lives on the left edge

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={target.taskId ? 'עריכת משימה' : 'משימה חדשה'}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[94dvh] flex-col rounded-t-3xl bg-[var(--surface)] shadow-2xl md:inset-y-0 md:end-0 md:start-auto md:max-h-none md:w-[480px] md:rounded-none md:rounded-e-none md:border-s md:border-[var(--border)]"
        initial={hidden}
        animate={{ x: 0, y: 0 }}
        exit={hidden}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      >
        {target.taskId && (isLoading || !task) ? (
          <div className="flex flex-col gap-4 p-6">
            {[60, 100, 80, 100].map((w, i) => (
              <div key={i} className="h-10 animate-pulse rounded-xl bg-[var(--surface-2)]" style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : (
          <EditorForm target={target} task={task} onClose={onClose} />
        )}
      </motion.aside>
    </>
  )
}

function EditorForm({ target, task, onClose }: { target: EditorTarget; task?: Task; onClose: () => void }) {
  const askScope = useAskScope()
  const save = useSaveTask()
  const remove = useDeleteTask()
  const occ = target.occurrence
  const repeatOfSeries = Boolean(task?.rrule && occ?.occurrence)

  const initial = useMemo(
    () => (task ? taskToValues(task, occ) : emptyValues(target.defaults)),
    [task, occ, target.defaults],
  )
  const form = useForm<TaskFormValues>({ resolver: zodResolver(taskFormSchema), defaultValues: initial })

  // Errors are shown as toasts by the mutation hooks.
  const onSubmit = form.handleSubmit((values) => submit(values).catch(() => {}))

  const submit = async (values: TaskFormValues) => {
    const after = valuesToInput(values)
    if (!task) {
      await save.mutateAsync({ data: after })
      toast.success('המשימה נוספה')
      return onClose()
    }
    let diff = changedFields(valuesToInput(initial), after)
    if (!Object.keys(diff).length) return onClose()

    let scope: Scope = 'all'
    if (repeatOfSeries) {
      const chosen = await askScope('edit')
      if (!chosen) return
      scope = chosen
    }
    if (scope === 'all' && occ && task.rrule) diff = shiftSeriesTimes(task, occ.start, after, diff)
    await save.mutateAsync({ id: task.id, data: diff, scope, occurrence: occ?.occurrence })
    toast.success('השינויים נשמרו')
    onClose()
  }

  const onDelete = async () => {
    if (!task) return
    const scope = await askScope(repeatOfSeries ? 'delete' : 'confirm-delete')
    if (!scope) return
    remove.mutate({ id: task.id, scope, occurrence: occ?.occurrence }, { onSuccess: onClose })
  }

  const repeatText = describeRRule(task?.rrule ?? null)

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
        <header className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-[var(--border)] md:hidden" />
          <h2 className="flex-1 text-lg font-semibold max-md:hidden">{task ? 'עריכת משימה' : 'משימה חדשה'}</h2>
          {repeatText && (
            <span className="flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-700 dark:bg-brand-500/20 dark:text-brand-100">
              <Repeat className="size-3" /> {repeatText}
            </span>
          )}
          <button type="button" onClick={onClose} aria-label="סגירה" className="rounded-lg p-1.5 hover:bg-[var(--surface-2)] max-md:absolute max-md:end-4 max-md:top-3">
            <X className="size-5" />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-5 py-5">
          <div>
            <input
              autoFocus={!task}
              placeholder="מה צריך לעשות?"
              className="w-full bg-transparent text-xl font-semibold outline-none placeholder:text-[var(--muted)]"
              {...form.register('title')}
            />
            {form.formState.errors.title && (
              <p className="mt-1 text-xs text-rose-600" role="alert">{form.formState.errors.title.message}</p>
            )}
          </div>
          <DateFields taskId={task?.id} />
          <RepeatFields />
          <PriorityStatusFields editing={Boolean(task)} />
          <CategoryTagFields />
          <ReminderFields />
          <ChecklistField />
          <DetailFields />
        </div>

        <footer className="flex items-center gap-2 border-t border-[var(--border)] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button type="submit" variant="primary" className="flex-1" disabled={save.isPending}>
            {save.isPending ? 'שומר…' : task ? 'שמירה' : 'הוספת משימה'}
          </Button>
          {task && (
            <Button type="button" variant="danger" onClick={onDelete} disabled={remove.isPending} aria-label="מחיקה">
              <Trash2 className="size-4" /> מחיקה
            </Button>
          )}
        </footer>
      </form>
    </FormProvider>
  )
}
