import { NextResponse, type NextRequest } from 'next/server'

const SESSION_COOKIE = 'sm_session'
const LOGIN_PAGE = '/login'

export default function proxy(request: NextRequest) {
  const loggedIn = Boolean(request.cookies.get(SESSION_COOKIE)?.value)
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/login')) {
    if (loggedIn) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  if (!loggedIn) {
    const url = new URL(LOGIN_PAGE, request.url)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}