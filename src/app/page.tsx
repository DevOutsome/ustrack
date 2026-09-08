import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Portal from './portal'

export default async function Home() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Query user role via RPC (bypasses RLS)
  const { data: role } = await supabase
    .rpc('get_user_role', { user_id: user.id })

  return <Portal role={role || 'participant'} email={user.email || ''} />
}
