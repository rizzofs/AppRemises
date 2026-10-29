'use client';

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MAP_CONFIG } from '@/lib/mapConfig';
import { coordinadorDashboardService } from '@/lib/api';
import { Navigation, Clock, Compass, ExternalLink } from 'lucide-react';

// Fix para los iconos por defecto de Leaflet en Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface ChoferRouteMapProps {
  origen: string;
  destino: string;
  estado: 'ACEPTADO' | 'EN_CAMINO' | 'EN_CURSO' | string;
}

// Ajusta automáticamente el encuadre del mapa para mostrar toda la ruta
function FitRouteBounds({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [points, map]);

  return null;
}

const createMarkerIcon = (bgColor: string, label: string) =>
  L.divIcon({
    className: 'custom-route-marker',
    html: `
      <div style="
        display:flex;
        align-items:center;
        justify-content:center;
        width:30px;
        height:30px;
        border-radius:9999px;
        background:${bgColor};
        color:#fff;
        font-weight:800;
        font-size:12px;
        border:3px solid #fff;
        box-shadow:0 4px 10px rgba(0,0,0,0.25);
      ">
        ${label}
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });

const createCarIcon = () =>
  L.divIcon({
    className: 'custom-car-marker',
    html: `
      <div style="
        display:flex;
        align-items:center;
        justify-content:center;
        width:34px;
        height:34px;
        border-radius:9999px;
        background:#0f172a;
        color:#38bdf8;
        border:3px solid #38bdf8;
        box-shadow:0 4px 12px rgba(15,23,42,0.4);
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
        </svg>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });

