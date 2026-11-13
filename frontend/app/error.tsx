'use client';

import React, { useEffect } from 'react';
import { PhoneCall, RefreshCw, Home, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import LogoBruno from '@/components/LogoBruno';
import { TELEFONOS_FIJOS } from '@/lib/constants/telefonos';

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Error en la aplicación:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 text-white text-center">
          <div className="flex justify-center mb-3">
            <LogoBruno size={64} />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider bg-black/20 px-3 py-1 rounded-full">
            Remises Bruno • Atención Directa
          </span>
          <h1 className="text-2xl font-black mt-2">
            ¡No te quedes sin tu remís!
          </h1>
          <p className="text-xs text-amber-100 mt-1">
            La aplicación tuvo un inconveniente momentáneo, pero estamos atendiendo normalmente por teléfono.
          </p>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-amber-950/40 border border-amber-800/50 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200 leading-relaxed">
              Comunicate ahora mismo a nuestros <strong>teléfonos fijos</strong> para que el coordinador tome tu pedido y te envíe un móvil de inmediato:
            </p>
          </div>

          <div className="space-y-3">
            {TELEFONOS_FIJOS.map((fono) => (
              <a
                key={fono.tel}
                href={`tel:${fono.tel}`}
                className="flex items-center justify-between w-full p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all"
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
                <span className="bg-white text-emerald-700 text-xs font-extrabold px-3 py-1.5 rounded-xl">
                  Llamar
                </span>
              </a>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => reset()}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reintentar
            </button>
            <Link
              href="/"
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-xs font-bold text-white transition-colors"
            >
              <Home className="w-4 h-4" />
              Ir al Inicio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
