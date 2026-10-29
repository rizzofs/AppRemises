'use client';

import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  MAP_CONFIG, 
  CHIVILCOY_COORDS, 
  getVehicleColor, 
  getVehicleStatusText, 
  calculateDistance, 
  formatDistance 
} from '@/lib/mapConfig';
import { 
  ExternalLink, 
  Car, 
  Navigation, 
  MapPin, 
  Building2, 
  Maximize2, 
  Compass,
  Phone
} from 'lucide-react';

// El CSS de leaflet se importa globalmente en app/layout.tsx

// Fix para los iconos rotos por defecto de Leaflet en Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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

export interface RemiseriaBase {
  id?: string;
  nombreFantasia?: string;
  razonSocial?: string;
  direccion?: string;
  telefono?: string;
  latitud?: number | null;
  longitud?: number | null;
}

interface RealMapComponentProps {
  vehiculos: Vehiculo[];
  remiseria?: RemiseriaBase | null;
  onVehiculoClick?: (vehiculo: Vehiculo) => void;
  center?: [number, number];
  zoom?: number;
  height?: string;
  selectedVehiculo?: Vehiculo | null;
}

interface MapActionSignal {
  type: 'base' | 'fit_all' | 'focus_vehicle';
  id: number;
  target?: [number, number];
}

// Controlador interno de Leaflet para gestionar animaciones de vuelo y encuadre
function MapController({
  actionSignal,
  vehiculos,
  selectedVehiculo,
  baseCoords
}: {
  actionSignal: MapActionSignal | null;
  vehiculos: Vehiculo[];
  selectedVehiculo: Vehiculo | null;
  baseCoords: [number, number];
}) {
  const map = useMap();

  useEffect(() => {
    if (!actionSignal) return;

    if (actionSignal.type === 'base') {
      map.flyTo(baseCoords, 15, {
        duration: 1.2
      });
    } else if (actionSignal.type === 'fit_all') {
      const validPoints: [number, number][] = vehiculos
        .filter(v => v.ubicacion && typeof v.ubicacion.lat === 'number' && typeof v.ubicacion.lng === 'number')
        .map(v => [v.ubicacion.lat, v.ubicacion.lng] as [number, number]);

      // Incluimos la ubicación de la base registrada por el dueño
      validPoints.push(baseCoords);

      if (validPoints.length === 1) {
        map.flyTo(validPoints[0], 14, { duration: 1.2 });
      } else {
        const bounds = L.latLngBounds(validPoints);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
      }
    } else if (actionSignal.type === 'focus_vehicle' && actionSignal.target) {
      map.flyTo(actionSignal.target, 16, { duration: 1.2 });
    }
  }, [actionSignal, map, vehiculos, baseCoords]);

  // Centrar suavemente cuando se selecciona un vehículo externamente
  useEffect(() => {
    if (selectedVehiculo?.ubicacion?.lat && selectedVehiculo?.ubicacion?.lng) {
      map.flyTo([selectedVehiculo.ubicacion.lat, selectedVehiculo.ubicacion.lng], 16, {
        duration: 1.2
      });
    }
  }, [selectedVehiculo, map]);

  return null;
}

