'use client';

import React from 'react';

export default function GlobalFatalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', backgroundColor: '#020617', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '16px' }}>
        <div style={{ maxWidth: '420px', width: '100%', backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
          <div style={{ background: 'linear-gradient(to right, #f59e0b, #ea580c)', padding: '24px', textAlign: 'center' }}>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: 900 }}>¡No te quedes sin viajar!</h1>
            <p style={{ margin: 0, fontSize: '13px', opacity: 0.95 }}>
              Tuvimos un inconveniente técnico en la App. Comunicate a nuestros teléfonos fijos para pedir tu remís al instante:
            </p>
          </div>
          <div style={{ padding: '24px' }}>
            <a
              href="tel:2346427637"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#059669', color: '#fff', textDecoration: 'none', padding: '16px', borderRadius: '16px', marginBottom: '12px', fontWeight: 800, fontSize: '18px' }}
            >
              <span>📞 2346-427637</span>
              <span style={{ fontSize: '12px', backgroundColor: '#fff', color: '#047857', padding: '6px 10px', borderRadius: '8px' }}>Llamar</span>
            </a>
            <a
              href="tel:2346433000"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#059669', color: '#fff', textDecoration: 'none', padding: '16px', borderRadius: '16px', marginBottom: '20px', fontWeight: 800, fontSize: '18px' }}
            >
              <span>📞 2346-433000</span>
              <span style={{ fontSize: '12px', backgroundColor: '#fff', color: '#047857', padding: '6px 10px', borderRadius: '8px' }}>Llamar</span>
            </a>
            <button
              onClick={() => reset()}
              style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              Reintentar en la App
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
