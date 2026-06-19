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
  EyeOff,
  Navigation
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { getVehicleColor, getVehicleStatusText, MAP_CONFIG } from '@/lib/mapConfig';
import { coordinadorDashboardService } from '@/lib/api';
import { io } from 'socket.io-client';

// Cargar dinámicamente el componente del mapa real (Leaflet) para desactivar SSR
const MapComponent = dynamic(
  () => import('@/components/RealMapComponent'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-[500px] bg-gray-50 flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 animate-pulse">
        <svg className="w-10 h-10 text-blue-500 animate-spin mb-3" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-sm font-semibold text-gray-600">Cargando mapa interactivo...</span>
        <span className="text-xs text-gray-400 mt-1">Conectando OpenStreetMap & CartoDB</span>
      </div>
    )
  }
);

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
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<Vehiculo | null>(null);

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
    },
    {
      id: '4',
      patente: 'GHI789',
      chofer: 'Ana Martínez',
      estado: 'en_viaje',
      ubicacion: { lat: -34.5950, lng: -58.3950 },
      ultimaActualizacion: '2024-01-15T10:32:00Z',
      direccionActual: 'San Telmo, CABA'
    },
    {
      id: '5',
      patente: 'JKL012',
      chofer: 'Roberto Silva',
      estado: 'disponible',
      ubicacion: { lat: -34.6200, lng: -58.3700 },
      ultimaActualizacion: '2024-01-15T10:29:00Z',
      direccionActual: 'Villa Crespo, CABA'
    },
    {
      id: '6',
      patente: 'MNO345',
      chofer: 'Laura Fernández',
      estado: 'fuera_servicio',
      ubicacion: { lat: -34.5900, lng: -58.4000 },
      ultimaActualizacion: '2024-01-15T10:15:00Z',
      direccionActual: 'La Boca, CABA'
    },
    {
      id: '7',
      patente: 'PQR678',
      chofer: 'Diego Rodríguez',
      estado: 'disponible',
      ubicacion: { lat: -34.6150, lng: -58.3850 },
      ultimaActualizacion: '2024-01-15T10:31:00Z',
      direccionActual: 'Almagro, CABA'
    },
    {
      id: '8',
      patente: 'STU901',
      chofer: 'Carmen López',
      estado: 'en_viaje',
      ubicacion: { lat: -34.6000, lng: -58.3600 },
      ultimaActualizacion: '2024-01-15T10:27:00Z',
      direccionActual: 'Belgrano, CABA'
    }
  ];

  // Cargar vehículos reales desde la API con fallback seguro
  const cargarVehiculosReales = async () => {
    setIsLoading(true);
    try {
      const response = await coordinadorDashboardService.getVehiculosTiempoReal();
      if (response.success && response.data && response.data.length > 0) {
        const mapped: Vehiculo[] = response.data.map(v => ({
          id: v.id,
          patente: v.patente,
          chofer: v.choferes && v.choferes[0] ? `${v.choferes[0].nombre} ${v.choferes[0].apellido}` : 'Sin Chofer',
          estado: v.estado.toLowerCase() === 'activo' ? 'disponible' : v.estado.toLowerCase() === 'mantenimiento' ? 'fuera_servicio' : 'fuera_servicio',
          ubicacion: {
            lat: v.latitud || -34.6037,
            lng: v.longitud || -58.3816
          },
          ultimaActualizacion: v.ultimaUbicacion || new Date().toISOString(),
          direccionActual: v.observaciones || 'Ubicación reportada'
        }));
        setVehiculos(mapped);
      } else {
        setVehiculos(vehiculosEjemplo);
      }
    } catch (error) {
      console.error('Error cargando vehículos reales de la API, usando demo:', error);
      setVehiculos(vehiculosEjemplo);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    cargarVehiculosReales();
  }, []);

  // Suscripción a WebSockets para actualizaciones en tiempo real
  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    const socket = io(socketUrl, {
      transports: ['websocket'],
      withCredentials: true
    });

    socket.on('connect', () => {
      console.log('⚡ Conectado al servidor de Sockets de AppRemises');
      const remiseriaId = user?.coordinador?.remiseriaId;
      if (remiseriaId) {
        socket.emit('join_room', { remiseriaId });
      }
    });

    socket.on('vehiculo_movido', (data: any) => {
      console.log('🚗 Vehículo movido en vivo:', data);
      
      setVehiculos((prevVehiculos) => {
        const index = prevVehiculos.findIndex((v) => v.id === data.id);
        if (index !== -1) {
          const updated = [...prevVehiculos];
          updated[index] = {
            ...updated[index],
            ubicacion: data.ubicacion,
            direccionActual: data.direccionActual,
            ultimaActualizacion: data.ultimaActualizacion,
            estado: data.estado
          };
          return updated;
        }
        // Si no está en el listado, agregarlo
        return [...prevVehiculos, data];
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  // Sincronizar el panel lateral con la lista de vehículos actualizada por WebSockets
  useEffect(() => {
    if (vehiculoSeleccionado) {
      const match = vehiculos.find(v => v.id === vehiculoSeleccionado.id);
      if (match && (
        match.ubicacion.lat !== vehiculoSeleccionado.ubicacion.lat ||
        match.ubicacion.lng !== vehiculoSeleccionado.ubicacion.lng ||
        match.estado !== vehiculoSeleccionado.estado
      )) {
        setVehiculoSeleccionado(match);
      }
    }
  }, [vehiculos, vehiculoSeleccionado]);

  // Simular movimiento periódico de vehículos en modo demo (para impresionar al usuario en la demo comercial)
  useEffect(() => {
    // Si la lista de vehículos contiene los de ejemplo, simular movimientos suaves
    const isDemo = vehiculos.some(v => ['1', '2', '3', '4', '5', '6', '7', '8'].includes(v.id));
    if (!isDemo || isLoading) return;

    const interval = setInterval(() => {
      setVehiculos((prev) => 
        prev.map((v) => {
          // Solo mover vehículos que estén en viaje o disponibles
          if (v.estado === 'fuera_servicio') return v;

          // Pequeño desplazamiento realista para simular que avanzan por avenidas de Buenos Aires
          const deltaLat = (Math.random() - 0.5) * 0.0006;
          const deltaLng = (Math.random() - 0.5) * 0.0006;
          
          return {
            ...v,
            ubicacion: {
              lat: v.ubicacion.lat + deltaLat,
              lng: v.ubicacion.lng + deltaLng
            },
            ultimaActualizacion: new Date().toISOString()
          };
        })
      );
    }, 4000); // Actualizar posiciones cada 4 segundos

    return () => clearInterval(interval);
  }, [vehiculos, isLoading]);

  const vehiculosFiltrados = vehiculos.filter(vehiculo => {
    if (filtroEstado === 'todos') return true;
    return vehiculo.estado === filtroEstado;
  });

  const getEstadoColor = (estado: string) => {
    return getVehicleColor(estado);
  };

  const getEstadoTexto = (estado: string) => {
    return getVehicleStatusText(estado);
  };

  const actualizarUbicaciones = () => {
    cargarVehiculosReales();
  };

  const handleVehiculoClick = (vehiculo: Vehiculo) => {
    setVehiculoSeleccionado(vehiculo);
  };

  const centrarEnVehiculo = (vehiculo: Vehiculo) => {
    setVehiculoSeleccionado(vehiculo);
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

            {/* Detalles del vehículo seleccionado */}
            {vehiculoSeleccionado && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Detalles del Vehículo</h3>
                  <button
                    onClick={() => setVehiculoSeleccionado(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <EyeOff className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ backgroundColor: getEstadoColor(vehiculoSeleccionado.estado) }}></div>

                    <div>
                      <h4 className="font-semibold text-gray-900">{vehiculoSeleccionado.patente}</h4>
                      <p className="text-sm text-gray-600">{vehiculoSeleccionado.chofer}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Estado:</span>
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                        vehiculoSeleccionado.estado === 'disponible' ? 'bg-green-100 text-green-800' :
                        vehiculoSeleccionado.estado === 'en_viaje' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {getEstadoTexto(vehiculoSeleccionado.estado)}
                      </span>
                    </div>
                    
                    <div>
                      <span className="font-medium text-gray-700">Ubicación:</span>
                      <p className="text-gray-600 mt-1">{vehiculoSeleccionado.direccionActual}</p>
                    </div>
                    
                    <div>
                      <span className="font-medium text-gray-700">Última actualización:</span>
                      <p className="text-gray-600 mt-1">
                        {new Date(vehiculoSeleccionado.ultimaActualizacion).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-gray-200">
                    <button
                      onClick={() => centrarEnVehiculo(vehiculoSeleccionado)}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Navigation className="h-4 w-4" />
                      <span>Centrar en Mapa</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mapa y lista de vehículos */}
          <div className="lg:col-span-3">
            {/* Mapa interactivo */}
            <div className="bg-white rounded-lg shadow mb-6">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <MapPin className="h-5 w-5 mr-2" />
                    Mapa de Ubicaciones
                  </h3>
                  
                  {/* Leyenda del mapa */}
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-gray-600">Disponible</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-gray-600">En Viaje</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="text-gray-600">Fuera de Servicio</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-4">
                <MapComponent
                  vehiculos={vehiculosFiltrados}
                  onVehiculoClick={handleVehiculoClick}
                  center={MAP_CONFIG.DEFAULT_CENTER}
                  zoom={MAP_CONFIG.DEFAULT_ZOOM}
                  height="500px"
                  selectedVehiculo={vehiculoSeleccionado}
                />
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
                        <div className="w-3 h-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: getEstadoColor(vehiculo.estado) }}></div>

                        
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
                        <button 
                          onClick={() => centrarEnVehiculo(vehiculo)}
                          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                          title="Centrar en mapa"
                        >
                          <Navigation className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => setVehiculoSeleccionado(vehiculo)}
                          className={`p-2 rounded-lg hover:bg-gray-100 ${
                            vehiculoSeleccionado?.id === vehiculo.id 
                              ? 'text-blue-600 bg-blue-50' 
                              : 'text-gray-400 hover:text-gray-600'
                          }`}
                          title="Ver detalles"
                        >
                          <Eye className="h-4 w-4" />
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