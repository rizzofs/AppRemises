'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { remiseriaService } from '@/lib/api';
import { Remiseria } from '@/types';
import { BarChart3, ArrowLeft, Building, TrendingUp, Users, Calendar } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function EstadisticasPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [remiserias, setRemiserias] = useState<Remiseria[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.rol !== 'DUENIO') {
      router.push('/login');
      return;
    }

    loadRemiserias();
  }, [user, router]);

  const loadRemiserias = async () => {
    try {
      setLoading(true);
      const response = await remiseriaService.getAll();
      
      if (response.success && response.data) {
                // Filtrar solo las remiserías del dueño actual
        const userRemiserias = response.data.filter(remiseria =>
          remiseria.duenios?.some(duenio => duenio.duenioId === user?.duenio?.id)
        );
        setRemiserias(userRemiserias);
      } else {
        toast.error('Error al cargar remiserías');
      }
    } catch (error) {
      console.error('Error loading remiserias:', error);
      toast.error('Error al cargar remiserías');
    } finally {
      setLoading(false);
    }
  };

  const activeRemiserias = remiserias.filter(r => r.estado).length;
  const totalRemiserias = remiserias.length;
  const totalDuenios = remiserias.reduce((total, remiseria) => 
    total + (remiseria.duenios?.length || 0), 0
  );

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
              <BarChart3 className="w-8 h-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Estadísticas</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Resumen de estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card p-6">
            <div className="flex items-center">
              <Building className="w-8 h-8 text-primary-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Remiserías</p>
                <p className="text-2xl font-semibold text-gray-900">{totalRemiserias}</p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Remiserías Activas</p>
                <p className="text-2xl font-semibold text-gray-900">{activeRemiserias}</p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Dueños</p>
                <p className="text-2xl font-semibold text-gray-900">{totalDuenios}</p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center">
              <Calendar className="w-8 h-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Miembro desde</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {new Date(user?.duenio?.createdAt || '').getFullYear()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico de estado de remiserías */}
        <div className="card p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Estado de Remiserías</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Activas</span>
                <span className="text-sm font-semibold text-green-600">{activeRemiserias}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full" 
                  style={{ width: `${totalRemiserias > 0 ? (activeRemiserias / totalRemiserias) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Inactivas</span>
                <span className="text-sm font-semibold text-red-600">{totalRemiserias - activeRemiserias}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-red-600 h-2 rounded-full" 
                  style={{ width: `${totalRemiserias > 0 ? ((totalRemiserias - activeRemiserias) / totalRemiserias) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de remiserías con estadísticas */}
        {remiserias.length > 0 ? (
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Detalle por Remisería</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Remisería
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dueños
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha Creación
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {remiserias.map((remiseria) => (
                    <tr key={remiseria.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {remiseria.nombreFantasia}
                          </div>
                          <div className="text-sm text-gray-500">{remiseria.razonSocial}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            remiseria.estado
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {remiseria.estado ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {remiseria.duenios?.length || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(remiseria.createdAt).toLocaleDateString('es-AR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card p-8 text-center">
            <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay datos para mostrar</h3>
            <p className="text-gray-600 mb-4">
              No tienes remiserías asignadas para generar estadísticas
            </p>
            <button
              onClick={() => router.push('/duenio/dashboard')}
              className="btn btn-primary"
            >
              Volver al Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 