import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from 'react'

import type { Scope } from '../api/types'
import { SCOPE } from '../i18n/he'
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'

type Kind = 'edit' | 'delete' | 'confirm-delete'
type Ask = (kind: Kind) => Promise<Scope | null>

const Ctx = createContext<Ask>(async () => null)

/** `await askScope('edit')` → which repeats to change ("this" / "following" / "all"), or null if cancelled. */
export const useAskScope = () => useContext(Ctx)

export function ScopeDialogProvider({ children }: { children: ReactNode }) {
  const [kind, setKind] = useState<Kind | null>(null)
  const resolver = useRef<(s: Scope | null) => void>(() => {})

  const ask = useCallback<Ask>(
    (k) =>
      new Promise((resolve) => {
        resolver.current = resolve
        setKind(k)
      }),
    [],
  )
  const answer = useCallback((s: Scope | null) => {
    resolver.current(s)
    setKind(null)
  }, [])

  const title =
    kind === 'confirm-delete' ? 'למחוק את המשימה?' : kind === 'delete' ? 'מחיקת משימה חוזרת' : 'עריכת משימה חוזרת'

  return (
    <Ctx.Provider value={ask}>
      {children}
      <Modal open={kind !== null} onClose={() => answer(null)} title={title}>
        <div className="flex flex-col gap-2">
          {kind === 'confirm-delete' ? (
            <>
              <p className="text-muted mb-2 text-sm">קבצים שצורפו יישארו בספריית הקבצים.</p>
              <Button variant="primary" className="!bg-rose-600 hover:!bg-rose-700" onClick={() => answer('all')}>
                מחיקה
              </Button>
            </>
          ) : (
            (Object.keys(SCOPE) as Scope[]).map((s) => (
              <Button key={s} variant={s === 'this' ? 'primary' : 'soft'} onClick={() => answer(s)}>
                {SCOPE[s]}
              </Button>
            ))
          )}
          <Button variant="ghost" onClick={() => answer(null)}>
            ביטול
          </Button>
        </div>
      </Modal>
    </Ctx.Provider>
  )
}
