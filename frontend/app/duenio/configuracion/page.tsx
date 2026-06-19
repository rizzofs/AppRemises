'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Settings, ArrowLeft, Building, Users, Truck, Car } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ConfiguracionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.rol !== 'DUENIO') {
      router.push('/login');
      return;
    }

    // TODO: Cargar configuraciones
    setLoading(false);
  }, [user, router]);

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="loading-spinner border-primary-500 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mr-4 text-slate-600">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Configuración</h2>
            <p className="text-sm text-slate-500">Ajustes globales de tu cuenta y notificaciones.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
          <Settings className="w-10 h-10 text-slate-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">Configuración del Sistema</h3>
        <p className="text-slate-500 max-w-sm mx-auto mb-6">
          Estamos preparando las opciones avanzadas para que puedas ajustar las notificaciones, integraciones y límites de tus remiserías.
        </p>
        <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-100">
          🚧 Próximamente
        </div>
      </div>
    </div>
  );
}