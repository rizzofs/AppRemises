'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import {
  ShieldCheck,
  Car,
  MapPin,
  Clock,
  Phone,
  Navigation,
  Compass,
  CheckCircle2,
  AlertCircle,
  Share2,
  Copy,
  Check
} from 'lucide-react';
import { clienteService } from '@/lib/api';
import { toast } from 'react-hot-toast';

export default function TrackViajePage() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viaje, setViaje] = useState<any>(null);
  const [vehiculoPos, setVehiculoPos] = useState<{ lat: number; lng: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchTracking = async () => {
    if (!token) return;
    try {
      const res = await clienteService.getViajeTracking(token);
      if (res.success && res.data) {
        setViaje(res.data);
        if (res.data.vehiculo?.latitud && res.data.vehiculo?.longitud) {
          setVehiculoPos({
            lat: res.data.vehiculo.latitud,
            lng: res.data.vehiculo.longitud
          });
        }
      } else {
        setError(res.message || 'No se pudo cargar el viaje');
      }
    } catch (err: any) {
      setError('Error al conectar con el servicio de seguimiento');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracking();
    const interval = setInterval(fetchTracking, 5000);
    return () => clearInterval(interval);
  }, [token]);

  // WebSocket para tracking GPS en tiempo real
  useEffect(() => {
    if (!viaje?.remiseria?.id) return;
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    const socket: Socket = io(socketUrl, {
      transports: ['websocket'],
      withCredentials: true,
    });

    socket.on('connect', () => {
      socket.emit('join_room', { remiseriaId: viaje.remiseria.id });
    });

    socket.on('vehiculo_movido', (data: any) => {
      if (viaje.vehiculo?.id && data.vehiculoId === viaje.vehiculo.id && data.ubicacion) {
        setVehiculoPos({
          lat: data.ubicacion.lat,
          lng: data.ubicacion.lng
        });
      }
    });

    socket.on('viaje_estado_actualizado', (data: any) => {
      if (data.viajeId === viaje.id) {
        setViaje((prev: any) => ({ ...prev, estado: data.estado, ...(data.viaje || {}) }));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [viaje?.remiseria?.id, viaje?.vehiculo?.id, viaje?.id]);

  const copiarEnlace = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success('¡Enlace de seguimiento copiado!');
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mb-4"></div>
        <p className="text-slate-600 dark:text-slate-300 font-semibold text-sm">
          Cargando seguimiento en vivo...
        </p>
      </div>
    );
  }

  if (error || !viaje) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 max-w-md w-full p-6 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-800 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Enlace de viaje no disponible</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {error || 'El viaje ya finalizó o el enlace temporal ha expirado.'}
          </p>
        </div>
      </div>
    );
  }

  const estadoBadge = () => {
    switch (viaje.estado) {
      case 'PENDIENTE':
        return {
          texto: 'Buscando conductor',
          color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300'
        };
      case 'ACEPTADO':
        return {
          texto: 'Conductor asignado - En camino',
          color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300'
        };
      case 'EN_CAMINO':
        return {
          texto: '¡Vehículo en la puerta!',
          color: 'bg-amber-500 text-white animate-pulse border-amber-600'
        };
      case 'EN_CURSO':
        return {
          texto: 'En viaje hacia el destino',
          color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300'
        };
      case 'COMPLETADO':
        return {
          texto: 'Viaje finalizado con éxito',
          color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300'
        };
      case 'CANCELADO':
        return {
          texto: 'Viaje cancelado',
          color: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300'
        };
      default:
        return {
          texto: viaje.estado,
          color: 'bg-slate-100 text-slate-700'
        };
    }
  };

  const badge = estadoBadge();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* HEADER DE SEGURIDAD */}
      <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 py-3.5 px-4 sticky top-0 z-30 shadow-xs">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                {viaje.remiseria?.nombreFantasia || 'Remises Bruno'}
              </h1>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block"></span>
                Seguimiento en Vivo de Seguridad
              </p>
            </div>
          </div>
          <button
            onClick={copiarEnlace}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            <span>{copied ? 'Copiado' : 'Compartir'}</span>
          </button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 max-w-lg w-full mx-auto p-4 space-y-4">
        {/* ESTADO ACTUAL */}
        <div className={`p-3.5 rounded-2xl border text-center font-bold text-xs shadow-xs ${badge.color}`}>
          {badge.texto}
        </div>

        {/* MAPA / LOCALIZACIÓN VISUAL */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="h-64 w-full bg-slate-100 dark:bg-slate-800 relative flex items-center justify-center">
            {vehiculoPos ? (
              <div className="text-center p-4">
                <div className="relative inline-flex items-center justify-center p-4 bg-emerald-500 text-white rounded-full shadow-xl mb-3 animate-bounce">
                  <Car className="w-8 h-8" />
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Ubicación actual del móvil
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Lat: {vehiculoPos.lat.toFixed(5)}, Lng: {vehiculoPos.lng.toFixed(5)}
                </p>
              </div>
            ) : (
              <div className="text-center p-4 text-slate-400">
                <Compass className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-semibold">Ubicación GPS en espera de señal...</p>
              </div>
            )}
          </div>
        </div>

        {/* DETALLES DEL CHOFER Y VEHÍCULO */}
        {viaje.chofer && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-3">
              {viaje.chofer.fotoUrl ? (
                <img
                  src={viaje.chofer.fotoUrl}
                  alt={viaje.chofer.nombre}
                  className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500"
                />
              ) : (
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-base">
                  {viaje.chofer.nombre?.charAt(0) || 'C'}
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {viaje.chofer.nombre} {viaje.chofer.apellido || ''}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Chofer profesional verificado</p>
              </div>
              {viaje.chofer.telefono && (
                <a
                  href={`tel:${viaje.chofer.telefono}`}
                  className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-100 transition-colors"
                  title="Llamar al chofer"
                >
                  <Phone className="w-4 h-4" />
                </a>
              )}
            </div>

            {viaje.vehiculo && (
              <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Vehículo</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {viaje.vehiculo.marca} {viaje.vehiculo.modelo}
                    {viaje.vehiculo.color ? ` (${viaje.vehiculo.color})` : ''}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Patente</span>
                  <span className="font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-800 dark:text-slate-100 text-xs border border-gray-200 dark:border-slate-700">
                    {viaje.vehiculo.patente}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ITINERARIO DEL VIAJE */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recorrido</h4>
          
          <div className="space-y-3">
            {/* Origen */}
            <div className="flex items-start gap-2.5">
              <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1 shrink-0"></div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Punto de Recogida (Origen)</p>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{viaje.origen}</p>
              </div>
            </div>

            {/* Paradas Intermedias */}
            {Array.isArray(viaje.paradas) && viaje.paradas.map((p: any, idx: number) => (
              <div key={idx} className="flex items-start gap-2.5 pl-0.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1 shrink-0"></div>
                <div>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase">
                    Parada Intermedia #{idx + 1}
                  </p>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{p.direccion}</p>
                </div>
              </div>
            ))}

            {/* Destino */}
            <div className="flex items-start gap-2.5">
              <div className="w-3 h-3 rounded-full bg-rose-500 mt-1 shrink-0"></div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Destino Final</p>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{viaje.destino}</p>
              </div>
            </div>
          </div>
        </div>

        {/* CONTACTO DE LA CENTRAL */}
        {viaje.remiseria?.telefono && (
          <div className="p-3.5 bg-slate-100 dark:bg-slate-900 rounded-xl text-center">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              ¿Dudas o consultas sobre este viaje?
            </p>
            <a
              href={`tel:${viaje.remiseria.telefono}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 hover:underline"
            >
              <Phone className="w-3.5 h-3.5" />
              Llamar a la Central ({viaje.remiseria.telefono})
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
