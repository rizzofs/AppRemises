import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get('host')?.toLowerCase() || '';
  const hostname = host.split(':')[0]; // Remover puerto si existe
  const pathname = url.pathname;

  // 1. Omitir recursos estáticos, _next, api interna, favicon, imágenes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 2. Extraer subdominio
  let subdomain = '';
  if (hostname.endsWith('.brunoremises.com.ar')) {
    subdomain = hostname.replace('.brunoremises.com.ar', '');
  } else if (hostname.endsWith('.localhost')) {
    subdomain = hostname.replace('.localhost', '');
  } else {
    // Soporte para pruebas en Vercel o CNAME
    const parts = hostname.split('.');
    if (parts.length >= 3 && parts[0] !== 'www') {
      subdomain = parts[0];
    }
  }

  if (subdomain === 'www') {
    subdomain = '';
  }

  // Rutas de autenticación globales permitidas en cualquier subdominio
  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/registro') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password');

  if (isAuthRoute) {
    return NextResponse.next();
  }

  // 3. Manejo por subdominio

  // --- SUBDOMINIO: CLIENTES (clientes.brunoremises.com.ar) ---
  if (subdomain === 'clientes') {
    if (pathname === '/') {
      url.pathname = '/cliente/app';
      return NextResponse.rewrite(url);
    }
    if (pathname.startsWith('/cliente/')) {
      return NextResponse.next();
    }
    if (['/app', '/viajes', '/reserva', '/perfil'].includes(pathname)) {
      url.pathname = `/cliente${pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // --- SUBDOMINIO: CHOFERES (choferes.brunoremises.com.ar) ---
  if (subdomain === 'choferes') {
    if (pathname === '/') {
      url.pathname = '/chofer/app';
      return NextResponse.rewrite(url);
    }
    if (pathname.startsWith('/chofer/')) {
      return NextResponse.next();
    }
    if (['/app', '/gastos', '/historial', '/perfil'].includes(pathname)) {
      url.pathname = `/chofer${pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // --- SUBDOMINIO: COORDINACIÓN (coordinacion.brunoremises.com.ar) ---
  if (subdomain === 'coordinacion' || subdomain === 'coordinador') {
    if (pathname === '/') {
      url.pathname = '/coordinador/dashboard';
      return NextResponse.rewrite(url);
    }
    if (pathname.startsWith('/coordinador/')) {
      return NextResponse.next();
    }
    if (
      ['/dashboard', '/mapa', '/cierre', '/choferes', '/reportes'].includes(pathname) ||
      pathname.startsWith('/viajes') ||
      pathname.startsWith('/reservas')
    ) {
      url.pathname = `/coordinador${pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // --- SUBDOMINIO: ADMIN / DUEÑO (admin.brunoremises.com.ar) ---
  if (subdomain === 'admin' || subdomain === 'duenio') {
    if (pathname === '/') {
      url.pathname = '/duenio/dashboard';
      return NextResponse.rewrite(url);
    }
    if (pathname.startsWith('/duenio/') || pathname.startsWith('/admin/')) {
      return NextResponse.next();
    }
    if (
      [
        '/dashboard',
        '/choferes',
        '/vehiculos',
        '/coordinadores',
        '/liquidaciones',
        '/estadisticas',
        '/remiserias',
        '/configuracion',
        '/perfil',
      ].includes(pathname) ||
      pathname.startsWith('/informes')
    ) {
      url.pathname = `/duenio${pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // Dominio principal (www.brunoremises.com.ar o brunoremises.com.ar)
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
