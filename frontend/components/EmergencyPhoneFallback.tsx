'use client';

import React, { useEffect, useState } from 'react';
import { PhoneCall, AlertTriangle, X } from 'lucide-react';
import LogoBruno from './LogoBruno';
import { TELEFONOS_FIJOS, MENSAJE_TELEFONOS_FALLBACK } from '@/lib/constants/telefonos';

export { TELEFONOS_FIJOS, MENSAJE_TELEFONOS_FALLBACK };

export interface SystemErrorEventDetail {
  status?: number;
  message?: string;
  action?: string;
}

export function triggerEmergencyPhoneFallback(detail?: SystemErrorEventDetail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('remiseria-system-error', { detail: detail || {} }));
  }
}

export default function EmergencyPhoneFallback() {
  const [isOpen, setIsOpen] = useState(false);
  const [errorDetail, setErrorDetail] = useState<SystemErrorEventDetail | null>(null);

  useEffect(() => {
    const handleSystemError = (event: Event) => {
      const customEvent = event as CustomEvent<SystemErrorEventDetail>;
      setErrorDetail(customEvent.detail || {});
      setIsOpen(true);
    };

    window.addEventListener('remiseria-system-error', handleSystemError);

    if (typeof window !== 'undefined' && window.location.search.includes('probarError=1')) {
      setErrorDetail({ action: 'solicitar tu remís' });
      setIsOpen(true);
    }

    return () => {
      window.removeEventListener('remiseria-system-error', handleSystemError);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Cabecera cálida y clara */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-5 text-white relative">
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Cerrar aviso"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <LogoBruno size={48} />
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider bg-black/20 px-2.5 py-0.5 rounded-full">
                Atención Directa • Remises Bruno
              </span>
              <h3 className="text-lg font-black mt-1 leading-tight">
                ¡No te quedes sin viajar!
              </h3>
            </div>
          </div>
        </div>

        {/* Cuerpo del mensaje */}
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-3.5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              <p className="font-bold">
                {errorDetail?.action
                  ? `No pudimos completar "${errorDetail.action}" por la App en este instante.`
                  : 'Ocurrió un inconveniente momentáneo de conexión con el sistema.'}
              </p>
              <p className="mt-1 text-amber-800 dark:text-amber-300">
                Para que no pierdas tiempo, <strong>comunicate directamente a nuestros teléfonos fijos</strong> y el coordinador tomará tu viaje de inmediato:
              </p>
            </div>
          </div>

          {/* Botones de llamada directa a los fijos */}
          <div className="space-y-2.5">
            {TELEFONOS_FIJOS.map((fono) => (
              <a
                key={fono.tel}
                href={`tel:${fono.tel}`}
                className="flex items-center justify-between w-full p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white shadow-lg shadow-emerald-600/20 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <PhoneCall className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <span className="block text-[10px] uppercase tracking-wider text-emerald-100 font-semibold">
                      {fono.label} • Tocar para llamar
                    </span>
                    <span className="text-xl font-black tracking-tight">
                      {fono.display}
                    </span>
                  </div>
                </div>
                <span className="bg-white text-emerald-700 text-xs font-extrabold px-3 py-1.5 rounded-xl group-hover:bg-emerald-50 transition-colors">
                  Llamar ahora
                </span>
              </a>
            ))}
          </div>

          <p className="text-[11px] text-center text-gray-500 dark:text-slate-400">
            Nuestros operadores anotarán tu pedido al instante para enviarte el móvil más cercano.
          </p>

          <button
            onClick={() => setIsOpen(false)}
            className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            Volver a intentar en la App
          </button>
        </div>
      </div>
    </div>
  );
}
