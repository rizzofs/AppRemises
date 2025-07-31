'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTracking } from '@/hooks/useAppTracking';
import { 
  ArrowLeft, 
  MapPin, 
  Car, 
  Users, 
  Clock, 
  Filter,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import Link from 'next/link';

interface Vehiculo {
  id: string;
  patente: string;
  chofer: string;
  estado: 'disponible' | 'en_viaje' | 'fuera_servicio';
  ubicacion: {
    lat: number;
    lng: number;
  };
  ultimaActualizacion: string;
  direccionActual: string;
}

export default function MapaTiempoReal() {
  const { user } = useAuth();
  useAppTracking('COORDINADOR_MAPA_TIEMPO_REAL');
  
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [mostrarDetalles, setMostrarDetalles] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Datos de ejemplo - luego vendrán de la API
  const vehiculosEjemplo: Vehiculo[] = [
    {
      id: '1',
      patente: 'ABC123',
      chofer: 'Juan Pérez',
      estado: 'disponible',
      ubicacion: { lat: -34.6037, lng: -58.3816 },
      ultimaActualizacion: '2024-01-15T10:30:00Z',
      direccionActual: 'Av. Corrientes 1234, CABA'
    },
    {
      id: '2',
      patente: 'XYZ789',
      chofer: 'María González',
      estado: 'en_viaje',
      ubicacion: { lat: -34.6084, lng: -58.3731 },
      ultimaActualizacion: '2024-01-15T10:25:00Z',
      direccionActual: 'Palermo, CABA'
    },
    {
      id: '3',
      patente: 'DEF456',
      chofer: 'Carlos López',
      estado: 'disponible',
      ubicacion: { lat: -34.6111, lng: -58.3772 },
      ultimaActualizacion: '2024-01-15T10:28:00Z',
      direccionActual: 'Recoleta, CABA'
    }
  ];

  useEffect(() => {
    // Simular carga de datos
    setTimeout(() => {
      setVehiculos(vehiculosEjemplo);
      setIsLoading(false);
    }, 1000);
  }, []);

  const vehiculosFiltrados = vehiculos.filter(vehiculo => {
    if (filtroEstado === 'todos') return true;
    return vehiculo.estado === filtroEstado;
  });

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'disponible':
        return 'bg-green-500';
      case 'en_viaje':
        return 'bg-blue-500';
      case 'fuera_servicio':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getEstadoTexto = (estado: string) => {
    switch (estado) {
      case 'disponible':
        return 'Disponible';
      case 'en_viaje':
        return 'En Viaje';
      case 'fuera_servicio':
        return 'Fuera de Servicio';
      default:
        return 'Desconocido';
    }
  };

  const actualizarUbicaciones = () => {
    setIsLoading(true);
    // Aquí iría la llamada a la API para actualizar ubicaciones
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center">
              <Link 
                href="/coordinador/dashboard"
                className="mr-4 p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Mapa en Tiempo Real</h1>
                <p className="text-sm text-gray-600">Ubicación de vehículos y choferes</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={actualizarUbicaciones}
                disabled={isLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>
              
              <button
                onClick={() => setMostrarDetalles(!mostrarDetalles)}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {mostrarDetalles ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span>{mostrarDetalles ? 'Ocultar' : 'Mostrar'} Detalles</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Panel lateral */}
          <div className="lg:col-span-1 space-y-6">
            {/* Filtros */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Filter className="h-5 w-5 mr-2" />
                Filtros
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estado del Vehículo
                  </label>
                  <select
                    value={filtroEstado}
                    onChange={(e) => setFiltroEstado(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="todos">Todos los estados</option>
                    <option value="disponible">Disponible</option>
                    <option value="en_viaje">En Viaje</option>
                    <option value="fuera_servicio">Fuera de Servicio</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Estadísticas */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Estadísticas</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Vehículos</span>
                  <span className="font-semibold">{vehiculos.length}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Disponibles</span>
                  <span className="font-semibold text-green-600">
                    {vehiculos.filter(v => v.estado === 'disponible').length}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">En Viaje</span>
                  <span className="font-semibold text-blue-600">
                    {vehiculos.filter(v => v.estado === 'en_viaje').length}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Fuera de Servicio</span>
                  <span className="font-semibold text-red-600">
                    {vehiculos.filter(v => v.estado === 'fuera_servicio').length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Mapa y lista de vehículos */}
          <div className="lg:col-span-3">
            {/* Mapa placeholder */}
            <div className="bg-white rounded-lg shadow mb-6">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <MapPin className="h-5 w-5 mr-2" />
                  Mapa de Ubicaciones
                </h3>
              </div>
              
              <div className="h-96 bg-gray-100 rounded-b-lg flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Mapa interactivo en desarrollo</p>
                  <p className="text-sm text-gray-400">Se integrará con Google Maps o similar</p>
                </div>
              </div>
            </div>

            {/* Lista de vehículos */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Car className="h-5 w-5 mr-2" />
                  Vehículos ({vehiculosFiltrados.length})
                </h3>
              </div>
              
              <div className="divide-y divide-gray-200">
                {vehiculosFiltrados.map((vehiculo) => (
                  <div key={vehiculo.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`w-3 h-3 rounded-full ${getEstadoColor(vehiculo.estado)}`}></div>
                        
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-gray-900">{vehiculo.patente}</span>
                            <span className="text-sm text-gray-500">•</span>
                            <span className="text-sm text-gray-600">{vehiculo.chofer}</span>
                          </div>
                          
                          {mostrarDetalles && (
                            <div className="mt-2 space-y-1">
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Estado:</span> {getEstadoTexto(vehiculo.estado)}
                              </p>
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Ubicación:</span> {vehiculo.direccionActual}
                              </p>
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Última actualización:</span> {
                                  new Date(vehiculo.ultimaActualizacion).toLocaleTimeString()
                                }
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                          <MapPin className="h-4 w-4" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                          <Users className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {vehiculosFiltrados.length === 0 && (
                  <div className="p-6 text-center text-gray-500">
                    <Car className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No hay vehículos que coincidan con los filtros</p>
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