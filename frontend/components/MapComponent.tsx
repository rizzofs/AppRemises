'use client';

import { useState } from 'react';
import { MAP_CONFIG, getVehicleColor, getVehicleStatusText } from '@/lib/mapConfig';
import { MapPin, Car, Navigation, ZoomIn, ZoomOut, ExternalLink } from 'lucide-react';

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

interface MapComponentProps {
  vehiculos: Vehiculo[];
  onVehiculoClick?: (vehiculo: Vehiculo) => void;
  center?: [number, number];
  zoom?: number;
  height?: string;
}

export default function MapComponent({
  vehiculos,
  onVehiculoClick,
  center = MAP_CONFIG.DEFAULT_CENTER,
  zoom = MAP_CONFIG.DEFAULT_ZOOM,
  height = '400px'
}: MapComponentProps) {
  const [selectedVehiculo, setSelectedVehiculo] = useState<Vehiculo | null>(null);
  const [currentZoom, setCurrentZoom] = useState(zoom);

  const handleVehiculoClick = (vehiculo: Vehiculo) => {
    setSelectedVehiculo(vehiculo);
    onVehiculoClick?.(vehiculo);
  };

  // Función para convertir coordenadas a posición relativa en el mapa
  const getVehiculoPosition = (vehiculo: Vehiculo) => {
    // Buenos Aires bounds aproximados
    const minLat = -34.8;
    const maxLat = -34.4;
    const minLng = -58.6;
    const maxLng = -58.2;
    
    const x = ((vehiculo.ubicacion.lng - minLng) / (maxLng - minLng)) * 100;
    const y = ((maxLat - vehiculo.ubicacion.lat) / (maxLat - minLat)) * 100;
    
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  };

  // Función para abrir Google Maps
  const openInGoogleMaps = (vehiculo: Vehiculo) => {
    const url = `https://www.google.com/maps?q=${vehiculo.ubicacion.lat},${vehiculo.ubicacion.lng}`;
    window.open(url, '_blank');
  };

  const handleZoomIn = () => {
    setCurrentZoom(prev => Math.min(prev + 1, 18));
  };

  const handleZoomOut = () => {
    setCurrentZoom(prev => Math.max(prev - 1, 1));
  };

  // Generar URL de imagen estática de Google Maps
  const getGoogleMapsImageUrl = () => {
    const [lat, lng] = center;
    const size = '600x400';
    const zoom = currentZoom;
    const apiKey = 'YOUR_API_KEY'; // Opcional para imágenes estáticas
    
    // Usar imagen estática sin API key (limitada pero funcional)
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&maptype=roadmap&markers=color:red%7C${lat},${lng}`;
  };

  // URL de OpenStreetMap como alternativa
  const getOpenStreetMapUrl = () => {
    const [lat, lng] = center;
    const zoom = currentZoom;
    return `https://tile.openstreetmap.org/${zoom}/${Math.floor((lng + 180) / 360 * Math.pow(2, zoom))}/${Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom))}.png`;
  };

  return (
    <div className="w-full rounded-lg overflow-hidden relative" style={{ height }}>
      {/* Mapa real con imagen estática */}
      <div className="w-full h-full relative bg-gray-200">
        {/* Imagen del mapa de fondo */}
        <div 
          className="w-full h-full bg-cover bg-center"
          style={{ 
            backgroundImage: `url(https://maps.googleapis.com/maps/api/staticmap?center=${center[0]},${center[1]}&zoom=${currentZoom}&size=800x600&maptype=roadmap&style=feature:poi|visibility:off&style=feature:transit|visibility:off)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          {/* Overlay para mejorar la visibilidad de los marcadores */}
          <div className="absolute inset-0 bg-black bg-opacity-5"></div>
        </div>

        {/* Controles de zoom */}
        <div className="absolute top-4 right-4 flex flex-col space-y-2 z-20">
          <button
            onClick={handleZoomIn}
            className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
            title="Acercar"
          >
            <ZoomIn className="w-5 h-5 text-gray-700" />
          </button>
          <button
            onClick={handleZoomOut}
            className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
            title="Alejar"
          >
            <ZoomOut className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* Botón para abrir en Google Maps */}
        <div className="absolute bottom-4 right-4 z-20">
          <button
            onClick={() => window.open(`https://www.google.com/maps?q=${center[0]},${center[1]}`, '_blank')}
            className="flex items-center space-x-2 px-3 py-2 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition-colors text-sm"
            title="Abrir en Google Maps"
          >
            <ExternalLink className="w-4 h-4 text-gray-700" />
            <span className="text-gray-700">Google Maps</span>
          </button>
        </div>

        {/* Marcadores de vehículos */}
        {vehiculos.map((vehiculo) => {
          const position = getVehiculoPosition(vehiculo);
          return (
            <div
              key={vehiculo.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
              style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
              }}
              onClick={() => handleVehiculoClick(vehiculo)}
            >
              {/* Marcador del vehículo */}
              <div
                className="w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ backgroundColor: getVehicleColor(vehiculo.estado) }}
              >
                <Car className="w-3 h-3 text-white" />
              </div>
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="bg-gray-900 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap">
                  {vehiculo.patente}
                </div>
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
              </div>
              
              {/* Botón para abrir en Google Maps */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openInGoogleMaps(vehiculo);
                  }}
                  className="flex items-center space-x-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                  title="Abrir en Google Maps"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Maps</span>
                </button>
              </div>
            </div>
          );
        })}

        {/* Popup del vehículo seleccionado */}
        {selectedVehiculo && (
          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-xs z-10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">{selectedVehiculo.patente}</h3>
              <button
                onClick={() => setSelectedVehiculo(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getVehicleColor(selectedVehiculo.estado) }}
                ></div>
                <span className="font-medium">{getVehicleStatusText(selectedVehiculo.estado)}</span>
              </div>
              
              <p><span className="font-medium">Chofer:</span> {selectedVehiculo.chofer}</p>
              <p><span className="font-medium">Ubicación:</span> {selectedVehiculo.direccionActual}</p>
              <p className="text-xs text-gray-500">
                Actualizado: {new Date(selectedVehiculo.ultimaActualizacion).toLocaleTimeString()}
              </p>
              
              <div className="pt-2 border-t border-gray-200">
                <button
                  onClick={() => openInGoogleMaps(selectedVehiculo)}
                  className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Abrir en Google Maps</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Leyenda del mapa */}
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 text-xs">
          <div className="font-medium text-gray-900 mb-2">Estados</div>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Disponible</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>En Viaje</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span>Fuera de Servicio</span>
            </div>
          </div>
        </div>

        {/* Información del centro */}
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 text-xs">
          <div className="flex items-center space-x-2 text-gray-600">
            <MapPin className="w-4 h-4" />
            <span>Buenos Aires, Argentina</span>
          </div>
        </div>
      </div>
    </div>
  );
}
