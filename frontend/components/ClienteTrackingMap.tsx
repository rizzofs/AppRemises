'use client';

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MAP_CONFIG } from '@/lib/mapConfig';
import { coordinadorDashboardService } from '@/lib/api';
import { Navigation, Clock, Car } from 'lucide-react';

// Fix para los iconos por defecto de Leaflet en Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface ClienteTrackingMapProps {
  origen: string;
  destino: string;
  origenDetallado?: string | null;
  destinoDetallado?: string | null;
  estado: 'ACEPTADO' | 'EN_CAMINO' | 'EN_CURSO' | string;
  choferCoords?: [number, number] | null;
  baseCoords?: [number, number] | null;
  choferNombre?: string;
  vehiculoInfo?: string;
}

function parseCoordsFromDetallado(detallado?: string | null): [number, number] | null {
  if (!detallado) return null;
  const latMatch = detallado.match(/LAT=([-\d.]+)/i);
  const lonMatch = detallado.match(/LON=([-\d.]+)/i);
  if (latMatch && lonMatch) {
    const lat = parseFloat(latMatch[1]);
    const lon = parseFloat(lonMatch[1]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return [lat, lon];
    }
  }
  return null;
}

// Ajusta automáticamente el encuadre del mapa para mostrar los puntos relevantes
function FitTrackingBounds({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
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

const createMovingCarIcon = () =>
  L.divIcon({
    className: 'custom-client-car-marker',
    html: `
      <div style="position:relative;width:38px;height:38px;display:flex;align-items:center;justify-content:center;">
        <div style="
          position:absolute;
          inset:0;
          border-radius:9999px;
          background:rgba(16, 185, 129, 0.35);
          animation: ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <div style="
          position:relative;
          display:flex;
          align-items:center;
          justify-content:center;
          width:34px;
          height:34px;
          border-radius:9999px;
          background:#0f172a;
          color:#10b981;
          border:3px solid #10b981;
          box-shadow:0 4px 12px rgba(15,23,42,0.45);
          font-size:16px;
        ">
          🚕
        </div>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -19],
  });

export default function ClienteTrackingMap({
  origen,
  destino,
  origenDetallado,
  destinoDetallado,
  estado,
  choferCoords,
  baseCoords,
  choferNombre,
  vehiculoInfo,
}: ClienteTrackingMapProps) {
  const [origenCoords, setOrigenCoords] = useState<[number, number] | null>(null);
  const [destinoCoords, setDestinoCoords] = useState<[number, number] | null>(null);
  const [fallbackCarCoords, setFallbackCarCoords] = useState<[number, number] | null>(null);
  const [pickupRouteCoords, setPickupRouteCoords] = useState<[number, number][]>([]);
  const [tripRouteCoords, setTripRouteCoords] = useState<[number, number][]>([]);
  const [pickupInfo, setPickupInfo] = useState<{ distanceKm: string; cuadras: number; durationMin: number } | null>(null);
  const [tripInfo, setTripInfo] = useState<{ distanceKm: string; durationMin: number } | null>(null);
  const [loadingRoute, setLoadingRoute] = useState<boolean>(true);

  // Coordenada efectiva del auto: prioriza el GPS en tiempo real del chofer, luego la base o estimación cercana
  const effectiveCarCoords: [number, number] | null =
    estado === 'EN_CAMINO' && origenCoords
      ? origenCoords
      : choferCoords || baseCoords || fallbackCarCoords;

  // 1. Resolver coordenadas de Origen y Destino
  useEffect(() => {
    let cancelled = false;

    const resolveCoordinates = async () => {
      setLoadingRoute(true);
      try {
        let orig = parseCoordsFromDetallado(origenDetallado);
        let dest = parseCoordsFromDetallado(destinoDetallado);

        if (!orig && origen) {
          const resOrig = await coordinadorDashboardService.geocode(origen);
          if (resOrig.success && Array.isArray(resOrig.data) && resOrig.data.length > 0) {
            orig = [parseFloat(resOrig.data[0].lat), parseFloat(resOrig.data[0].lon)];
          }
        }

        if (!dest && destino) {
          const resDest = await coordinadorDashboardService.geocode(destino);
          if (resDest.success && Array.isArray(resDest.data) && resDest.data.length > 0) {
            dest = [parseFloat(resDest.data[0].lat), parseFloat(resDest.data[0].lon)];
          }
        }

        if (!orig) {
          orig = [-34.8957, -60.0189];
        }
        if (!dest) {
          dest = [orig[0] + 0.012, orig[1] + 0.015];
        }

        if (!cancelled) {
          setOrigenCoords(orig);
          setDestinoCoords(dest);
          setFallbackCarCoords((prev) => prev || [orig![0] - 0.0045, orig![1] - 0.0055]);
        }
      } catch (err) {
        console.error('Error geocodificando mapa de seguimiento del cliente:', err);
      } finally {
        if (!cancelled) setLoadingRoute(false);
      }
    };

    resolveCoordinates();

    return () => {
      cancelled = true;
    };
  }, [origen, destino, origenDetallado, destinoDetallado]);

  // 2. Calcular ruta por calles (OSRM) desde el auto hasta el cliente (ACEPTADO) y desde origen hasta destino
  useEffect(() => {
    if (!origenCoords || !destinoCoords) return;
    let cancelled = false;

    const fetchRoutes = async () => {
      try {
        // Si el auto está yendo a buscar al cliente (ACEPTADO), calculamos el trayecto Auto -> Origen
        if (effectiveCarCoords && estado === 'ACEPTADO') {
          const pickupUrl = `https://router.project-osrm.org/route/v1/driving/${effectiveCarCoords[1]},${effectiveCarCoords[0]};${origenCoords[1]},${origenCoords[0]}?overview=full&geometries=geojson`;
          const pickupRes = await fetch(pickupUrl);
          const pickupData = await pickupRes.json();

          if (!cancelled && pickupData?.routes?.length > 0) {
            const pRoute = pickupData.routes[0];
            const pCoords: [number, number][] = pRoute.geometry.coordinates.map(
              (c: [number, number]) => [c[1], c[0]]
            );
            setPickupRouteCoords(pCoords);
            const distMeters = Number(pRoute.distance) || 0;
            setPickupInfo({
              distanceKm: (distMeters / 1000).toFixed(1),
              cuadras: Math.max(1, Math.round(distMeters / 100)),
              durationMin: Math.max(1, Math.round(pRoute.duration / 60)),
            });
          } else if (!cancelled) {
            setPickupRouteCoords([effectiveCarCoords, origenCoords]);
          }
        } else if (!cancelled) {
          setPickupRouteCoords([]);
        }

        // Ruta del viaje (Auto/Origen -> Destino)
        const startPoint = estado === 'EN_CURSO' && effectiveCarCoords ? effectiveCarCoords : origenCoords;
        const tripUrl = `https://router.project-osrm.org/route/v1/driving/${startPoint[1]},${startPoint[0]};${destinoCoords[1]},${destinoCoords[0]}?overview=full&geometries=geojson`;
        const tripRes = await fetch(tripUrl);
        const tripData = await tripRes.json();

        if (!cancelled && tripData?.routes?.length > 0) {
          const tRoute = tripData.routes[0];
          const tCoords: [number, number][] = tRoute.geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]]
          );
          setTripRouteCoords(tCoords);
          setTripInfo({
            distanceKm: (tRoute.distance / 1000).toFixed(1),
            durationMin: Math.max(1, Math.round(tRoute.duration / 60)),
          });
        } else if (!cancelled) {
          setTripRouteCoords([startPoint, destinoCoords]);
        }
      } catch (err) {
        if (!cancelled) {
          if (effectiveCarCoords && estado === 'ACEPTADO') {
            setPickupRouteCoords([effectiveCarCoords, origenCoords]);
          }
          setTripRouteCoords([origenCoords, destinoCoords]);
        }
      }
    };

    fetchRoutes();

    return () => {
      cancelled = true;
    };
  }, [
    origenCoords,
    destinoCoords,
    effectiveCarCoords?.[0],
    effectiveCarCoords?.[1],
    estado,
  ]);

  // Puntos a encuadrar según el estado del viaje:
  // En ACEPTADO enfocamos el mapa en el auto yendo hacia el cliente para que vea claramente por dónde viene
  const boundsPoints: [number, number][] =
    estado === 'ACEPTADO'
      ? [
          ...(pickupRouteCoords.length > 0 ? pickupRouteCoords : []),
          ...(effectiveCarCoords ? [effectiveCarCoords] : []),
          ...(origenCoords ? [origenCoords] : []),
        ]
      : [
          ...(tripRouteCoords.length > 0 ? tripRouteCoords : []),
          ...(effectiveCarCoords ? [effectiveCarCoords] : []),
          ...(origenCoords ? [origenCoords] : []),
          ...(destinoCoords ? [destinoCoords] : []),
        ];

  const centerPoint: [number, number] =
    effectiveCarCoords || origenCoords || destinoCoords || MAP_CONFIG.DEFAULT_CENTER;

  return (
    <div className="rounded-xl overflow-hidden border border-emerald-200 dark:border-slate-800 shadow-sm bg-slate-50 dark:bg-slate-900">
      {/* Barra superior informativa en vivo */}
      <div className="bg-slate-900 text-white px-3 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <Car className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-pulse" />
          <span className="font-bold text-emerald-400 truncate">
            {estado === 'ACEPTADO'
              ? 'Auto en camino a buscarte'
              : estado === 'EN_CAMINO'
              ? 'Auto esperándote en la puerta'
              : 'En viaje hacia el destino'}
          </span>
        </div>

        {estado === 'ACEPTADO' && pickupInfo && (
          <div className="flex items-center gap-2 text-[11px] shrink-0 ml-2">
            <span className="flex items-center gap-0.5 font-bold text-white bg-slate-800 px-2 py-0.5 rounded-md">
              <Navigation className="w-3 h-3 text-emerald-400" />
              {Number(pickupInfo.distanceKm) < 1
                ? `A ~${pickupInfo.cuadras} ${pickupInfo.cuadras === 1 ? 'cuadra' : 'cuadras'}`
                : `${pickupInfo.distanceKm} km`}
            </span>
            <span className="flex items-center gap-0.5 font-bold text-amber-300 bg-slate-800 px-2 py-0.5 rounded-md">
              <Clock className="w-3 h-3" />
              ~{pickupInfo.durationMin} min
            </span>
          </div>
        )}

        {estado !== 'ACEPTADO' && tripInfo && (
          <div className="flex items-center gap-2 text-[11px] shrink-0 ml-2">
            <span className="flex items-center gap-0.5 font-bold text-white bg-slate-800 px-2 py-0.5 rounded-md">
              <Navigation className="w-3 h-3 text-sky-400" />
              {tripInfo.distanceKm} km
            </span>
            <span className="flex items-center gap-0.5 font-bold text-amber-300 bg-slate-800 px-2 py-0.5 rounded-md">
              <Clock className="w-3 h-3" />
              ~{tripInfo.durationMin} min
            </span>
          </div>
        )}
      </div>

      {/* Mapa Interactivo Leaflet */}
      <div className="w-full h-44 sm:h-52 relative">
        {loadingRoute && !origenCoords ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 text-gray-500 dark:text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2"></div>
            Ubicando tu remís en el mapa...
          </div>
        ) : (
          <MapContainer
            center={centerPoint}
            zoom={15}
            scrollWheelZoom={true}
            className="w-full h-full"
            style={{ zIndex: 1 }}
          >
            <TileLayer
              url={MAP_CONFIG.TILE_LAYERS.OPENSTREETMAP.url}
              attribution={MAP_CONFIG.TILE_LAYERS.OPENSTREETMAP.attribution}
            />

            {boundsPoints.length > 0 && <FitTrackingBounds points={boundsPoints} />}

            {/* Ruta del Auto -> Tu Ubicación (cuando está yendo a buscarte) */}
            {estado === 'ACEPTADO' && pickupRouteCoords.length > 1 && (
              <Polyline
                positions={pickupRouteCoords}
                pathOptions={{
                  color: '#10b981',
                  weight: 5,
                  opacity: 0.9,
                }}
              />
            )}

            {/* Ruta Principal Origen -> Destino */}
            {tripRouteCoords.length > 1 && (
              <Polyline
                positions={tripRouteCoords}
                pathOptions={{
                  color: '#2563eb',
                  weight: estado === 'ACEPTADO' ? 3 : 5,
                  dashArray: estado === 'ACEPTADO' ? '6, 6' : undefined,
                  opacity: estado === 'ACEPTADO' ? 0.55 : 0.85,
                }}
              />
            )}

            {/* Marcador de Origen (Punto de encuentro con el cliente) */}
            {origenCoords && (
              <Marker position={origenCoords} icon={createMarkerIcon('#16a34a', 'A')}>
                <Popup>
                  <div className="text-xs">
                    <p className="font-bold text-green-700">TU UBICACIÓN (Origen)</p>
                    <p className="text-gray-700">{origen}</p>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Marcador de Destino */}
            {destinoCoords && (
              <Marker position={destinoCoords} icon={createMarkerIcon('#dc2626', 'B')}>
                <Popup>
                  <div className="text-xs">
                    <p className="font-bold text-red-600">DESTINO</p>
                    <p className="text-gray-700">{destino}</p>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Marcador en vivo del Auto Asignado */}
            {effectiveCarCoords && (
              <Marker position={effectiveCarCoords} icon={createMovingCarIcon()}>
                <Popup>
                  <div className="text-xs">
                    <p className="font-bold text-emerald-700">
                      🚕 {choferNombre || 'Tu remís asignado'}
                    </p>
                    {vehiculoInfo && <p className="text-gray-600 font-medium">{vehiculoInfo}</p>}
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        )}
      </div>

      {/* Leyenda rápida inferior */}
      <div className="px-3 py-1.5 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-gray-600 dark:text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
            <span>🚕</span>
            <span>Remís en vivo</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-600 inline-block"></span>
            <span>Tu origen (A)</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-600 inline-block"></span>
            <span>Destino (B)</span>
          </span>
        </div>
        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
          GPS Activo
        </span>
      </div>
    </div>
  );
}
