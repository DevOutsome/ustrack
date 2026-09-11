import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Two gates:
 *   1. Signed out            -> /login
 *   2. Signed in, not yet approved -> "/" only, which renders the waiting screen.
 *
 * The second gate has to live here, not just in page.tsx. public/app.html is a
 * static file that ships with a hardcoded fallback schedule AND the Info tab
 * (accommodation address, Wi-Fi password, organiser phone numbers). Without this
 * check, a pending account could open /app.html directly and read all of it even
 * though every API answered 403.
 *
 * /api/* is deliberately excluded: those routes answer with a JSON 403 through
 * requireApproved(), which a fetch() can handle. A redirect would be useless there.
 * /api/profile stays reachable so someone waiting can still enter their name.
 */

const PUBLIC_PATHS = ['/login']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  if (PUBLIC_PATHS.includes(path) || path.startsWith('/auth/')) {
    return supabaseResponse
  }

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // API routes gate themselves and must return JSON, not a redirect.
  if (path.startsWith('/api/')) {
    return supabaseResponse
  }

  // "/" renders the waiting screen itself; anything else is program content.
  if (path !== '/') {
    const { data: approved } = await supabase.rpc('is_approved', { user_id: user.id })
    if (approved !== true) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
