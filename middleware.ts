import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // 1. Unconditionally allow container health probes & public endpoints
  const isPublicRoute =
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/signin') ||
    pathname.startsWith('/signup')

  if (isPublicRoute) {
    return supabaseResponse
  }

  // 2. Check for Bearer token in Authorization header (Cognito / API client)
  const authHeader = request.headers.get('authorization')
  const hasBearerToken = authHeader?.startsWith('Bearer ') && authHeader.length > 20

  // 3. Protected routes definition
  const protectedRoutes = ['/borrowers', '/alerts', '/analytics']
  const isProtectedRoute =
    protectedRoutes.some((route) => pathname.startsWith(route)) ||
    (pathname.startsWith('/api/') && !isPublicRoute)

  // Redirect legacy /login to /signin
  if (pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/signin'
    return NextResponse.redirect(url)
  }

  // Exclude signin, signup from protection
  const isAuthRoute = pathname.startsWith('/signin') || pathname.startsWith('/signup')

  const isAuthenticated = Boolean(user || hasBearerToken)

  if (!isAuthenticated && isProtectedRoute) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }
    const url = request.nextUrl.clone()
    url.pathname = '/signin'
    return NextResponse.redirect(url)
  }

  // If user is logged in and tries to access /signin or /signup, redirect to /borrowers
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/borrowers'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images, etc.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
