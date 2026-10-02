import clsx from 'clsx'

import type { Priority } from '../../api/types'
import { PRIORITY } from '../../i18n/he'

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', PRIORITY[priority].color)}>
      {PRIORITY[priority].label}
    </span>
  )
}

export function CategoryDot({ color }: { color: string }) {
  return <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: color }} />
}
