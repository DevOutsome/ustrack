import { createServerSupabase } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/avatar
 *
 * Receives a pre-resized avatar (max 512x512, ≤500KB) from the browser,
 * stores it in the public 'avatars' bucket under the user's ID, and updates
 * users.avatar_url so People/cards/profile all pick it up.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData().catch(() => null)
  if (!formData) return NextResponse.json({ error: 'No form data' }, { status: 400 })

  const file = formData.get('file') as File | null
  if (!file || !file.size) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (file.size > 512_000) return NextResponse.json({ error: 'File too large (max 500KB)' }, { status: 400 })

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${user.id}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
  const url = publicUrl + '?v=' + Date.now()

  await supabase.from('users').update({ avatar_url: url }).eq('id', user.id)

  return NextResponse.json({ ok: true, url })
}
