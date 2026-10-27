'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Car, Smartphone, Headphones, Shield, ArrowRight, LogIn, UserPlus } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  // Si el usuario ya está autenticado, redirigir a su portal correspondiente
  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      const hostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
      const isProdDomain = hostname.includes('brunoremises.com.ar');

      if (isProdDomain) {
        if (user.rol === 'CLIENTE') {
          window.location.href = 'https://clientes.brunoremises.com.ar/';
          return;
        } else if (user.rol === 'CHOFER') {
          window.location.href = 'https://choferes.brunoremises.com.ar/';
          return;
        } else if (user.rol === 'COORDINADOR') {
          window.location.href = 'https://coordinacion.brunoremises.com.ar/';
          return;
        } else {
          window.location.href = 'https://admin.brunoremises.com.ar/';
          return;
        }
      }

      // Desarrollo / Localhost
      if (user.rol === 'ADMIN') {
        router.push('/admin/dashboard');
      } else if (user.rol === 'COORDINADOR') {
        router.push('/coordinador/dashboard');
      } else if (user.rol === 'CLIENTE') {
        router.push('/cliente/app');
      } else if (user.rol === 'CHOFER') {
        router.push('/chofer/app');
      } else {
        router.push('/duenio/dashboard');
      }
    }
  }, [loading, isAuthenticated, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-950 to-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600/30 rounded-2xl mb-4 border border-primary-500/30 animate-pulse">
            <Car className="w-8 h-8 text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Remises Bruno</h1>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400 mx-auto mt-4"></div>
        </div>
      </div>
    );
  }

  const portales = [
    {
      title: 'Portal Clientes',
      subdomain: 'clientes.brunoremises.com.ar',
      href: 'https://clientes.brunoremises.com.ar',
      localHref: '/cliente/app',
      desc: 'Pedí tu remís en segundos, seguí el viaje en mapa en tiempo real y conocé tu tarifa antes de viajar.',
      icon: Smartphone,
      badge: 'Pasajeros',
      gradient: 'from-blue-600 to-cyan-600',
      btnColor: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
    {
      title: 'Portal Choferes',
      subdomain: 'choferes.brunoremises.com.ar',
      href: 'https://choferes.brunoremises.com.ar',
      localHref: '/chofer/app',
      desc: 'App de conductor: conectate al turno, aceptá viajes despachados y llevá control de tu odometría y gastos.',
      icon: Car,
      badge: 'Conductores',
      gradient: 'from-emerald-600 to-teal-600',
      btnColor: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    },
    {
      title: 'Central de Coordinación',
      subdomain: 'coordinacion.brunoremises.com.ar',
      href: 'https://coordinacion.brunoremises.com.ar',
      localHref: '/coordinador/dashboard',
      desc: 'Despacho de viajes, mapa en vivo de la flota, asignación de reservas y cierres diarios de caja.',
      icon: Headphones,
      badge: 'Operaciones',
      gradient: 'from-amber-600 to-orange-600',
      btnColor: 'bg-amber-600 hover:bg-amber-700 text-white',
    },
    {
      title: 'Panel de Administración',
      subdomain: 'admin.brunoremises.com.ar',
      href: 'https://admin.brunoremises.com.ar',
      localHref: '/duenio/dashboard',
      desc: 'Gestión integral: liquidaciones de choferes, altas de flota, reportes financieros y configuración.',
      icon: Shield,
      badge: 'Dirección',
      gradient: 'from-purple-600 to-indigo-600',
      btnColor: 'bg-purple-600 hover:bg-purple-700 text-white',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-primary-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-primary-400 flex items-center justify-center shadow-lg shadow-primary-500/20">
              <Car className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-white block">REMISES BRUNO</span>
              <span className="text-[10px] uppercase tracking-widest text-primary-400 font-semibold block -mt-1">
                Plataforma Digital Oficial
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/registro-chofer"
              className="hidden sm:inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Sumate como Chofer</span>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-600/30 transition-all hover:scale-105 active:scale-95"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Iniciar Sesión</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 w-full flex-1 flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto mb-12 lg:mb-16">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-primary-950/80 border border-primary-800/60 text-primary-400 text-xs font-medium mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Sistema en línea 24/7 en tiempo real</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Acceso a los Portales de <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-cyan-400">Remises Bruno</span>
          </h1>
          <p className="mt-4 text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
            Seleccioná tu perfil correspondiente para ingresar directamente a tu portal especializado.
          </p>
        </div>

        {/* Grid de Portales / Subdominios */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {portales.map((portal) => {
            const Icon = portal.icon;
            return (
              <div
                key={portal.title}
                className="group relative bg-slate-900/70 border border-slate-800 hover:border-slate-700 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-900 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${portal.gradient} flex items-center justify-center text-white shadow-lg`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {portal.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-primary-300 transition">
                    {portal.title}
                  </h3>
                  <p className="text-xs font-mono text-primary-400 mt-0.5 break-all">
                    {portal.subdomain}
                  </p>

                  <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                    {portal.desc}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80">
                  <a
                    href={portal.href}
                    className={`w-full flex items-center justify-center space-x-1.5 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-md group-hover:scale-102 ${portal.btnColor}`}
                  >
                    <span>Ingresar</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Remises Bruno • www.brunoremises.com.ar • Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