export default function RealMapComponent({
  vehiculos,
  remiseria,
  onVehiculoClick,
  center = MAP_CONFIG.DEFAULT_CENTER,
  zoom = MAP_CONFIG.DEFAULT_ZOOM,
  height = '500px',
  selectedVehiculo = null
}: RealMapComponentProps) {
  const [actionSignal, setActionSignal] = useState<MapActionSignal | null>(null);

  // Coordenadas oficiales de la remisería cargadas por el dueño
  const baseCoords: [number, number] = useMemo(() => {
    if (remiseria?.latitud && remiseria?.longitud) {
      return [remiseria.latitud, remiseria.longitud];
    }
    return center || MAP_CONFIG.DEFAULT_CENTER;
  }, [remiseria?.latitud, remiseria?.longitud, center]);

  const baseNombre = remiseria?.nombreFantasia || 'Remisería Central';
  const baseDireccion = remiseria?.direccion || 'Chivilcoy, Buenos Aires';
  const baseTelefono = remiseria?.telefono;

  // Marcador para la Central / Base de Remises con los datos cargados por el dueño
  const createBaseIcon = (nombre: string) => {
    const abrev = nombre.length > 18 ? nombre.slice(0, 16) + '...' : nombre;
    return L.divIcon({
      className: 'base-marker-wrapper z-[400]',
      html: `
        <div class="relative flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 text-white border-2 border-white shadow-xl hover:scale-110 transition-transform">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
          </svg>
          <div class="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-indigo-950 text-white text-[9px] px-2 py-0.5 rounded-md shadow whitespace-nowrap border border-indigo-700 font-bold uppercase tracking-wider">
            ${abrev}
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20]
    });
  };

  // Marcador SVG dinámico según el estado del vehículo
  const createCustomIcon = (estado: string, patente: string, isSelected: boolean) => {
    const color = getVehicleColor(estado);
    const pulseClass = estado === 'en_viaje' ? 'animate-pulse' : '';
    const borderClass = isSelected ? 'border-4 border-yellow-400 scale-125 z-[1000]' : 'border-2 border-white shadow-lg';

    return L.divIcon({
      className: `custom-marker-wrapper z-[500]`,
      html: `
        <div class="relative flex items-center justify-center w-8 h-8 rounded-full ${borderClass} transition-all duration-300" style="background-color: ${color};">
          <div class="absolute inset-0 rounded-full ${pulseClass} opacity-20" style="background-color: ${color}; transform: scale(1.4);"></div>
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
          </svg>
          <div class="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-[9px] px-1 py-0.5 rounded shadow whitespace-nowrap border border-gray-700 font-semibold">
            ${patente}
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16]
    });
  };

  const handleMarkerClick = (vehiculo: Vehiculo) => {
    onVehiculoClick?.(vehiculo);
  };

  // Cuántos vehículos están alejados de la base (> 12 km)
  const vehiculosFueraDeRadio = vehiculos.filter(v => {
    if (!v.ubicacion?.lat || !v.ubicacion?.lng) return false;
    const dist = calculateDistance(v.ubicacion.lat, v.ubicacion.lng, baseCoords[0], baseCoords[1]);
    return dist > 12;
  }).length;

  return (
    <div className="w-full rounded-2xl overflow-hidden relative shadow-inner border border-gray-200" style={{ height }}>
      <MapContainer 
        center={baseCoords} 
        zoom={zoom} 
        scrollWheelZoom={true}
        className="w-full h-full"
        style={{ zIndex: 1 }}
      >
        <MapController 
          actionSignal={actionSignal} 
          vehiculos={vehiculos} 
          selectedVehiculo={selectedVehiculo} 
          baseCoords={baseCoords}
        />

        {/* Capa de mapa OpenStreetMap */}
        <TileLayer
          url={MAP_CONFIG.TILE_LAYERS.OPENSTREETMAP.url}
          attribution={MAP_CONFIG.TILE_LAYERS.OPENSTREETMAP.attribution}
        />

        {/* Marcador oficial de la Remisería registrado por el Dueño */}
        <Marker
          position={baseCoords}
          icon={createBaseIcon(baseNombre)}
        >
          <Popup maxWidth={280} className="custom-leaflet-popup">
            <div className="p-2.5 font-sans">
              <div className="flex items-center space-x-2 border-b pb-2 mb-2">
                <Building2 className="w-5 h-5 text-indigo-600 shrink-0" />
                <div>
                  <h4 className="font-extrabold text-gray-900 text-sm leading-tight">{baseNombre}</h4>
                  <span className="text-[10px] text-indigo-600 font-semibold uppercase">Base Central de Remisería</span>
                </div>
              </div>
              <div className="space-y-1 text-xs text-gray-600">
                <p className="flex items-start space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                  <span className="font-medium text-gray-800">{baseDireccion}</span>
                </p>
                {baseTelefono && (
                  <p className="flex items-center space-x-1.5 text-gray-500">
                    <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>Tel: {baseTelefono}</span>
                  </p>
                )}
                <p className="text-[10px] text-gray-400 pt-1">
                  Ubicación oficial registrada por el dueño.
                </p>
              </div>
            </div>
          </Popup>
        </Marker>

        {/* Marcadores de todos los vehículos (donde sea que se encuentren) */}
        {vehiculos.map((vehiculo) => {
          if (!vehiculo.ubicacion?.lat || !vehiculo.ubicacion?.lng) return null;
          const isSelected = selectedVehiculo?.id === vehiculo.id;
          
          const distKm = calculateDistance(
            vehiculo.ubicacion.lat, 
            vehiculo.ubicacion.lng, 
            baseCoords[0], 
            baseCoords[1]
          );
          const esRuta = distKm > 12;

          return (
            <Marker
              key={vehiculo.id}
              position={[vehiculo.ubicacion.lat, vehiculo.ubicacion.lng]}
              icon={createCustomIcon(vehiculo.estado, vehiculo.patente, isSelected)}
              eventHandlers={{
                click: () => handleMarkerClick(vehiculo),
              }}
            >
              <Popup maxWidth={MAP_CONFIG.POPUP_CONFIG.MAX_WIDTH} className="custom-leaflet-popup">
                <div className="p-3 font-sans">
                  <div className="flex items-center justify-between border-b pb-2 mb-2">
                    <h3 className="font-bold text-gray-900 flex items-center space-x-1.5">
                      <Car className="w-4 h-4 text-blue-600" />
                      <span>{vehiculo.patente}</span>
                    </h3>
                    <span 
                      className="text-[10px] px-2 py-0.5 rounded-full text-white font-semibold"
                      style={{ backgroundColor: getVehicleColor(vehiculo.estado) }}
                    >
                      {getVehicleStatusText(vehiculo.estado)}
                    </span>
                  </div>
                  
                  <div className="space-y-1.5 text-xs text-gray-700">
                    <p className="flex items-center space-x-1">
                      <span className="font-semibold text-gray-600">Chofer:</span>
                      <span>{vehiculo.chofer}</span>
                    </p>
                    <p className="flex items-start space-x-1">
                      <Navigation className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                      <span>{vehiculo.direccionActual}</span>
                    </p>
                    
                    <p className="flex items-center space-x-1 text-[11px]">
                      <Compass className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className={esRuta ? 'text-amber-700 font-semibold' : 'text-gray-500'}>
                        {esRuta ? `A ${formatDistance(distKm)} de la Base (En ruta)` : `A ${formatDistance(distKm)} de la Base (Urbano)`}
                      </span>
                    </p>

                    <p className="text-[10px] text-gray-400 pt-1">
                      Actualizado: {new Date(vehiculo.ultimaActualizacion).toLocaleTimeString()}
                    </p>
                  </div>
                  
                  <div className="mt-3 pt-2 border-t flex space-x-2">
                    <button
                      onClick={() => window.open(`https://www.openstreetmap.org/?mlat=${vehiculo.ubicacion.lat}&mlon=${vehiculo.ubicacion.lng}#map=16/${vehiculo.ubicacion.lat}/${vehiculo.ubicacion.lng}`, '_blank')}
                      className="w-full flex items-center justify-center space-x-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Ver en OpenStreetMap</span>
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Control Superior Izquierdo: Identificación de la Base Registrada por el Dueño */}
      <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md border border-gray-100 rounded-xl shadow-lg p-3 z-[1000] flex items-center space-x-3 text-xs font-medium text-gray-800 pointer-events-auto">
        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
          <Building2 className="w-4 h-4" />
        </div>
        <div>
          <span className="font-bold block text-[10px] uppercase tracking-wider text-indigo-700">Base Operativa</span>
          <span className="font-extrabold text-gray-900 text-xs block leading-tight">{baseNombre}</span>
          <span className="text-[11px] text-gray-500 block truncate max-w-[190px] sm:max-w-xs">{baseDireccion}</span>
          {vehiculosFueraDeRadio > 0 && (
            <span className="block text-[10px] text-amber-600 font-semibold mt-0.5">
              {vehiculosFueraDeRadio} {vehiculosFueraDeRadio === 1 ? 'móvil en viaje exterior' : 'móviles en viaje exterior'}
            </span>
          )}
        </div>
      </div>

      {/* Control Superior Derecho: Botones de Centrado Rápido */}
      <div className="absolute top-4 right-4 z-[1000] flex items-center space-x-2 pointer-events-auto">
        <button
          type="button"
          onClick={() => setActionSignal({ type: 'base', id: Date.now() })}
          className="flex items-center space-x-1.5 px-3 py-2 bg-white/95 hover:bg-white text-gray-800 rounded-xl shadow-md border border-gray-200 text-xs font-semibold backdrop-blur-sm transition-all hover:scale-105 active:scale-95"
          title={`Centrar vista en ${baseNombre} (${baseDireccion})`}
        >
          <Building2 className="w-4 h-4 text-indigo-600" />
          <span className="hidden sm:inline">Centrar en</span> Base
        </button>

        <button
          type="button"
          onClick={() => setActionSignal({ type: 'fit_all', id: Date.now() })}
          className="flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md text-xs font-semibold backdrop-blur-sm transition-all hover:scale-105 active:scale-95"
          title="Ajustar encuadre para ver todos los vehículos donde sea que se encuentren"
        >
          <Maximize2 className="w-4 h-4 text-white" />
          <span>Ver toda la flota ({vehiculos.length})</span>
        </button>
      </div>

      {/* Control Inferior Izquierdo: Leyenda Moderna */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md border border-gray-100 rounded-xl shadow-lg p-3 z-[1000] pointer-events-auto">
        <h4 className="font-bold text-gray-900 text-[11px] mb-1.5 flex items-center space-x-1">
          <span>Estados de Flota</span>
        </h4>
        <div className="grid grid-cols-3 gap-2">
          <div className="flex items-center space-x-1.5 text-[10px] font-medium text-gray-700">
            <span className="w-2.5 h-2.5 rounded-full border border-white shadow bg-green-500"></span>
            <span>Disponible</span>
          </div>
          <div className="flex items-center space-x-1.5 text-[10px] font-medium text-gray-700">
            <span className="w-2.5 h-2.5 rounded-full border border-white shadow bg-blue-500"></span>
            <span>En Viaje</span>
          </div>
          <div className="flex items-center space-x-1.5 text-[10px] font-medium text-gray-700">
            <span className="w-2.5 h-2.5 rounded-full border border-white shadow bg-red-500"></span>
            <span>Fuera Turno</span>
          </div>
        </div>
      </div>
    </div>
  );
}
