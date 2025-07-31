'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTracking } from '@/hooks/useAppTracking';
import { 
  Car, 
  Clock, 
  Calendar, 
  MapPin, 
  Plus, 
  Users, 
  AlertCircle,
  Search,
  Filter,
  Bell,
  TrendingUp,
  DollarSign,
  Phone,
  Mail,
  MapPin as LocationIcon,
  AlertTriangle,
  LogOut
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CoordinadorDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  useAppTracking('COORDINADOR_DASHBOARD_ACCESS');
  
  const [activeTab, setActiveTab] = useState('en-curso');
  const [searchTerm, setSearchTerm] = useState('');

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // Datos de ejemplo - luego vendrán de la API
  const stats = {
    viajesEnCurso: 8,
    viajesSinAsignar: 3,
    viajesReservados: 12,
    choferesDisponibles: 15,
    vehiculosDisponibles: 22,
    tiempoPromedio: '12 min'
  };

  const tabs = [
    { id: 'en-curso', label: 'Viajes en Curso', icon: Car, count: stats.viajesEnCurso },
    { id: 'sin-asignar', label: 'Sin Asignar', icon: Clock, count: stats.viajesSinAsignar, alert: stats.viajesSinAsignar > 0 },
    { id: 'reservados', label: 'Reservados', icon: Calendar, count: stats.viajesReservados }
  ];

  // Datos de ejemplo para las tablas
  const viajesEnCurso = [
    {
      id: 1,
      cliente: 'Juan Pérez',
      telefono: '123-456-7890',
      origen: 'Av. Corrientes 1234',
      destino: 'Aeropuerto Ezeiza',
      chofer: 'Carlos López',
      vehiculo: 'ABC-123',
      estado: 'En Curso',
      tiempo: '15 min'
    },
    {
      id: 2,
      cliente: 'María García',
      telefono: '098-765-4321',
      origen: 'Plaza de Mayo',
      destino: 'Puerto Madero',
      chofer: 'Roberto Silva',
      vehiculo: 'XYZ-789',
      estado: 'En Curso',
      tiempo: '8 min'
    }
  ];

  const viajesSinAsignar = [
    {
      id: 3,
      cliente: 'Pedro Rodríguez',
      telefono: '555-123-4567',
      origen: 'Retiro',
      destino: 'Palermo',
      prioridad: 'Alta',
      tiempo: '5 min'
    }
  ];

  const reservas = [
    {
      id: 4,
      cliente: 'Ana Martínez',
      telefono: '111-222-3333',
      origen: 'Microcentro',
      destino: 'San Telmo',
      fecha: '2024-01-15',
      hora: '14:30',
      tipo: 'Única'
    }
  ];

  // Función para determinar si hay alertas
  const hasAlerts = stats.viajesSinAsignar > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard Coordinador</h1>
              <p className="text-sm text-gray-600">Bienvenido, {user?.coordinador?.nombre || user?.email}</p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Notificaciones */}
              <button className="relative p-2 text-gray-600 hover:text-gray-900">
                <Bell className="h-6 w-6" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  3
                </span>
              </button>
              
              {/* Mapa en tiempo real */}
              <Link 
                href="/coordinador/mapa"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700"
              >
                <MapPin className="h-4 w-4" />
                <span>Ver Mapa</span>
              </Link>

              {/* Cerrar sesión */}
              <button 
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-red-700 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Alerta de viajes sin asignar */}
      {hasAlerts && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-400 mr-3" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">
                ¡Atención! Tienes {stats.viajesSinAsignar} viaje{stats.viajesSinAsignar > 1 ? 's' : ''} sin asignar
              </p>
              <p className="text-sm text-red-700">
                Asigna choferes y vehículos lo antes posible para evitar retrasos
              </p>
            </div>
            <button 
              onClick={() => setActiveTab('sin-asignar')}
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Ver Viajes
            </button>
          </div>
        </div>
      )}

      <div className="flex h-screen">
        {/* Panel principal - Tablas */}
        <div className="flex-1 flex flex-col">
          {/* Estadísticas rápidas */}
          <div className="bg-white shadow-sm border-b p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.viajesEnCurso}</div>
                <div className="text-sm text-gray-600">En Curso</div>
              </div>
              <div className={`text-center ${hasAlerts ? 'bg-red-50 rounded-lg p-2 border-2 border-red-200' : ''}`}>
                <div className={`text-2xl font-bold ${hasAlerts ? 'text-red-600' : 'text-yellow-600'}`}>
                  {stats.viajesSinAsignar}
                  {hasAlerts && (
                    <span className="ml-2 inline-block animate-pulse">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600">Sin Asignar</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.choferesDisponibles}</div>
                <div className="text-sm text-gray-600">Choferes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.vehiculosDisponibles}</div>
                <div className="text-sm text-gray-600">Vehículos</div>
              </div>
            </div>
          </div>

          {/* Barra de búsqueda */}
          <div className="bg-white shadow-sm border-b p-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="text"
                    placeholder="Buscar por cliente, chofer, dirección..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Filter className="h-4 w-4" />
                  <span>Filtros</span>
                </button>
                
                <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option>Hoy</option>
                  <option>Esta semana</option>
                  <option>Este mes</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tabs de navegación */}
          <div className="bg-white shadow-sm border-b">
            <nav className="flex space-x-8 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 relative ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } ${tab.alert ? 'bg-red-50 rounded-t-lg' : ''}`}
                >
                  <tab.icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                  <span className={`py-1 px-2 rounded-full text-xs ${
                    tab.alert 
                      ? 'bg-red-100 text-red-900 animate-pulse' 
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    {tab.count}
                  </span>
                  {tab.alert && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Contenido de las tablas - Ocupa todo el espacio restante */}
          <div className="flex-1 overflow-auto">
            {activeTab === 'en-curso' && (
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Viajes en Curso</h3>
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origen</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destino</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chofer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehículo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tiempo</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {viajesEnCurso.map((viaje) => (
                        <tr key={viaje.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{viaje.cliente}</div>
                              <div className="text-sm text-gray-500 flex items-center">
                                <Phone className="h-3 w-3 mr-1" />
                                {viaje.telefono}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 flex items-center">
                              <LocationIcon className="h-3 w-3 mr-1" />
                              {viaje.origen}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 flex items-center">
                              <LocationIcon className="h-3 w-3 mr-1" />
                              {viaje.destino}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{viaje.chofer}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{viaje.vehiculo}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              {viaje.estado}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{viaje.tiempo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'sin-asignar' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Viajes Sin Asignar</h3>
                  {hasAlerts && (
                    <div className="flex items-center space-x-2 bg-red-100 text-red-800 px-3 py-1 rounded-full">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-medium">Requiere atención</span>
                    </div>
                  )}
                </div>
                <div className="bg-white rounded-lg shadow overflow-hidden border-2 border-red-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-red-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-red-600 uppercase tracking-wider">Cliente</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-red-600 uppercase tracking-wider">Origen</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-red-600 uppercase tracking-wider">Destino</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-red-600 uppercase tracking-wider">Prioridad</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-red-600 uppercase tracking-wider">Tiempo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-red-600 uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {viajesSinAsignar.map((viaje) => (
                        <tr key={viaje.id} className="hover:bg-red-50 bg-red-25">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{viaje.cliente}</div>
                              <div className="text-sm text-gray-500 flex items-center">
                                <Phone className="h-3 w-3 mr-1" />
                                {viaje.telefono}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 flex items-center">
                              <LocationIcon className="h-3 w-3 mr-1" />
                              {viaje.origen}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 flex items-center">
                              <LocationIcon className="h-3 w-3 mr-1" />
                              {viaje.destino}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 animate-pulse">
                              {viaje.prioridad}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{viaje.tiempo}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button className="text-red-600 hover:text-red-900 font-semibold">Asignar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'reservados' && (
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Viajes Reservados</h3>
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origen</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destino</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reservas.map((reserva) => (
                        <tr key={reserva.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{reserva.cliente}</div>
                              <div className="text-sm text-gray-500 flex items-center">
                                <Phone className="h-3 w-3 mr-1" />
                                {reserva.telefono}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 flex items-center">
                              <LocationIcon className="h-3 w-3 mr-1" />
                              {reserva.origen}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 flex items-center">
                              <LocationIcon className="h-3 w-3 mr-1" />
                              {reserva.destino}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{reserva.fecha}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{reserva.hora}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{reserva.tipo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panel lateral derecho - Botones de acción */}
        <div className="w-80 bg-white shadow-lg border-l">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Acciones Rápidas</h3>
            
            <div className="space-y-4">
              <Link 
                href="/coordinador/viajes/nuevo"
                className="w-full bg-green-600 text-white px-4 py-3 rounded-lg flex items-center space-x-3 hover:bg-green-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span>Nuevo Viaje</span>
              </Link>

              <Link 
                href="/coordinador/reservas/nueva"
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg flex items-center space-x-3 hover:bg-blue-700 transition-colors"
              >
                <Calendar className="h-5 w-5" />
                <span>Nueva Reserva</span>
              </Link>

              <Link 
                href="/coordinador/choferes"
                className="w-full bg-purple-600 text-white px-4 py-3 rounded-lg flex items-center space-x-3 hover:bg-purple-700 transition-colors"
              >
                <Users className="h-5 w-5" />
                <span>Gestionar Choferes</span>
              </Link>

              <Link 
                href="/coordinador/reportes"
                className="w-full bg-gray-600 text-white px-4 py-3 rounded-lg flex items-center space-x-3 hover:bg-gray-700 transition-colors"
              >
                <TrendingUp className="h-5 w-5" />
                <span>Reportes</span>
              </Link>
            </div>

            {/* Información adicional */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-4">Información Rápida</h4>
              
                             <div className="space-y-3">
                 <div className="flex items-center justify-between text-sm">
                   <span className="text-gray-600">Vehículos disponibles:</span>
                   <span className="font-medium">{stats.vehiculosDisponibles}</span>
                 </div>
                 
                 <div className="flex items-center justify-between text-sm">
                   <span className="text-gray-600">Choferes activos:</span>
                   <span className="font-medium">{stats.choferesDisponibles}</span>
                 </div>
                 
                 <div className="flex items-center justify-between text-sm">
                   <span className="text-gray-600">Viajes hoy:</span>
                   <span className="font-medium">{stats.viajesEnCurso + stats.viajesSinAsignar}</span>
                 </div>

                 <div className="flex items-center justify-between text-sm">
                   <span className="text-gray-600">Tiempo promedio:</span>
                   <span className="font-medium">{stats.tiempoPromedio}</span>
                 </div>

                {hasAlerts && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium text-red-800">
                        {stats.viajesSinAsignar} viaje{stats.viajesSinAsignar > 1 ? 's' : ''} pendiente{stats.viajesSinAsignar > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 