'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTracking } from '@/hooks/useAppTracking';
import { clienteService } from '@/lib/api';
import { 
  Car, 
  Calendar, 
  MapPin, 
  Clock, 
  User, 
  Phone, 
  Mail, 
  Settings,
  LogOut,
  History,
  Star,
  Navigation,
  Plus,
  Search,
  Filter,
  Loader2,
  DollarSign
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

interface Viaje {
  id: string;
  origen: string;
  destino: string;
  fecha: string;
  estado: string;
  precio: number;
  chofer?: {
    nombre: string;
    telefono: string;
    vehiculo?: {
      patente: string;
      marca: string;
      modelo: string;
    };
  };
  vehiculo?: {
    patente: string;
    marca: string;
    modelo: string;
  };
}

interface Reserva {
  id: string;
  origen: string;
  destino: string;
  fechaInicio: string;
  horaInicio: string;
  tipoReserva: 'unica' | 'periodica';
  estado: string;
  fechaFin?: string;
  diasSemana?: string[];
  horaFin?: string;
  observaciones?: string;
}

interface SolicitudViajeForm {
  origen: string;
  destino: string;
  fechaHora: string;
  observaciones: string;
  usarUbicacionActual: boolean;
  tipoViaje: 'inmediato' | 'programado';
}

export default function ClienteApp() {
  const { user, logout } = useAuth();
  useAppTracking('CLIENTE_APP_ACCESS');
  
  const [activeTab, setActiveTab] = useState('solicitar');
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculatingPrice, setIsCalculatingPrice] = useState(false);
  const [precioEstimado, setPrecioEstimado] = useState<number | null>(null);
  const [ubicacionActual, setUbicacionActual] = useState<{ lat: number; lng: number; direccion: string } | null>(null);

  // Formulario de solicitud
  const [formData, setFormData] = useState<SolicitudViajeForm>({
    origen: '',
    destino: '',
    fechaHora: '',
    observaciones: '',
    usarUbicacionActual: false,
    tipoViaje: 'inmediato'
  });

  // Datos de ejemplo
  const viajesEjemplo: Viaje[] = [
    {
      id: '1',
      origen: 'Av. Corrientes 1234',
      destino: 'Aeropuerto Ezeiza',
      fecha: '2024-01-15T14:30:00',
      estado: 'COMPLETADO',
      precio: 2500,
      chofer: {
        nombre: 'Carlos López',
        telefono: '11-1234-5678',
        vehiculo: {
          patente: 'ABC-123',
          marca: 'Toyota',
          modelo: 'Corolla'
        }
      }
    },
    {
      id: '2',
      origen: 'Plaza de Mayo',
      destino: 'Puerto Madero',
      fecha: '2024-01-14T10:15:00',
      estado: 'EN_CURSO',
      precio: 800,
      chofer: {
        nombre: 'Roberto Silva',
        telefono: '11-9876-5432',
        vehiculo: {
          patente: 'XYZ-789',
          marca: 'Honda',
          modelo: 'Civic'
        }
      }
    }
  ];

  const reservasEjemplo: Reserva[] = [
    {
      id: '1',
      origen: 'Microcentro',
      destino: 'San Telmo',
      fechaInicio: '2024-01-20',
      horaInicio: '14:30',
      tipoReserva: 'unica',
      estado: 'ACTIVA'
    }
  ];

  useEffect(() => {
    // Cargar datos del cliente
    setViajes(viajesEjemplo);
    setReservas(reservasEjemplo);
    cargarViajes();
    cargarReservas();
  }, []);

  const cargarViajes = async () => {
    try {
      const response = await clienteService.getViajes();
      if (response.success && response.data) {
        setViajes(response.data);
      }
    } catch (error) {
      console.error('Error al cargar viajes:', error);
    }
  };

  const cargarReservas = async () => {
    try {
      const response = await clienteService.getReservas();
      if (response.success && response.data) {
        setReservas(response.data);
      }
    } catch (error) {
      console.error('Error al cargar reservas:', error);
    }
  };

  const obtenerUbicacionActual = async () => {
    try {
      const response = await clienteService.getUbicacionActual();
      if (response.success && response.data) {
        setUbicacionActual(response.data);
        setFormData(prev => ({
          ...prev,
          origen: response.data?.direccion || '',
          usarUbicacionActual: true
        }));
        toast.success('Ubicación actual obtenida');
      }
    } catch (error) {
      toast.error('Error al obtener ubicación actual');
    }
  };

  const calcularPrecio = async () => {
    if (!formData.origen || !formData.destino) {
      toast.error('Por favor completa origen y destino');
      return;
    }

    setIsCalculatingPrice(true);
    try {
      const response = await clienteService.calcularPrecio(formData.origen, formData.destino);
      if (response.success && response.data) {
        setPrecioEstimado(response.data.precioEstimado);
        toast.success(`Precio estimado: $${response.data.precioEstimado}`);
      }
    } catch (error) {
      toast.error('Error al calcular precio');
    } finally {
      setIsCalculatingPrice(false);
    }
  };

  const solicitarViaje = async () => {
    if (!formData.origen || !formData.destino) {
      toast.error('Por favor completa origen y destino');
      return;
    }

    setIsLoading(true);
    try {
      const response = await clienteService.solicitarViaje({
        origen: formData.origen,
        destino: formData.destino,
        fechaHora: formData.tipoViaje === 'programado' ? formData.fechaHora : undefined,
        observaciones: formData.observaciones,
        usarUbicacionActual: formData.usarUbicacionActual,
        latitudOrigen: ubicacionActual?.lat,
        longitudOrigen: ubicacionActual?.lng
      });

      if (response.success) {
        toast.success('Viaje solicitado exitosamente');
        setFormData({
          origen: '',
          destino: '',
          fechaHora: '',
          observaciones: '',
          usarUbicacionActual: false,
          tipoViaje: 'inmediato'
        });
        setPrecioEstimado(null);
        cargarViajes();
      } else {
        toast.error(response.message || 'Error al solicitar viaje');
      }
    } catch (error) {
      toast.error('Error al solicitar viaje');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Sesión cerrada');
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'COMPLETADO':
        return 'bg-green-100 text-green-800';
      case 'EN_CURSO':
        return 'bg-blue-100 text-blue-800';
      case 'PENDIENTE':
        return 'bg-yellow-100 text-yellow-800';
      case 'CANCELADO':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEstadoText = (estado: string) => {
    switch (estado) {
      case 'COMPLETADO':
        return 'Completado';
      case 'EN_CURSO':
        return 'En Curso';
      case 'PENDIENTE':
        return 'Pendiente';
      case 'CANCELADO':
        return 'Cancelado';
      default:
        return estado;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center">
                <Car className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">App Remises</h1>
                <p className="text-sm text-gray-600">Bienvenido, {user?.cliente?.nombre}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Link 
                href="/cliente/perfil"
                className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
              >
                <User className="h-5 w-5" />
              </Link>
              <button 
                onClick={handleLogout}
                className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs de navegación */}
      <div className="bg-white shadow-sm border-b">
        <nav className="flex space-x-8 px-6">
          <button
            onClick={() => setActiveTab('solicitar')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeTab === 'solicitar'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Car className="h-5 w-5" />
            <span>Solicitar Viaje</span>
          </button>
          
          <button
            onClick={() => setActiveTab('reservas')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeTab === 'reservas'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Calendar className="h-5 w-5" />
            <span>Mis Reservas</span>
          </button>
          
          <button
            onClick={() => setActiveTab('historial')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeTab === 'historial'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <History className="h-5 w-5" />
            <span>Historial</span>
          </button>
        </nav>
      </div>

      {/* Contenido principal */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'solicitar' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Solicitar Viaje</h2>
              <p className="text-gray-600">¿A dónde quieres ir?</p>
            </div>

            {/* Formulario de solicitud */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Origen
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="¿Desde dónde?"
                      value={formData.origen}
                      onChange={(e) => setFormData(prev => ({ ...prev, origen: e.target.value }))}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <MapPin className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                  </div>
                  <button
                    onClick={obtenerUbicacionActual}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                  >
                    <MapPin className="h-4 w-4" />
                    <span>Usar ubicación actual</span>
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Destino
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="¿A dónde?"
                      value={formData.destino}
                      onChange={(e) => setFormData(prev => ({ ...prev, destino: e.target.value }))}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <Navigation className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Viaje
                  </label>
                  <select 
                    value={formData.tipoViaje}
                    onChange={(e) => setFormData(prev => ({ ...prev, tipoViaje: e.target.value as 'inmediato' | 'programado' }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="inmediato">Inmediato</option>
                    <option value="programado">Programado</option>
                  </select>
                </div>

                {formData.tipoViaje === 'programado' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fecha y Hora
                    </label>
                    <div className="relative">
                      <input
                        type="datetime-local"
                        value={formData.fechaHora}
                        onChange={(e) => setFormData(prev => ({ ...prev, fechaHora: e.target.value }))}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <Clock className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observaciones
                </label>
                <textarea
                  rows={3}
                  placeholder="Información adicional (opcional)"
                  value={formData.observaciones}
                  onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Cálculo de precio */}
              {formData.origen && formData.destino && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">Precio Estimado</h3>
                      <p className="text-sm text-gray-600">Calcula el precio antes de solicitar</p>
                    </div>
                    <button
                      onClick={calcularPrecio}
                      disabled={isCalculatingPrice}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isCalculatingPrice ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <DollarSign className="h-4 w-4" />
                      )}
                      <span>{isCalculatingPrice ? 'Calculando...' : 'Calcular Precio'}</span>
                    </button>
                  </div>
                  {precioEstimado && (
                    <div className="mt-3 p-3 bg-white rounded border">
                      <p className="text-lg font-bold text-green-600">
                        Precio estimado: ${precioEstimado}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 flex space-x-4">
                <button 
                  onClick={solicitarViaje}
                  disabled={isLoading || !formData.origen || !formData.destino}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Car className="h-5 w-5" />
                  )}
                  <span>{isLoading ? 'Solicitando...' : 'Solicitar Viaje'}</span>
                </button>
                <Link 
                  href="/cliente/reserva"
                  className="flex-1 bg-gray-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors text-center"
                >
                  Hacer Reserva
                </Link>
              </div>
            </div>

            {/* Información adicional */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Car className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Viajes Completados</h3>
                    <p className="text-2xl font-bold text-green-600">{viajes.filter(v => v.estado === 'COMPLETADO').length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Star className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Calificación Promedio</h3>
                    <p className="text-2xl font-bold text-blue-600">4.8</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Reservas Activas</h3>
                    <p className="text-2xl font-bold text-purple-600">{reservas.filter(r => r.estado === 'ACTIVA').length}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reservas' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Mis Reservas</h2>
              <Link 
                href="/cliente/reserva"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Nueva Reserva</span>
              </Link>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Reservas Activas</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {reservas.map((reserva) => (
                  <div key={reserva.id} className="px-6 py-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900">{reserva.origen}</p>
                            <p className="text-sm text-gray-500">→ {reserva.destino}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                          <span>{reserva.fechaInicio}</span>
                          <span>{reserva.horaInicio}</span>
                          <span className="capitalize">{reserva.tipoReserva}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          reserva.estado === 'ACTIVA' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {reserva.estado}
                        </span>
                        <button className="text-red-600 hover:text-red-800 text-sm font-medium">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'historial' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Historial de Viajes</h2>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Viajes Recientes</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {viajes.map((viaje) => (
                  <div key={viaje.id} className="px-6 py-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900">{viaje.origen}</p>
                            <p className="text-sm text-gray-500">→ {viaje.destino}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                          <span>{new Date(viaje.fecha).toLocaleDateString()}</span>
                          <span>${viaje.precio}</span>
                          {viaje.chofer && (
                            <span>Chofer: {viaje.chofer.nombre}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getEstadoColor(viaje.estado)}`}>
                          {getEstadoText(viaje.estado)}
                        </span>
                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                          Detalles
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 