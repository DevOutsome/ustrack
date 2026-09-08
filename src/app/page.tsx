import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <iframe
      src="/app.html"
      className="w-full h-screen border-0"
      title="US Healthcare Track"
    />
  )
}
