import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'framer-motion'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'

import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* Respect the system "reduce motion" setting for every animation. */}
      <MotionConfig reducedMotion="user">
        <App />
        <Toaster dir="rtl" position="top-center" richColors closeButton />
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
)
