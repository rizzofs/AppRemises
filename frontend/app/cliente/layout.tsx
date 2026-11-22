'use client';

import { useState, useEffect } from 'react';
import LogoutButton from '@/components/LogoutButton';
import ThemeToggle from '@/components/ThemeToggle';
import LogoBruno from '@/components/LogoBruno';
import { ThemeModuleProvider } from '@/contexts/ThemeContext';
import { triggerEmergencyPhoneFallback } from '@/components/EmergencyPhoneFallback';
import { PhoneCall, BellRing, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  subscribeToPushNotifications,
  isPushNotificationSupported,
  getNotificationPermissionState,
} from '@/lib/pushNotifications';
import toast from 'react-hot-toast';

export default function ClienteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mostrarBannerPush, setMostrarBannerPush] = useState(false);
  const [activandoPush, setActivandoPush] = useState(false);

  useEffect(() => {
    if (!isPushNotificationSupported()) return;

    const perm = getNotificationPermissionState();
    if (perm === 'granted') {
      // Si ya tiene permiso concedido, sincronizamos la suscripción en segundo plano
      subscribeToPushNotifications().catch(() => {});
    } else if (perm === 'default') {
      // Verificar si el usuario no cerró el banner en esta sesión
      const descartado = sessionStorage.getItem('push_banner_cliente_descartado');
      if (!descartado) {
        setMostrarBannerPush(true);
      }
    }
  }, []);

  const handleActivarNotificaciones = async () => {
    setActivandoPush(true);
    try {
      const res = await subscribeToPushNotifications();
      if (res.success) {
        setMostrarBannerPush(false);
        toast.success('¡Listo! Tu teléfono te avisará cuando el chofer llegue a tu puerta.', {
          icon: '🔔',
          duration: 4500,
        });
      } else {
        toast.error(res.message || 'No se pudieron activar las notificaciones');
      }
    } catch {
      toast.error('Error al solicitar permiso de notificaciones');
    } finally {
      setActivandoPush(false);
    }
  };

  const handleDescartarBanner = () => {
    setMostrarBannerPush(false);
    sessionStorage.setItem('push_banner_cliente_descartado', 'true');
  };

  const isPedirActive = pathname === '/cliente/app' || pathname === '/cliente/reserva';
  const isViajesActive = pathname === '/cliente/viajes';

  return (
    <ThemeModuleProvider>
      <div className="cliente-module min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
        <header className="bg-white dark:bg-slate-900 p-4 shadow-sm sticky top-0 z-30 flex justify-between items-center border-b border-gray-100 dark:border-slate-800 transition-colors">
          <div className="flex items-center gap-2.5">
            <LogoBruno size={34} />
            <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 tracking-tight">
              Remises Bruno
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => triggerEmergencyPhoneFallback({ action: 'solicitar tu remís' })}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-bold transition-colors"
              title="Teléfonos fijos de Remises Bruno"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Teléfonos</span>
            </button>
            {/* Selector de Modo Oscuro / Claro / Sistema */}
            <ThemeToggle />
            <Link 
              href="/cliente/perfil" 
              className="w-8 h-8 rounded-full bg-primary-100 dark:bg-slate-800 flex items-center justify-center text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-slate-700 transition-colors"
              title="Ver Perfil"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </Link>
            <LogoutButton className="text-gray-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400" />
          </div>
        </header>

        {/* Banner discreto para activar alertas cuando el chofer llega a la puerta */}
        {mostrarBannerPush && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2.5 min-w-0">
              <BellRing className="w-4 h-4 shrink-0 animate-bounce" />
              <p className="truncate text-xs font-medium">
                ¿Querés que tu teléfono suene cuando el remis llegue a tu puerta?
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleActivarNotificaciones}
                disabled={activandoPush}
                className="px-2.5 py-1 bg-white text-blue-700 hover:bg-blue-50 rounded-lg font-black text-[11px] uppercase tracking-wider transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {activandoPush ? 'Activando...' : 'Activar'}
              </button>
              <button
                type="button"
                onClick={handleDescartarBanner}
                className="p-1 hover:bg-white/20 rounded-md transition-colors cursor-pointer text-white/80 hover:text-white"
                title="Descartar aviso"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        <nav className="bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 sticky bottom-0 z-20 shadow-lg transition-colors">
          <div className="flex justify-around items-center h-16">
            <Link 
              href="/cliente/app" 
              className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
                isPedirActive 
                  ? 'text-primary-600 dark:text-primary-400 font-semibold border-t-2 border-primary-600 dark:border-primary-400' 
                  : 'text-gray-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-xs mt-1">Pedir</span>
            </Link>
            
            <Link 
              href="/cliente/viajes" 
              className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
                isViajesActive 
                  ? 'text-primary-600 dark:text-primary-400 font-semibold border-t-2 border-primary-600 dark:border-primary-400' 
                  : 'text-gray-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <span className="text-xs mt-1">Mis Viajes</span>
            </Link>
          </div>
        </nav>
      </div>
    </ThemeModuleProvider>
  );
}
