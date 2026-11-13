'use client';

import React from 'react';
import Link from 'next/link';
import { PhoneCall, Home } from 'lucide-react';
import LogoBruno from '@/components/LogoBruno';
import { TELEFONOS_FIJOS } from '@/lib/constants/telefonos';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-primary-600 to-indigo-600 p-6 text-white text-center">
          <div className="flex justify-center mb-3">
            <LogoBruno size={64} />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider bg-black/20 px-3 py-1 rounded-full">
            Remises Bruno
          </span>
          <h1 className="text-2xl font-black mt-2">
            Página no disponible
          </h1>
          <p className="text-xs text-primary-100 mt-1">
            Si necesitás pedir un remís ahora mismo, podés llamarnos directamente a nuestros teléfonos fijos.
          </p>
        </div>

        <div className="p-6 space-y-4">
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

          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors"
          >
            <Home className="w-4 h-4" />
            Volver al Inicio de la App
          </Link>
        </div>
      </div>
    </div>
  );
}
