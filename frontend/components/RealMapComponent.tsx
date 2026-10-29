'use client';

import { useState, useEffect } from 'react';
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
  Compass 
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

interface RealMapComponentProps {
  vehiculos: Vehiculo[];
  onVehiculoClick?: (vehiculo: Vehiculo) => void;
  center?: [number, number];
  zoom?: number;
  height?: string;
  selectedVehiculo?: Vehiculo | null;
  onCentrarChivilcoy?: () => void;
  onVerTodos?: () => void;
}

interface MapActionSignal {
  type: 'chivilcoy' | 'fit_all' | 'focus_vehicle';
  id: number;
  target?: [number, number];
}

// Controlador interno de Leaflet para gestionar animaciones de vuelo y encuadre
function MapController({
  actionSignal,
  vehiculos,
  selectedVehiculo
}: {
  actionSignal: MapActionSignal | null;
  vehiculos: Vehiculo[];
  selectedVehiculo: Vehiculo | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!actionSignal) return;

    if (actionSignal.type === 'chivilcoy') {
      map.flyTo(MAP_CONFIG.DEFAULT_CENTER, MAP_CONFIG.DEFAULT_ZOOM, {
        duration: 1.2
      });
    } else if (actionSignal.type === 'fit_all') {
      const validPoints: [number, number][] = vehiculos
        .filter(v => v.ubicacion && typeof v.ubicacion.lat === 'number' && typeof v.ubicacion.lng === 'number')
        .map(v => [v.ubicacion.lat, v.ubicacion.lng] as [number, number]);

      // Incluimos la base central de Chivilcoy para mantener la referencia
      validPoints.push(MAP_CONFIG.DEFAULT_CENTER);

      if (validPoints.length === 1) {
        map.flyTo(validPoints[0], MAP_CONFIG.DEFAULT_ZOOM, { duration: 1.2 });
      } else {
        const bounds = L.latLngBounds(validPoints);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
      }
    } else if (actionSignal.type === 'focus_vehicle' && actionSignal.target) {
      map.flyTo(actionSignal.target, 16, { duration: 1.2 });
    }
  }, [actionSignal, map, vehiculos]);

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
  onVehiculoClick,
  center = MAP_CONFIG.DEFAULT_CENTER,
  zoom = MAP_CONFIG.DEFAULT_ZOOM,
  height = '500px',
  selectedVehiculo = null
}: RealMapComponentProps) {
  const [actionSignal, setActionSignal] = useState<MapActionSignal | null>(null);

  // Marcador para la Central / Base de Remises en Chivilcoy
  const createBaseIcon = () => {
    return L.divIcon({
      className: 'base-marker-wrapper z-[400]',
      html: `
        <div class="relative flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600 text-white border-2 border-white shadow-xl hover:scale-110 transition-transform">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
          </svg>
          <div class="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-indigo-900 text-white text-[9px] px-1.5 py-0.5 rounded shadow whitespace-nowrap border border-indigo-700 font-bold uppercase tracking-wider">
            Base Chivilcoy
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18]
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

  // Cuántos vehículos están fuera del casco urbano de Chivilcoy (> 12 km)
  const vehiculosFueraDeChivilcoy = vehiculos.filter(v => {
    if (!v.ubicacion?.lat || !v.ubicacion?.lng) return false;
    const dist = calculateDistance(v.ubicacion.lat, v.ubicacion.lng, CHIVILCOY_COORDS.LAT, CHIVILCOY_COORDS.LNG);
    return dist > 12;
  }).length;

  return (
    <div className="w-full rounded-2xl overflow-hidden relative shadow-inner border border-gray-200" style={{ height }}>
      <MapContainer 
        center={center} 
        zoom={zoom} 
        scrollWheelZoom={true}
        className="w-full h-full"
        style={{ zIndex: 1 }}
      >
        <MapController 
          actionSignal={actionSignal} 
          vehiculos={vehiculos} 
          selectedVehiculo={selectedVehiculo} 
        />

        {/* Capa de mapa OpenStreetMap */}
        <TileLayer
          url={MAP_CONFIG.TILE_LAYERS.OPENSTREETMAP.url}
          attribution={MAP_CONFIG.TILE_LAYERS.OPENSTREETMAP.attribution}
        />

        {/* Marcador fijo de la Central de Remisería en Chivilcoy */}
        <Marker
          position={MAP_CONFIG.CHIVILCOY_CENTER}
          icon={createBaseIcon()}
        >
          <Popup maxWidth={260} className="custom-leaflet-popup">
            <div className="p-2 font-sans">
              <div className="flex items-center space-x-2 border-b pb-1.5 mb-1.5">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <h4 className="font-bold text-gray-900 text-xs">Base Central Chivilcoy</h4>
              </div>
              <p className="text-xs text-gray-600">Centro neurálgico de operaciones de la remisería.</p>
              <p className="text-[10px] text-gray-400 mt-1">Plaza 25 de Mayo, Chivilcoy, Bs. As.</p>
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
            CHIVILCOY_COORDS.LAT, 
            CHIVILCOY_COORDS.LNG
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
                        {esRuta ? `A ${formatDistance(distKm)} de Chivilcoy (En viaje/ruta)` : 'Radio urbano Chivilcoy'}
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

      {/* Control Superior Izquierdo: Identificación de Base Chivilcoy */}
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md border border-gray-100 rounded-xl shadow-lg p-3 z-[1000] flex items-center space-x-2.5 text-xs font-medium text-gray-800 pointer-events-auto">
        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
          <MapPin className="w-4 h-4" />
        </div>
        <div>
          <span className="font-semibold block text-[10px] uppercase tracking-wider text-indigo-700">Base Operativa</span>
          <span className="font-bold text-gray-900">Chivilcoy, Buenos Aires</span>
          {vehiculosFueraDeChivilcoy > 0 && (
            <span className="block text-[10px] text-amber-600 font-semibold">
              {vehiculosFueraDeChivilcoy} {vehiculosFueraDeChivilcoy === 1 ? 'móvil en viaje exterior' : 'móviles en viaje exterior'}
            </span>
          )}
        </div>
      </div>

      {/* Control Superior Derecho: Botones de Centrado Rápido */}
      <div className="absolute top-4 right-4 z-[1000] flex items-center space-x-2 pointer-events-auto">
        <button
          type="button"
          onClick={() => setActionSignal({ type: 'chivilcoy', id: Date.now() })}
          className="flex items-center space-x-1.5 px-3 py-2 bg-white/95 hover:bg-white text-gray-800 rounded-xl shadow-md border border-gray-200 text-xs font-semibold backdrop-blur-sm transition-all hover:scale-105 active:scale-95"
          title="Centrar vista en la ciudad de Chivilcoy"
        >
          <Building2 className="w-4 h-4 text-indigo-600" />
          <span className="hidden sm:inline">Centrar en</span> Chivilcoy
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
