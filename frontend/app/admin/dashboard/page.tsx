'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { remiseriaService, duenioService, appUsageService } from '@/lib/api';
import { Remiseria, Duenio } from '@/types';
import { Car, Users, Building, LogOut, Plus, Eye, Activity, TrendingUp, Clock, UserCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAppTracking } from '@/hooks/useAppTracking';

interface AppUsageStats {
  period: string;
  totalActions: number;
  actionsByType: Array<{
    action: string;
    _count: { action: number };
  }>;
  activeUsersCount: number;
  recentActivity: Array<{
    id: string;
    userEmail: string;
    action: string;
    details: string | null;
    createdAt: string;
  }>;
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [remiserias, setRemiserias] = useState<Remiseria[]>([]);
  const [duenios, setDuenios] = useState<Duenio[]>([]);
  const [usageStats, setUsageStats] = useState<AppUsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');

  useEffect(() => {
    if (!user || user.rol !== 'ADMIN') {
      router.push('/login');
      return;
    }

    loadDashboardData();
  }, [user, router, selectedPeriod]);

  // Track dashboard access
  useAppTracking('DASHBOARD_ACCESS', { period: selectedPeriod });

  const loadDashboardData = async () => {
    try {
      setError(null);
      const [remiseriasResponse, dueniosResponse, usageResponse] = await Promise.all([
        remiseriaService.getAll(),
        duenioService.getAll(),
        appUsageService.getStats(selectedPeriod)
      ]);

      if (remiseriasResponse.success && remiseriasResponse.data) {
        setRemiserias(remiseriasResponse.data);
      } else {
        console.error('Error loading remiserias:', remiseriasResponse.message);
        toast.error('Error al cargar remiserías');
      }

      if (dueniosResponse.success && dueniosResponse.data) {
        setDuenios(dueniosResponse.data);
      } else {
        console.error('Error loading duenios:', dueniosResponse.message);
        toast.error('Error al cargar dueños');
      }

      if (usageResponse.success && usageResponse.data) {
        setUsageStats(usageResponse.data);
      } else {
        console.error('Error loading usage stats:', usageResponse.message);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Error al cargar los datos del dashboard');
      toast.error('Error al cargar los datos');
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
  const activeDuenios = duenios.filter(d => d.user?.activo).length;
  const pendingCuitRemiserias = remiserias.filter(r => r.cuit.startsWith('PENDIENTE_')).length;
  const pendingDniDuenios = duenios.filter(d => d.dni.startsWith('PENDIENTE_')).length;

  const getActionLabel = (action: string) => {
    const labels: { [key: string]: string } = {
      'LOGIN': 'Inicio de sesión',
      'CREATE_REMISERIA': 'Crear remisería',
      'UPDATE_REMISERIA': 'Actualizar remisería',
      'CREATE_DUENIO': 'Crear dueño',
      'UPDATE_DUENIO': 'Actualizar dueño',
      'CREATE_CHOFER': 'Crear chofer',
      'UPDATE_CHOFER': 'Actualizar chofer',
      'CREATE_VEHICULO': 'Crear vehículo',
      'UPDATE_VEHICULO': 'Actualizar vehículo',
      'CREATE_VIAJE': 'Crear viaje',
      'UPDATE_VIAJE': 'Actualizar viaje'
    };
    return labels[action] || action;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-AR');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={loadDashboardData}
            className="btn btn-primary"
          >
            Reintentar
          </button>
        </div>
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
              <h1 className="text-xl font-semibold text-gray-900">App Remises - Admin</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Bienvenido, {user?.email}
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
        {/* Estadísticas principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card p-6">
            <div className="flex items-center">
              <Building className="w-8 h-8 text-primary-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Remiserías Activas</p>
                <p className="text-2xl font-semibold text-gray-900">{activeRemiserias}</p>
                {pendingCuitRemiserias > 0 && (
                  <p className="text-xs text-orange-600">{pendingCuitRemiserias} pendientes de CUIT</p>
                )}
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Dueños Activos</p>
                <p className="text-2xl font-semibold text-gray-900">{activeDuenios}</p>
                {pendingDniDuenios > 0 && (
                  <p className="text-xs text-orange-600">{pendingDniDuenios} pendientes de DNI</p>
                )}
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center">
              <Activity className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Actividad App</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {usageStats?.totalActions || 0}
                </p>
                <p className="text-xs text-gray-500">Últimos {selectedPeriod}</p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center">
              <UserCheck className="w-8 h-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Usuarios Activos</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {usageStats?.activeUsersCount || 0}
                </p>
                <p className="text-xs text-gray-500">Últimos {selectedPeriod}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Selector de período */}
        <div className="mb-6">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Período:</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm"
            >
              <option value="24h">Últimas 24 horas</option>
              <option value="7d">Últimos 7 días</option>
              <option value="30d">Últimos 30 días</option>
            </select>
          </div>
        </div>

        {/* Acciones rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <button
            onClick={() => router.push('/admin/remiserias')}
            className="card card-hover p-6"
          >
            <div className="flex items-center">
              <Building className="w-6 h-6 text-primary-600 mr-3" />
              <div>
                <h3 className="font-medium text-gray-900">Gestionar Remiserías</h3>
                <p className="text-sm text-gray-600">Ver y editar remiserías</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/admin/duenios')}
            className="card card-hover p-6"
          >
            <div className="flex items-center">
              <Users className="w-6 h-6 text-green-600 mr-3" />
              <div>
                <h3 className="font-medium text-gray-900">Gestionar Dueños</h3>
                <p className="text-sm text-gray-600">Ver y editar dueños</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/admin/remiserias/nueva')}
            className="card card-hover p-6"
          >
            <div className="flex items-center">
              <Plus className="w-6 h-6 text-blue-600 mr-3" />
              <div>
                <h3 className="font-medium text-gray-900">Nueva Remisería</h3>
                <p className="text-sm text-gray-600">Crear nueva remisería</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/admin/duenios/nuevo')}
            className="card card-hover p-6"
          >
            <div className="flex items-center">
              <Plus className="w-6 h-6 text-purple-600 mr-3" />
              <div>
                <h3 className="font-medium text-gray-900">Nuevo Dueño</h3>
                <p className="text-sm text-gray-600">Crear nuevo dueño</p>
              </div>
            </div>
          </button>
        </div>

        {/* Actividad reciente */}
        {usageStats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                Actividad Reciente
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {usageStats.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {getActionLabel(activity.action)}
                      </p>
                      <p className="text-xs text-gray-600">{activity.userEmail}</p>
                      <p className="text-xs text-gray-500">{formatDate(activity.createdAt)}</p>
                    </div>
                  </div>
                ))}
                {usageStats.recentActivity.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No hay actividad reciente</p>
                )}
              </div>
            </div>

            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Acciones por Tipo
              </h3>
              <div className="space-y-3">
                {usageStats.actionsByType.map((action) => (
                  <div key={action.action} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-900">
                      {getActionLabel(action.action)}
                    </span>
                    <span className="text-sm text-gray-600 bg-blue-100 px-2 py-1 rounded">
                      {action._count.action}
                    </span>
                  </div>
                ))}
                {usageStats.actionsByType.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No hay datos de acciones</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 