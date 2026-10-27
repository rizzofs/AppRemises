'use client';

import LogoutButton from '@/components/LogoutButton';
import ThemeToggle from '@/components/ThemeToggle';
import { ThemeModuleProvider } from '@/contexts/ThemeContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ClienteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isPedirActive = pathname === '/cliente/app' || pathname === '/cliente/reserva';
  const isViajesActive = pathname === '/cliente/viajes';

  return (
    <ThemeModuleProvider>
      <div className="cliente-module min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
        <header className="bg-white dark:bg-slate-900 p-4 shadow-sm sticky top-0 z-30 flex justify-between items-center border-b border-gray-100 dark:border-slate-800 transition-colors">
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 tracking-tight">
            Remises Bruno
          </h1>
          <div className="flex items-center space-x-2">
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
