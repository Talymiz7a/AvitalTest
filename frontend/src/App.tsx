import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import { Layout } from './components/Layout'
import { ScopeDialogProvider } from './components/ScopeDialog'
import { TaskEditorProvider } from './features/editor/TaskEditor'

// Each screen is loaded only when first opened.
const TodayPage = lazy(() => import('./features/today/TodayPage'))
const CalendarPage = lazy(() => import('./features/calendar/CalendarPage'))
const TasksPage = lazy(() => import('./features/tasks/TasksPage'))
const ComingSoon = lazy(() => import('./features/placeholder/ComingSoon'))

const page = (el: React.ReactNode) => (
  <Suspense fallback={<div className="h-40 animate-pulse rounded-3xl bg-[var(--surface-2)]" />}>{el}</Suspense>
)

const router = createBrowserRouter([
  {
    element: (
      <ScopeDialogProvider>
        <TaskEditorProvider>
          <Layout />
        </TaskEditorProvider>
      </ScopeDialogProvider>
    ),
    children: [
      { path: '/', element: page(<TodayPage />) },
      { path: '/calendar', element: page(<CalendarPage />) },
      { path: '/tasks', element: page(<TasksPage />) },
      { path: '/files', element: page(<ComingSoon title="קבצים" hint="העלאה, תצוגה, עריכה ומחיקה של מסמכים – אחרי האישור שלך" />) },
      { path: '/settings', element: page(<ComingSoon title="הגדרות" hint="קטגוריות, תזכורות ברירת מחדל וייצוא ל-Numbers" />) },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
