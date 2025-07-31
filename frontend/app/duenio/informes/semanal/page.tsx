'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart3, ArrowLeft, DollarSign, TrendingUp, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function InformeSemanalPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.rol !== 'DUENIO') {
      router.push('/login');
      return;
    }

    // TODO: Cargar datos del informe semanal
    setLoading(false);
  }, [user, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/duenio/dashboard')}
                className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Volver
              </button>
              <BarChart3 className="w-8 h-8 text-green-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Informe Semanal</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card p-8 text-center">
          <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Informe Semanal de Recaudación</h3>
          <p className="text-gray-600 mb-4">
            Aquí podrás ver la recaudación de la semana actual
          </p>
          <p className="text-sm text-gray-500">
            Funcionalidad en desarrollo - Próximamente
          </p>
        </div>
      </div>
    </div>
  );
} 