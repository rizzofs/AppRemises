'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTheme, ThemeMode } from '@/contexts/ThemeContext';
import { Sun, Moon, Monitor, Check } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
  variant?: 'header' | 'inline';
}

export default function ThemeToggle({ className = '', variant = 'header' }: ThemeToggleProps) {
  const { themeMode, resolvedTheme, isDark, setThemeMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const options: { mode: ThemeMode; label: string; description: string; icon: typeof Sun }[] = [
    {
      mode: 'system',
      label: 'Sistema',
      description: 'Adaptable a tu teléfono o PC',
      icon: Monitor,
    },
    {
      mode: 'dark',
      label: 'Modo Oscuro',
      description: 'Recomendado de noche',
      icon: Moon,
    },
    {
      mode: 'light',
      label: 'Modo Claro',
      description: 'Aspecto estándar luminoso',
      icon: Sun,
    },
  ];

  if (variant === 'inline') {
    return (
      <div className={`grid grid-cols-3 gap-2 p-1.5 bg-gray-100 dark:bg-slate-800 rounded-2xl ${className}`}>
        {options.map((opt) => {
          const Icon = opt.icon;
          const isSelected = themeMode === opt.mode;
          return (
            <button
              key={opt.mode}
              type="button"
              onClick={() => setThemeMode(opt.mode)}
              className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${
                isSelected
                  ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm font-bold'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5 mb-1.5" />
              <span className="text-xs">{opt.label}</span>
              {isSelected && themeMode === 'system' && (
                <span className="text-[10px] opacity-75 mt-0.5">
                  ({resolvedTheme === 'dark' ? 'Oscuro' : 'Claro'})
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-xl text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center justify-center relative"
        title={`Tema actual: ${
          themeMode === 'system'
            ? `Sistema (${resolvedTheme === 'dark' ? 'Oscuro' : 'Claro'})`
            : themeMode === 'dark'
            ? 'Modo Oscuro'
            : 'Modo Claro'
        }`}
        aria-label="Cambiar tema de color"
      >
        {themeMode === 'system' ? (
          <div className="relative">
            <Monitor className="w-5 h-5" />
            <span
              className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border border-white dark:border-slate-900 ${
                isDark ? 'bg-amber-400' : 'bg-primary-500'
              }`}
            />
          </div>
        ) : isDark ? (
          <Moon className="w-5 h-5 text-amber-300" />
        ) : (
          <Sun className="w-5 h-5 text-amber-500" />
        )}
      </button>

      {/* Menú desplegable */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-gray-150 dark:border-slate-800 p-2 z-50 animate-scale-up">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-800 mb-1">
            <p className="text-xs font-bold text-gray-800 dark:text-slate-200 uppercase tracking-wider">
              Apariencia
            </p>
            <p className="text-[11px] text-gray-500 dark:text-slate-400">
              Modo visual para la aplicación
            </p>
          </div>

          <div className="space-y-1">
            {options.map((opt) => {
              const Icon = opt.icon;
              const isSelected = themeMode === opt.mode;
              return (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={() => {
                    setThemeMode(opt.mode);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-colors ${
                    isSelected
                      ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 font-semibold'
                      : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span>{opt.label}</span>
                        {opt.mode === 'system' && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-gray-200 dark:bg-slate-700 rounded text-gray-600 dark:text-slate-300">
                            {resolvedTheme === 'dark' ? 'Noche' : 'Día'}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 dark:text-slate-400 font-normal">
                        {opt.description}
                      </p>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
