'use client';

import { useState, useEffect, useMemo } from 'react';
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
  Navigation,
  Building2,
  Maximize2,
  Compass,
  Search
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { 
  getVehicleColor, 
  getVehicleStatusText, 
  MAP_CONFIG, 
  CHIVILCOY_COORDS,
  calculateDistance,
  formatDistance,
  isEnChivilcoy
} from '@/lib/mapConfig';
import { coordinadorDashboardService } from '@/lib/api';
import { io } from 'socket.io-client';

// Cargar dinámicamente el componente del mapa real (Leaflet) para desactivar SSR
const MapComponent = dynamic(
  () => import('@/components/RealMapComponent'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-[520px] bg-gray-50 flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 animate-pulse">
        <svg className="w-10 h-10 text-indigo-600 animate-spin mb-3" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-sm font-semibold text-gray-700">Cargando mapa de Chivilcoy y alrededores...</span>
        <span className="text-xs text-gray-400 mt-1">Conectando con OpenStreetMap en tiempo real</span>
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
  const [filtroZona, setFiltroZona] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState<string>('');
  const [mostrarDetalles, setMostrarDetalles] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<Vehiculo | null>(null);

  // Vehículos de ejemplo ubicados en la ciudad de Chivilcoy y rutas aledañas
  const vehiculosEjemplo: Vehiculo[] = [
    {
      id: '1',
      patente: 'AF123CD',
      chofer: 'Juan Pérez',
      estado: 'disponible',
      ubicacion: { lat: -34.8957, lng: -60.0189 }, // Plaza 25 de Mayo (Centro)
      ultimaActualizacion: new Date().toISOString(),
      direccionActual: 'Plaza 25 de Mayo (Centro), Chivilcoy'
    },
    {
      id: '2',
      patente: 'AE456GH',
      chofer: 'María González',
      estado: 'en_viaje',
      ubicacion: { lat: -34.8905, lng: -60.0250 }, // Av. Villarino
      ultimaActualizacion: new Date().toISOString(),
      direccionActual: 'Av. Villarino y 25 de Mayo, Chivilcoy'
    },
    {
      id: '3',
      patente: 'AD789JK',
      chofer: 'Carlos López',
      estado: 'disponible',
      ubicacion: { lat: -34.9010, lng: -60.0120 }, // Av. Soárez
      ultimaActualizacion: new Date().toISOString(),
      direccionActual: 'Av. Soárez 350, Chivilcoy'
    },
    {
      id: '4',
      patente: 'AC321MN',
      chofer: 'Ana Martínez',
      estado: 'en_viaje',
      ubicacion: { lat: -34.8870, lng: -60.0145 }, // Av. Bernardo de Irigoyen
      ultimaActualizacion: new Date().toISOString(),
      direccionActual: 'Av. Bernardo de Irigoyen 420, Chivilcoy'
    },
    {
      id: '5',
      patente: 'AB654PQ',
      chofer: 'Roberto Silva',
      estado: 'disponible',
      ubicacion: { lat: -34.9080, lng: -60.0290 }, // Hospital Municipal
      ultimaActualizacion: new Date().toISOString(),
      direccionActual: 'Hospital Municipal / Hijas de San José, Chivilcoy'
    },
    {
      id: '6',
      patente: 'AA987RS',
      chofer: 'Laura Fernández',
      estado: 'fuera_servicio',
      ubicacion: { lat: -34.8930, lng: -60.0050 }, // Av. Sarmiento
      ultimaActualizacion: new Date().toISOString(),
      direccionActual: 'Av. Sarmiento y Av. Ceballos, Chivilcoy'
    },
    {
      id: '7',
      patente: 'AG112TV',
      chofer: 'Diego Rodríguez',
      estado: 'en_viaje',
      ubicacion: { lat: -34.7083, lng: -59.7892 }, // Ruta 5 km 132 (Suipacha / Mercedes)
      ultimaActualizacion: new Date().toISOString(),
      direccionActual: 'Ruta 5 km 132 (En viaje interurbano hacia Mercedes/CABA)'
    },
    {
      id: '8',
      patente: 'AF554XY',
      chofer: 'Carmen Gómez',
      estado: 'disponible',
      ubicacion: { lat: -34.9150, lng: -60.0350 }, // Parque Industrial / Acceso Ruta 30
      ultimaActualizacion: new Date().toISOString(),
      direccionActual: 'Acceso Parque Industrial / Ruta 30, Chivilcoy'
    }
  ];

  // Cargar vehículos reales desde la API con fallback seguro en Chivilcoy
  const cargarVehiculosReales = async () => {
    setIsLoading(true);
    try {
      const response = await coordinadorDashboardService.getVehiculosTiempoReal();
      if (response.success && response.data && response.data.length > 0) {
        const mapped: Vehiculo[] = response.data.map(v => {
          const chofer = v.choferes && v.choferes[0];
          const isOnline = chofer?.isOnline;
          const estado = isOnline ? 'disponible' : (v.estado?.toLowerCase() === 'activo' ? 'disponible' : 'fuera_servicio');
          return {
            id: v.id,
            patente: v.patente || 'Móvil',
            chofer: chofer ? `${chofer.nombre} ${chofer.apellido}` : (v.propietario || 'Sin Chofer'),
            estado: estado as any,
            ubicacion: {
              lat: v.latitud || CHIVILCOY_COORDS.LAT,
              lng: v.longitud || CHIVILCOY_COORDS.LNG
            },
            ultimaActualizacion: v.ultimaUbicacion || new Date().toISOString(),
            direccionActual: v.observaciones || (v.latitud ? `Lat: ${v.latitud.toFixed(4)}, Lng: ${v.longitud.toFixed(4)}` : 'Chivilcoy')
          };
        });
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

  // Suscripción a WebSockets para actualizaciones en vivo
  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    const socket = io(socketUrl, {
      transports: ['websocket'],
      withCredentials: true
    });

    socket.on('connect', () => {
      const remiseriaId = user?.coordinador?.remiseriaId;
      if (remiseriaId) {
        socket.emit('join_room', { remiseriaId });
      }
    });

    socket.on('vehiculo_movido', (data: any) => {
      setVehiculos((prevVehiculos) => {
        const soloReales = prevVehiculos.filter((v) => !['1', '2', '3', '4', '5', '6', '7', '8'].includes(v.id));
        const index = soloReales.findIndex((v) => v.id === data.id || (data.choferId && v.id === data.choferId) || (data.patente && v.patente === data.patente));
        if (index !== -1) {
          const updated = [...soloReales];
          updated[index] = {
            ...updated[index],
            ubicacion: data.ubicacion,
            direccionActual: data.direccionActual,
            ultimaActualizacion: data.ultimaActualizacion,
            estado: data.estado
          };
          return updated;
        }
        return [...soloReales, {
          id: data.id,
          patente: data.patente || 'Móvil',
          chofer: data.chofer || 'Chofer',
          estado: data.estado || 'disponible',
          ubicacion: data.ubicacion,
          ultimaActualizacion: data.ultimaActualizacion || new Date().toISOString(),
          direccionActual: data.direccionActual || `${data.ubicacion.lat.toFixed(5)}, ${data.ubicacion.lng.toFixed(5)}`
        }];
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  // Sincronizar vehículo seleccionado con actualizaciones
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

  // Simulación de patrullaje suave en modo demo para Chivilcoy
  useEffect(() => {
    const isDemo = vehiculos.length > 0 && vehiculos.every(v => ['1', '2', '3', '4', '5', '6', '7', '8'].includes(v.id));
    if (!isDemo || isLoading) return;

    const interval = setInterval(() => {
      setVehiculos((prev) => 
        prev.map((v) => {
          if (v.estado === 'fuera_servicio') return v;

          // Si es el móvil 7 en Ruta 5, avanza a lo largo de la ruta
          if (v.id === '7') {
            return {
              ...v,
              ubicacion: {
                lat: v.ubicacion.lat + 0.0004,
                lng: v.ubicacion.lng + 0.0006
              },
              ultimaActualizacion: new Date().toISOString()
            };
          }

          const deltaLat = (Math.random() - 0.5) * 0.0005;
          const deltaLng = (Math.random() - 0.5) * 0.0005;
          
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
    }, 4500);

    return () => clearInterval(interval);
  }, [vehiculos, isLoading]);

  // Filtrado de vehículos
  const vehiculosFiltrados = useMemo(() => {
    return vehiculos.filter(vehiculo => {
      if (filtroEstado !== 'todos' && vehiculo.estado !== filtroEstado) {
        return false;
      }
      
      const enChivilcoy = isEnChivilcoy(vehiculo.ubicacion.lat, vehiculo.ubicacion.lng);
      if (filtroZona === 'chivilcoy' && !enChivilcoy) {
        return false;
      }
      if (filtroZona === 'ruta' && enChivilcoy) {
        return false;
      }

      if (busqueda.trim()) {
        const query = busqueda.toLowerCase();
        const coincidePatente = vehiculo.patente.toLowerCase().includes(query);
        const coincideChofer = vehiculo.chofer.toLowerCase().includes(query);
        const coincideDir = vehiculo.direccionActual.toLowerCase().includes(query);
        if (!coincidePatente && !coincideChofer && !coincideDir) {
          return false;
        }
      }

      return true;
    });
  }, [vehiculos, filtroEstado, filtroZona, busqueda]);

  const getEstadoColor = (estado: string) => getVehicleColor(estado);
  const getEstadoTexto = (estado: string) => getVehicleStatusText(estado);

  const centrarEnVehiculo = (vehiculo: Vehiculo) => {
    setVehiculoSeleccionado(vehiculo);
  };

  // Contadores para estadísticas operativas
  const stats = useMemo(() => {
    const total = vehiculos.length;
    const disponibles = vehiculos.filter(v => v.estado === 'disponible').length;
    const enViaje = vehiculos.filter(v => v.estado === 'en_viaje').length;
    const fueraServicio = vehiculos.filter(v => v.estado === 'fuera_servicio').length;
    const enRadioChivilcoy = vehiculos.filter(v => isEnChivilcoy(v.ubicacion.lat, v.ubicacion.lng)).length;
    const enRuta = total - enRadioChivilcoy;

    return { total, disponibles, enViaje, fueraServicio, enRadioChivilcoy, enRuta };
  }, [vehiculos]);

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden w-full">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-3">
              <Link 
                href="/coordinador/dashboard"
                className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
                title="Volver al Panel Principal"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Mapa de Flota en Vivo</h1>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                    <Building2 className="w-3.5 h-3.5 mr-1" />
                    Chivilcoy, Bs. As.
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-500">
                  Monitoreo centralizado de vehículos en radio urbano y viajes de ruta
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-3">
              <button
                type="button"
                onClick={cargarVehiculosReales}
                disabled={isLoading}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:scale-95 text-xs font-medium transition shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Actualizar</span>
              </button>
              
              <button
                type="button"
                onClick={() => setMostrarDetalles(!mostrarDetalles)}
                className="flex items-center space-x-1.5 px-3 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 active:scale-95 text-xs font-medium transition bg-white"
              >
                {mostrarDetalles ? <EyeOff className="h-4 w-4 text-gray-500" /> : <Eye className="h-4 w-4 text-gray-500" />}
                <span className="hidden md:inline">{mostrarDetalles ? 'Ocultar' : 'Mostrar'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full min-w-0">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-w-0">
          {/* Panel lateral de controles, filtros y vehículo seleccionado */}
          <div className="lg:col-span-1 space-y-5">
            {/* Buscador y Filtros */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 flex items-center">
                  <Filter className="h-4 w-4 mr-1.5 text-indigo-600" />
                  Filtrar Vehículos
                </h3>
                {(filtroEstado !== 'todos' || filtroZona !== 'todos' || busqueda) && (
                  <button
                    onClick={() => {
                      setFiltroEstado('todos');
                      setFiltroZona('todos');
                      setBusqueda('');
                    }}
                    className="text-[11px] text-indigo-600 hover:underline font-semibold"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {/* Búsqueda por texto */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar patente o chofer..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50/50"
                />
              </div>
              
              {/* Filtro por Zona Geográfica */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Zona Geográfica
                </label>
                <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-xl text-[11px] font-medium text-gray-600">
                  <button
                    type="button"
                    onClick={() => setFiltroZona('todos')}
                    className={`py-1.5 rounded-lg transition-all ${filtroZona === 'todos' ? 'bg-white shadow text-indigo-700 font-bold' : 'hover:text-gray-900'}`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroZona('chivilcoy')}
                    className={`py-1.5 rounded-lg transition-all ${filtroZona === 'chivilcoy' ? 'bg-white shadow text-indigo-700 font-bold' : 'hover:text-gray-900'}`}
                    title="Vehículos en el radio urbano de Chivilcoy"
                  >
                    Chivilcoy
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroZona('ruta')}
                    className={`py-1.5 rounded-lg transition-all ${filtroZona === 'ruta' ? 'bg-white shadow text-indigo-700 font-bold' : 'hover:text-gray-900'}`}
                    title="Vehículos en viaje por rutas o ciudades vecinas"
                  >
                    En Ruta
                  </button>
                </div>
              </div>

              {/* Filtro por Estado */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Estado Operativo
                </label>
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50/50"
                >
                  <option value="todos">Todos los estados</option>
                  <option value="disponible">🟢 Disponibles</option>
                  <option value="en_viaje">🔵 En Viaje</option>
                  <option value="fuera_servicio">🔴 Fuera de Servicio</option>
                </select>
              </div>
            </div>

            {/* Estadísticas de flota */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center justify-between">
                <span>Resumen de Flota</span>
                <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  {stats.total} total
                </span>
              </h3>
              
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-gray-100">
                  <span className="text-gray-600 flex items-center">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
                    Disponibles
                  </span>
                  <span className="font-bold text-emerald-600">{stats.disponibles}</span>
                </div>
                
                <div className="flex justify-between items-center py-1 border-b border-gray-100">
                  <span className="text-gray-600 flex items-center">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                    En Viaje
                  </span>
                  <span className="font-bold text-blue-600">{stats.enViaje}</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-gray-100">
                  <span className="text-gray-600 flex items-center">
                    <span className="w-2 h-2 rounded-full bg-rose-500 mr-2"></span>
                    Fuera de Turno
                  </span>
                  <span className="font-bold text-rose-600">{stats.fueraServicio}</span>
                </div>

                <div className="pt-2">
                  <div className="flex justify-between items-center text-[11px] text-gray-500">
                    <span>En Chivilcoy (urbano):</span>
                    <span className="font-bold text-gray-800">{stats.enRadioChivilcoy}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-gray-500 mt-1">
                    <span>En ruta / Interurbano:</span>
                    <span className="font-bold text-amber-600">{stats.enRuta}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Detalles del vehículo seleccionado */}
            {vehiculoSeleccionado && (
              <div className="bg-white rounded-2xl shadow-sm border border-indigo-200 p-5 ring-2 ring-indigo-500/10">
                <div className="flex items-center justify-between mb-3 border-b pb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getEstadoColor(vehiculoSeleccionado.estado) }}></div>
                    <h3 className="text-sm font-bold text-gray-900">Móvil Seleccionado</h3>
                  </div>
                  <button
                    onClick={() => setVehiculoSeleccionado(null)}
                    className="text-gray-400 hover:text-gray-600 p-1"
                    title="Cerrar detalle"
                  >
                    <EyeOff className="h-4 w-4" />
                  </button>
                </div>
                
                <div className="space-y-3 text-xs">
                  <div>
                    <h4 className="text-base font-extrabold text-gray-900">{vehiculoSeleccionado.patente}</h4>
                    <p className="text-gray-600 font-medium">{vehiculoSeleccionado.chofer}</p>
                  </div>
                  
                  <div className="bg-gray-50 p-2.5 rounded-xl space-y-1.5 border border-gray-100">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Estado:</span>
                      <span className="font-semibold" style={{ color: getEstadoColor(vehiculoSeleccionado.estado) }}>
                        {getEstadoTexto(vehiculoSeleccionado.estado)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Ubicación reportada:</span>
                      <span className="font-medium text-gray-800">{vehiculoSeleccionado.direccionActual}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Distancia a Base:</span>
                      <span className="font-semibold text-indigo-700">
                        {(() => {
                          const dist = calculateDistance(
                            vehiculoSeleccionado.ubicacion.lat,
                            vehiculoSeleccionado.ubicacion.lng,
                            CHIVILCOY_COORDS.LAT,
                            CHIVILCOY_COORDS.LNG
                          );
                          return dist <= 12 ? 'Dentro de Chivilcoy' : `A ${formatDistance(dist)} de Chivilcoy (En Ruta)`;
                        })()}
                      </span>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => centrarEnVehiculo(vehiculoSeleccionado)}
                    className="w-full flex items-center justify-center space-x-1.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-semibold shadow transition"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    <span>Enfocar en Mapa</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mapa interactivo principal y lista de móviles */}
          <div className="lg:col-span-3 space-y-6 min-w-0">
            {/* Contenedor del Mapa */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Ubicación en Tiempo Real</h2>
                    <p className="text-xs text-gray-500">
                      Centrado en Chivilcoy con cobertura de toda la flota en viaje
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setVehiculoSeleccionado(null)}
                    className="flex items-center space-x-1 text-gray-600 hover:text-indigo-600 font-medium"
                    title="Restablecer selección"
                  >
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Base Chivilcoy</span>
                  </button>
                  <span className="text-gray-300">|</span>
                  <span className="font-semibold text-gray-700">
                    {vehiculosFiltrados.length} visibles
                  </span>
                </div>
              </div>
              
              <div className="p-3 sm:p-4">
                <MapComponent
                  vehiculos={vehiculosFiltrados}
                  onVehiculoClick={centrarEnVehiculo}
                  center={MAP_CONFIG.DEFAULT_CENTER}
                  zoom={MAP_CONFIG.DEFAULT_ZOOM}
                  height="520px"
                  selectedVehiculo={vehiculoSeleccionado}
                />
              </div>
            </div>

            {/* Listado de Vehículos con geolocalización y salto directo */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900 flex items-center">
                    <Car className="h-4 w-4 mr-2 text-indigo-600" />
                    Flota de Móviles ({vehiculosFiltrados.length})
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Toca en cualquier vehículo para enfocarlo en el mapa inmediatamente
                  </p>
                </div>
              </div>
              
              <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                {vehiculosFiltrados.map((vehiculo) => {
                  const distKm = calculateDistance(
                    vehiculo.ubicacion.lat,
                    vehiculo.ubicacion.lng,
                    CHIVILCOY_COORDS.LAT,
                    CHIVILCOY_COORDS.LNG
                  );
                  const fueraChivilcoy = distKm > 12;
                  const isSelected = vehiculoSeleccionado?.id === vehiculo.id;

                  return (
                    <div 
                      key={vehiculo.id} 
                      className={`p-4 transition-colors cursor-pointer ${
                        isSelected ? 'bg-indigo-50/70 border-l-4 border-indigo-600' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => centrarEnVehiculo(vehiculo)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-start space-x-3 min-w-0">
                          <div 
                            className="w-3.5 h-3.5 rounded-full mt-1 shrink-0 border border-white shadow-sm" 
                            style={{ backgroundColor: getEstadoColor(vehiculo.estado) }}
                          />
                          
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2 flex-wrap">
                              <span className="font-bold text-gray-900 text-sm">{vehiculo.patente}</span>
                              <span className="text-gray-400">•</span>
                              <span className="text-xs text-gray-700 font-medium truncate">{vehiculo.chofer}</span>
                              
                              {fueraChivilcoy ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  <Compass className="w-3 h-3 mr-1" />
                                  A {formatDistance(distKm)} (En ruta)
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <MapPin className="w-3 h-3 mr-1" />
                                  Chivilcoy Urbano
                                </span>
                              )}
                            </div>
                            
                            {mostrarDetalles && (
                              <div className="mt-1.5 space-y-0.5 text-xs text-gray-600">
                                <p className="truncate flex items-center">
                                  <Navigation className="w-3 h-3 text-gray-400 mr-1 shrink-0" />
                                  <span>{vehiculo.direccionActual}</span>
                                </p>
                                <p className="text-[11px] text-gray-400">
                                  Actualizado: {new Date(vehiculo.ultimaActualizacion).toLocaleTimeString()}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-1 shrink-0 ml-3">
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              centrarEnVehiculo(vehiculo);
                            }}
                            className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-xl transition"
                            title="Centrar en mapa"
                          >
                            <Navigation className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {vehiculosFiltrados.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    <Car className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm font-medium">No hay vehículos que coincidan con los filtros aplicados</p>
                    <button
                      onClick={() => {
                        setFiltroEstado('todos');
                        setFiltroZona('todos');
                        setBusqueda('');
                      }}
                      className="mt-2 text-xs text-indigo-600 font-semibold hover:underline"
                    >
                      Restablecer filtros
                    </button>
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
