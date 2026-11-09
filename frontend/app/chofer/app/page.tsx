'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  Banknote,
  CreditCard,
  Check,
  Coffee,
  Play,
  Pause,
  Utensils,
  MessageSquare,
  Send,
  Plus,
  Compass,
  Star,
  Sun,
  ShieldAlert,
  Wifi,
  WifiOff,
  FileText,
  RotateCcw,
  ListOrdered,
  Share2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { choferService, coordinadorDashboardService } from '@/lib/api';
import { io, Socket } from 'socket.io-client';

const ChoferRouteMap = dynamic(() => import('@/components/ChoferRouteMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-36 sm:h-48 bg-slate-100 rounded-xl border border-gray-200 flex flex-col items-center justify-center text-xs text-gray-500 animate-pulse">
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
  const [avisoLlegandoEnviado, setAvisoLlegandoEnviado] = useState(false);
  const [viajeExpandido, setViajeExpandido] = useState(false);
  const [navbarSlot, setNavbarSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      setNavbarSlot(document.getElementById('chofer-navbar-status'));
    }
  }, []);

  useEffect(() => {
    setAvisoLlegandoEnviado(false);
    setViajeExpandido(false);
  }, [viajeActual?.id]);

  useEffect(() => {
    setViajeExpandido(false);
    if (viajeActual?.estado === 'EN_CURSO') {
      setIsChatChoferOpen(false);
    }
  }, [viajeActual?.estado]);

  // Turno y Odometría
  const [turnoActivo, setTurnoActivo] = useState<any>(null);
  const [kmConPasajero, setKmConPasajero] = useState(0);
  const [kmSinPasajero, setKmSinPasajero] = useState(0);
  const [kmTotalConectado, setKmTotalConectado] = useState(0);

  // Pausa temporal de turno (Almuerzo / Baño / Combustible)
  const [enPausa, setEnPausa] = useState(false);
  const [motivoPausa, setMotivoPausa] = useState('Descanso');
  const [isPausaModalOpen, setIsPausaModalOpen] = useState(false);
  const [pausandoTurno, setPausandoTurno] = useState(false);

  // Modal para iniciar/finalizar turno con odómetro de tablero opcional
  const [modalConexion, setModalConexion] = useState<'INICIAR' | 'FINALIZAR' | null>(null);
  const [odometroInput, setOdometroInput] = useState('');

  // Modal y selección de método de pago al finalizar viaje
  const [modalFinalizarViaje, setModalFinalizarViaje] = useState(false);
  const [metodoPagoSeleccionado, setMetodoPagoSeleccionado] = useState<'EFECTIVO' | 'TRANSFERENCIA'>('EFECTIVO');
  const [montoFinalACobrar, setMontoFinalACobrar] = useState<number | null>(null);

  // Modal para agregar parada intermedia solicitada por el cliente
  const [isAddStopModalOpenChofer, setIsAddStopModalOpenChofer] = useState(false);
  const [nuevaParadaDireccionChofer, setNuevaParadaDireccionChofer] = useState('');
  const [isNuevaParadaSelectedChofer, setIsNuevaParadaSelectedChofer] = useState(false);
  const [nuevaParadaSuggestionsChofer, setNuevaParadaSuggestionsChofer] = useState<any[]>([]);
  const [nuevaParadaCoordsChofer, setNuevaParadaCoordsChofer] = useState<{ lat: number; lon: number } | null>(null);
  const [isSearchingParadaChofer, setIsSearchingParadaChofer] = useState(false);
  const [isAddingStopChofer, setIsAddingStopChofer] = useState(false);

  // Chat con el Pasajero
  const [isChatChoferOpen, setIsChatChoferOpen] = useState(false);
  const [chatChoferInput, setChatChoferInput] = useState('');
  const [chatMensajesChofer, setChatMensajesChofer] = useState<any[]>([]);
  const [isSendingChatChofer, setIsSendingChatChofer] = useState(false);

  // 1. Lanzador Directo a GPS Externo (Google Maps / Waze)
  const abrirNavegadorExterno = (app: 'google' | 'waze') => {
    if (!viajeActual) return;
    const esBuscarPasajero = viajeActual.estado === 'ACEPTADO' || viajeActual.estado === 'EN_CAMINO';
    const direccionObjetivo = esBuscarPasajero ? viajeActual.origen : viajeActual.destino;
    const detalleObjetivo = esBuscarPasajero ? viajeActual.origenDetallado : viajeActual.destinoDetallado;

    let destinoParam = direccionObjetivo;
    if (detalleObjetivo) {
      try {
        if (detalleObjetivo.startsWith('{')) {
          const parsed = JSON.parse(detalleObjetivo);
          if (parsed.lat && parsed.lng) {
            destinoParam = `${parsed.lat},${parsed.lng}`;
          }
        } else if (detalleObjetivo.includes(',')) {
          destinoParam = detalleObjetivo.trim();
        }
      } catch {}
    }

    if (app === 'google') {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinoParam)}&travelmode=driving`, '_blank');
    } else {
      window.open(`https://waze.com/ul?q=${encodeURIComponent(destinoParam)}&navigate=yes`, '_blank');
    }
  };

  // 2. Mantener Pantalla Encendida (Wake Lock API)
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const wakeLockSentinelRef = useRef<any>(null);

  const solicitarWakeLock = useCallback(async () => {
    if (typeof window === 'undefined' || !('wakeLock' in navigator)) return;
    try {
      if (!wakeLockSentinelRef.current) {
        const sentinel = await (navigator as any).wakeLock.request('screen');
        sentinel.addEventListener('release', () => {
          wakeLockSentinelRef.current = null;
          setWakeLockActive(false);
        });
        wakeLockSentinelRef.current = sentinel;
        setWakeLockActive(true);
      }
    } catch (err: any) {
      console.warn('Wake Lock no disponible o denegado:', err?.message);
      setWakeLockActive(false);
    }
  }, []);

  const liberarWakeLock = useCallback(() => {
    if (wakeLockSentinelRef.current) {
      try {
        wakeLockSentinelRef.current.release();
      } catch {}
      wakeLockSentinelRef.current = null;
      setWakeLockActive(false);
    }
  }, []);

  // Solicitar WakeLock automáticamente cuando esté activo
  useEffect(() => {
    if (isActive) {
      solicitarWakeLock();
    } else {
      liberarWakeLock();
    }
  }, [isActive, solicitarWakeLock, liberarWakeLock]);

  // Re-solicitar WakeLock si la pestaña vuelve a ser visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isActive) {
        solicitarWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isActive, solicitarWakeLock]);

  // 3. Resiliencia de GPS y Detección Offline
  const [isOffline, setIsOffline] = useState(false);
  const offlineKmBufferRef = useRef<{ con: number; sin: number }>({ con: 0, sin: 0 });

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Conexión a internet restablecida.');
      const bCon = offlineKmBufferRef.current.con;
      const bSin = offlineKmBufferRef.current.sin;
      if (bCon > 0 || bSin > 0) {
        choferService.actualizarKmTurno({
          kmConPasajeroDelta: bCon,
          kmSinPasajeroDelta: bSin,
          choferId: user?.chofer?.id,
        }).then(() => {
          offlineKmBufferRef.current = { con: 0, sin: 0 };
        }).catch(() => {});
      }
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.error('Sin conexión a internet. Guardando recorrido en búfer local...', { id: 'offline-toast' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user]);

  // 4. Arqueo y Cierre de Turno del Chofer
  const [modalArqueoCierreOpen, setModalArqueoCierreOpen] = useState(false);
  const [arqueoData, setArqueoData] = useState<any>(null);
  const [cargandoArqueo, setCargandoArqueo] = useState(false);

  // 5. Calificación del Pasajero por parte del Chofer
  const [modalCalificarPasajeroOpen, setModalCalificarPasajeroOpen] = useState(false);
  const [viajeParaCalificar, setViajeParaCalificar] = useState<any>(null);
  const [califEstrellas, setCalifEstrellas] = useState(5);
  const [califTags, setCalifTags] = useState<string[]>([]);
  const [califComentario, setCalifComentario] = useState('');
  const [califConflictivo, setCalifConflictivo] = useState(false);
  const [enviandoCalif, setEnviandoCalif] = useState(false);

  const TAGS_CALIFICACION_PASAJERO = [
    'Puntual',
    'Amable y respetuoso',
    'Esperó en la puerta',
    'Dejó propina',
    'Demoró en salir',
    'Pasajero conflictivo',
    'Vehículo sucio / Fumó',
  ];

  const handleToggleTagCalif = (tag: string) => {
    setCalifTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    if (tag === 'Pasajero conflictivo') {
      setCalifConflictivo(!califTags.includes(tag));
    }
  };

  const handleEnviarCalificacionPasajero = async () => {
    if (!viajeParaCalificar?.id) {
      setModalCalificarPasajeroOpen(false);
      return;
    }
    setEnviandoCalif(true);
    try {
      if (!String(viajeParaCalificar.id).startsWith('viaje-test')) {
        await choferService.calificarPasajero(viajeParaCalificar.id, {
          estrellas: califEstrellas,
          tags: califTags,
          comentario: califComentario.trim() || undefined,
          pasajeroConflictivo: califConflictivo,
        });
      }
      toast.success('¡Calificación del pasajero registrada!');
      setModalCalificarPasajeroOpen(false);
      setViajeParaCalificar(null);
      setCalifEstrellas(5);
      setCalifTags([]);
      setCalifComentario('');
      setCalifConflictivo(false);
    } catch {
      toast.error('Error al guardar la calificación');
      setModalCalificarPasajeroOpen(false);
    } finally {
      setEnviandoCalif(false);
    }
  };

  // 6. Turnero / Parada Virtual de Base
  const [paradaVirtualEstado, setParadaVirtualEstado] = useState<{
    enParadaVirtual: boolean;
    puesto: number | null;
    totalEnCola: number;
    cola: any[];
  }>({
    enParadaVirtual: false,
    puesto: null,
    totalEnCola: 0,
    cola: [],
  });
  const [viajeEnColaTabla, setViajeEnColaTabla] = useState<{
    viajeId: string;
    puestoOfertado: number;
    choferOfertadoNombre: string;
    segundosRestantes: number;
  } | null>(null);
  const [cargandoParadaVirtual, setCargandoParadaVirtual] = useState(false);

  const cargarEstadoParadaVirtual = useCallback(async () => {
    if (!user?.chofer?.id) return;
    try {
      const res = await choferService.getEstadoParadaVirtual(user.chofer.id);
      if (res.success && res.data) {
        setParadaVirtualEstado(res.data);
      }
    } catch (e) {
      // ignore
    }
  }, [user?.chofer?.id]);

  useEffect(() => {
    if (isActive) {
      cargarEstadoParadaVirtual();
    }
  }, [isActive, cargarEstadoParadaVirtual]);

  const handleAnotarseParadaVirtual = async () => {
    setCargandoParadaVirtual(true);
    try {
      const res = await choferService.anotarseParadaVirtual(user?.chofer?.id);
      if (res.success && res.data) {
        setParadaVirtualEstado(res.data);
        toast.success(res.message || '¡Te anotaste en la Parada Base!');
      } else {
        toast.error(res.message || 'No se pudo ingresar a la parada');
      }
    } catch {
      toast.error('Error al ingresar a la parada virtual');
    } finally {
      setCargandoParadaVirtual(false);
    }
  };

  const handleSalirParadaVirtual = async () => {
    setCargandoParadaVirtual(true);
    try {
      const res = await choferService.salirParadaVirtual(user?.chofer?.id);
      if (res.success) {
        setParadaVirtualEstado({
          enParadaVirtual: false,
          puesto: null,
          totalEnCola: 0,
          cola: [],
        });
        toast('Saliste de la parada virtual.');
      } else {
        toast.error(res.message || 'Error al salir de la parada');
      }
    } catch {
      toast.error('Error al salir de la parada virtual');
    } finally {
      setCargandoParadaVirtual(false);
    }
  };

  // Geofencing y Detección Automática de Parada Base (~100m a la redonda)
  const [distanciaBaseMetros, setDistanciaBaseMetros] = useState<number | null>(null);
  const remiseriaBaseCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const paradaVirtualRef = useRef<{ enParadaVirtual: boolean }>({ enParadaVirtual: false });
  const enPausaRef = useRef<boolean>(false);

  useEffect(() => {
    paradaVirtualRef.current.enParadaVirtual = paradaVirtualEstado.enParadaVirtual;
  }, [paradaVirtualEstado.enParadaVirtual]);

  useEffect(() => {
    enPausaRef.current = enPausa;
  }, [enPausa]);

  // 7. Viaje Espontáneo de Calle / Encadenado con Taxímetro Digital
  const [ultimoDestinoCompletado, setUltimoDestinoCompletado] = useState<string | null>(null);
  const [modalViajeCalleOpen, setModalViajeCalleOpen] = useState(false);
  const [viajeCalleOrigen, setViajeCalleOrigen] = useState('');
  const [viajeCalleDestino, setViajeCalleDestino] = useState('');
  const [viajeCalleClienteNombre, setViajeCalleClienteNombre] = useState('Pasajero de Calle');
  const [viajeCallePinPasajero, setViajeCallePinPasajero] = useState('');
  const [viajeCalleModoApp, setViajeCalleModoApp] = useState(false);
  const [creandoViajeCalle, setCreandoViajeCalle] = useState(false);

  const handleIniciarViajeCalle = async (origenPrefijado?: string) => {
    const origenFinal = origenPrefijado || viajeCalleOrigen.trim() || 'Tomado en la calle / Parada';
    setCreandoViajeCalle(true);
    try {
      const res = await choferService.crearViajeCalle({
        origen: origenFinal,
        destino: viajeCalleDestino.trim() || 'Destino a indicar (Taxímetro en vivo)',
        clienteNombre: viajeCalleClienteNombre.trim() || 'Pasajero de Calle',
        pinPasajero: viajeCalleModoApp ? viajeCallePinPasajero.trim() : undefined,
      });

      if (res.success && res.data) {
        previousViajeIdRef.current = res.data.id;
        tripDistanceRef.current = { con: 0, sin: 0 };
        setViajeActual(res.data);
        setModalViajeCalleOpen(false);
        setViajeCalleOrigen('');
        setViajeCalleDestino('');
        setViajeCalleClienteNombre('Pasajero de Calle');
        setViajeCallePinPasajero('');
        setViajeCalleModoApp(false);
        toast.success('¡Viaje de calle iniciado! Taxímetro digital activo.');
      } else {
        toast.error(res.message || 'Error al iniciar viaje de calle');
      }
    } catch {
      toast.error('Error al comunicarse con el servidor');
    } finally {
      setCreandoViajeCalle(false);
    }
  };

  const lastAlertedIdRef = useRef<string | null>(null);
  const previousViajeIdRef = useRef<string | null>(null);
  const choferIdRef = useRef<string | undefined>(user?.chofer?.id);
  const actionLoadingRef = useRef<boolean>(false);
  const acceptedAtRef = useRef<number>(0);

  // Referencias para tracking GPS
  const lastCoordsRef = useRef<[number, number] | null>(null);
  const pendingDeltaRef = useRef<{ con: number; sin: number }>({ con: 0, sin: 0 });
  const tripDistanceRef = useRef<{ con: number; sin: number }>({ con: 0, sin: 0 });
  const viajeActualRef = useRef<any>(null);
  const isActiveRef = useRef<boolean>(false);

  useEffect(() => {
    if (user?.chofer?.id) {
      choferIdRef.current = user.chofer.id;
    }
  }, [user?.chofer?.id]);

  useEffect(() => {
    actionLoadingRef.current = actionLoading;
  }, [actionLoading]);

  // Mantener refs sincronizadas para el watcher de GPS
  useEffect(() => {
    viajeActualRef.current = viajeActual;
    if (viajeActual?.mensajesChat) {
      try {
        const msgs = typeof viajeActual.mensajesChat === 'string'
          ? JSON.parse(viajeActual.mensajesChat)
          : viajeActual.mensajesChat;
        if (Array.isArray(msgs)) setChatMensajesChofer(msgs);
      } catch {}
    }
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

    // Alerta sonora y visual inmediata si el cliente cancela el viaje
    socket.on('viaje_cancelado', (data: any) => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.setValueAtTime(880, now + 0.15);
          osc.frequency.setValueAtTime(440, now + 0.3);
          gain.gain.setValueAtTime(0.5, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.5);
        }
      } catch {}

      toast(
        `🚨 ¡VIAJE CANCELADO POR EL CLIENTE!\nMotivo: ${data.motivo || 'No especificado'}.\n${
          data.debeAbonarMinimo
            ? `⚠️ Cliente a menos de 10 cuadras: Corresponde cobrar viaje mínimo de $${data.costoCancelacion}`
            : ''
        }`,
        {
          duration: 10000,
          style: { background: '#991b1b', color: '#fff', fontWeight: 'bold' },
        }
      );
      setViajeActual(null);
      tripDistanceRef.current = { con: 0, sin: 0 };
    });

    // Mensajes de chat en vivo con el pasajero
    socket.on('mensaje_chat_recibido', (data: any) => {
      if (viajeActualRef.current && data.viajeId === viajeActualRef.current.id) {
        setChatMensajesChofer((prev) => [...prev, data.mensaje]);
        if (data.mensaje.remitente === 'CLIENTE') {
          toast(`💬 Mensaje del Pasajero: "${data.mensaje.texto}"`, { duration: 6000 });
        }
      }
    });

    // Actualización de tiempo de espera y recálculo de precio
    socket.on('espera_actualizada', (data: any) => {
      if (viajeActualRef.current && data.viajeId === viajeActualRef.current.id) {
        setViajeActual((prev: any) => ({
          ...prev,
          enEspera: data.enEspera,
          inicioEsperaActual: data.inicioEsperaActual,
          tiempoEsperaSegundos: data.tiempoEsperaSegundos,
          costoEspera: data.costoEspera,
          precio: data.nuevoPrecio || prev?.precio,
        }));
      }
    });

    // Notificación de nueva parada agregada dinámicamente
    socket.on('parada_agregada', (data: any) => {
      if (viajeActualRef.current && data.viajeId === viajeActualRef.current.id) {
        setViajeActual((prev: any) => ({
          ...prev,
          paradas: data.paradas,
          precio: data.nuevoPrecio || prev?.precio,
        }));
        toast(`📍 Parada intermedia añadida: ${data.nuevaParada?.direccion || ''}`, {
          icon: '📍',
          duration: 5000,
        });
      }
    });

    // Notificación en vivo de parada virtual / turnero
    socket.on('parada_virtual_actualizada', () => {
      cargarEstadoParadaVirtual();
    });

    // Sincronización instantánea si se acepta o actualiza el estado del viaje
    socket.on('viaje_estado_actualizado', (data: any) => {
      const myChoferId = user?.chofer?.id || choferIdRef.current;
      if (data?.viaje && myChoferId && data.viaje.choferId === myChoferId) {
        if (['ACEPTADO', 'EN_CAMINO', 'EN_CURSO'].includes(data.estado)) {
          acceptedAtRef.current = Date.now();
          previousViajeIdRef.current = data.viaje.id;
          viajeActualRef.current = data.viaje;
          setViajeActual(data.viaje);
          setAlertaViaje(null);
        }
      }
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
      if (actionLoadingRef.current) return;
      const res = await choferService.getMiEstado(user?.chofer?.id || choferIdRef.current);
      if (!res.success || !res.data) return;
      if (actionLoadingRef.current) return;

      const { chofer, viajeActual: viajeEnCurso, viajesDisponibles, turnoActivo: turno } = res.data;
      if (chofer?.id) {
        choferIdRef.current = chofer.id;
      }

      const activoActual = forzarActivo !== undefined ? forzarActivo : Boolean(chofer?.isOnline);

      if (chofer?.remiseria?.latitud && chofer?.remiseria?.longitud) {
        remiseriaBaseCoordsRef.current = {
          lat: Number(chofer.remiseria.latitud),
          lng: Number(chofer.remiseria.longitud),
        };
      }

      const dataEstado = res.data;
      setViajeEnColaTabla(dataEstado?.viajeEnColaTabla || null);
      if (chofer?.enParadaVirtual !== undefined || dataEstado?.puestoEnTabla !== undefined) {
        setParadaVirtualEstado((prev) => ({
          ...prev,
          enParadaVirtual: Boolean(chofer?.enParadaVirtual ?? true),
          puesto: dataEstado?.puestoEnTabla ?? prev.puesto,
          totalEnCola: dataEstado?.totalEnTabla ?? prev.totalEnCola,
        }));
      }

      if (turno) {
        setTurnoActivo(turno);
        setKmConPasajero(Number((turno.kmConPasajero || 0).toFixed(1)));
        setKmSinPasajero(Number((turno.kmSinPasajero || 0).toFixed(1)));
        setKmTotalConectado(Number((turno.kmTotalConectado || 0).toFixed(1)));
      }

      if (res.data.enPausa !== undefined) {
        setEnPausa(Boolean(res.data.enPausa));
        if (res.data.motivoPausa) setMotivoPausa(res.data.motivoPausa);
      }

      // Evitar que una respuesta en vuelo anterior a aceptarViaje pise el viaje recién aceptado
      if (!viajeEnCurso && Date.now() - acceptedAtRef.current < 5000 && viajeActualRef.current) {
        return;
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
      viajeActualRef.current = viajeEnCurso || null;
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

        // Sistema de Tablas: asegurar que todo chofer libre esté anotado en la cola FIFO
        // (sin sacarlo si está circulando lejos de la base tras terminar un viaje)
        if (
          isActiveRef.current &&
          !viajeActualRef.current &&
          !enPausaRef.current &&
          !actionLoadingRef.current &&
          Date.now() - acceptedAtRef.current > 10000
        ) {
          const base = remiseriaBaseCoordsRef.current || { lat: -34.901138, lng: -60.013778 };
          const distBaseKm = calcularDistanciaKm(lat, lon, base.lat, base.lng);
          const distBaseMetros = Math.round(distBaseKm * 1000);
          setDistanciaBaseMetros(distBaseMetros);

          if (!paradaVirtualRef.current.enParadaVirtual) {
            paradaVirtualRef.current.enParadaVirtual = true;
            choferService.anotarseParadaVirtual(user?.chofer?.id || choferIdRef.current).catch(() => {});
          }
        }

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

  const handleTogglePausa = async (nuevoEstado: boolean, motivo?: string) => {
    if (viajeActual && nuevoEstado) {
      toast.error('No puedes pausar tu turno mientras tienes un viaje en curso.');
      return;
    }
    setPausandoTurno(true);
    try {
      const res = await choferService.togglePausa(nuevoEstado, motivo, user?.chofer?.id);
      if (res.success && res.data) {
        setEnPausa(Boolean(res.data.enPausa));
        if (res.data.motivoPausa) setMotivoPausa(res.data.motivoPausa);
        setIsPausaModalOpen(false);
        if (nuevoEstado) {
          setAlertaViaje(null);
          toast.success(`Turno en pausa (${motivo || 'Descanso'}). ¡Buen refrigerio!`);
          if (lastCoordsRef.current) {
            emitirUbicacionGps(lastCoordsRef.current[0], lastCoordsRef.current[1], 'en_pausa');
          }
        } else {
          toast.success('¡Turno reanudado! Ya estás disponible para recibir viajes.');
          if (lastCoordsRef.current) {
            emitirUbicacionGps(lastCoordsRef.current[0], lastCoordsRef.current[1], 'disponible');
          }
        }
      } else {
        toast.error(res.message || 'Error al cambiar estado de pausa');
      }
    } catch {
      toast.error('Error de red al cambiar pausa de turno');
    } finally {
      setPausandoTurno(false);
    }
  };

  const handleToggleClick = async () => {
    if (!isActive) {
      setModalConexion('INICIAR');
    } else {
      if (viajeActual) {
        toast.error('No puedes desconectarte mientras tienes un viaje en curso.');
        return;
      }
      setOdometroInput('');
      setModalArqueoCierreOpen(true);
      setCargandoArqueo(true);
      try {
        const res = await choferService.getResumenCierreTurno({ choferId: user?.chofer?.id });
        if (res.success && res.data) {
          setArqueoData(res.data);
        }
      } catch (e) {
        console.warn('Error cargando arqueo:', e);
      } finally {
        setCargandoArqueo(false);
      }
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
    actionLoadingRef.current = true;
    try {
      const res = await choferService.aceptarViaje(
        alertaViaje.id,
        user?.chofer?.id || choferIdRef.current
      );
      if (res.success && res.data) {
        acceptedAtRef.current = Date.now();
        previousViajeIdRef.current = res.data.id;
        viajeActualRef.current = res.data;
        tripDistanceRef.current = { con: 0, sin: 0 };
        setViajeActual(res.data);
        setAlertaViaje(null);
        setViajeEnColaTabla(null);
        setParadaVirtualEstado((prev) => ({
          ...prev,
          enParadaVirtual: false,
          puesto: null,
        }));
        if (lastCoordsRef.current) {
          emitirUbicacionGps(lastCoordsRef.current[0], lastCoordsRef.current[1], 'en_viaje');
        }
        toast.success('¡Viaje aceptado! Dirígete al punto de origen.');
      } else {
        toast.error(res.message || 'No se pudo aceptar el viaje');
        setAlertaViaje(null);
        actionLoadingRef.current = false;
        await sincronizarEstado(isActive);
      }
    } finally {
      actionLoadingRef.current = false;
      setActionLoading(false);
    }
  };

  const rechazarViaje = async () => {
    if (!alertaViaje) return;
    const viajeId = alertaViaje.id;
    const nuevosRechazados = [...viajesRechazados, viajeId];
    setViajesRechazados(nuevosRechazados);
    try {
      sessionStorage.setItem('chofer_viajes_rechazados', JSON.stringify(nuevosRechazados));
    } catch {
      // ignore
    }
    setAlertaViaje(null);
    try {
      await choferService.rechazarViaje(viajeId);
    } catch {
      // ignore
    }
    toast('Solicitud rechazada. Seguimos buscando viajes...');
  };

  const avisarEstoyLlegando = async () => {
    if (!viajeActual || actionLoading) return;
    if (String(viajeActual.id).startsWith('viaje-test')) {
      setAvisoLlegandoEnviado(true);
      toast.success('Avisamos al cliente que estás llegando a su domicilio');
      return;
    }

    setActionLoading(true);
    try {
      const res = await choferService.avisarLlegando(viajeActual.id);
      if (res.success) {
        setAvisoLlegandoEnviado(true);
        toast.success('Avisamos al cliente que estás llegando a su domicilio');
      } else {
        toast.error(res.message || 'Error al enviar aviso de llegada');
      }
    } catch {
      toast.error('Error al enviar aviso');
    } finally {
      setActionLoading(false);
    }
  };

  const avisarLlegadaEnPuerta = async () => {
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
        toast.success('Avisamos al cliente que estás esperando afuera en la puerta');
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

  const abrirModalFinalizar = () => {
    if (!viajeActual || actionLoading) return;
    setMetodoPagoSeleccionado('EFECTIVO');

    // Calcular si la distancia real por GPS supera la estimación original
    const distGps = tripDistanceRef.current.con;
    const distEstimada = Number(viajeActual.distanciaKm || viajeActual.distancia || 0);
    const valorKm = viajeActual?.remiseria?.valorKm || 1200;
    const bajadaBandera = viajeActual?.remiseria?.bajadaBandera || 3500;
    const precioBase = Number(viajeActual.precio || 0) - (Number(viajeActual.costoEspera) || 0);

    let precioSugerido = precioBase + costoEsperaChoferLive;
    if (distGps > 1 && distGps > distEstimada + 0.3) {
      const calculoGps = bajadaBandera + (distGps - 1) * valorKm;
      const calculoGpsRedondeado = Math.round(calculoGps / 100) * 100;
      if (calculoGpsRedondeado > precioBase) {
        precioSugerido = calculoGpsRedondeado + costoEsperaChoferLive;
      }
    }
    setMontoFinalACobrar(precioSugerido);
    setModalFinalizarViaje(true);
  };

  const confirmarFinalizarViaje = async () => {
    if (!viajeActual || actionLoading) return;

    if (String(viajeActual.id).startsWith('viaje-test')) {
      const vTest = viajeActual;
      setUltimoDestinoCompletado(vTest?.destino || null);
      setViajeActual(null);
      tripDistanceRef.current = { con: 0, sin: 0 };
      setModalFinalizarViaje(false);
      toast.success(`Viaje completado. Cobrado en ${metodoPagoSeleccionado === 'EFECTIVO' ? 'Efectivo 💵' : 'Transferencia 💳'}`);
      setViajeParaCalificar(vTest);
      setModalCalificarPasajeroOpen(true);
      return;
    }

    setActionLoading(true);
    try {
      const distCon = tripDistanceRef.current.con > 0 ? Number(tripDistanceRef.current.con.toFixed(2)) : undefined;
      const distSin = tripDistanceRef.current.sin > 0 ? Number(tripDistanceRef.current.sin.toFixed(2)) : undefined;

      const res = await choferService.actualizarEstadoViaje(viajeActual.id, 'COMPLETADO', {
        distanciaKmConPasajero: distCon,
        distanciaKmSinPasajero: distSin,
        metodoPago: metodoPagoSeleccionado,
        precioFinal: montoFinalACobrar !== null ? montoFinalACobrar : undefined,
      });

      if (res.success) {
        const viajeFin = viajeActual;
        previousViajeIdRef.current = null;
        tripDistanceRef.current = { con: 0, sin: 0 };
        setUltimoDestinoCompletado(viajeFin?.destino || null);
        setViajeActual(null);
        setModalFinalizarViaje(false);
        toast.success(`¡Viaje completado! Cobro en ${metodoPagoSeleccionado === 'EFECTIVO' ? 'Efectivo 💵' : 'Transferencia 💳'}`);
        // Abrir calificación del pasajero
        setViajeParaCalificar(viajeFin);
        setModalCalificarPasajeroOpen(true);
        await sincronizarEstado(isActive);
      } else {
        toast.error(res.message || 'Error al finalizar el viaje');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Autocompletado de dirección para parada intermedia agregada por el Chofer
  useEffect(() => {
    if (!isAddStopModalOpenChofer || isNuevaParadaSelectedChofer || !nuevaParadaDireccionChofer || nuevaParadaDireccionChofer.length < 3) {
      setNuevaParadaSuggestionsChofer([]);
      setIsSearchingParadaChofer(false);
      return;
    }

    setIsSearchingParadaChofer(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await coordinadorDashboardService.geocode(nuevaParadaDireccionChofer);
        if (res.success && Array.isArray(res.data)) {
          setNuevaParadaSuggestionsChofer(res.data);
        } else {
          setNuevaParadaSuggestionsChofer([]);
        }
      } catch (err) {
        setNuevaParadaSuggestionsChofer([]);
      } finally {
        setIsSearchingParadaChofer(false);
      }
    }, 350);

    return () => clearTimeout(delayDebounceFn);
  }, [nuevaParadaDireccionChofer, isNuevaParadaSelectedChofer, isAddStopModalOpenChofer]);

  const handleAgregarParadaChofer = async () => {
    if (!nuevaParadaDireccionChofer.trim() || !viajeActual) return;
    setIsAddingStopChofer(true);
    try {
      let coords = nuevaParadaCoordsChofer;
      if (!coords) {
        try {
          const geoRes = await coordinadorDashboardService.geocode(nuevaParadaDireccionChofer.trim());
          if (geoRes.success && Array.isArray(geoRes.data) && geoRes.data.length > 0) {
            coords = {
              lat: parseFloat(geoRes.data[0].lat),
              lon: parseFloat(geoRes.data[0].lon),
            };
          }
        } catch {}
      }

      const res = await choferService.agregarParada(viajeActual.id, {
        direccion: nuevaParadaDireccionChofer.trim(),
        lat: coords?.lat,
        lon: coords?.lon,
      });

      if (res.success && res.data) {
        setViajeActual(res.data);
        toast.success(`Parada agregada. Tarifa actualizada: $${Number(res.data.precio).toLocaleString('es-AR')}`);
        setIsAddStopModalOpenChofer(false);
        setNuevaParadaDireccionChofer('');
        setNuevaParadaCoordsChofer(null);
        setIsNuevaParadaSelectedChofer(false);
        setNuevaParadaSuggestionsChofer([]);
      } else {
        toast.error(res.message || 'Error al agregar parada');
      }
    } catch {
      toast.error('Error al agregar parada');
    } finally {
      setIsAddingStopChofer(false);
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

  const toggleEspera = async () => {
    if (!viajeActual || actionLoading) return;
    const accion = viajeActual.enEspera ? 'PAUSAR' : 'INICIAR';
    setActionLoading(true);
    try {
      const res = await choferService.controlarEspera(viajeActual.id, accion);
      if (res.success && res.data) {
        setViajeActual((prev: any) => ({
          ...prev,
          enEspera: res.data.enEspera,
          inicioEsperaActual: res.data.inicioEsperaActual,
          tiempoEsperaSegundos: res.data.tiempoEsperaSegundos,
          costoEspera: res.data.costoEspera,
          precio: res.data.precioTotal || prev?.precio,
        }));
        toast.success(res.message || 'Espera actualizada');
      } else {
        toast.error(res.message || 'Error al modificar espera');
      }
    } catch {
      toast.error('Error al controlar espera');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnviarChatChofer = async (textoAEnviar?: string) => {
    const texto = textoAEnviar || chatChoferInput;
    if (!texto.trim() || !viajeActual) return;
    setIsSendingChatChofer(true);
    try {
      const res = await choferService.enviarMensajeChat(viajeActual.id, texto.trim());
      if (res.success && res.data) {
        setChatMensajesChofer((prev) => [...prev, res.data]);
        setChatChoferInput('');
      } else {
        toast.error(res.message || 'Error al enviar mensaje');
      }
    } catch {
      toast.error('Error de red al enviar mensaje');
    } finally {
      setIsSendingChatChofer(false);
    }
  };

  if (!user) return null;

  const precioAlerta = alertaViaje?.precio ?? alertaViaje?.precioEstimado ?? 0;
  const clienteFotoAlerta = alertaViaje?.clienteFoto || alertaViaje?.cliente?.fotoUrl || null;
  const clienteNombreAlerta =
    alertaViaje?.clienteNombre ||
    (alertaViaje?.cliente
      ? `${alertaViaje.cliente.nombre} ${alertaViaje.cliente.apellido}`
      : 'Pasajero');

  // Cronómetro en vivo de espera del viaje actual (sumando segundo a segundo en tiempo real)
  const [segundosEsperaLive, setSegundosEsperaLive] = useState<number>(0);

  useEffect(() => {
    if (!viajeActual) {
      setSegundosEsperaLive(0);
      return;
    }
    const baseSegundos = Number(viajeActual.tiempoEsperaSegundos) || 0;
    if (!viajeActual.enEspera || !viajeActual.inicioEsperaActual) {
      setSegundosEsperaLive(baseSegundos);
      return;
    }
    const updateTicker = () => {
      const inicio = new Date(viajeActual.inicioEsperaActual).getTime();
      const deltaSec = Math.max(0, Math.floor((Date.now() - inicio) / 1000));
      setSegundosEsperaLive(baseSegundos + deltaSec);
    };
    updateTicker();
    const timer = setInterval(updateTicker, 1000);
    return () => clearInterval(timer);
  }, [viajeActual?.enEspera, viajeActual?.inicioEsperaActual, viajeActual?.tiempoEsperaSegundos]);

  const valorHoraEsperaChofer = viajeActual?.remiseria?.valorHoraEspera || 12000;
  const minutosEsperaChofer = Math.floor(segundosEsperaLive / 60);
  const segundosRestantesChofer = segundosEsperaLive % 60;
  const costoEsperaChoferLive = Math.round(((segundosEsperaLive / 3600) * valorHoraEsperaChofer) / 100) * 100;
  const precioBaseSinEspera = Number(viajeActual?.precio ?? viajeActual?.precioEstimado ?? 0) - (Number(viajeActual?.costoEspera) || 0);
  const precioActual = Math.max(0, precioBaseSinEspera + costoEsperaChoferLive);

  // Distancias y recálculo por GPS real (útil para desvíos no programados, calles cortadas, etc.)
  const distGpsRealChofer = tripDistanceRef.current.con;
  const distEstimadaChofer = Number(viajeActual?.distanciaKm || viajeActual?.distancia || 0);
  const valorKmChofer = viajeActual?.remiseria?.valorKm || 1200;
  const bajadaBanderaChofer = viajeActual?.remiseria?.bajadaBandera || 3500;
  const precioGpsPuro = distGpsRealChofer > 1
    ? bajadaBanderaChofer + (distGpsRealChofer - 1) * valorKmChofer
    : bajadaBanderaChofer;
  const precioRecalculadoGps = Math.round(precioGpsPuro / 100) * 100 + costoEsperaChoferLive;
  const clienteFotoActual = viajeActual?.clienteFoto || viajeActual?.cliente?.fotoUrl || null;
  const clienteNombreActual =
    viajeActual?.clienteNombre ||
    (viajeActual?.cliente
      ? `${viajeActual.cliente.nombre} ${viajeActual.cliente.apellido}`
      : 'Pasajero');
  const clienteTelefonoActual =
    viajeActual?.clienteTelefono || viajeActual?.cliente?.telefono || null;

  return (
    <div className="p-3 sm:p-4 space-y-3 max-w-lg mx-auto pb-16 overflow-x-hidden">
      {/* Estado EN LÍNEA / PAUSAR / DESCONECTARSE inyectado directamente en el Navbar superior */}
      {navbarSlot &&
        createPortal(
          !isActive ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-extrabold leading-tight truncate text-white">FUERA DE LÍNEA</p>
                  <p className="text-[10px] text-white/80 dark:text-slate-400 leading-tight truncate">
                    Sin turno iniciado
                  </p>
                </div>
              </div>
            </div>
          ) : enPausa ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <Coffee className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-extrabold text-amber-300 leading-tight truncate">EN PAUSA</p>
                    <span className="text-[9px] bg-amber-500/30 text-amber-200 px-1.5 py-0.5 rounded-full font-bold shrink-0">
                      {motivoPausa || 'Descanso'}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/80 dark:text-slate-400 leading-tight truncate">
                    Turno abierto en descanso
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleTogglePausa(false)}
                  disabled={pausandoTurno}
                  className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold rounded-lg shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Reanudar</span>
                </button>
                <button
                  type="button"
                  onClick={handleToggleClick}
                  disabled={Boolean(viajeActual) || actionLoading}
                  className="px-2.5 py-1.5 bg-white/15 hover:bg-white/25 text-white text-[11px] font-semibold rounded-lg border border-white/20 transition-colors cursor-pointer disabled:opacity-40"
                >
                  Desconectarse
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping absolute"></div>
                  <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full relative"></div>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-white leading-tight truncate">EN LÍNEA</p>
                  <p className="text-[10px] text-emerald-200 dark:text-emerald-400 leading-tight truncate">
                    {viajeActual
                      ? viajeActual.estado === 'EN_CURSO'
                        ? 'Con pasajero a bordo'
                        : 'Yendo a buscar al pasajero'
                      : 'Esperando solicitudes de viaje...'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {!viajeActual && (
                  <button
                    type="button"
                    onClick={() => setIsPausaModalOpen(true)}
                    className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-lg shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Coffee className="w-3 h-3" />
                    <span>Pausar</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleToggleClick}
                  disabled={Boolean(viajeActual) || actionLoading}
                  className="px-2.5 py-1.5 bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100 text-[11px] font-bold rounded-lg shadow-xs border border-white/20 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Desconectarse
                </button>
              </div>
            </div>
          ),
          navbarSlot
        )}

      {/* Indicador de Pérdida de Conexión / Modo Offline Resiliente */}
      {isOffline && (
        <div className="bg-rose-600 text-white px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-lg animate-pulse">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>Sin conexión a internet. Guardando odometría en búfer local...</span>
          </div>
          <span className="text-[10px] bg-black/25 px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">Offline</span>
        </div>
      )}

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
      ) : !viajeActual ? (
        <div className="space-y-3">
          {/* Widget de Odometría / Kilometraje del Turno en Tiempo Real */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold uppercase tracking-wider">
                <Gauge className="w-4 h-4 text-emerald-400" />
                <span>Odómetro de Jornada</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => (wakeLockActive ? liberarWakeLock() : solicitarWakeLock())}
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1 transition-all cursor-pointer ${
                    wakeLockActive
                      ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40'
                      : 'bg-white/10 text-slate-400 hover:text-white'
                  }`}
                  title="Evita que el celular bloquee la pantalla mientras conduces"
                >
                  <Sun className={`w-3.5 h-3.5 ${wakeLockActive ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span>{wakeLockActive ? 'Pantalla Activa' : 'Encender Pantalla'}</span>
                </button>
                <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                  GPS Activo
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              {/* Km con Pasajeros */}
              <div className="p-2 rounded-xl transition-all bg-white/5">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">C/ Pasajeros</p>
                <p className="text-lg font-black text-emerald-400">{kmConPasajero}</p>
                <span className="text-[10px] text-slate-400">km ocupado</span>
              </div>

              {/* Km sin Pasajeros */}
              <div className="p-2 rounded-xl transition-all bg-white/5">
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
      ) : null}

      {/* Estado de espera cuando está conectado y sin viaje ni alerta */}
      {isActive && !alertaViaje && !viajeActual && (
        <div className="space-y-3">
          {/* Botones de Acción Rápida: Viaje de Calle y Rotación de Pasajero */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setViajeCalleOrigen('');
                setViajeCalleDestino('');
                setModalViajeCalleOpen(true);
              }}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-2xl shadow-md flex items-center justify-center gap-2 text-xs transition-all active:scale-98 cursor-pointer"
            >
              <Car className="w-4 h-4" />
              <span>🚖 Iniciar Viaje de Calle (Taxímetro)</span>
            </button>

            {ultimoDestinoCompletado && (
              <button
                type="button"
                onClick={() => handleIniciarViajeCalle(ultimoDestinoCompletado)}
                disabled={creandoViajeCalle}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold rounded-2xl shadow-md flex items-center justify-center gap-2 text-xs transition-all active:scale-98 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="truncate">🔄 Pasajero Aquí ({ultimoDestinoCompletado.split(',')[0]})</span>
              </button>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-800 text-center space-y-3 transition-colors">
            <div className="w-12 h-12 bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 rounded-full flex items-center justify-center mx-auto">
              <Car className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="font-bold text-gray-800 dark:text-white text-sm">Esperando solicitudes</h3>
            {paradaVirtualEstado.puesto && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-extrabold">
                <ListOrdered className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>
                  Puesto #{paradaVirtualEstado.puesto} en la Tabla
                  {paradaVirtualEstado.totalEnCola > 0 ? ` (de ${paradaVirtualEstado.totalEnCola} libres)` : ''}
                </span>
                {paradaVirtualEstado.puesto === 1 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-500 text-white text-[10px] uppercase">
                    Próximo en salir
                  </span>
                )}
              </div>
            )}
            {viajeEnColaTabla && (
              <div className="mt-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/70 text-amber-800 dark:text-amber-200 text-xs font-semibold flex items-center justify-center gap-2 animate-pulse">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Viaje en rotación: ofreciéndose al <strong>Puesto #{viajeEnColaTabla.puestoOfertado}</strong> ({viajeEnColaTabla.choferOfertadoNombre}) • pasa al siguiente en <strong>{viajeEnColaTabla.segundosRestantes}s</strong>
                </span>
              </div>
            )}
            <p className="text-xs text-gray-400 dark:text-slate-400 max-w-xs mx-auto">
              Se respeta el orden de la Tabla en base, o prioridad automática si estás a pocas cuadras de un pedido.
            </p>
          </div>
        </div>
      )}

      {/* Alerta de Nuevo Viaje */}
      {alertaViaje && (
        <div className="fixed inset-x-0 bottom-16 p-4 z-50 animate-slide-up">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-primary-100 dark:border-slate-800 overflow-hidden max-w-md mx-auto transition-colors">
            <div className="bg-primary-600 dark:bg-slate-800 text-white p-3.5 flex items-center justify-between">
              <div className="min-w-0">
                <span className="font-bold flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 animate-pulse text-amber-300 shrink-0" />
                  <span className="truncate">¡NUEVO VIAJE DISPONIBLE!</span>
                </span>
                <span className="text-[11px] text-amber-200 font-semibold block mt-0.5">
                  {alertaViaje.motivoOferta === 'CERCANIA'
                    ? `⚡ Prioridad por Cercanía (a ~${alertaViaje.distanciaOfertaMetros || 300}m del pedido)`
                    : alertaViaje.motivoOferta === 'ASIGNADO_DIRECTO'
                    ? '🎯 Asignado por Coordinación'
                    : `📋 Turno #${alertaViaje.puestoTabla || 1} en la Tabla`}
                </span>
              </div>
              <span className="font-extrabold text-lg shrink-0">
                ${Number(precioAlerta).toLocaleString('es-AR')}
              </span>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-gray-100 dark:border-slate-700/60">
                {clienteFotoAlerta ? (
                  <img
                    src={clienteFotoAlerta}
                    alt="Foto Pasajero"
                    className="w-10 h-10 rounded-full object-cover border-2 border-primary-500 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-slate-700 text-primary-700 dark:text-primary-300 flex items-center justify-center shrink-0 font-bold">
                    <User className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-gray-400 dark:text-slate-400 font-bold uppercase tracking-wider">
                    Pasajero a buscar
                  </p>
                  <p className="font-bold text-sm text-gray-900 dark:text-white truncate">
                    {clienteNombreAlerta}
                  </p>
                </div>
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

      {/* Viaje Actual (Reducido automáticamente con flecha desplegable para evitar scroll en celular) */}
      {viajeActual && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden transition-colors">
          {/* Header compacto con botón de flecha para desplegar/reducir */}
          <div className="bg-slate-900 text-white px-3.5 py-2.5 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-2 min-w-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm leading-tight">Viaje en curso</h3>
                  <span className="inline-flex px-2 py-0.5 bg-white/20 text-[10px] font-bold rounded-md">
                    {viajeActual.estado === 'ACEPTADO' && 'YENDO AL ORIGEN'}
                    {viajeActual.estado === 'EN_CAMINO' && 'ESPERANDO CLIENTE'}
                    {viajeActual.estado === 'EN_CURSO' && 'AL DESTINO'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <div className="text-right">
                <p className="text-[10px] text-slate-400 leading-none">Tarifa</p>
                <p className="text-base font-extrabold text-emerald-400 leading-tight">
                  ${Number(precioActual).toLocaleString('es-AR')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViajeExpandido((prev) => !prev)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-all cursor-pointer border border-white/15"
                title={viajeExpandido ? 'Reducir detalles del viaje' : 'Desplegar todos los detalles del viaje'}
              >
                <span>{viajeExpandido ? 'Reducir' : 'Detalles'}</span>
                {viajeExpandido ? (
                  <ChevronUp className="w-4 h-4 text-emerald-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-emerald-400" />
                )}
              </button>
            </div>
          </div>

          <div className="p-3 space-y-2.5">
            {/* Resumen ultra-compacto siempre visible: Pasajero + Llamar + Chat + Origen/Destino en 1 vistazo */}
            <div className="bg-slate-50 dark:bg-slate-800/70 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {clienteFotoActual ? (
                    <img
                      src={clienteFotoActual}
                      alt="Foto Pasajero"
                      className="w-8 h-8 rounded-full object-cover border border-primary-500 shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-slate-700 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{clienteNombreActual}</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                      {viajeActual.metodoPago === 'TRANSFERENCIA' ? '💳 Transferencia' : '💵 Efectivo'}
                      {viajeActual.pagaCon ? ` (Paga c/ $${Number(viajeActual.pagaCon).toLocaleString('es-AR')})` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {viajeActual.estado !== 'EN_CURSO' && (
                    <button
                      type="button"
                      onClick={() => setIsChatChoferOpen(true)}
                      className="px-2.5 py-1.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-blue-200 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Chat{chatMensajesChofer.length > 0 ? ` (${chatMensajesChofer.length})` : ''}</span>
                    </button>
                  )}
                  {clienteTelefonoActual && (
                    <a
                      href={`tel:${clienteTelefonoActual}`}
                      className="px-2.5 py-1.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-emerald-200 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Llamar</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Direcciones compactas en 1 línea cada una (cuando está reducido) */}
              {!viajeExpandido && (
                <div className="grid grid-cols-1 gap-1 pt-1.5 border-t border-slate-200/70 dark:border-slate-700/70 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Orig:</span>
                    <span className="font-semibold text-gray-900 dark:text-white truncate">{viajeActual.origen}</span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Dest:</span>
                    <span className="font-semibold text-gray-900 dark:text-white truncate">{viajeActual.destino}</span>
                  </div>
                </div>
              )}
            </div>

            {/* MODO TAXÍMETRO DIGITAL EN VIVO (Compacto si está reducido) */}
            {viajeActual.esViajeCalle && (
              <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-black rounded-xl px-3.5 py-2 text-white border border-emerald-500/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></span>
                  <div>
                    <span className="text-[10px] font-black tracking-wider text-emerald-400 uppercase block">
                      Taxímetro en Vivo
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {distGpsRealChofer.toFixed(2)} km {costoEsperaChoferLive > 0 ? `+ espera` : ''}
                    </span>
                  </div>
                </div>
                <div className="text-xl font-black text-emerald-400 font-mono">
                  ${Math.max(bajadaBanderaChofer, precioRecalculadoGps).toLocaleString('es-AR')}
                </div>
              </div>
            )}

            {/* Barra de Accesos Rápidos en 1 sola fila: Google Maps, Waze y Espera */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => abrirNavegadorExterno('google')}
                className="flex-1 py-2 px-2.5 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 rounded-xl text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="truncate">Maps</span>
              </button>
              <button
                type="button"
                onClick={() => abrirNavegadorExterno('waze')}
                className="flex-1 py-2 px-2.5 bg-white dark:bg-slate-900 border border-cyan-300 dark:border-cyan-800 rounded-xl text-cyan-700 dark:text-cyan-300 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <span className="truncate">Waze</span>
              </button>

              {['EN_CAMINO', 'EN_CURSO'].includes(viajeActual.estado) && (
                <button
                  type="button"
                  onClick={toggleEspera}
                  disabled={actionLoading}
                  className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all shadow-xs cursor-pointer ${
                    viajeActual.enEspera
                      ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                      : 'bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                  }`}
                >
                  <Clock className={`w-3.5 h-3.5 shrink-0 ${viajeActual.enEspera ? 'animate-spin' : ''}`} />
                  <span className="truncate">
                    {viajeActual.enEspera
                      ? `${minutosEsperaChofer}:${segundosRestantesChofer < 10 ? '0' : ''}${segundosRestantesChofer}`
                      : 'Espera'}
                  </span>
                </button>
              )}
            </div>

            {/* SECCIÓN DESPLEGABLE (Solo se muestra al tocar la flechita "Detalles") */}
            {viajeExpandido && (
              <div className="space-y-2.5 pt-2 border-t border-gray-100 dark:border-slate-800 animate-in fade-in">
                <div className="flex gap-3 items-start bg-slate-50/60 dark:bg-slate-800/40 p-2.5 rounded-xl">
                  <div className="mt-1 w-5 flex flex-col items-center">
                    <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
                    <div className="w-0.5 h-8 bg-gray-200 dark:bg-slate-700"></div>
                    <div className="w-2.5 h-2.5 bg-rose-500 rounded-full"></div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-slate-400 font-bold">ORIGEN COMPLETO</p>
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">{viajeActual.origen}</p>
                    </div>

                    {/* Paradas intermedias */}
                    {viajeActual.paradas && (() => {
                      let paradasList = [];
                      try {
                        paradasList = typeof viajeActual.paradas === 'string' ? JSON.parse(viajeActual.paradas) : viajeActual.paradas;
                      } catch {}
                      if (!Array.isArray(paradasList) || paradasList.length === 0) return null;
                      return (
                        <div className="space-y-1 py-0.5">
                          {paradasList.map((p: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-xs bg-amber-50 dark:bg-amber-950/40 p-1.5 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase">
                                Parada #{idx + 1}:
                              </span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{p.direccion}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-slate-400 font-bold">DESTINO COMPLETO</p>
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">{viajeActual.destino}</p>
                    </div>
                  </div>
                </div>

                {/* DETALLES DE PAGO Y CAMBIO */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-gray-200 dark:border-slate-700 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <Banknote className="w-4 h-4 text-emerald-500" />
                      Método de pago:
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-300">
                      {viajeActual.metodoPago === 'TRANSFERENCIA' ? 'Transferencia Bancaria 💳' : 'Efectivo 💵'}
                    </span>
                  </div>
                  {viajeActual.metodoPago !== 'TRANSFERENCIA' && (
                    <div className="text-xs text-slate-600 dark:text-slate-300 pt-0.5">
                      {viajeActual.pagaCon ? (
                        <div className="flex items-center justify-between">
                          <span>Abona con: <strong>${Number(viajeActual.pagaCon).toLocaleString('es-AR')}</strong></span>
                          {Number(viajeActual.pagaCon) > Number(precioActual) && (
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                              Vuelto: ${Number(viajeActual.pagaCon - precioActual).toLocaleString('es-AR')}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500">Abona con importe exacto / en mano</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {/* Botón para agregar parada intermedia */}
                  {['EN_CAMINO', 'EN_CURSO'].includes(viajeActual.estado) && (
                    <button
                      type="button"
                      onClick={() => setIsAddStopModalOpenChofer(true)}
                      className="flex-1 py-2 px-3 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 border border-amber-300 dark:border-amber-800/60 rounded-xl text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-600" />
                      <span>Agregar Parada</span>
                    </button>
                  )}

                  {/* Botón para anular el viaje */}
                  <button
                    onClick={anularViaje}
                    disabled={actionLoading}
                    className="flex-1 py-2 px-3 bg-white dark:bg-slate-900 text-rose-500 dark:text-rose-400 text-xs font-semibold rounded-xl border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 transition-colors"
                  >
                    Anular Viaje
                  </button>
                </div>
              </div>
            )}

            {/* Mapa interactivo en tiempo real con el camino trazado */}
            <ChoferRouteMap
              origen={viajeActual.origen}
              destino={viajeActual.destino}
              estado={viajeActual.estado}
            />

            {/* Botón de Acción Principal siempre visible al pie */}
            <div className="pt-1 flex flex-col gap-2">
              {viajeActual.estado === 'ACEPTADO' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Botón secundario: Avisar que está a pocas cuadras */}
                  <button
                    onClick={avisarEstoyLlegando}
                    disabled={actionLoading || avisoLlegandoEnviado}
                    className={`w-full py-2.5 px-3 rounded-xl border flex items-center justify-center gap-1.5 font-bold text-xs transition-all shadow-xs ${
                      avisoLlegandoEnviado
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 cursor-default'
                        : 'bg-white dark:bg-slate-900 border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                    }`}
                  >
                    <Navigation className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {avisoLlegandoEnviado ? '✓ Aviso "Llegando" enviado' : 'Avisar "Estoy Llegando"'}
                    </span>
                  </button>

                  {/* Botón principal: Ya llegó a la puerta / esperando afuera */}
                  <button
                    onClick={avisarLlegadaEnPuerta}
                    disabled={actionLoading}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50 text-sm transition-colors"
                  >
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>¡YA LLEGUÉ A LA PUERTA!</span>
                  </button>
                </div>
              )}

              {viajeActual.estado === 'EN_CAMINO' && (
                <button
                  onClick={iniciarViaje}
                  disabled={actionLoading}
                  className="w-full py-3 bg-primary-600 text-white font-bold rounded-xl shadow-md shadow-primary-500/20 disabled:opacity-50 text-sm"
                >
                  INICIAR VIAJE (PASAJERO A BORDO)
                </button>
              )}

              {viajeActual.estado === 'EN_CURSO' && (
                <button
                  onClick={abrirModalFinalizar}
                  disabled={actionLoading}
                  className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-md shadow-emerald-500/20 disabled:opacity-50 text-sm"
                >
                  FINALIZAR VIAJE (${Number(precioActual).toLocaleString('es-AR')})
                </button>
              )}
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
      {/* Modal para Pausar Turno (Almuerzo / Baño / Combustible) */}
      {isPausaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl p-5 shadow-2xl border border-transparent dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Coffee className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-gray-800 dark:text-white text-sm">Pausar Turno Temporalmente</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPausaModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-600 dark:text-slate-300">
              Seleccioná el motivo de tu descanso. Tu turno y odómetro seguirán activos, pero no te asignaremos viajes hasta que reanudes:
            </p>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Almorzar / Comer', icon: '🍔', motivo: 'Almuerzo' },
                { label: 'Baño / Refrigerio', icon: '🚻', motivo: 'Baño' },
                { label: 'Cargar GNC / Nafta', icon: '⛽', motivo: 'Combustible' },
                { label: 'Pausa Personal', icon: '☕', motivo: 'Descanso' },
              ].map((item) => (
                <button
                  key={item.motivo}
                  type="button"
                  disabled={pausandoTurno}
                  onClick={() => handleTogglePausa(true, item.motivo)}
                  className="p-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/60 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-left transition-all flex flex-col gap-1 cursor-pointer"
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-xs font-bold text-gray-800 dark:text-slate-200 leading-tight">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsPausaModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Finalizar Viaje y Elegir Método de Pago */}
      {modalFinalizarViaje && viajeActual && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900 dark:text-white">Finalizar Viaje</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Seleccioná cómo abonó el pasajero</p>
                </div>
              </div>
              <button
                onClick={() => setModalFinalizarViaje(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumen del viaje con Comparativa de Kilómetros y Recálculo por GPS */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 space-y-3">
              {/* Kilómetros: Estimados vs GPS Real */}
              <div className="grid grid-cols-2 gap-2 pb-2.5 border-b border-slate-200/60 dark:border-slate-700/60 text-xs">
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-gray-150 dark:border-slate-800">
                  <span className="text-gray-400 dark:text-slate-500 block text-[10px] uppercase font-bold">Km Estimados</span>
                  <p className="font-extrabold text-sm text-slate-800 dark:text-slate-200 mt-0.5">
                    {distEstimadaChofer > 0 ? `${distEstimadaChofer.toFixed(1)} km` : '—'}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-gray-150 dark:border-slate-800">
                  <span className="text-gray-400 dark:text-slate-500 block text-[10px] uppercase font-bold">Km Reales (GPS)</span>
                  <p className={`font-extrabold text-sm mt-0.5 ${
                    distGpsRealChofer > (distEstimadaChofer + 0.3)
                      ? 'text-amber-600 dark:text-amber-400 font-black'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {distGpsRealChofer.toFixed(1)} km
                  </p>
                </div>
              </div>

              {/* Aviso si se detectó desvío o mayor recorrido */}
              {distGpsRealChofer > (distEstimadaChofer + 0.3) && (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    <span>Mayor recorrido detectado (+{(distGpsRealChofer - distEstimadaChofer).toFixed(1)} km)</span>
                  </p>
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-tight">
                    Por desvío, calles cortadas o paradas no programadas, podés optar por cobrar la tarifa calculada con el GPS real.
                  </p>
                </div>
              )}

              {/* Selector de tarifa final a cobrar */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-gray-700 dark:text-slate-300 block">
                  Tarifa a cobrar al pasajero:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMontoFinalACobrar(Number(viajeActual.precio || 0))}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      (montoFinalACobrar === Number(viajeActual.precio || 0) || montoFinalACobrar === null)
                        ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                        : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="block text-[10px] text-gray-500 dark:text-slate-400 font-medium">Pactada inicial</span>
                    <span className="text-sm font-black">${Number(viajeActual.precio || 0).toLocaleString('es-AR')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMontoFinalACobrar(precioRecalculadoGps)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      montoFinalACobrar === precioRecalculadoGps
                        ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/20'
                        : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-bold">Por GPS real</span>
                    <span className="text-sm font-black">${precioRecalculadoGps.toLocaleString('es-AR')}</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                <span className="text-xs font-bold text-gray-700 dark:text-slate-300">Total a cobrar:</span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  ${(montoFinalACobrar ?? Number(viajeActual.precio || 0)).toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            {/* Opciones de Método de Pago */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700 dark:text-slate-300 block">
                Método de Pago:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMetodoPagoSeleccionado('EFECTIVO')}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                    metodoPagoSeleccionado === 'EFECTIVO'
                      ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                      : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className="p-2 rounded-xl bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                      <Banknote className="w-5 h-5" />
                    </div>
                    {metodoPagoSeleccionado === 'EFECTIVO' && (
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-sm">Efectivo</p>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400">Dinero en mano</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMetodoPagoSeleccionado('TRANSFERENCIA')}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                    metodoPagoSeleccionado === 'TRANSFERENCIA'
                      ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20'
                      : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className="p-2 rounded-xl bg-blue-100/80 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    {metodoPagoSeleccionado === 'TRANSFERENCIA' && (
                      <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-sm">Transferencia</p>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400">MP / Banco</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalFinalizarViaje(false)}
                className="flex-1 py-3 text-xs font-semibold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={confirmarFinalizarViaje}
                disabled={actionLoading}
                className="flex-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
              >
                {actionLoading ? 'Finalizando...' : 'Confirmar y Finalizar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Chat Rápido con el Pasajero (solo disponible antes de iniciar el viaje) */}
      {isChatChoferOpen && viajeActual && viajeActual.estado !== 'EN_CURSO' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full h-[32rem] flex flex-col border border-gray-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scale-up">
            
            {/* Header del Chat */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                    {viajeActual.clienteNombre || (viajeActual.cliente ? `${viajeActual.cliente.nombre} ${viajeActual.cliente.apellido || ''}` : 'Pasajero')}
                  </h4>
                  <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Chat directo del viaje
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsChatChoferOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mensajes rápidos de 1 toque para el chofer */}
            <div className="p-2 bg-gray-50 dark:bg-slate-800/40 border-b border-gray-100 dark:border-slate-800 flex gap-1.5 overflow-x-auto no-scrollbar">
              {[
                'Estoy en la puerta',
                'Llegando en 2 minutos',
                'Hay mucho tráfico, voy en camino',
                'Estoy con balizas afuera'
              ].map((msg) => (
                <button
                  key={msg}
                  type="button"
                  onClick={() => handleEnviarChatChofer(msg)}
                  disabled={isSendingChatChofer}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-200 shrink-0 hover:bg-gray-100 active:scale-95 transition-transform"
                >
                  {msg}
                </button>
              ))}
            </div>

            {/* Feed de Mensajes */}
            <div className="flex-1 p-3 overflow-y-auto space-y-2">
              {chatMensajesChofer.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-4">
                  <MessageSquare className="w-8 h-8 opacity-40 mb-1" />
                  <p className="text-xs">No hay mensajes previos</p>
                  <p className="text-[10px] mt-0.5">Usa las respuestas rápidas o escribe al pasajero</p>
                </div>
              ) : (
                chatMensajesChofer.map((m, idx) => {
                  const isMe = m.remitente === 'CHOFER';
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <span className="text-[9px] text-slate-400 mb-0.5 px-1">{m.remitenteNombre}</span>
                      <div
                        className={`max-w-[75%] px-3 py-2 rounded-2xl text-xs font-medium ${
                          isMe
                            ? 'bg-blue-600 text-white rounded-br-xs shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-xs'
                        }`}
                      >
                        {m.texto}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input para mensaje personalizado */}
            <div className="p-2.5 border-t border-gray-200 dark:border-slate-800 flex gap-1.5">
              <input
                type="text"
                value={chatChoferInput}
                onChange={(e) => setChatChoferInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleEnviarChatChofer();
                }}
                placeholder="Escribir al pasajero..."
                className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => handleEnviarChatChofer()}
                disabled={isSendingChatChofer || !chatChoferInput.trim()}
                className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl shadow-xs"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal para Agregar Parada Intermedia desde App del Chofer */}
      {isAddStopModalOpenChofer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border border-gray-200 dark:border-slate-800 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-amber-600">
                <Plus className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Agregar Parada Intermedia</h3>
              </div>
              <button
                onClick={() => setIsAddStopModalOpenChofer(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Ingresá la dirección de la parada solicitada por el pasajero o desvío. La tarifa del viaje se recalculará automáticamente y se sincronizará con la app del cliente.
            </p>

            <div className="relative">
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500">
                  <MapPin className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={nuevaParadaDireccionChofer}
                  onChange={(e) => {
                    setNuevaParadaDireccionChofer(e.target.value);
                    setIsNuevaParadaSelectedChofer(false);
                    setNuevaParadaCoordsChofer(null);
                  }}
                  placeholder="Dirección de la parada (Ej: Av. Mitre 250)"
                  className="w-full pl-10 pr-9 p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 font-medium placeholder-gray-400"
                  autoFocus
                />
                {isSearchingParadaChofer && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-amber-600"></div>
                  </div>
                )}
              </div>

              {/* Lista flotante de sugerencias encontradas desde Maps */}
              {nuevaParadaSuggestionsChofer.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800">
                  {nuevaParadaSuggestionsChofer.map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setNuevaParadaDireccionChofer(sug.display_name);
                        setNuevaParadaCoordsChofer({ lat: parseFloat(sug.lat), lon: parseFloat(sug.lon) });
                        setIsNuevaParadaSelectedChofer(true);
                        setNuevaParadaSuggestionsChofer([]);
                      }}
                      className="w-full text-left p-3 text-xs hover:bg-amber-50/50 dark:hover:bg-slate-800 flex items-start gap-2.5 transition-colors group"
                    >
                      <MapPin className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-slate-800 dark:text-slate-100 block truncate">
                          {sug.display_name.split(',')[0]}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-400 block truncate">
                          {sug.display_name.split(',').slice(1).join(',').trim()}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {nuevaParadaCoordsChofer && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                  <Check className="w-3.5 h-3.5" />
                  <span>Dirección validada en Maps</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddStopModalOpenChofer(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAgregarParadaChofer}
                disabled={isAddingStopChofer || !nuevaParadaDireccionChofer.trim()}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md"
              >
                {isAddingStopChofer ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <span>Confirmar Parada</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Calificación del Pasajero por parte del Chofer */}
      {modalCalificarPasajeroOpen && viajeParaCalificar && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 border border-gray-100 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-500 flex items-center justify-center">
                <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
              </div>
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                ¿Cómo fue el viaje con {viajeParaCalificar.clienteNombre || 'el pasajero'}?
              </h3>
              <p className="text-xs text-gray-400 dark:text-slate-400">
                Tu calificación ayuda a mantener la seguridad de toda la flota.
              </p>
            </div>

            {/* Selector de Estrellas 1 a 5 */}
            <div className="flex items-center justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCalifEstrellas(num)}
                  className="p-1 hover:scale-110 active:scale-95 transition-transform"
                >
                  <Star
                    className={`w-7 h-7 ${
                      num <= califEstrellas
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-gray-300 dark:text-slate-700'
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Tags de calificación rápida */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                Aspectos destacados:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {TAGS_CALIFICACION_PASAJERO.map((tag) => {
                  const isSelected = califTags.includes(tag);
                  const isConflict = tag === 'Pasajero conflictivo';
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleToggleTagCalif(tag)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all ${
                        isSelected
                          ? isConflict
                            ? 'bg-rose-500 text-white'
                            : 'bg-primary-600 text-white'
                          : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comentario opcional */}
            <div>
              <textarea
                value={califComentario}
                onChange={(e) => setCalifComentario(e.target.value)}
                placeholder="Comentario sobre el pasajero (opcional)..."
                rows={2}
                className="w-full p-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white resize-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModalCalificarPasajeroOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Omitir
              </button>
              <button
                type="button"
                onClick={handleEnviarCalificacionPasajero}
                disabled={enviandoCalif}
                className="flex-2 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer"
              >
                {enviandoCalif ? 'Guardando...' : 'Guardar Calificación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Arqueo y Cierre de Turno del Chofer */}
      {modalArqueoCierreOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-gray-100 dark:border-slate-800 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Arqueo y Cierre de Turno</h3>
                  <p className="text-xs text-gray-400 dark:text-slate-400">Balance general de tu jornada</p>
                </div>
              </div>
              <button
                onClick={() => setModalArqueoCierreOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {cargandoArqueo ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-2 text-xs text-gray-500">
                <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                <span>Calculando balance financiero del turno...</span>
              </div>
            ) : arqueoData ? (
              <div className="space-y-4">
                {/* Tarjeta de Ganancia Neta de Bolsillo */}
                <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-4 text-white text-center shadow-lg">
                  <span className="text-[10px] text-emerald-100 uppercase tracking-wider block font-bold">
                    Ganancia Neta de Bolsillo
                  </span>
                  <div className="text-3xl font-black font-mono my-1">
                    ${Number(arqueoData.liquidacion?.gananciaNetaChofer || 0).toLocaleString('es-AR')}
                  </div>
                  <span className="text-[11px] text-emerald-100/90 font-medium">
                    (Total Bruto - Comisión {arqueoData.liquidacion?.comisionPorcentaje}% - Gastos deducidos)
                  </span>
                </div>

                {/* Desglose de Recaudación */}
                <div className="bg-gray-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-gray-100 dark:border-slate-800 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-slate-300 flex items-center gap-1.5 font-medium">
                      <Banknote className="w-4 h-4 text-emerald-600" />
                      Total Cobrado en Efectivo ({arqueoData.viajes?.lista?.filter((v: any) => v.metodoPago === 'EFECTIVO').length || 0} viajes)
                    </span>
                    <span className="font-extrabold text-gray-900 dark:text-white">
                      ${Number(arqueoData.viajes?.totalEfectivo || 0).toLocaleString('es-AR')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-slate-300 flex items-center gap-1.5 font-medium">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      Total por Transferencia ({arqueoData.viajes?.lista?.filter((v: any) => v.metodoPago === 'TRANSFERENCIA').length || 0} viajes)
                    </span>
                    <span className="font-extrabold text-gray-900 dark:text-white">
                      ${Number(arqueoData.viajes?.totalTransferencia || 0).toLocaleString('es-AR')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-slate-700">
                    <span className="font-bold text-gray-800 dark:text-slate-200">
                      Total Bruto Recaudado ({arqueoData.viajes?.total || 0} viajes)
                    </span>
                    <span className="font-black text-gray-900 dark:text-white">
                      ${Number(arqueoData.viajes?.totalBruto || 0).toLocaleString('es-AR')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                    <span className="font-medium">Gastos operativos turno (Nafta/GNC/Peajes)</span>
                    <span className="font-bold">
                      -${Number(arqueoData.gastos?.total || 0).toLocaleString('es-AR')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
                    <span className="font-medium">Comisión Agencia ({arqueoData.liquidacion?.comisionPorcentaje}%)</span>
                    <span className="font-bold">
                      -${Number(arqueoData.liquidacion?.comisionRemiseria || 0).toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>

                {/* Saldo de rendición física */}
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/50 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-amber-900 dark:text-amber-200 block">Comisión a Rendir en Base:</span>
                    <span className="text-[10px] text-amber-700 dark:text-amber-400">A entregar al despachador al cerrar</span>
                  </div>
                  <span className="text-base font-black text-amber-900 dark:text-amber-100">
                    ${Number(arqueoData.liquidacion?.aRendirCentral || 0).toLocaleString('es-AR')}
                  </span>
                </div>

                {/* Kilometraje del Turno */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-150 dark:border-slate-800">
                    <span className="text-[10px] text-gray-400 block uppercase font-bold">Km c/ Pasajeros</span>
                    <p className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                      {Number(arqueoData.turno?.kmConPasajero || kmConPasajero).toFixed(1)} km
                    </p>
                  </div>
                  <div className="p-2.5 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-150 dark:border-slate-800">
                    <span className="text-[10px] text-gray-400 block uppercase font-bold">Km Totales Turno</span>
                    <p className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                      {Number(arqueoData.turno?.kmTotalConectado || kmTotalConectado).toFixed(1)} km
                    </p>
                  </div>
                </div>

                {/* Odómetro final opcional */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-slate-300 block">
                    Odómetro de Tablero Final (opcional):
                  </label>
                  <input
                    type="number"
                    placeholder="Ej: 145890"
                    value={odometroInput}
                    onChange={(e) => setOdometroInput(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            ) : null}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalArqueoCierreOpen(false)}
                className="flex-1 py-3 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Continuar en Turno
              </button>
              <button
                type="button"
                onClick={async () => {
                  setModalArqueoCierreOpen(false);
                  const odo = odometroInput ? parseFloat(odometroInput) : undefined;
                  await confirmarToggleStatus(odo);
                }}
                disabled={actionLoading}
                className="flex-2 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/30 cursor-pointer"
              >
                {actionLoading ? 'Finalizando...' : 'Confirmar Cierre de Turno'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Iniciar Viaje Espontáneo de Calle / Taxímetro */}
      {modalViajeCalleOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-gray-100 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Viaje Espontáneo de Calle</h3>
                  <p className="text-xs text-gray-400 dark:text-slate-400">Modo Taxímetro Digital Inmediato</p>
                </div>
              </div>
              <button
                onClick={() => setModalViajeCalleOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector con app o sin app */}
            <div className="grid grid-cols-2 gap-2 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setViajeCalleModoApp(false)}
                className={`py-2 rounded-lg transition-all cursor-pointer ${
                  !viajeCalleModoApp
                    ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Pasajero Sin App
              </button>
              <button
                type="button"
                onClick={() => setViajeCalleModoApp(true)}
                className={`py-2 rounded-lg transition-all cursor-pointer ${
                  viajeCalleModoApp
                    ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Pasajero Con App (PIN)
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-gray-700 dark:text-slate-300 block mb-1">
                  Lugar de Origen / Subida:
                </label>
                <input
                  type="text"
                  value={viajeCalleOrigen}
                  onChange={(e) => setViajeCalleOrigen(e.target.value)}
                  placeholder="Ej: Av. Ceballos 120 (o en blanco para GPS actual)"
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-700 dark:text-slate-300 block mb-1">
                  Destino (Opcional - Si no sabe, corre taxímetro):
                </label>
                <input
                  type="text"
                  value={viajeCalleDestino}
                  onChange={(e) => setViajeCalleDestino(e.target.value)}
                  placeholder="Ej: Estación de tren (o en blanco)"
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white"
                />
              </div>

              {viajeCalleModoApp ? (
                <div>
                  <label className="text-[11px] font-bold text-gray-700 dark:text-slate-300 block mb-1">
                    PIN de 4 dígitos o Teléfono del Pasajero:
                  </label>
                  <input
                    type="text"
                    value={viajeCallePinPasajero}
                    onChange={(e) => setViajeCallePinPasajero(e.target.value)}
                    placeholder="Ej: 4821 o 2346554433"
                    className="w-full p-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white font-mono"
                    autoFocus
                  />
                </div>
              ) : (
                <div>
                  <label className="text-[11px] font-bold text-gray-700 dark:text-slate-300 block mb-1">
                    Identificación / Nombre del Pasajero (Opcional):
                  </label>
                  <input
                    type="text"
                    value={viajeCalleClienteNombre}
                    onChange={(e) => setViajeCalleClienteNombre(e.target.value)}
                    placeholder="Ej: Pasajero de Calle"
                    className="w-full p-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white"
                  />
                </div>
              )}

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5" />
                  Bajada de Bandera: ${bajadaBanderaChofer.toLocaleString('es-AR')}
                </span>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                  El taxímetro comenzará a tarifar los kilómetros recorridos en vivo a ${valorKmChofer}/km y la central registrará el viaje automáticamente.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalViajeCalleOpen(false)}
                className="flex-1 py-3 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleIniciarViajeCalle()}
                disabled={creandoViajeCalle}
                className="flex-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                {creandoViajeCalle ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span>Iniciar Taxímetro</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
