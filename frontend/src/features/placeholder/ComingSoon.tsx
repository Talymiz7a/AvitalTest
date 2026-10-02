import { Hammer } from 'lucide-react'

import { PageHeader } from '../../components/Layout'
import { EmptyState } from '../../components/ui/EmptyState'

export default function ComingSoon({ title, hint }: { title: string; hint: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState icon={<Hammer />} title="בבנייה – השלב הבא" hint={hint} />
    </>
  )
}