export default function ChoferRouteMap({ origen, destino, estado }: ChoferRouteMapProps) {
  const [origenCoords, setOrigenCoords] = useState<[number, number] | null>(null);
  const [destinoCoords, setDestinoCoords] = useState<[number, number] | null>(null);
  const [choferCoords, setChoferCoords] = useState<[number, number] | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [pickupRouteCoords, setPickupRouteCoords] = useState<[number, number][]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: string; durationMin: number } | null>(null);
  const [loadingRoute, setLoadingRoute] = useState<boolean>(true);

  // 1. Geocodificar Origen y Destino
  useEffect(() => {
    let cancelled = false;

    const resolveCoordinates = async () => {
      setLoadingRoute(true);
      try {
        let orig: [number, number] | null = null;
        let dest: [number, number] | null = null;

        if (origen) {
          const resOrig = await coordinadorDashboardService.geocode(origen);
          if (resOrig.success && Array.isArray(resOrig.data) && resOrig.data.length > 0) {
            orig = [parseFloat(resOrig.data[0].lat), parseFloat(resOrig.data[0].lon)];
          }
        }

        if (destino) {
          const resDest = await coordinadorDashboardService.geocode(destino);
          if (resDest.success && Array.isArray(resDest.data) && resDest.data.length > 0) {
            dest = [parseFloat(resDest.data[0].lat), parseFloat(resDest.data[0].lon)];
          }
        }

        // Coordenadas de respaldo en caso de direcciones sin match exacto (Chivilcoy)
        if (!orig) {
          orig = [-34.8957, -60.0189];
        }
        if (!dest) {
          dest = [orig[0] + 0.015, orig[1] + 0.018];
        }

        if (!cancelled) {
          setOrigenCoords(orig);
          setDestinoCoords(dest);
          setChoferCoords((prev) => prev || [orig![0] - 0.004, orig![1] - 0.004]);
        }
      } catch (err) {
        console.error('Error geocodificando ruta del chofer:', err);
      } finally {
        if (!cancelled) setLoadingRoute(false);
      }
    };

    resolveCoordinates();

    return () => {
      cancelled = true;
    };
  }, [origen, destino]);

  // 2. Escuchar GPS en tiempo real del dispositivo del chofer (si está disponible)
  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setChoferCoords([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {
        // Si el navegador no tiene permisos de GPS, mantenemos la posición estimada cercana al origen
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // 3. Obtener el trazado real de calles mediante OSRM (Open Source Routing Machine)
  useEffect(() => {
    if (!origenCoords || !destinoCoords) return;
    let cancelled = false;

    const fetchOsrmRoute = async () => {
      try {
        // Ruta principal: Origen -> Destino
        const url = `https://router.project-osrm.org/route/v1/driving/${origenCoords[1]},${origenCoords[0]};${destinoCoords[1]},${destinoCoords[0]}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();

        if (!cancelled && data?.routes?.length > 0) {
          const route = data.routes[0];
          const coords: [number, number][] = route.geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]]
          );
          setRouteCoords(coords);
          setRouteInfo({
            distanceKm: (route.distance / 1000).toFixed(1),
            durationMin: Math.max(1, Math.round(route.duration / 60)),
          });
        } else if (!cancelled) {
          setRouteCoords([origenCoords, destinoCoords]);
        }

        // Si el chofer está yendo al origen (ACEPTADO), trazar también el camino Chofer -> Origen
        if (choferCoords && estado === 'ACEPTADO') {
          const pickupUrl = `https://router.project-osrm.org/route/v1/driving/${choferCoords[1]},${choferCoords[0]};${origenCoords[1]},${origenCoords[0]}?overview=full&geometries=geojson`;
          const pickupRes = await fetch(pickupUrl);
          const pickupData = await pickupRes.json();
          if (!cancelled && pickupData?.routes?.length > 0) {
            const pCoords: [number, number][] = pickupData.routes[0].geometry.coordinates.map(
              (c: [number, number]) => [c[1], c[0]]
            );
            setPickupRouteCoords(pCoords);
          } else if (!cancelled) {
            setPickupRouteCoords([choferCoords, origenCoords]);
          }
        } else if (!cancelled) {
          setPickupRouteCoords([]);
        }
      } catch (err) {
        console.error('Error obteniendo ruta OSRM:', err);
        if (!cancelled) {
          setRouteCoords([origenCoords, destinoCoords]);
        }
      }
    };

    fetchOsrmRoute();

    return () => {
      cancelled = true;
    };
  }, [origenCoords, destinoCoords, choferCoords, estado]);

  const allPoints: [number, number][] = [
    ...(routeCoords.length > 0 ? routeCoords : []),
    ...(origenCoords ? [origenCoords] : []),
    ...(destinoCoords ? [destinoCoords] : []),
    ...(estado === 'ACEPTADO' && choferCoords ? [choferCoords] : []),
  ];

  const centerPoint: [number, number] =
    origenCoords || destinoCoords || MAP_CONFIG.DEFAULT_CENTER;

  const abrirNavegacionExterna = () => {
    const destQuery = encodeURIComponent(destino);
    const origQuery = encodeURIComponent(origen);
    const url =
      estado === 'ACEPTADO'
        ? `https://www.google.com/maps/dir/?api=1&destination=${origQuery}&travelmode=driving`
        : `https://www.google.com/maps/dir/?api=1&origin=${origQuery}&destination=${destQuery}&travelmode=driving`;
    window.open(url, '_blank');
  };

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-slate-800 shadow-sm bg-slate-50 dark:bg-slate-900">
      {/* Barra superior de métricas de ruta en tiempo real */}
      <div className="bg-slate-900 text-white px-3.5 py-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-semibold text-sky-400">
            <Compass className="w-4 h-4 animate-spin" style={{ animationDuration: '6s' }} />
            {estado === 'ACEPTADO'
              ? 'Ruta hacia el pasajero'
              : estado === 'EN_CAMINO'
              ? 'En punto de partida'
              : 'Ruta hacia el destino'}
          </span>
          {routeInfo && (
            <div className="flex items-center gap-2 text-slate-300 border-l border-slate-700 pl-3">
              <span className="flex items-center gap-1 font-bold text-white">
                <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                {routeInfo.distanceKm} km
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-bold text-amber-300">
                <Clock className="w-3.5 h-3.5" />
                {routeInfo.durationMin} min
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={abrirNavegacionExterna}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] transition-colors"
          title="Abrir indicaciones paso a paso en Google Maps"
        >
          <ExternalLink className="w-3 h-3" />
          <span>Navegar</span>
        </button>
      </div>

      {/* Mapa Interactivo Leaflet */}
      <div className="w-full h-64 relative">
        {loadingRoute && !origenCoords ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 text-gray-500 dark:text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
            Calculando el mejor camino...
          </div>
        ) : (
          <MapContainer
            center={centerPoint}
            zoom={14}
            scrollWheelZoom={true}
            className="w-full h-full"
            style={{ zIndex: 1 }}
          >
            <TileLayer
              url={MAP_CONFIG.TILE_LAYERS.OPENSTREETMAP.url}
              attribution={MAP_CONFIG.TILE_LAYERS.OPENSTREETMAP.attribution}
            />

            {allPoints.length > 0 && <FitRouteBounds points={allPoints} />}

            {/* Tramo Chofer -> Origen cuando está yendo a buscar al cliente */}
            {estado === 'ACEPTADO' && pickupRouteCoords.length > 1 && (
              <Polyline
                positions={pickupRouteCoords}
                pathOptions={{
                  color: '#f97316',
                  weight: 4,
                  dashArray: '8, 8',
                  opacity: 0.9,
                }}
              />
            )}

            {/* Ruta Principal Origen -> Destino */}
            {routeCoords.length > 1 && (
              <Polyline
                positions={routeCoords}
                pathOptions={{
                  color: '#2563eb',
                  weight: 5,
                  opacity: 0.85,
                }}
              />
            )}

            {/* Marcador de Posición Actual del Chofer */}
            {choferCoords && (
              <Marker
                position={
                  estado === 'EN_CAMINO' && origenCoords ? origenCoords : choferCoords
                }
                icon={createCarIcon()}
              >
                <Popup>
                  <div className="text-xs font-semibold">Tu vehículo (En línea)</div>
                </Popup>
              </Marker>
            )}

            {/* Marcador de Origen (A) */}
            {origenCoords && (
              <Marker position={origenCoords} icon={createMarkerIcon('#16a34a', 'A')}>
                <Popup>
                  <div className="text-xs">
                    <p className="font-bold text-green-700">ORIGEN (Punto A)</p>
                    <p className="text-gray-700">{origen}</p>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Marcador de Destino (B) */}
            {destinoCoords && (
              <Marker position={destinoCoords} icon={createMarkerIcon('#dc2626', 'B')}>
                <Popup>
                  <div className="text-xs">
                    <p className="font-bold text-red-600">DESTINO (Punto B)</p>
                    <p className="text-gray-700">{destino}</p>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        )}
      </div>

      {/* Leyenda rápida inferior */}
      <div className="px-3 py-2 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-gray-600 dark:text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-green-600 inline-block"></span>
            Origen (A)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"></span>
            Destino (B)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-1 bg-blue-600 rounded inline-block"></span>
            Camino sugerido
          </span>
        </div>
      </div>
    </div>
  );
}
