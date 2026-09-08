import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Portal from './portal'

export default async function Home() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'participant'

  return <Portal role={role} email={user.email || ''} />
}
