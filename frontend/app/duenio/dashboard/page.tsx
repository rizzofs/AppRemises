'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { remiseriaService } from '@/lib/api';
import { Remiseria } from '@/types';
import { Car, Building, LogOut, Plus, Eye, Users, Truck, BarChart3, Settings, DollarSign, Calendar } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function DuenioDashboard() {
  const { user, logout } = useAuth();
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
          remiseria.duenios?.some(duenio => duenio.duenioId === user.duenio?.id)
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

  const handleLogout = () => {
    logout();
    router.push('/login');
    toast.success('Sesión cerrada');
  };

  const activeRemiserias = remiserias.filter(r => r.estado).length;
  const totalRemiserias = remiserias.length;
  
  // Calcular estadísticas totales (solo elementos activos)
  const totalCoordinadores = remiserias.reduce((total, remiseria) => 
    total + (remiseria.coordinadores?.filter(c => c.activo).length || 0), 0
  );
  
  const totalChoferes = remiserias.reduce((total, remiseria) => 
    total + (remiseria.choferes?.filter(c => c.estado === 'ACTIVO').length || 0), 0
  );
  
  const totalVehiculos = remiserias.reduce((total, remiseria) => 
    total + (remiseria.vehiculos?.filter(v => v.estado === 'ACTIVO').length || 0), 0
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
              <Car className="w-8 h-8 text-primary-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">App Remises - Dueño</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Bienvenido, {user?.duenio?.nombre}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Información del dueño */}
        <div className="card p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{user?.duenio?.nombre}</h2>
              <p className="text-gray-600">{user?.email}</p>
              <p className="text-sm text-gray-500">{user?.duenio?.telefono}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Miembro desde</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(user?.duenio?.createdAt || '').toLocaleDateString('es-AR')}
              </p>
            </div>
          </div>
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card p-6">
            <div className="flex items-center">
              <Building className="w-8 h-8 text-primary-600" />
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
                <p className="text-sm font-medium text-gray-600">Coordinadores</p>
                <p className="text-2xl font-semibold text-gray-900">{totalCoordinadores}</p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center">
              <Truck className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Choferes</p>
                <p className="text-2xl font-semibold text-gray-900">{totalChoferes}</p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center">
              <Car className="w-8 h-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Vehículos</p>
                <p className="text-2xl font-semibold text-gray-900">{totalVehiculos}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Gestión de Personal y Vehículos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <button
            onClick={() => router.push('/duenio/coordinadores')}
            className="card card-hover p-6"
          >
            <div className="flex items-center">
              <Users className="w-6 h-6 text-blue-600 mr-3" />
              <div>
                <h3 className="font-medium text-gray-900">Coordinadores</h3>
                <p className="text-sm text-gray-600">Gestionar coordinadores</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/duenio/choferes')}
            className="card card-hover p-6"
          >
            <div className="flex items-center">
              <Truck className="w-6 h-6 text-green-600 mr-3" />
              <div>
                <h3 className="font-medium text-gray-900">Choferes</h3>
                <p className="text-sm text-gray-600">Gestionar choferes</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/duenio/vehiculos')}
            className="card card-hover p-6"
          >
            <div className="flex items-center">
              <Car className="w-6 h-6 text-purple-600 mr-3" />
              <div>
                <h3 className="font-medium text-gray-900">Vehículos</h3>
                <p className="text-sm text-gray-600">Gestionar vehículos</p>
              </div>
            </div>
          </button>
        </div>

        {/* Informes y Recaudación */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <button
            onClick={() => router.push('/duenio/informes/diario')}
            className="card card-hover p-6"
          >
            <div className="flex items-center">
              <Calendar className="w-6 h-6 text-blue-600 mr-3" />
              <div>
                <h3 className="font-medium text-gray-900">Informe Diario</h3>
                <p className="text-sm text-gray-600">Recaudación del día</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/duenio/informes/semanal')}
            className="card card-hover p-6"
          >
            <div className="flex items-center">
              <BarChart3 className="w-6 h-6 text-green-600 mr-3" />
              <div>
                <h3 className="font-medium text-gray-900">Informe Semanal</h3>
                <p className="text-sm text-gray-600">Recaudación semanal</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/duenio/informes/mensual')}
            className="card card-hover p-6"
          >
            <div className="flex items-center">
              <DollarSign className="w-6 h-6 text-yellow-600 mr-3" />
              <div>
                <h3 className="font-medium text-gray-900">Informe Mensual</h3>
                <p className="text-sm text-gray-600">Recaudación mensual</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/duenio/informes/choferes')}
            className="card card-hover p-6"
          >
            <div className="flex items-center">
              <Truck className="w-6 h-6 text-red-600 mr-3" />
              <div>
                <h3 className="font-medium text-gray-900">Por Chofer</h3>
                <p className="text-sm text-gray-600">Recaudación por chofer</p>
              </div>
            </div>
          </button>
        </div>

        {/* Configuración y Administración */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <button
            onClick={() => router.push('/duenio/configuracion')}
            className="card card-hover p-6"
          >
            <div className="flex items-center">
              <Settings className="w-6 h-6 text-gray-600 mr-3" />
              <div>
                <h3 className="font-medium text-gray-900">Configuración</h3>
                <p className="text-sm text-gray-600">Ajustes del sistema</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/duenio/perfil')}
            className="card card-hover p-6"
          >
            <div className="flex items-center">
              <Users className="w-6 h-6 text-green-600 mr-3" />
              <div>
                <h3 className="font-medium text-gray-900">Mi Perfil</h3>
                <p className="text-sm text-gray-600">Editar información personal</p>
              </div>
            </div>
          </button>
        </div>

        {/* Lista de remiserías */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Mis Remiserías</h3>
            <span className="text-sm text-gray-600">{remiserias.length} remiserías</span>
          </div>

          {remiserias.length === 0 ? (
            <div className="text-center py-8">
              <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No tienes remiserías</h3>
              <p className="text-gray-600 mb-4">
                Contacta al administrador para que te asigne remiserías
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {remiserias.map((remiseria) => (
                <div key={remiseria.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {remiseria.nombreFantasia}
                      </h4>
                      <p className="text-sm text-gray-600">{remiseria.razonSocial}</p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        remiseria.estado
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {remiseria.estado ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Building className="w-4 h-4 mr-2" />
                      {remiseria.direccion}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Car className="w-4 h-4 mr-2" />
                      {remiseria.telefono}
                    </div>
                  </div>

                  {/* Estadísticas de la remisería */}
                  <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
                    <div className="text-center">
                      <p className="font-medium text-blue-600">{remiseria.coordinadores?.length || 0}</p>
                      <p className="text-gray-500">Coord.</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-green-600">{remiseria.choferes?.length || 0}</p>
                      <p className="text-gray-500">Choferes</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-purple-600">{remiseria.vehiculos?.length || 0}</p>
                      <p className="text-gray-500">Vehículos</p>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => router.push(`/duenio/remiserias/${remiseria.id}`)}
                      className="btn btn-sm btn-primary"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Ver
                    </button>
                    <button
                      onClick={() => router.push(`/duenio/remiserias/${remiseria.id}`)}
                      className="btn btn-sm btn-secondary"
                    >
                      <Settings className="w-4 h-4 mr-1" />
                      Editar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 