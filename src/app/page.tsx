import { getAccess } from '@/lib/access'
import { redirect } from 'next/navigation'
import Portal from './portal'
import Pending from './pending'

export default async function Home() {
  const access = await getAccess()

  if (!access) {
    redirect('/login')
  }

  // New accounts wait for an organiser. Until then they see nothing about the
  // program - not the schedule, not the address, not who else is coming.
  if (!access.approved) {
    return <Pending email={access.email} />
  }

  return <Portal role={access.role} email={access.email} />
}
