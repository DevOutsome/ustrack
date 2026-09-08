import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Query user role from profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'participant'

  return (
    <iframe
      src={`/app.html?role=${role}&email=${encodeURIComponent(user.email || '')}`}
      className="w-full h-screen border-0"
      title="US Healthcare Track"
    />
  )
}
