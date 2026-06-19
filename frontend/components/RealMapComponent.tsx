'use client';

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MAP_CONFIG, getVehicleColor, getVehicleStatusText } from '@/lib/mapConfig';
import { ExternalLink, Car, Navigation, MapPin } from 'lucide-react';

// El CSS de leaflet se importa globalmente en app/layout.tsx para evitar problemas de des-hidratación y pérdida de CSS al navegar.


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
}

// Componente helper para centrar el mapa cuando cambia la selección o el centro
function ChangeMapView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
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
  const [mapCenter, setMapCenter] = useState<[number, number]>(center);
  const [mapZoom, setMapZoom] = useState<number>(zoom);

  // Actualizar centro cuando se selecciona un vehículo desde el exterior
  useEffect(() => {
    if (selectedVehiculo) {
      setMapCenter([selectedVehiculo.ubicacion.lat, selectedVehiculo.ubicacion.lng]);
      setMapZoom(15); // Zoom de detalle
    }
  }, [selectedVehiculo]);

  // Crear marcador SVG dinámico y estilizado según el estado
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

  return (
    <div className="w-full rounded-2xl overflow-hidden relative shadow-inner border border-gray-200" style={{ height }}>
      <MapContainer 
        center={mapCenter} 
        zoom={mapZoom} 
        scrollWheelZoom={true}
        className="w-full h-full"
        style={{ zIndex: 1 }}
      >
        <ChangeMapView center={mapCenter} zoom={mapZoom} />

        {/* Usamos el tile premium de CartoDB (Light) que se ve súper limpio y corporativo */}
        <TileLayer
          url={MAP_CONFIG.TILE_LAYERS.CARTODB.url}
          attribution={MAP_CONFIG.TILE_LAYERS.CARTODB.attribution}
        />

        {/* Marcadores de vehículos */}
        {vehiculos.map((vehiculo) => {
          const isSelected = selectedVehiculo?.id === vehiculo.id;
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
                    <p className="text-[10px] text-gray-400 pt-1">
                      Actualizado: {new Date(vehiculo.ultimaActualizacion).toLocaleTimeString()}
                    </p>
                  </div>
                  
                  <div className="mt-3 pt-2 border-t flex space-x-2">
                    <button
                      onClick={() => window.open(`https://www.google.com/maps?q=${vehiculo.ubicacion.lat},${vehiculo.ubicacion.lng}`, '_blank')}
                      className="w-full flex items-center justify-center space-x-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Google Maps</span>
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Control Premium: Info del Centro del Mapa */}
      <div className="absolute top-4 left-4 bg-white/80 backdrop-blur-md border border-gray-100 rounded-xl shadow-lg p-3 z-[1000] flex items-center space-x-2 text-xs font-medium text-gray-800">
        <div className="p-1 bg-blue-50 text-blue-600 rounded-lg">
          <MapPin className="w-4 h-4" />
        </div>
        <div>
          <span className="font-semibold block text-[10px] uppercase tracking-wider text-gray-400">Región Activa</span>
          <span>Buenos Aires, Argentina</span>
        </div>
      </div>

      {/* Control Premium: Leyenda Moderna */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md border border-gray-100 rounded-xl shadow-lg p-3.5 z-[1000]">
        <h4 className="font-bold text-gray-900 text-xs mb-2 flex items-center space-x-1">
          <span>Leyenda de Flota</span>
        </h4>
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2 text-[11px] font-medium text-gray-700">
            <span className="w-3 h-3 rounded-full border border-white shadow bg-green-500"></span>
            <span>Disponible</span>
          </div>
          <div className="flex items-center space-x-2 text-[11px] font-medium text-gray-700">
            <span className="w-3 h-3 rounded-full border border-white shadow bg-blue-500"></span>
            <span>En Viaje</span>
          </div>
          <div className="flex items-center space-x-2 text-[11px] font-medium text-gray-700">
            <span className="w-3 h-3 rounded-full border border-white shadow bg-red-500"></span>
            <span>Fuera de Turno</span>
          </div>
        </div>
      </div>
    </div>
  );
}
