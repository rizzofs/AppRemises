'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import {
  MapPin,
  Navigation,
  Car,
  AlertTriangle,
  CheckCircle,
  User,
  Phone,
  Gauge,
  Clock,
  Sparkles,
  X,
  TrendingUp,
} from 'lucide-react';
import { choferService } from '@/lib/api';
import { io, Socket } from 'socket.io-client';

const ChoferRouteMap = dynamic(() => import('@/components/ChoferRouteMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 bg-slate-100 rounded-xl border border-gray-200 flex flex-col items-center justify-center text-xs text-gray-500 animate-pulse">
      Cargando mapa de navegación en tiempo real...
    </div>
  ),
});

// Fórmula de Haversine para calcular distancia en kilómetros entre dos coordenadas GPS
function calcularDistanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function ChoferApp() {
  const { user } = useAuth();

  const [isActive, setIsActive] = useState(false);
  const [viajeActual, setViajeActual] = useState<any>(null);
  const [alertaViaje, setAlertaViaje] = useState<any>(null);
  const [viajesRechazados, setViajesRechazados] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Turno y Odometría
  const [turnoActivo, setTurnoActivo] = useState<any>(null);
  const [kmConPasajero, setKmConPasajero] = useState(0);
  const [kmSinPasajero, setKmSinPasajero] = useState(0);
  const [kmTotalConectado, setKmTotalConectado] = useState(0);

  // Modal para iniciar/finalizar turno con odómetro de tablero opcional
  const [modalConexion, setModalConexion] = useState<'INICIAR' | 'FINALIZAR' | null>(null);
  const [odometroInput, setOdometroInput] = useState('');

  const lastAlertedIdRef = useRef<string | null>(null);
  const previousViajeIdRef = useRef<string | null>(null);

  // Referencias para tracking GPS
  const lastCoordsRef = useRef<[number, number] | null>(null);
  const pendingDeltaRef = useRef<{ con: number; sin: number }>({ con: 0, sin: 0 });
  const tripDistanceRef = useRef<{ con: number; sin: number }>({ con: 0, sin: 0 });
  const viajeActualRef = useRef<any>(null);
  const isActiveRef = useRef<boolean>(false);

  // Mantener refs sincronizadas para el watcher de GPS
  useEffect(() => {
    viajeActualRef.current = viajeActual;
  }, [viajeActual]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const socketRef = useRef<Socket | null>(null);
  const lastGpsEmitRef = useRef<number>(0);

  // Conexión WebSocket para reporte de GPS y despacho en tiempo real
  useEffect(() => {
    const remiseriaId = user?.chofer?.remiseriaId;
    if (!remiseriaId) return;

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    const socket = io(socketUrl, {
      transports: ['websocket'],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('⚡ Chofer conectado a Sockets. Sala:', remiseriaId);
      socket.emit('join_room', { remiseriaId });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.chofer?.remiseriaId]);

  // Función para emitir ubicación GPS al coordinador vía WebSocket
  const emitirUbicacionGps = useCallback((lat: number, lon: number, estadoOverride?: string) => {
    if (!user?.chofer || !socketRef.current?.connected) return;

    const estadoFinal = estadoOverride || (
      viajeActualRef.current
        ? 'en_viaje'
        : (isActiveRef.current ? 'disponible' : 'fuera_servicio')
    );

    socketRef.current.emit('actualizar_gps', {
      choferId: user.chofer.id,
      vehiculoId: user.chofer.vehiculoId || null,
      remiseriaId: user.chofer.remiseriaId,
      choferNombre: `${user.chofer.nombre || ''} ${user.chofer.apellido || ''}`.trim(),
      lat,
      lng: lon,
      estado: estadoFinal,
    });
  }, [user?.chofer]);

  // Cargar IDs de viajes rechazados en esta sesión
  useEffect(() => {
    try {
      const savedRejected = sessionStorage.getItem('chofer_viajes_rechazados');
      if (savedRejected) {
        setViajesRechazados(JSON.parse(savedRejected));
      }
    } catch {
      // ignore
    }
  }, []);

  const sincronizarEstado = useCallback(
    async (forzarActivo?: boolean) => {
      if (!user) return;
      const res = await choferService.getMiEstado(user?.chofer?.id);
      if (!res.success || !res.data) return;

      const { chofer, viajeActual: viajeEnCurso, viajesDisponibles, turnoActivo: turno } = res.data;

      const activoActual = forzarActivo !== undefined ? forzarActivo : Boolean(chofer?.isOnline);

      if (turno) {
        setTurnoActivo(turno);
        setKmConPasajero(Number((turno.kmConPasajero || 0).toFixed(1)));
        setKmSinPasajero(Number((turno.kmSinPasajero || 0).toFixed(1)));
        setKmTotalConectado(Number((turno.kmTotalConectado || 0).toFixed(1)));
      }

      // Si el chofer ya tenía un viaje en curso y desapareció
      if (previousViajeIdRef.current && !viajeEnCurso) {
        toast('El viaje actual fue finalizado o cancelado.', { icon: 'ℹ️' });
        tripDistanceRef.current = { con: 0, sin: 0 };
      }
      // Si el coordinador le asignó un viaje directamente
      if (!previousViajeIdRef.current && viajeEnCurso && lastAlertedIdRef.current !== viajeEnCurso.id) {
        toast.success('¡Tienes un viaje asignado!');
        tripDistanceRef.current = { con: 0, sin: 0 };
      }

      previousViajeIdRef.current = viajeEnCurso?.id || null;
      setViajeActual(viajeEnCurso || null);

      if (viajeEnCurso) {
        setAlertaViaje(null);
        return;
      }

      if (activoActual && Array.isArray(viajesDisponibles)) {
        let rechazadosActuales = viajesRechazados;
        try {
          const saved = sessionStorage.getItem('chofer_viajes_rechazados');
          if (saved) rechazadosActuales = JSON.parse(saved);
        } catch {
          // ignore
        }

        const siguienteViaje = viajesDisponibles.find(
          (v: any) => !rechazadosActuales.includes(v.id)
        );

        if (siguienteViaje) {
          setAlertaViaje(siguienteViaje);
          if (lastAlertedIdRef.current !== siguienteViaje.id) {
            lastAlertedIdRef.current = siguienteViaje.id;
            toast('¡Nueva solicitud de viaje disponible!', { icon: '🚕' });
          }
        } else {
          setAlertaViaje(null);
        }
      } else {
        setAlertaViaje(null);
      }
    },
    [user, viajesRechazados]
  );

  // Inicializar estado real desde el backend al entrar a la pantalla
  useEffect(() => {
    if (!user) return;

    const init = async () => {
      const savedLocal = localStorage.getItem('chofer_isActive');
      const res = await choferService.getMiEstado(user?.chofer?.id);

      if (res.success && res.data) {
        const dbOnline = Boolean(res.data.chofer?.isOnline);
        const localOnline = savedLocal !== null ? JSON.parse(savedLocal) : dbOnline;

        if (localOnline && !dbOnline) {
          await choferService.updateOnlineStatus(true, user?.chofer?.id);
        }

        const effectiveOnline = localOnline || dbOnline;
        setIsActive(effectiveOnline);
        localStorage.setItem('chofer_isActive', JSON.stringify(effectiveOnline));

        await sincronizarEstado(effectiveOnline);
      }
    };

    init();
  }, [user]);

  // Polling cada 3 segundos para detectar solicitudes de viaje entrantes o cambios de estado
  useEffect(() => {
    if (!user) return;
    if (!isActive && !viajeActual) return;

    const interval = setInterval(() => {
      sincronizarEstado(isActive);
    }, 3000);

    return () => clearInterval(interval);
  }, [user, isActive, viajeActual, sincronizarEstado]);

  // ==========================================
  // SEGUIMIENTO GPS Y ACUMULADOR DE ODOMETRÍA
  // ==========================================
  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        if (lastCoordsRef.current && isActiveRef.current) {
          const [prevLat, prevLon] = lastCoordsRef.current;
          const deltaKm = calcularDistanciaKm(prevLat, prevLon, lat, lon);

          // Filtrar ruido GPS: solo sumar si el movimiento es mayor a 15 metros y menor a 2.5 km por lectura
          if (deltaKm >= 0.015 && deltaKm <= 2.5) {
            const viaje = viajeActualRef.current;
            const esConPasajero = viaje && viaje.estado === 'EN_CURSO';

            if (esConPasajero) {
              setKmConPasajero((prev) => Number((prev + deltaKm).toFixed(2)));
              pendingDeltaRef.current.con += deltaKm;
              tripDistanceRef.current.con += deltaKm;
            } else {
              setKmSinPasajero((prev) => Number((prev + deltaKm).toFixed(2)));
              pendingDeltaRef.current.sin += deltaKm;
              tripDistanceRef.current.sin += deltaKm;
            }

            setKmTotalConectado((prev) => Number((prev + deltaKm).toFixed(2)));
          }
        }

        lastCoordsRef.current = [lat, lon];

        // Transmitir ubicación GPS en vivo al coordinador vía WebSocket (máximo cada 3 segundos)
        const ahora = Date.now();
        if (isActiveRef.current && (ahora - lastGpsEmitRef.current >= 3000)) {
          lastGpsEmitRef.current = ahora;
          emitirUbicacionGps(lat, lon);
        }
      },
      (err) => {
        console.warn('GPS chofer aviso:', err.message);
        if (err.code === 1) {
          toast.error('Por favor habilitá el permiso de ubicación en tu navegador para reportar tu posición en el mapa.', { id: 'gps-perm-error' });
        }
      },
      { enableHighAccuracy: false, maximumAge: 10000, timeout: 15000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Sincronizar periódicamente deltas de kilometraje acumulados al backend cada 25s
  useEffect(() => {
    if (!isActive || !user) return;

    const syncInterval = setInterval(async () => {
      const deltaCon = pendingDeltaRef.current.con;
      const deltaSin = pendingDeltaRef.current.sin;

      if (deltaCon > 0 || deltaSin > 0) {
        pendingDeltaRef.current = { con: 0, sin: 0 };
        try {
          await choferService.actualizarKmTurno({
            kmConPasajeroDelta: deltaCon,
            kmSinPasajeroDelta: deltaSin,
            choferId: user?.chofer?.id,
          });
        } catch {
          // Re-acumular en caso de fallo de red
          pendingDeltaRef.current.con += deltaCon;
          pendingDeltaRef.current.sin += deltaSin;
        }
      }
    }, 25000);

    return () => clearInterval(syncInterval);
  }, [isActive, user]);

  // Manejar conexión y desconexión con odómetro
  const confirmarToggleStatus = async (odometro?: number) => {
    const newState = !isActive;
    setActionLoading(true);

    try {
      const odometros = newState
        ? { odometroInicio: odometro }
        : { odometroFin: odometro };

      // Si se desconecta, sincronizar cualquier km remanente antes
      if (!newState && (pendingDeltaRef.current.con > 0 || pendingDeltaRef.current.sin > 0)) {
        await choferService.actualizarKmTurno({
          kmConPasajeroDelta: pendingDeltaRef.current.con,
          kmSinPasajeroDelta: pendingDeltaRef.current.sin,
          choferId: user?.chofer?.id,
        });
        pendingDeltaRef.current = { con: 0, sin: 0 };
      }

      const response = await choferService.updateOnlineStatus(
        newState,
        user?.chofer?.id,
        odometros
      );

      if (!response.success) {
        toast.error(response.message || 'Error al actualizar estado en el servidor');
        return;
      }

      setIsActive(newState);
      localStorage.setItem('chofer_isActive', JSON.stringify(newState));
      setModalConexion(null);
      setOdometroInput('');

      if (newState) {
        toast.success('Ahora estás Activo. Esperando viajes...');
        await sincronizarEstado(true);

        // Transmitir inmediatamente la coordenada actual por WebSocket
        if (typeof window !== 'undefined' && 'geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const lat = pos.coords.latitude;
              const lon = pos.coords.longitude;
              lastCoordsRef.current = [lat, lon];
              lastGpsEmitRef.current = Date.now();
              emitirUbicacionGps(lat, lon, 'disponible');
            },
            (err) => console.warn('GPS chofer aviso inicial:', err.message),
            { enableHighAccuracy: false, timeout: 15000 }
          );
        }
      } else {
        setAlertaViaje(null);
        toast.success('Te has desconectado. ¡Buen descanso!');

        // Notificar desconexión al mapa del coordinador
        if (lastCoordsRef.current) {
          emitirUbicacionGps(lastCoordsRef.current[0], lastCoordsRef.current[1], 'fuera_servicio');
        }
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleClick = () => {
    if (!isActive) {
      setModalConexion('INICIAR');
    } else {
      if (viajeActual) {
        toast.error('No puedes desconectarte mientras tienes un viaje en curso.');
        return;
      }
      setModalConexion('FINALIZAR');
    }
  };

  const aceptarViaje = async () => {
    if (!alertaViaje || actionLoading) return;

    if (String(alertaViaje.id).startsWith('viaje-test')) {
      setViajeActual({ ...alertaViaje, estado: 'ACEPTADO' });
      setAlertaViaje(null);
      tripDistanceRef.current = { con: 0, sin: 0 };
      toast.success('¡Viaje aceptado!');
      return;
    }

    setActionLoading(true);
    try {
      const res = await choferService.aceptarViaje(alertaViaje.id, user?.chofer?.id);
      if (res.success && res.data) {
        previousViajeIdRef.current = res.data.id;
        tripDistanceRef.current = { con: 0, sin: 0 };
        setViajeActual(res.data);
        setAlertaViaje(null);
        toast.success('¡Viaje aceptado! Dirígete al punto de origen.');
      } else {
        toast.error(res.message || 'No se pudo aceptar el viaje');
        setAlertaViaje(null);
        await sincronizarEstado(isActive);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const rechazarViaje = () => {
    if (!alertaViaje) return;
    const nuevosRechazados = [...viajesRechazados, alertaViaje.id];
    setViajesRechazados(nuevosRechazados);
    try {
      sessionStorage.setItem('chofer_viajes_rechazados', JSON.stringify(nuevosRechazados));
    } catch {
      // ignore
    }
    setAlertaViaje(null);
    toast('Solicitud rechazada. Seguimos buscando viajes...');
  };

  const avisarLlegada = async () => {
    if (!viajeActual || actionLoading) return;
    if (String(viajeActual.id).startsWith('viaje-test')) {
      setViajeActual({ ...viajeActual, estado: 'EN_CAMINO' });
      toast.success('Avisamos al cliente que estás esperando afuera');
      return;
    }

    setActionLoading(true);
    try {
      const res = await choferService.actualizarEstadoViaje(viajeActual.id, 'EN_CAMINO');
      if (res.success && res.data) {
        setViajeActual(res.data);
        toast.success('Avisamos al cliente que estás esperando afuera');
      } else {
        toast.error(res.message || 'Error al actualizar el estado del viaje');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const iniciarViaje = async () => {
    if (!viajeActual || actionLoading) return;
    if (String(viajeActual.id).startsWith('viaje-test')) {
      setViajeActual({ ...viajeActual, estado: 'EN_CURSO' });
      toast.success('Pasajero a bordo. Viaje iniciado.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await choferService.actualizarEstadoViaje(viajeActual.id, 'EN_CURSO');
      if (res.success && res.data) {
        setViajeActual(res.data);
        toast.success('Pasajero a bordo. Viaje en curso hacia el destino');
      } else {
        toast.error(res.message || 'Error al iniciar el viaje');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const finalizarViaje = async () => {
    if (!viajeActual || actionLoading) return;
    const confirmacion = window.confirm(
      '¿Estás seguro de que deseas finalizar el viaje ahora? Verifica que hayas llegado a destino.'
    );

    if (!confirmacion) return;

    if (String(viajeActual.id).startsWith('viaje-test')) {
      setViajeActual(null);
      tripDistanceRef.current = { con: 0, sin: 0 };
      toast.success('Viaje completado. ¡Buen trabajo!');
      return;
    }

    setActionLoading(true);
    try {
      const distCon = tripDistanceRef.current.con > 0 ? Number(tripDistanceRef.current.con.toFixed(2)) : undefined;
      const distSin = tripDistanceRef.current.sin > 0 ? Number(tripDistanceRef.current.sin.toFixed(2)) : undefined;

      const res = await choferService.actualizarEstadoViaje(viajeActual.id, 'COMPLETADO', {
        distanciaKmConPasajero: distCon,
        distanciaKmSinPasajero: distSin,
      });

      if (res.success) {
        previousViajeIdRef.current = null;
        tripDistanceRef.current = { con: 0, sin: 0 };
        setViajeActual(null);
        toast.success('Viaje completado. ¡Buen trabajo!');
        await sincronizarEstado(isActive);
      } else {
        toast.error(res.message || 'Error al finalizar el viaje');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const anularViaje = async () => {
    if (!viajeActual || actionLoading) return;
    const confirmacion = window.confirm(
      '¿Estás seguro de que deseas anular este viaje? Esta acción no se puede deshacer.'
    );

    if (!confirmacion) return;

    if (String(viajeActual.id).startsWith('viaje-test')) {
      setViajeActual(null);
      tripDistanceRef.current = { con: 0, sin: 0 };
      toast.error('Viaje anulado.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await choferService.actualizarEstadoViaje(viajeActual.id, 'CANCELADO');
      if (res.success) {
        previousViajeIdRef.current = null;
        tripDistanceRef.current = { con: 0, sin: 0 };
        setViajeActual(null);
        toast.error('Viaje anulado.');
        await sincronizarEstado(isActive);
      } else {
        toast.error(res.message || 'Error al anular el viaje');
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (!user) return null;

  const precioAlerta = alertaViaje?.precio ?? alertaViaje?.precioEstimado ?? 0;
  const clienteNombreAlerta =
    alertaViaje?.clienteNombre ||
    (alertaViaje?.cliente
      ? `${alertaViaje.cliente.nombre} ${alertaViaje.cliente.apellido}`
      : 'Pasajero');

  const precioActual = viajeActual?.precio ?? viajeActual?.precioEstimado ?? 0;
  const clienteNombreActual =
    viajeActual?.clienteNombre ||
    (viajeActual?.cliente
      ? `${viajeActual.cliente.nombre} ${viajeActual.cliente.apellido}`
      : 'Pasajero');
  const clienteTelefonoActual =
    viajeActual?.clienteTelefono || viajeActual?.cliente?.telefono || null;

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto pb-24">
      {/* Botón de Estado / Toggle Activo */}
      {!isActive ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col items-center justify-center min-h-[50vh] transition-colors">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6">Comenzar Jornada</h2>
          <button
            onClick={handleToggleClick}
            disabled={actionLoading}
            className="relative w-40 h-40 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-xl bg-gradient-to-br from-gray-100 to-gray-300 dark:from-slate-800 dark:to-slate-700 text-gray-600 dark:text-slate-200 shadow-gray-500/20 dark:shadow-black/50 active:scale-95 disabled:opacity-50"
          >
            <Car className="w-12 h-12 mb-2 text-primary-600 dark:text-primary-400" />
            <span className="font-extrabold text-lg tracking-wide text-gray-800 dark:text-white">CONECTARSE</span>
          </button>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-6 text-center max-w-xs">
            Pulsa el botón para ponerte en línea y comenzar a registrar tus kilómetros y recibir viajes.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Barra de Estado Conectado */}
          <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl p-4 shadow-sm border border-emerald-100 dark:border-emerald-800/40 flex items-center justify-between transition-colors">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-3.5 h-3.5 bg-emerald-500 rounded-full animate-ping absolute"></div>
                <div className="w-3.5 h-3.5 bg-emerald-500 rounded-full relative"></div>
              </div>
              <div>
                <p className="font-bold text-emerald-900 dark:text-emerald-200 leading-tight">EN LÍNEA</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  {viajeActual
                    ? viajeActual.estado === 'EN_CURSO'
                      ? 'Con pasajero a bordo'
                      : 'Yendo a buscar al pasajero'
                    : 'Esperando solicitudes de viaje...'}
                </p>
              </div>
            </div>

            <button
              onClick={handleToggleClick}
              disabled={Boolean(viajeActual) || actionLoading}
              className="px-3.5 py-1.5 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 text-xs font-semibold rounded-xl shadow-xs border border-gray-200 dark:border-slate-700 active:bg-gray-50 dark:active:bg-slate-700 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              Desconectarse
            </button>
          </div>

          {/* Widget de Odometría / Kilometraje del Turno en Tiempo Real */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold uppercase tracking-wider">
                <Gauge className="w-4 h-4 text-emerald-400" />
                <span>Odómetro de Jornada</span>
              </div>
              <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                GPS Activo
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              {/* Km con Pasajeros */}
              <div
                className={`p-2 rounded-xl transition-all ${
                  viajeActual?.estado === 'EN_CURSO'
                    ? 'bg-emerald-500/20 ring-1 ring-emerald-400'
                    : 'bg-white/5'
                }`}
              >
                <p className="text-[10px] text-slate-400 uppercase font-semibold">C/ Pasajeros</p>
                <p className="text-lg font-black text-emerald-400">{kmConPasajero}</p>
                <span className="text-[10px] text-slate-400">km ocupado</span>
              </div>

              {/* Km sin Pasajeros */}
              <div
                className={`p-2 rounded-xl transition-all ${
                  viajeActual && viajeActual.estado !== 'EN_CURSO'
                    ? 'bg-amber-500/20 ring-1 ring-amber-400'
                    : 'bg-white/5'
                }`}
              >
                <p className="text-[10px] text-slate-400 uppercase font-semibold">S/ Pasajeros</p>
                <p className="text-lg font-black text-amber-400">{kmSinPasajero}</p>
                <span className="text-[10px] text-slate-400">km vacío/espera</span>
              </div>

              {/* Km Total Conectado */}
              <div className="bg-white/5 p-2 rounded-xl">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Total Turno</p>
                <p className="text-lg font-black text-white">{kmTotalConectado}</p>
                <span className="text-[10px] text-slate-400">km totales</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estado de espera cuando está conectado y sin viaje ni alerta */}
      {isActive && !alertaViaje && !viajeActual && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-800 text-center space-y-3 transition-colors">
          <div className="w-12 h-12 bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 rounded-full flex items-center justify-center mx-auto">
            <Car className="w-6 h-6 animate-pulse" />
          </div>
          <h3 className="font-bold text-gray-800 dark:text-white text-sm">Esperando solicitudes</h3>
          <p className="text-xs text-gray-400 dark:text-slate-400 max-w-xs mx-auto">
            Tu ubicación se está transmitiendo en tiempo real. Cuando haya un viaje cerca o el coordinador te asigne uno, aparecerá aquí.
          </p>
        </div>
      )}

      {/* Alerta de Nuevo Viaje */}
      {alertaViaje && (
        <div className="fixed inset-x-0 bottom-16 p-4 z-50 animate-slide-up">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-primary-100 dark:border-slate-800 overflow-hidden max-w-md mx-auto transition-colors">
            <div className="bg-primary-600 dark:bg-slate-800 text-white p-3.5 flex items-center justify-between">
              <span className="font-bold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 animate-pulse text-amber-300" />
                ¡NUEVO VIAJE DISPONIBLE!
              </span>
              <span className="font-extrabold text-lg">
                ${Number(precioAlerta).toLocaleString('es-AR')}
              </span>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-800/80 px-3 py-2 rounded-lg">
                <User className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
                <span className="font-semibold text-gray-800 dark:text-white">{clienteNombreAlerta}</span>
              </div>

              <div className="flex gap-3">
                <MapPin className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-400">ORIGEN</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{alertaViaje.origen}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Navigation className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-400">DESTINO</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{alertaViaje.destino}</p>
                </div>
              </div>

              {alertaViaje.observaciones && (
                <p className="text-xs text-gray-600 dark:text-slate-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800/40 p-2 rounded-lg">
                  Nota: {alertaViaje.observaciones}
                </p>
              )}

              <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button
                  onClick={rechazarViaje}
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 font-bold rounded-xl active:bg-gray-200 dark:active:bg-slate-700 disabled:opacity-50 text-sm"
                >
                  RECHAZAR
                </button>
                <button
                  onClick={aceptarViaje}
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-500/30 active:bg-primary-700 disabled:opacity-50 text-sm"
                >
                  {actionLoading ? 'ACEPTANDO...' : 'ACEPTAR VIAJE'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Viaje Actual */}
      {viajeActual && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden transition-colors">
          <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-white/10">
            <div>
              <h3 className="font-bold text-base mb-1">Viaje en curso</h3>
              <span className="inline-flex px-2 py-0.5 bg-white/20 text-xs font-semibold rounded-md">
                {viajeActual.estado === 'ACEPTADO' && 'YENDO AL ORIGEN'}
                {viajeActual.estado === 'EN_CAMINO' && 'ESPERANDO AL CLIENTE'}
                {viajeActual.estado === 'EN_CURSO' && 'EN CAMINO AL DESTINO'}
              </span>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-slate-400">Tarifa estimada</p>
              <p className="text-xl font-extrabold text-emerald-400">
                ${Number(precioActual).toLocaleString('es-AR')}
              </p>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/70 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-slate-700 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-400">Pasajero</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{clienteNombreActual}</p>
                </div>
              </div>
              {clienteTelefonoActual && (
                <a
                  href={`tel:${clienteTelefonoActual}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-semibold"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {clienteTelefonoActual}
                </a>
              )}
            </div>

            <div className="flex gap-3 items-start">
              <div className="mt-1 w-6 flex flex-col items-center">
                <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                <div className="w-0.5 h-10 bg-gray-200 dark:bg-slate-700"></div>
                <div className="w-3 h-3 bg-rose-500 rounded-full"></div>
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-400">ORIGEN</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{viajeActual.origen}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-400">DESTINO</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{viajeActual.destino}</p>
                </div>
              </div>
            </div>

            {/* Mapa interactivo en tiempo real con el camino trazado */}
            <ChoferRouteMap
              origen={viajeActual.origen}
              destino={viajeActual.destino}
              estado={viajeActual.estado}
            />

            <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex flex-col gap-2.5">
              {viajeActual.estado === 'ACEPTADO' && (
                <button
                  onClick={avisarLlegada}
                  disabled={actionLoading}
                  className="w-full py-3.5 bg-amber-500 text-white font-bold rounded-xl shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                >
                  <CheckCircle className="w-5 h-5" />
                  AVISAR &quot;ESTOY LLEGANDO&quot;
                </button>
              )}

              {viajeActual.estado === 'EN_CAMINO' && (
                <button
                  onClick={iniciarViaje}
                  disabled={actionLoading}
                  className="w-full py-3.5 bg-primary-600 text-white font-bold rounded-xl shadow-md shadow-primary-500/20 disabled:opacity-50 text-sm"
                >
                  INICIAR VIAJE (PASAJERO A BORDO)
                </button>
              )}

              {viajeActual.estado === 'EN_CURSO' && (
                <button
                  onClick={finalizarViaje}
                  disabled={actionLoading}
                  className="w-full py-3.5 bg-emerald-600 text-white font-bold rounded-xl shadow-md shadow-emerald-500/20 disabled:opacity-50 text-sm"
                >
                  FINALIZAR VIAJE (${Number(precioActual).toLocaleString('es-AR')})
                </button>
              )}

              {/* Botón para anular el viaje */}
              <button
                onClick={anularViaje}
                disabled={actionLoading}
                className="w-full py-2.5 bg-white dark:bg-slate-900 text-rose-500 dark:text-rose-400 text-xs font-semibold rounded-xl border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30 shadow-xs disabled:opacity-50 transition-colors"
              >
                Anular Viaje
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para ingresar Odómetro de Tablero opcional al Conectarse o Desconectarse */}
      {modalConexion && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl p-5 shadow-2xl border border-transparent dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Gauge className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                  {modalConexion === 'INICIAR' ? 'Iniciar Turno' : 'Finalizar Turno'}
                </h3>
              </div>
              <button
                onClick={() => setModalConexion(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-slate-400">
              {modalConexion === 'INICIAR'
                ? '¿Deseas registrar el odómetro del tablero del auto para control exacto? (Opcional)'
                : '¿Deseas anotar el odómetro final del tablero antes de desconectarte? (Opcional)'}
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Kilometraje de tablero (km)
              </label>
              <input
                type="number"
                placeholder="Ej: 145200"
                value={odometroInput}
                onChange={(e) => setOdometroInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary-500 text-sm"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => confirmarToggleStatus(undefined)}
                disabled={actionLoading}
                className="flex-1 py-2.5 border border-gray-300 dark:border-slate-700 text-gray-600 dark:text-slate-300 text-xs font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                Omitir Odómetro
              </button>
              <button
                type="button"
                onClick={() =>
                  confirmarToggleStatus(
                    odometroInput ? parseFloat(odometroInput) : undefined
                  )
                }
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
              >
                {modalConexion === 'INICIAR' ? 'Conectarse' : 'Desconectarse'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
