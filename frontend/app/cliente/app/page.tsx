'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';
import { 
  MapPin, 
  Navigation, 
  Car, 
  CreditCard, 
  Clock, 
  Search,
  MessageSquare,
  Phone,
  Trash2,
  Calendar,
  Compass,
  ArrowRight,
  Info,
  BellRing,
  Volume2,
  Bookmark,
  Home,
  Briefcase,
  Dumbbell,
  Heart,
  GraduationCap,
  Star,
  ShieldAlert,
  Share2,
  Plus,
  Send,
  X,
  Check,
  Banknote,
  DollarSign,
  AlertTriangle,
  Copy,
  ExternalLink,
  MessageCircle
} from 'lucide-react';
import { DireccionFrecuente, ParadaIntermedia } from '@/types';
import { clienteService, coordinadorDashboardService } from '@/lib/api';
import Link from 'next/link';

// Generador de tono de campana / timbre de llegada
function reproducirAlertaLlegada() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.18); // A5
      gain2.gain.setValueAtTime(0.4, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.65);
    }
  } catch (err) {
    console.warn('Audio de llegada no disponible:', err);
  }

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200, 100, 300]);
    } catch {}
  }
}

// Tono suave para aviso "Estoy llegando" (a pocas cuadras)
function reproducirAlertaLlegando() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.15); // E5
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    }
  } catch {}
}

// Alerta sonora de cancelación
function reproducirAlertaCancelacion() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.45);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    }
  } catch {}
}

// Alerta sonora de nuevo mensaje en chat
function reproducirAlertaMensaje() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(750, now);
      osc.frequency.setValueAtTime(950, now + 0.08);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    }
  } catch {}
}

const PREDEFINED_TAGS = [
  'Manejo prudente',
  'Auto limpio',
  'Puntual',
  'Aire acondicionado',
  'Excelente atención',
  'Buena música',
];

const PREDEFINED_QUICK_MESSAGES = [
  'Ya bajo',
  'Estoy en la puerta',
  'Esperame 2 minutos',
  'No veo el auto',
];

const MOTIVOS_CANCELACION = [
  'El chofer demora demasiado',
  'Cambio de planes',
  'Pedí por error',
  'Conseguí otro medio de transporte',
  'Otro motivo'
];

export default function ClienteApp() {
  const { user } = useAuth();
  const router = useRouter();

  // Inputs y Autocompletado de Origen / Destino
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [origenSuggestions, setOrigenSuggestions] = useState<any[]>([]);
  const [destinoSuggestions, setDestinoSuggestions] = useState<any[]>([]);
  const [isOrigenSelected, setIsOrigenSelected] = useState(false);
  const [isDestinoSelected, setIsDestinoSelected] = useState(false);
  
  // Coordenadas
  const [origenCoords, setOrigenCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [destinoCoords, setDestinoCoords] = useState<{ lat: number; lon: number } | null>(null);

  // Múltiples Paradas Intermedias (Iniciales)
  const [paradas, setParadas] = useState<
    Array<{ direccion: string; lat?: number; lon?: number; suggestions?: any[]; isSelected?: boolean }>
  >([]);

  // Método de pago y cambio en efectivo
  const [metodoPago, setMetodoPago] = useState<'EFECTIVO' | 'TRANSFERENCIA'>('EFECTIVO');
  const [pagaCon, setPagaCon] = useState<string>('');

  // Estados del Proceso
  const [isCalculando, setIsCalculando] = useState(false);
  const [presupuesto, setPresupuesto] = useState<any>(null);
  const [observaciones, setObservaciones] = useState('');
  
  // Viaje Activo y Polling
  const [activeViaje, setActiveViaje] = useState<any | null>(null);
  const [estadoViaje, setEstadoViaje] = useState<'IDLE' | 'BUSCANDO' | 'ACEPTADO' | 'EN_CAMINO' | 'EN_CURSO'>('IDLE');
  const [isRequesting, setIsRequesting] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  // Modales
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState('El chofer demora demasiado');
  const [motivoCancelacionCustom, setMotivoCancelacionCustom] = useState('');

  // Modal Calificación
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [viajeParaCalificar, setViajeParaCalificar] = useState<any | null>(null);
  const [estrellasChofer, setEstrellasChofer] = useState(5);
  const [estrellasVehiculo, setEstrellasVehiculo] = useState(5);
  const [tagsSeleccionados, setTagsSeleccionados] = useState<string[]>([]);
  const [comentarioCalificacion, setComentarioCalificacion] = useState('');
  const [isEnviandoCalificacion, setIsEnviandoCalificacion] = useState(false);

  // Modal Compartir Viaje
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  // Modal SOS de Emergencia
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);
  const [isSendingSos, setIsSendingSos] = useState(false);

  // Chat Rápido
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [mensajesChat, setMensajesChat] = useState<any[]>([]);
  const [isSendingChat, setIsSendingChat] = useState(false);

  // Agregar parada intermedia en curso
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  const [nuevaParadaDireccion, setNuevaParadaDireccion] = useState('');
  const [isNuevaParadaSelected, setIsNuevaParadaSelected] = useState(false);
  const [nuevaParadaSuggestions, setNuevaParadaSuggestions] = useState<any[]>([]);
  const [nuevaParadaCoords, setNuevaParadaCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [isSearchingParada, setIsSearchingParada] = useState(false);
  const [isAddingStop, setIsAddingStop] = useState(false);

  // Cronómetro en vivo de espera del viaje actual (sumando cada segundo en tiempo real)
  const [segundosEsperaLive, setSegundosEsperaLive] = useState<number>(0);

  useEffect(() => {
    if (!activeViaje) {
      setSegundosEsperaLive(0);
      return;
    }
    const baseSegundos = Number(activeViaje.tiempoEsperaSegundos) || 0;
    if (!activeViaje.enEspera || !activeViaje.inicioEsperaActual) {
      setSegundosEsperaLive(baseSegundos);
      return;
    }
    const updateWaitTicker = () => {
      const inicio = new Date(activeViaje.inicioEsperaActual).getTime();
      const deltaSec = Math.max(0, Math.floor((Date.now() - inicio) / 1000));
      setSegundosEsperaLive(baseSegundos + deltaSec);
    };
    updateWaitTicker();
    const waitInterval = setInterval(updateWaitTicker, 1000);
    return () => clearInterval(waitInterval);
  }, [activeViaje?.enEspera, activeViaje?.inicioEsperaActual, activeViaje?.tiempoEsperaSegundos]);

  const valorHoraEsperaCliente = activeViaje?.remiseria?.valorHoraEspera || 12000;
  const minutosEsperaCliente = Math.floor(segundosEsperaLive / 60);
  const segundosRestantesCliente = segundosEsperaLive % 60;
  const costoEsperaClienteLive = Math.round(((segundosEsperaLive / 3600) * valorHoraEsperaCliente) / 100) * 100;
  const precioBaseCliente = Number(activeViaje?.precio || 0) - (Number(activeViaje?.costoEspera) || 0);
  const precioTotalClienteLive = Math.max(0, precioBaseCliente + costoEsperaClienteLive);

  // Direcciones Frecuentes / Favoritas del Cliente
  const direccionesFrecuentesList: DireccionFrecuente[] = useMemo(() => {
    if (!user?.cliente?.direccionesFrecuentes) {
      if (user?.cliente?.direccion) {
        return [{ id: 'casa-def', alias: 'Casa', direccion: user.cliente.direccion, icono: 'home' }];
      }
      return [];
    }
    try {
      if (Array.isArray(user.cliente.direccionesFrecuentes)) {
        return user.cliente.direccionesFrecuentes;
      }
      if (typeof user.cliente.direccionesFrecuentes === 'string') {
        const parsed = JSON.parse(user.cliente.direccionesFrecuentes);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      return [];
    }
    return [];
  }, [user]);

  const handleAplicarDireccionFrecuente = async (dir: DireccionFrecuente) => {
    if (!origen.trim()) {
      setIsOrigenSelected(true);
      setOrigen(dir.direccion);
      setPresupuesto(null);
      try {
        const res = await coordinadorDashboardService.geocode(dir.direccion);
        if (res.success && res.data && res.data[0]) {
          setOrigenCoords({
            lat: parseFloat(res.data[0].lat),
            lon: parseFloat(res.data[0].lon)
          });
        }
      } catch {}
      toast.success(`Origen fijado: ${dir.alias}`);
    } else {
      setIsDestinoSelected(true);
      setDestino(dir.direccion);
      setPresupuesto(null);
      try {
        const res = await coordinadorDashboardService.geocode(dir.direccion);
        if (res.success && res.data && res.data[0]) {
          setDestinoCoords({
            lat: parseFloat(res.data[0].lat),
            lon: parseFloat(res.data[0].lon)
          });
        }
      } catch {}
      toast.success(`Destino fijado: ${dir.alias}`);
    }
  };

  const renderIconoDir = (icono?: string) => {
    switch (icono) {
      case 'home':
        return <Home className="w-3.5 h-3.5 text-emerald-500" />;
      case 'briefcase':
        return <Briefcase className="w-3.5 h-3.5 text-blue-500" />;
      case 'dumbbell':
        return <Dumbbell className="w-3.5 h-3.5 text-purple-500" />;
      case 'heart':
        return <Heart className="w-3.5 h-3.5 text-rose-500" />;
      case 'graduation':
        return <GraduationCap className="w-3.5 h-3.5 text-amber-500" />;
      default:
        return <MapPin className="w-3.5 h-3.5 text-primary-500" />;
    }
  };

  const previousEstadoRef = useRef<string | null>(null);
  const activeViajeRef = useRef<any>(null);
  const notificacionesLlegadaRef = useRef<Set<string>>(new Set());
  const notificacionesLlegandoRef = useRef<Set<string>>(new Set());
  const [choferLlegandoAviso, setChoferLlegandoAviso] = useState<boolean>(false);

  useEffect(() => {
    activeViajeRef.current = activeViaje;
    if (activeViaje?.mensajesChat) {
      try {
        const list = typeof activeViaje.mensajesChat === 'string'
          ? JSON.parse(activeViaje.mensajesChat)
          : activeViaje.mensajesChat;
        if (Array.isArray(list)) setMensajesChat(list);
      } catch {}
    }
  }, [activeViaje]);

  const notificarLlegadaChofer = (viajeInfo?: any) => {
    const viajeTarget = viajeInfo || activeViajeRef.current;
    const vId = viajeTarget?.id;
    if (vId) {
      if (notificacionesLlegadaRef.current.has(vId)) {
        return; // DEDUPLICADO: ya se mostró notificación de llegada
      }
      notificacionesLlegadaRef.current.add(vId);
    }
    previousEstadoRef.current = 'EN_CAMINO';

    reproducirAlertaLlegada();
    const choferNombre = viajeTarget?.chofer?.nombre || activeViajeRef.current?.chofer?.nombre || 'El chofer';
    const vehiculo = viajeTarget?.vehiculo || viajeTarget?.chofer?.vehiculo || activeViajeRef.current?.vehiculo || activeViajeRef.current?.chofer?.vehiculo;
    const autoStr = vehiculo ? ` (${vehiculo.marca} ${vehiculo.modelo} - ${vehiculo.patente})` : '';

    toast(
      `🚕 ¡${choferNombre}${autoStr} está en la puerta esperándote!`,
      {
        id: `llegada-puerta-${vId || 'activo'}`,
        duration: 9000,
        icon: '🔔',
        style: {
          background: '#047857',
          color: '#ffffff',
          fontWeight: 'bold',
          fontSize: '13px',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)',
        },
      }
    );

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('¡Tu remís ha llegado!', {
          body: `${choferNombre}${autoStr} está esperándote afuera en la puerta.`,
          icon: '/favicon.ico',
        });
      } catch {}
    }
  };

  const notificarChoferLlegando = (viajeInfo?: any) => {
    const viajeTarget = viajeInfo || activeViajeRef.current;
    const vId = viajeTarget?.id;
    if (vId) {
      if (notificacionesLlegandoRef.current.has(vId)) {
        return; // DEDUPLICADO: ya se mostró aviso de que está llegando
      }
      notificacionesLlegandoRef.current.add(vId);
    }

    setChoferLlegandoAviso(true);
    reproducirAlertaLlegando();
    const choferNombre = viajeTarget?.chofer?.nombre || activeViajeRef.current?.chofer?.nombre || 'El chofer';
    const vehiculo = viajeTarget?.vehiculo || viajeTarget?.chofer?.vehiculo || activeViajeRef.current?.vehiculo || activeViajeRef.current?.chofer?.vehiculo;
    const autoStr = vehiculo ? ` (${vehiculo.marca} ${vehiculo.modelo} - ${vehiculo.patente})` : '';

    toast(
      `🚕 ¡${choferNombre}${autoStr} está llegando a tu ubicación! Podés ir preparándote.`,
      {
        id: `llegando-aviso-${vId || 'activo'}`,
        duration: 8500,
        icon: '📍',
        style: {
          background: '#1d4ed8',
          color: '#ffffff',
          fontWeight: 'bold',
          fontSize: '13px',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)',
        },
      }
    );

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('¡Tu remís está llegando!', {
          body: `${choferNombre}${autoStr} está a pocas cuadras de tu ubicación.`,
          icon: '/favicon.ico',
        });
      } catch {}
    }
  };

  // Conexión WebSocket para notificaciones inmediatas y chat en tiempo real
  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    const socket: Socket = io(socketUrl, {
      transports: ['websocket'],
      withCredentials: true,
    });

    socket.on('connect', () => {
      const remId = user?.cliente?.remiseriaId || activeViajeRef.current?.remiseriaId;
      if (remId) {
        socket.emit('join_room', { remiseriaId: remId });
      }
    });

    socket.on('viaje_estado_actualizado', (data: { viajeId: string; estado: string; mensaje?: string; viaje?: any }) => {
      if (activeViajeRef.current && data.viajeId === activeViajeRef.current.id) {
        if (data.estado === 'EN_CAMINO') {
          previousEstadoRef.current = 'EN_CAMINO';
          notificarLlegadaChofer(data.viaje || activeViajeRef.current);
          setEstadoViaje('EN_CAMINO');
          setActiveViaje((prev: any) => ({ ...(prev || {}), estado: 'EN_CAMINO', ...(data.viaje || {}) }));
        } else if (data.estado === 'COMPLETADO') {
          const vCompletado = data.viaje || activeViajeRef.current;
          setViajeParaCalificar(vCompletado);
          setIsRatingModalOpen(true);
          toast.success('¡Viaje finalizado! Por favor califica el servicio.');
          resetRequestState();
        } else if (data.estado === 'CANCELADO') {
          reproducirAlertaCancelacion();
          toast.error(data.mensaje || 'El viaje fue cancelado.');
          resetRequestState();
        } else if (data.estado === 'EN_CURSO') {
          setEstadoViaje('EN_CURSO');
          setActiveViaje((prev: any) => ({ ...(prev || {}), estado: 'EN_CURSO', ...(data.viaje || {}) }));
        }
      }
    });

    // Escucha aviso de que el chofer está llegando a pocas cuadras
    socket.on('chofer_llegando', (data: any) => {
      if (activeViajeRef.current && data.viajeId === activeViajeRef.current.id) {
        notificarChoferLlegando(data.viaje || activeViajeRef.current);
      }
    });

    // Escucha cancelación con sonido y motivo
    socket.on('viaje_cancelado', (data: any) => {
      if (activeViajeRef.current && data.viajeId === activeViajeRef.current.id) {
        reproducirAlertaCancelacion();
        toast.error(`Viaje cancelado. ${data.motivo ? `Motivo: ${data.motivo}` : ''}`);
        resetRequestState();
      }
    });

    // Escucha mensajes de chat del chofer
    socket.on('mensaje_chat_recibido', (data: any) => {
      if (activeViajeRef.current && data.viajeId === activeViajeRef.current.id) {
        reproducirAlertaMensaje();
        setMensajesChat((prev) => [...prev, data.mensaje]);
        if (data.mensaje.remitente === 'CHOFER') {
          toast(`Mensaje del chofer: "${data.mensaje.texto}"`, { icon: '💬', duration: 5000 });
        }
      }
    });

    // Escucha actualización de espera (botón de espera del chofer)
    socket.on('espera_actualizada', (data: any) => {
      if (activeViajeRef.current && data.viajeId === activeViajeRef.current.id) {
        setActiveViaje((prev: any) => ({
          ...prev,
          enEspera: data.enEspera,
          inicioEsperaActual: data.inicioEsperaActual,
          tiempoEsperaSegundos: data.tiempoEsperaSegundos,
          costoEspera: data.costoEspera,
          precio: data.nuevoPrecio || prev?.precio
        }));
      }
    });

    // Escucha nueva parada agregada dinámicamente
    socket.on('parada_agregada', (data: any) => {
      if (activeViajeRef.current && data.viajeId === activeViajeRef.current.id) {
        setActiveViaje((prev: any) => ({
          ...prev,
          paradas: data.paradas,
          precio: data.nuevoPrecio || prev?.precio
        }));
        toast.success('Nueva parada agregada al itinerario');
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.cliente?.remiseriaId, activeViaje?.remiseriaId]);

  const [disponibilidad, setDisponibilidad] = useState<{
    hayAutosDisponibles: boolean;
    autosDisponibles: number;
    autosEnViaje: number;
    choferesConectados: number;
    totalVehiculosActivos: number;
    viajesPendientes: number;
    todosOcupados: boolean;
    demoraMin: number;
    demoraMax: number;
  } | null>(null);

  const cargarDisponibilidad = async () => {
    try {
      const res = await clienteService.getDisponibilidad();
      if (res.success && res.data) {
        setDisponibilidad(res.data);
      }
    } catch (error) {
      console.error('Error consultando disponibilidad:', error);
    }
  };

  useEffect(() => {
    if (!user || user.rol !== 'CLIENTE') {
      router.push('/login');
      return;
    }
    buscarViajeActivo();
    cargarDisponibilidad();

    const dispInterval = setInterval(cargarDisponibilidad, 6000);
    return () => clearInterval(dispInterval);
  }, [user, router]);

  const buscarViajeActivo = async () => {
    try {
      const res = await clienteService.getViajes();
      if (res.success && res.data) {
        const activos = res.data.filter((v: any) => 
          ['PENDIENTE', 'ACEPTADO', 'EN_CAMINO', 'EN_CURSO'].includes(v.estado)
        );
        if (activos.length > 0) {
          actualizarEstadoSegunViaje(activos[0]);
        }
      }
    } catch (error) {
      console.error('Error buscando viajes activos:', error);
    }
  };

  const actualizarEstadoSegunViaje = (viaje: any) => {
    const estadoAnterior = previousEstadoRef.current;
    previousEstadoRef.current = viaje.estado;
    activeViajeRef.current = viaje;
    setActiveViaje(viaje);

    if (viaje.estado === 'PENDIENTE') {
      setEstadoViaje('BUSCANDO');
    } else if (viaje.estado === 'ACEPTADO') {
      setEstadoViaje('ACEPTADO');
    } else if (viaje.estado === 'EN_CAMINO') {
      setEstadoViaje('EN_CAMINO');
      if (estadoAnterior && estadoAnterior !== 'EN_CAMINO') {
        notificarLlegadaChofer(viaje);
      }
    } else if (viaje.estado === 'EN_CURSO') {
      setEstadoViaje('EN_CURSO');
    }
  };

  // Polling del viaje activo cada 4 segundos
  useEffect(() => {
    if (!activeViaje) return;

    const interval = setInterval(async () => {
      try {
        const res = await clienteService.getViajes();
        if (res.success && res.data) {
          const vActualizado = res.data.find((v: any) => v.id === activeViaje.id);
          
          if (!vActualizado) {
            resetRequestState();
            return;
          }

          if (vActualizado.estado === 'COMPLETADO') {
            setViajeParaCalificar(vActualizado);
            setIsRatingModalOpen(true);
            toast.success('¡Viaje finalizado! Por favor califica tu experiencia.');
            resetRequestState();
          } else if (vActualizado.estado === 'CANCELADO') {
            toast.error('El viaje fue cancelado.');
            resetRequestState();
          } else {
            actualizarEstadoSegunViaje(vActualizado);
          }
        }
      } catch (error) {
        console.error('Error en polling de viaje:', error);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeViaje]);

  const resetRequestState = () => {
    setActiveViaje(null);
    setEstadoViaje('IDLE');
    setPresupuesto(null);
    setOrigen('');
    setDestino('');
    setParadas([]);
    setOrigenCoords(null);
    setDestinoCoords(null);
    setIsOrigenSelected(false);
    setIsDestinoSelected(false);
    setObservaciones('');
    setPagaCon('');
    setMensajesChat([]);
    setChoferLlegandoAviso(false);
    notificacionesLlegadaRef.current.clear();
    notificacionesLlegandoRef.current.clear();
    previousEstadoRef.current = null;
  };

  // Autocompletado de dirección de origen
  useEffect(() => {
    if (isOrigenSelected || !origen || origen.length < 3) {
      setOrigenSuggestions([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await coordinadorDashboardService.geocode(origen);
        if (res.success && res.data) {
          setOrigenSuggestions(res.data);
        }
      } catch (err) {}
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [origen, isOrigenSelected]);

  // Autocompletado de dirección de destino
  useEffect(() => {
    if (isDestinoSelected || !destino || destino.length < 3) {
      setDestinoSuggestions([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await coordinadorDashboardService.geocode(destino);
        if (res.success && res.data) {
          setDestinoSuggestions(res.data);
        }
      } catch (err) {}
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [destino, isDestinoSelected]);

  // Autocompletado de dirección para la parada en curso con búsqueda en Maps
  useEffect(() => {
    if (!isAddStopModalOpen || isNuevaParadaSelected || !nuevaParadaDireccion || nuevaParadaDireccion.length < 3) {
      setNuevaParadaSuggestions([]);
      setIsSearchingParada(false);
      return;
    }

    setIsSearchingParada(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await coordinadorDashboardService.geocode(nuevaParadaDireccion);
        if (res.success && Array.isArray(res.data)) {
          setNuevaParadaSuggestions(res.data);
        } else {
          setNuevaParadaSuggestions([]);
        }
      } catch (err) {
        setNuevaParadaSuggestions([]);
      } finally {
        setIsSearchingParada(false);
      }
    }, 350);

    return () => clearTimeout(delayDebounceFn);
  }, [nuevaParadaDireccion, isNuevaParadaSelected, isAddStopModalOpen]);

  const handleSelectOrigen = (s: any) => {
    setIsOrigenSelected(true);
    setOrigen(s.display_name);
    setOrigenCoords({
      lat: parseFloat(s.lat),
      lon: parseFloat(s.lon)
    });
    setOrigenSuggestions([]);
    setPresupuesto(null);
  };

  const handleSelectDestino = (s: any) => {
    setIsDestinoSelected(true);
    setDestino(s.display_name);
    setDestinoCoords({
      lat: parseFloat(s.lat),
      lon: parseFloat(s.lon)
    });
    setDestinoSuggestions([]);
    setPresupuesto(null);
  };

  const recalcularConParadas = async (paradasList: any[]) => {
    if (!origen || !destino) return;
    setIsCalculando(true);
    try {
      const paradasPayload = paradasList
        .filter((p) => p.direccion && p.direccion.trim().length > 0)
        .map((p) => ({ direccion: p.direccion, lat: p.lat, lon: p.lon }));

      const res = await clienteService.calcularPrecio(
        origen,
        destino,
        origenCoords?.lat,
        origenCoords?.lon,
        destinoCoords?.lat,
        destinoCoords?.lon,
        paradasPayload.length > 0 ? paradasPayload : undefined
      );

      if (res.success && res.data) {
        setPresupuesto({
          precio: res.data.precioEstimado,
          distancia: res.data.distancia ? `${res.data.distancia} km` : 'Calculada',
          tiempo: res.data.tiempoEstimado ? `${res.data.tiempoEstimado} min` : '10-15 min',
        });
      }
    } catch {
      // ignore
    } finally {
      setIsCalculando(false);
    }
  };

  // Gestión de Paradas Intermedias antes de pedir
  const handleAgregarParada = () => {
    if (paradas.length >= 3) {
      toast.error('Máximo 3 paradas intermedias por viaje');
      return;
    }
    setParadas([...paradas, { direccion: '' }]);
    setPresupuesto(null);
  };

  const handleEliminarParada = (index: number) => {
    const updated = paradas.filter((_, idx) => idx !== index);
    setParadas(updated);
    if (origen && destino && presupuesto) {
      recalcularConParadas(updated);
    } else {
      setPresupuesto(null);
    }
  };

  const handleParadaChange = async (index: number, val: string) => {
    const updated = [...paradas];
    updated[index].direccion = val;
    updated[index].isSelected = false;
    updated[index].lat = undefined;
    updated[index].lon = undefined;
    setParadas(updated);
    setPresupuesto(null);

    if (val.length >= 3) {
      try {
        const res = await coordinadorDashboardService.geocode(val);
        if (res.success && res.data) {
          const withSug = [...paradas];
          withSug[index].suggestions = res.data;
          setParadas(withSug);
        }
      } catch {}
    }
  };

  const handleSelectParada = (index: number, suggestion: any) => {
    const updated = [...paradas];
    updated[index].direccion = suggestion.display_name;
    updated[index].lat = parseFloat(suggestion.lat);
    updated[index].lon = parseFloat(suggestion.lon);
    updated[index].isSelected = true;
    updated[index].suggestions = [];
    setParadas(updated);
    if (origen && destino) {
      recalcularConParadas(updated);
    }
  };

  const usarUbicacionActual = async () => {
    try {
      const res = await clienteService.getUbicacionActual();
      if (res.success && res.data) {
        setIsOrigenSelected(true);
        setOrigen(res.data.direccion);
        setOrigenCoords({
          lat: res.data.lat,
          lon: res.data.lng
        });
        toast.success('Ubicación obtenida exitosamente');
      } else {
        toast.error('No se pudo obtener la ubicación');
      }
    } catch {
      toast.error('Error al obtener ubicación actual');
    }
  };

  const calcularPrecio = async () => {
    if (!origen || !destino) {
      toast.error('Por favor ingresa un origen y un destino');
      return;
    }
    
    setIsCalculando(true);
    try {
      const paradasPayload = paradas
        .filter((p) => p.direccion.trim().length > 0)
        .map((p) => ({ direccion: p.direccion, lat: p.lat, lon: p.lon }));

      const res = await clienteService.calcularPrecio(
        origen,
        destino,
        origenCoords?.lat,
        origenCoords?.lon,
        destinoCoords?.lat,
        destinoCoords?.lon,
        paradasPayload.length > 0 ? paradasPayload : undefined
      );
      
      if (res.success && res.data) {
        setPresupuesto({
          precio: res.data.precioEstimado,
          distancia: res.data.distancia ? `${res.data.distancia} km` : 'Calculada',
          tiempo: res.data.tiempoEstimado ? `${res.data.tiempoEstimado} min` : '10-15 min',
        });
      } else {
        toast.error('Error al calcular el precio del viaje');
      }
    } catch (error) {
      console.error('Error calculando precio:', error);
      toast.error('Error al cotizar viaje');
    } finally {
      setIsCalculando(false);
    }
  };

  const pedirAuto = async () => {
    if (!origen || !destino || !presupuesto) return;
    setIsRequesting(true);
    setEstadoViaje('BUSCANDO');
    
    try {
      const paradasPayload = paradas
        .filter((p) => p.direccion.trim().length > 0)
        .map((p, idx) => ({
          direccion: p.direccion,
          lat: p.lat,
          lon: p.lon,
          orden: idx + 1,
          completada: false
        }));

      const payload = {
        origen,
        destino,
        latitudOrigen: origenCoords?.lat,
        longitudOrigen: origenCoords?.lon,
        latitudDestino: destinoCoords?.lat,
        longitudDestino: destinoCoords?.lon,
        observaciones: observaciones || undefined,
        paradas: paradasPayload.length > 0 ? paradasPayload : undefined,
        metodoPago,
        pagaCon: metodoPago === 'EFECTIVO' && pagaCon ? parseFloat(pagaCon) : undefined
      };

      const res = await clienteService.solicitarViaje(payload);
      if (res.success && res.data) {
        setActiveViaje(res.data);
        toast.success('Buscando el auto más cercano...');
      } else {
        toast.error(res.message || 'Error al solicitar el viaje');
        setEstadoViaje('IDLE');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error de red al solicitar viaje');
      setEstadoViaje('IDLE');
    } finally {
      setIsRequesting(false);
    }
  };

  const confirmarCancelacionViaje = async () => {
    if (!activeViaje) return;
    const motivoFinal = motivoCancelacion === 'Otro motivo' ? motivoCancelacionCustom : motivoCancelacion;
    if (!motivoFinal.trim()) {
      toast.error('Por favor especifica el motivo de la cancelación');
      return;
    }

    setIsCanceling(true);
    try {
      const res = await clienteService.cancelarViaje(activeViaje.id, motivoFinal);
      if (res.success) {
        if (res.data?.debeAbonarMinimo) {
          toast(
            `Viaje cancelado. El chofer estaba a menos de 10 cuadras. Deberás abonar el viaje mínimo ($${res.data.costoCancelacion}).`,
            {
              duration: 8000,
              icon: '⚠️',
              style: { background: '#991b1b', color: '#fff', fontWeight: 'bold' }
            }
          );
        } else {
          toast.success('Viaje cancelado exitosamente');
        }
        setIsCancelModalOpen(false);
        resetRequestState();
      } else {
        toast.error(res.message || 'Error al cancelar viaje');
      }
    } catch {
      toast.error('Error al intentar cancelar viaje');
    } finally {
      setIsCanceling(false);
    }
  };

  // Enviar calificación
  const handleEnviarCalificacion = async () => {
    if (!viajeParaCalificar) return;
    setIsEnviandoCalificacion(true);
    try {
      const res = await clienteService.calificarViaje(viajeParaCalificar.id, {
        estrellasChofer,
        estrellasVehiculo,
        tags: tagsSeleccionados,
        comentario: comentarioCalificacion
      });
      if (res.success) {
        toast.success('¡Gracias por tus comentarios y calificación!');
        setIsRatingModalOpen(false);
        setViajeParaCalificar(null);
      } else {
        toast.error(res.message || 'No se pudo registrar la calificación');
      }
    } catch {
      toast.error('Error al enviar calificación');
    } finally {
      setIsEnviandoCalificacion(false);
    }
  };

  // Enviar mensaje en Chat Rápido
  const handleEnviarMensaje = async (textoAEnviar?: string) => {
    const texto = textoAEnviar || chatInput;
    if (!texto.trim() || !activeViaje) return;
    setIsSendingChat(true);
    try {
      const res = await clienteService.enviarMensajeChat(activeViaje.id, texto.trim());
      if (res.success && res.data) {
        setMensajesChat((prev) => [...prev, res.data]);
        setChatInput('');
      } else {
        toast.error(res.message || 'Error al enviar mensaje');
      }
    } catch {
      toast.error('Error de red al enviar mensaje');
    } finally {
      setIsSendingChat(false);
    }
  };

  // Emitir alerta SOS
  const handleEmitirAlertaSos = async () => {
    if (!activeViaje) return;
    setIsSendingSos(true);
    try {
      const res = await clienteService.enviarAlertaSOS(activeViaje.id, origenCoords || undefined);
      if (res.success) {
        toast.success('🚨 Alerta SOS enviada con éxito a la central de la agencia', { duration: 6000 });
      } else {
        toast.error(res.message || 'Error al emitir alerta');
      }
    } catch {
      toast.error('Error al contactar con la central');
    } finally {
      setIsSendingSos(false);
    }
  };

  // Agregar parada en curso
  const handleAgregarParadaEnCurso = async () => {
    if (!nuevaParadaDireccion.trim() || !activeViaje) return;
    setIsAddingStop(true);
    try {
      let coords = nuevaParadaCoords;
      if (!coords) {
        // Si no seleccionó de la lista, intentar geocodificar antes de enviar
        try {
          const geoRes = await coordinadorDashboardService.geocode(nuevaParadaDireccion.trim());
          if (geoRes.success && Array.isArray(geoRes.data) && geoRes.data.length > 0) {
            coords = {
              lat: parseFloat(geoRes.data[0].lat),
              lon: parseFloat(geoRes.data[0].lon)
            };
          }
        } catch {}
      }

      const res = await clienteService.agregarParada(activeViaje.id, {
        direccion: nuevaParadaDireccion.trim(),
        lat: coords?.lat,
        lon: coords?.lon
      });
      if (res.success && res.data) {
        setActiveViaje(res.data);
        toast.success(`Parada agregada. Tarifa actualizada: $${res.data.precio?.toLocaleString('es-AR')}`);
        setIsAddStopModalOpen(false);
        setNuevaParadaDireccion('');
        setNuevaParadaCoords(null);
        setIsNuevaParadaSelected(false);
        setNuevaParadaSuggestions([]);
      } else {
        toast.error(res.message || 'Error al agregar parada');
      }
    } catch {
      toast.error('Error al actualizar recorrido');
    } finally {
      setIsAddingStop(false);
    }
  };

  // Cálculo dinámico de vuelto
  const calcularVuelto = () => {
    if (!presupuesto || metodoPago !== 'EFECTIVO' || !pagaCon) return null;
    const monto = parseFloat(pagaCon);
    if (isNaN(monto) || monto <= presupuesto.precio) return null;
    return (monto - presupuesto.precio).toLocaleString('es-AR');
  };

  if (!user) return null;

  return (
    <div className="relative flex flex-col h-[calc(100vh-8rem)] bg-gray-50 dark:bg-slate-950 transition-colors">
      
      {/* MAPA DE FONDO */}
      <div className="absolute inset-0 bg-slate-100 dark:bg-slate-950 z-0">
        <div
          className="w-full h-full opacity-35 dark:opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(#94a3b8 1px, transparent 1px), linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)',
            backgroundSize: '20px 20px, 80px 80px, 80px 80px'
          }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-transparent to-white/90 dark:from-slate-950/70 dark:via-transparent dark:to-slate-950/90"></div>
        {estadoViaje === 'IDLE' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-8 text-center select-none pointer-events-none">
            <Compass className="w-16 h-16 mb-2 text-slate-300 dark:text-slate-600 animate-pulse" />
            <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">¿A dónde quieres ir hoy?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mt-1">
              Ingresa el origen, paradas intermedias si tienes mandados, y el destino
            </p>
          </div>
        )}
      </div>

      {/* CONTROLES SUPERIORES (Ingreso de dirección) */}
      {estadoViaje === 'IDLE' && (
        <div className="z-20 p-4 w-full max-w-lg mx-auto overflow-y-auto max-h-[calc(100vh-14rem)] no-scrollbar">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-150 dark:border-slate-800 transition-colors">
            <div className="p-4 space-y-3.5">
              
              {/* Input de Origen */}
              <div className="relative z-20">
                <div className="flex gap-3 items-center">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0">
                    <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
                  </div>
                  <div className="flex-1 relative">
                    <input 
                      type="text" 
                      value={origen}
                      onChange={(e) => {
                        setOrigen(e.target.value);
                        setIsOrigenSelected(false);
                        setOrigenCoords(null);
                        setPresupuesto(null);
                      }}
                      placeholder="¿Dónde te buscamos? (Origen)"
                      className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 pr-9 text-sm focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white font-medium placeholder-gray-500 dark:placeholder-slate-400"
                    />
                    <button 
                      type="button"
                      onClick={usarUbicacionActual}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-600 dark:text-primary-400 hover:text-primary-800 transition-colors"
                      title="Usar mi ubicación actual"
                    >
                      <Navigation className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Sugerencias Origen */}
                {origenSuggestions.length > 0 && (
                  <div className="absolute left-7 right-0 mt-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                    {origenSuggestions.map((s, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => handleSelectOrigen(s)}
                        className="w-full text-left p-3 text-xs hover:bg-gray-50 dark:hover:bg-slate-800 border-b border-gray-100 dark:border-slate-800 last:border-0 text-gray-800 dark:text-slate-200 font-medium truncate block"
                      >
                        {s.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* PARADAS INTERMEDIAS */}
              {paradas.map((parada, idx) => (
                <div key={idx} className="relative z-15 pl-1.5 space-y-1">
                  <div className="w-0.5 h-3 bg-amber-400 ml-[10px] -my-1"></div>
                  <div className="flex gap-2 items-center">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0">
                      <div className="w-2.5 h-2.5 bg-amber-500 rounded-full"></div>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={parada.direccion}
                        onChange={(e) => handleParadaChange(idx, e.target.value)}
                        placeholder={`Parada intermedia #${idx + 1} (Ej: Farmacia, Banco)`}
                        className="w-full bg-amber-50/50 dark:bg-slate-800/80 border border-amber-200/60 dark:border-amber-900/40 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-amber-500 text-gray-900 dark:text-white font-medium"
                      />
                      {parada.suggestions && parada.suggestions.length > 0 && (
                        <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-40 overflow-y-auto">
                          {parada.suggestions.map((sug, sIdx) => (
                            <button
                              type="button"
                              key={sIdx}
                              onClick={() => handleSelectParada(idx, sug)}
                              className="w-full text-left p-2.5 text-xs hover:bg-gray-50 dark:hover:bg-slate-800 border-b border-gray-100 last:border-0 truncate block text-slate-800 dark:text-slate-200"
                            >
                              {sug.display_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleEliminarParada(idx)}
                      className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                      title="Eliminar parada"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Botón para añadir parada intermedia */}
              <div className="flex justify-between items-center pl-7 pr-1">
                <button
                  type="button"
                  onClick={handleAgregarParada}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar parada intermedia</span>
                </button>
                {paradas.length > 0 && (
                  <span className="text-[11px] text-slate-400">{paradas.length}/3 paradas</span>
                )}
              </div>

              <div className="w-0.5 h-3 bg-gray-200 dark:bg-slate-700 ml-[7px] -my-1"></div>

              {/* Input de Destino */}
              <div className="relative z-10">
                <div className="flex gap-3 items-center">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0">
                    <div className="w-2.5 h-2.5 bg-rose-500 rounded-full"></div>
                  </div>
                  <div className="flex-1">
                    <input 
                      type="text" 
                      value={destino}
                      onChange={(e) => {
                        setDestino(e.target.value);
                        setIsDestinoSelected(false);
                        setDestinoCoords(null);
                        setPresupuesto(null);
                      }}
                      placeholder="¿A dónde quieres ir? (Destino final)"
                      className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white font-medium placeholder-gray-500 dark:placeholder-slate-400"
                    />
                  </div>
                </div>

                {/* Sugerencias Destino */}
                {destinoSuggestions.length > 0 && (
                  <div className="absolute left-7 right-0 mt-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                    {destinoSuggestions.map((s, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => handleSelectDestino(s)}
                        className="w-full text-left p-3 text-xs hover:bg-gray-50 dark:hover:bg-slate-800 border-b border-gray-100 dark:border-slate-800 last:border-0 text-gray-800 dark:text-slate-200 font-medium truncate block"
                      >
                        {s.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Lugares Frecuentes */}
              {direccionesFrecuentesList.length > 0 && (
                <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 dark:text-slate-400 mb-1.5 px-0.5">
                    <span className="flex items-center gap-1">
                      <Bookmark className="w-3 h-3 text-primary-500" />
                      Tus lugares frecuentes:
                    </span>
                    <Link href="/cliente/perfil" className="text-primary-600 dark:text-primary-400 hover:underline">
                      Gestionar
                    </Link>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {direccionesFrecuentesList.map((dir, idx) => (
                      <button
                        key={dir.id || idx}
                        type="button"
                        onClick={() => handleAplicarDireccionFrecuente(dir)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200/80 dark:border-slate-700/80 hover:border-primary-500 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 shrink-0 shadow-2xs transition-all active:scale-95"
                      >
                        {renderIconoDir(dir.icono)}
                        <span>{dir.alias}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Disponibilidad */}
          {disponibilidad && (
            <div className="mt-3 space-y-2 relative z-0">
              {disponibilidad.hayAutosDisponibles ? (
                <div className="bg-emerald-50/95 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/60 rounded-xl px-4 py-3 shadow-sm flex items-center justify-between transition-colors">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-3 w-3 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <div>
                      <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                        {disponibilidad.autosDisponibles === 1
                          ? '1 auto disponible ahora'
                          : `${disponibilidad.autosDisponibles} autos disponibles ahora`}
                      </p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                        Conductores activos en línea para asignarte de inmediato
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-emerald-100 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold shrink-0">
                    <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{disponibilidad.demoraMin}-{disponibilidad.demoraMax} min</span>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50/95 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3.5 shadow-sm space-y-2 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="relative flex h-3 w-3 shrink-0 mt-1">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                      </span>
                      <div>
                        <p className="text-xs font-bold text-amber-950 dark:text-amber-200">
                          {disponibilidad.todosOcupados
                            ? 'Todos los vehículos están ocupados en este momento'
                            : 'No hay vehículos libres en línea en este instante'}
                        </p>
                        <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                          {disponibilidad.todosOcupados
                            ? `Hay ${disponibilidad.autosEnViaje} autos realizando viajes. Tu pedido será asignado apenas se libere una unidad.`
                            : 'Puedes solicitar tu viaje igualmente y el coordinador en base te asignará una unidad.'}
                        </p>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/60 rounded-xl px-3 py-1.5 text-right shrink-0 shadow-xs">
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                        Demora aprox.
                      </span>
                      <span className="text-xs font-extrabold text-amber-950 dark:text-amber-200 flex items-center justify-end gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        {disponibilidad.demoraMin} - {disponibilidad.demoraMax} min
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ÁREA INFERIOR (Presupuesto o Estado del Viaje) */}
      <div className="mt-auto z-10 w-full max-w-lg mx-auto p-4 animate-slide-up">
        
        {/* Caso 1: Origen y Destino ingresados pero no cotizados */}
        {estadoViaje === 'IDLE' && origen && destino && !presupuesto && !isCalculando && (
          <button 
            onClick={calcularPrecio}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl py-4 shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2 text-sm"
          >
            <span>Confirmar Itinerario y Ver Precio</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {/* Caso 2: Calculando */}
        {isCalculando && (
          <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xl text-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 dark:border-primary-400 mx-auto"></div>
            <p className="text-gray-600 dark:text-slate-300 font-semibold text-sm">Cotizando viaje y buscando mejor ruta...</p>
          </div>
        )}

        {/* Caso 3: Presupuesto Listo para pedir */}
        {estadoViaje === 'IDLE' && presupuesto && !isCalculando && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-150 dark:border-slate-800 overflow-hidden transition-colors">
            <div className="p-5 space-y-4">
              
              <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="bg-primary-50 dark:bg-primary-950/60 p-2.5 rounded-xl text-primary-600 dark:text-primary-400">
                    <Car className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">Remís de la Agencia</h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3.5 h-3.5" />
                      Estimado: {presupuesto.tiempo} ({presupuesto.distancia})
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-gray-950 dark:text-white">${presupuesto.precio}</span>
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 block">Tarifa fija</span>
                </div>
              </div>

              {/* Indicaciones para el chofer */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Indicaciones para el chofer
                </label>
                <input 
                  type="text" 
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Ej: Portón verde, timbre B..."
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* SELECCIÓN DE MÉTODO DE PAGO Y DETALLE DE CAMBIO */}
              <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-slate-800">
                <label className="block text-[11px] font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">
                  Método de Pago
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMetodoPago('EFECTIVO')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      metodoPago === 'EFECTIVO'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 shadow-xs'
                        : 'border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-gray-50'
                    }`}
                  >
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    <span>Efectivo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetodoPago('TRANSFERENCIA')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      metodoPago === 'TRANSFERENCIA'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 shadow-xs'
                        : 'border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-gray-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    <span>Transferencia</span>
                  </button>
                </div>

                {/* Si es efectivo: ¿Con cuánto abona? */}
                {metodoPago === 'EFECTIVO' && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-gray-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        ¿Con cuánto vas a abonar?
                      </span>
                      <span className="text-[10px] text-slate-400">Para preparar tu cambio</span>
                    </div>

                    <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                      <button
                        type="button"
                        onClick={() => setPagaCon(String(presupuesto.precio))}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-colors ${
                          pagaCon === String(presupuesto.precio)
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        Exacto (${presupuesto.precio})
                      </button>
                      {[5000, 10000, 20000].map((monto) => (
                        <button
                          key={monto}
                          type="button"
                          onClick={() => setPagaCon(String(monto))}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-colors ${
                            pagaCon === String(monto)
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          ${monto.toLocaleString('es-AR')}
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        value={pagaCon}
                        onChange={(e) => setPagaCon(e.target.value)}
                        placeholder="Otro monto (ej: 7000)"
                        className="w-full pl-7 pr-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    {calcularVuelto() && (
                      <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        El chofer llevará ${calcularVuelto()} de cambio preparado.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <button 
                onClick={pedirAuto}
                disabled={isRequesting}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl py-4 shadow-lg shadow-primary-500/25 active:scale-95 transition-transform flex items-center justify-center gap-2 text-sm"
              >
                {isRequesting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Car className="w-4 h-4" />
                    <span>PEDIR REMÍS AHORA</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Caso 4: Buscando Chofer */}
        {estadoViaje === 'BUSCANDO' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-250 dark:border-slate-800 shadow-xl p-6 text-center space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 bg-primary-100 dark:bg-primary-950/60 rounded-full animate-ping"></div>
              <div className="relative bg-primary-600 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-lg">
                <Navigation className="w-8 h-8 rotate-45" />
              </div>
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">Buscando conductor...</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Tu solicitud ha sido enviada al coordinador de la remisería</p>
            </div>
            
            <div className="h-1.5 w-full bg-gray-150 dark:bg-slate-800 rounded-full overflow-hidden mt-6">
              <div className="h-full bg-primary-600 w-1/3 rounded-full animate-pulse-loader"></div>
            </div>

            <button 
              onClick={() => setIsCancelModalOpen(true)}
              disabled={isCanceling}
              className="mt-6 text-red-500 hover:text-red-700 font-bold text-xs flex items-center justify-center mx-auto gap-1 py-2 px-4 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl"
            >
              <Trash2 className="w-4 h-4" />
              <span>Cancelar solicitud de viaje</span>
            </button>
          </div>
        )}

        {/* Caso 5: Viaje Aceptado / En Camino / En Curso */}
        {['ACEPTADO', 'EN_CAMINO', 'EN_CURSO'].includes(estadoViaje) && activeViaje && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-150 dark:border-slate-800 overflow-hidden transition-colors">
            
            {/* Header del estado */}
            {estadoViaje === 'EN_CAMINO' ? (
              <div className="bg-amber-500 text-white p-4 text-center animate-pulse shadow-md">
                <h3 className="font-black text-sm flex items-center justify-center gap-2">
                  <BellRing className="w-5 h-5 animate-bounce" />
                  ¡TU REMÍS HA LLEGADO!
                </h3>
                <p className="text-xs text-amber-100 mt-0.5 font-medium">
                  El chofer se encuentra afuera esperándote en la puerta
                </p>
              </div>
            ) : (
              <div className="bg-emerald-600 text-white p-4 text-center">
                <h3 className="font-bold text-sm flex items-center justify-center gap-2">
                  <Car className="w-4 h-4" />
                  {estadoViaje === 'EN_CURSO' ? '¡Estás en viaje!' : '¡Tu remís está asignado!'}
                </h3>
                <p className="text-[11px] text-emerald-100 mt-0.5">
                  {estadoViaje === 'EN_CURSO'
                    ? 'Buen viaje a tu destino'
                    : choferLlegandoAviso
                    ? '📍 ¡El chofer te avisó que está a pocas cuadras llegando!'
                    : 'El chofer se encuentra en camino a tu ubicación'}
                </p>
              </div>
            )}
            
            <div className="p-5 space-y-4">
              
              {/* Información del Chofer y Auto */}
              <div className="flex items-center gap-4">
                {activeViaje.chofer?.fotoUrl ? (
                  <img
                    src={activeViaje.chofer.fotoUrl}
                    alt={activeViaje.chofer.nombre || 'Chofer'}
                    className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow-sm"
                  />
                ) : (
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 font-black text-sm">
                    {activeViaje.chofer?.nombre?.charAt(0) || 'C'}
                  </div>
                )}
                <div className="flex-1">
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                    {activeViaje.chofer
                      ? `${activeViaje.chofer.nombre} ${activeViaje.chofer.apellido || ''}`.trim()
                      : 'Conductor asignado'}
                  </h4>
                  {(activeViaje.vehiculo || activeViaje.chofer?.vehiculo) ? (
                    <div className="flex gap-2 items-center text-xs text-gray-500 dark:text-slate-400 mt-1">
                      <span className="font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-1.5 py-0.5 rounded">
                        {(activeViaje.vehiculo || activeViaje.chofer?.vehiculo).patente}
                      </span>
                      <span>
                        • {(activeViaje.vehiculo || activeViaje.chofer?.vehiculo).marca}{' '}
                        {(activeViaje.vehiculo || activeViaje.chofer?.vehiculo).modelo}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Auto de la agencia</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 block">Total</span>
                  <p className="font-black text-lg text-gray-950 dark:text-white">
                    ${precioTotalClienteLive.toLocaleString('es-AR')}
                  </p>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 block">
                    {activeViaje.metodoPago === 'TRANSFERENCIA' ? 'Transferencia' : 'Efectivo'}
                  </span>
                </div>
              </div>

              {/* Indicador de Espera del Chofer (actualizándose en vivo segundo a segundo) */}
              {(activeViaje.enEspera || segundosEsperaLive > 0 || (activeViaje.costoEspera && activeViaje.costoEspera > 0)) && (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between text-xs animate-pulse-subtle">
                  <div className="flex items-center gap-2">
                    <Clock className={`w-4 h-4 text-amber-600 ${activeViaje.enEspera ? 'animate-spin' : ''}`} />
                    <div>
                      <span className="font-bold text-amber-900 dark:text-amber-200">
                        {activeViaje.enEspera ? '⏱️ Chofer en espera actualmente' : 'Tiempo de espera acumulado'}
                      </span>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300">
                        {activeViaje.enEspera
                          ? `${minutosEsperaCliente}m ${segundosRestantesCliente < 10 ? '0' : ''}${segundosRestantesCliente}s transcurridos`
                          : `${minutosEsperaCliente} min de espera`
                        }
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-amber-950 dark:text-amber-100">
                    +${costoEsperaClienteLive.toLocaleString('es-AR')}
                  </span>
                </div>
              )}

              {/* Botón para agregar parada intermedia durante el viaje */}
              {estadoViaje === 'EN_CURSO' && (
                <button
                  type="button"
                  onClick={() => setIsAddStopModalOpen(true)}
                  className="w-full py-2 px-3 border border-dashed border-amber-400 bg-amber-50/50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-amber-100/50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>¿Bajás a hacer un mandado? Agregar parada intermedia</span>
                </button>
              )}

              {/* Botones de acción y comunicación */}
              <div className="grid grid-cols-4 gap-2">
                {/* 1. Llamar al chofer */}
                {activeViaje.chofer?.telefono ? (
                  <a 
                    href={`tel:${activeViaje.chofer.telefono}`}
                    className="py-2.5 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 font-bold text-gray-700 dark:text-slate-200 text-xs rounded-xl flex flex-col items-center justify-center gap-1 transition-colors"
                    title="Llamar al chofer"
                  >
                    <Phone className="w-4 h-4 text-emerald-600" />
                    <span className="text-[10px]">Llamar</span>
                  </a>
                ) : (
                  <div className="opacity-40 py-2.5 border rounded-xl flex flex-col items-center justify-center">
                    <Phone className="w-4 h-4" />
                    <span className="text-[10px]">Llamar</span>
                  </div>
                )}

                {/* 2. Chat rápido con el chofer */}
                <button
                  type="button"
                  onClick={() => setIsChatOpen(true)}
                  className="relative py-2.5 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 font-bold text-gray-700 dark:text-slate-200 text-xs rounded-xl flex flex-col items-center justify-center gap-1 transition-colors"
                  title="Mensajería rápida"
                >
                  <MessageCircle className="w-4 h-4 text-blue-600" />
                  <span className="text-[10px]">Chat</span>
                  {mensajesChat.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white rounded-full text-[9px] font-black flex items-center justify-center">
                      {mensajesChat.length}
                    </span>
                  )}
                </button>

                {/* 3. Compartir viaje en tiempo real */}
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(true)}
                  className="py-2.5 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 font-bold text-gray-700 dark:text-slate-200 text-xs rounded-xl flex flex-col items-center justify-center gap-1 transition-colors"
                  title="Compartir con familiares"
                >
                  <Share2 className="w-4 h-4 text-purple-600" />
                  <span className="text-[10px]">Compartir</span>
                </button>

                {/* 4. Botón SOS de Emergencia */}
                <button
                  type="button"
                  onClick={() => setIsSosModalOpen(true)}
                  className="py-2.5 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 border border-rose-300 dark:border-rose-900 font-black text-rose-700 dark:text-rose-300 text-xs rounded-xl flex flex-col items-center justify-center gap-1 transition-colors animate-pulse"
                  title="Emergencia SOS"
                >
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span className="text-[10px]">SOS</span>
                </button>
              </div>

              {/* Botón Cancelar (disponible si aún no subió al auto) */}
              {estadoViaje !== 'EN_CURSO' && (
                <button 
                  onClick={() => setIsCancelModalOpen(true)}
                  disabled={isCanceling}
                  className="w-full text-red-500 hover:text-red-700 font-bold text-xs mt-2 py-2 flex items-center justify-center gap-1 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Cancelar viaje</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: CANCELACIÓN CON MOTIVO & AVISO DE 10 CUADRAS */}
      {/* ======================================================== */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border border-gray-200 dark:border-slate-800 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Cancelar viaje</h3>
              </div>
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Banner de regla de 10 cuadras */}
            {activeViaje && ['ACEPTADO', 'EN_CAMINO'].includes(activeViaje.estado) && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 rounded-xl text-xs space-y-1">
                <p className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  Política de proximidad de la agencia
                </p>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  Si el móvil ya se encuentra a menos de 10 cuadras de tu ubicación o esperando en la puerta,
                  se registrará el cobro de la tarifa mínima en compensación al chofer.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                ¿Cuál es el motivo de la cancelación?
              </label>
              <div className="space-y-1.5">
                {MOTIVOS_CANCELACION.map((m) => (
                  <label
                    key={m}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-colors ${
                      motivoCancelacion === m
                        ? 'border-rose-500 bg-rose-50/60 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-bold'
                        : 'border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="motivoCancel"
                      checked={motivoCancelacion === m}
                      onChange={() => setMotivoCancelacion(m)}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span>{m}</span>
                  </label>
                ))}
              </div>

              {motivoCancelacion === 'Otro motivo' && (
                <textarea
                  value={motivoCancelacionCustom}
                  onChange={(e) => setMotivoCancelacionCustom(e.target.value)}
                  placeholder="Por favor cuéntanos brevemente qué sucedió..."
                  rows={2}
                  className="mt-2 w-full p-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-rose-500 text-slate-900 dark:text-white"
                />
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-gray-100"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={confirmarCancelacionViaje}
                disabled={isCanceling}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md"
              >
                {isCanceling ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <span>Confirmar Cancelación</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: CALIFICACIÓN Y RESEÑAS (1 a 5 estrellas) */}
      {/* ======================================================== */}
      {isRatingModalOpen && viajeParaCalificar && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border border-gray-200 dark:border-slate-800 shadow-2xl space-y-4 animate-scale-up">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950/60 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                <Star className="w-6 h-6 fill-amber-500 text-amber-500" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">¡Llegaste a tu destino!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ¿Cómo estuvo tu experiencia con {viajeParaCalificar.chofer?.nombre || 'el conductor'}?
              </p>
            </div>

            {/* Estrellas Chofer */}
            <div className="p-3 bg-gray-50 dark:bg-slate-800/60 rounded-xl space-y-1.5 text-center">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Calificación al Chofer</span>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setEstrellasChofer(star)}
                    className="p-1 transition-transform hover:scale-125"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        star <= estrellasChofer ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Estrellas Vehículo */}
            <div className="p-3 bg-gray-50 dark:bg-slate-800/60 rounded-xl space-y-1.5 text-center">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Estado y Limpieza del Vehículo</span>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setEstrellasVehiculo(star)}
                    className="p-1 transition-transform hover:scale-125"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= estrellasVehiculo ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Tags Predefinidos */}
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1.5">
                ¿Qué destacarías de este viaje?
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PREDEFINED_TAGS.map((tag) => {
                  const selected = tagsSeleccionados.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        if (selected) {
                          setTagsSeleccionados(tagsSeleccionados.filter((t) => t !== tag));
                        } else {
                          setTagsSeleccionados([...tagsSeleccionados, tag]);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                        selected
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200'
                          : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {selected && <Check className="w-3 h-3 inline mr-1 text-emerald-600" />}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comentario opcional */}
            <div>
              <textarea
                value={comentarioCalificacion}
                onChange={(e) => setComentarioCalificacion(e.target.value)}
                placeholder="Comentarios adicionales para control de calidad (opcional)..."
                rows={2}
                className="w-full p-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsRatingModalOpen(false);
                  setViajeParaCalificar(null);
                }}
                className="py-2.5 px-4 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold text-slate-500 hover:bg-gray-100"
              >
                Omitir
              </button>
              <button
                type="button"
                onClick={handleEnviarCalificacion}
                disabled={isEnviandoCalificacion}
                className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md"
              >
                {isEnviandoCalificacion ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <span>Enviar Calificación</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: COMPARTIR VIAJE EN TIEMPO REAL */}
      {/* ======================================================== */}
      {isShareModalOpen && activeViaje && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border border-gray-200 dark:border-slate-800 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-purple-600">
                <Share2 className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Compartir viaje en vivo</h3>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Envía este enlace seguro a tus amigos o familiares para que puedan seguir en vivo el trayecto de tu auto.
            </p>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-slate-700 dark:text-slate-200 truncate flex-1">
                {typeof window !== 'undefined' ? `${window.location.origin}/track/${activeViaje.trackingToken}` : ''}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    navigator.clipboard.writeText(`${window.location.origin}/track/${activeViaje.trackingToken}`);
                    setCopiedShare(true);
                    toast.success('¡Enlace copiado al portapapeles!');
                    setTimeout(() => setCopiedShare(false), 2500);
                  }
                }}
                className="px-2.5 py-1.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 shrink-0"
              >
                {copiedShare ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedShare ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>

            {/* Botón WhatsApp */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `Hola! Te comparto el seguimiento en vivo de mi viaje en Remises Bruno: ${
                  typeof window !== 'undefined' ? `${window.location.origin}/track/${activeViaje.trackingToken}` : ''
                }`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Enviar directo por WhatsApp</span>
            </a>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: BOTÓN DE EMERGENCIA / SOS */}
      {/* ======================================================== */}
      {isSosModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border-2 border-rose-500 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-rose-600">
                <ShieldAlert className="w-6 h-6 animate-bounce" />
                <h3 className="font-black text-base text-rose-600">ASISTENCIA Y SOS DE EMERGENCIA</h3>
              </div>
              <button
                onClick={() => setIsSosModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Si te encuentras ante una situación de peligro, utiliza cualquiera de estos accesos directos inmediatos:
            </p>

            <div className="space-y-2">
              <a
                href="tel:911"
                className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg"
              >
                <Phone className="w-5 h-5" />
                <span>LLAMAR DIRECTO AL 911</span>
              </a>

              {activeViaje?.remiseria?.telefono && (
                <a
                  href={`tel:${activeViaje.remiseria.telefono}`}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2"
                >
                  <Phone className="w-4 h-4" />
                  <span>Llamar a Central de la Remisería ({activeViaje.remiseria.telefono})</span>
                </a>
              )}

              <button
                type="button"
                onClick={handleEmitirAlertaSos}
                disabled={isSendingSos}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md"
              >
                {isSendingSos ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4" />
                    <span>Emitir Alerta SOS con mis Coordenadas a la Central</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: CHAT RÁPIDO CON EL CHOFER */}
      {/* ======================================================== */}
      {isChatOpen && activeViaje && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full h-[32rem] flex flex-col border border-gray-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scale-up">
            
            {/* Header del Chat */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">
                  {activeViaje.chofer?.nombre?.charAt(0) || 'C'}
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                    {activeViaje.chofer?.nombre || 'Chofer Asignado'}
                  </h4>
                  <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    En línea
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mensajes rápidos de 1 toque */}
            <div className="p-2 bg-gray-50 dark:bg-slate-800/40 border-b border-gray-100 dark:border-slate-800 flex gap-1.5 overflow-x-auto no-scrollbar">
              {PREDEFINED_QUICK_MESSAGES.map((msg) => (
                <button
                  key={msg}
                  type="button"
                  onClick={() => handleEnviarMensaje(msg)}
                  disabled={isSendingChat}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-200 shrink-0 hover:bg-gray-100 active:scale-95 transition-transform"
                >
                  {msg}
                </button>
              ))}
            </div>

            {/* Feed de Mensajes */}
            <div className="flex-1 p-3 overflow-y-auto space-y-2">
              {mensajesChat.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-4">
                  <MessageCircle className="w-8 h-8 opacity-40 mb-1" />
                  <p className="text-xs">No hay mensajes previos</p>
                  <p className="text-[10px] mt-0.5">Usa los mensajes rápidos arriba o escribe un mensaje al chofer</p>
                </div>
              ) : (
                mensajesChat.map((m, idx) => {
                  const isMe = m.remitente === 'CLIENTE';
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <span className="text-[9px] text-slate-400 mb-0.5 px-1">{m.remitenteNombre}</span>
                      <div
                        className={`max-w-[75%] px-3 py-2 rounded-2xl text-xs font-medium ${
                          isMe
                            ? 'bg-primary-600 text-white rounded-br-xs shadow-xs'
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
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleEnviarMensaje();
                }}
                placeholder="Escribe un mensaje..."
                className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-primary-500"
              />
              <button
                type="button"
                onClick={() => handleEnviarMensaje()}
                disabled={isSendingChat || !chatInput.trim()}
                className="p-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl shadow-xs"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 6: AGREGAR PARADA INTERMEDIA EN CURSO */}
      {/* ======================================================== */}
      {isAddStopModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border border-gray-200 dark:border-slate-800 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-amber-600">
                <Plus className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Agregar parada en curso</h3>
              </div>
              <button
                onClick={() => setIsAddStopModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Ingresa la dirección de la parada intermedia. La tarifa del viaje se recalculará dinámicamente y se notificará al chofer.
            </p>

            <div className="relative">
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500">
                  <MapPin className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={nuevaParadaDireccion}
                  onChange={(e) => {
                    setNuevaParadaDireccion(e.target.value);
                    setIsNuevaParadaSelected(false);
                    setNuevaParadaCoords(null);
                  }}
                  placeholder="¿Dónde es la parada? (Ej: Av. Mitre 250)"
                  className="w-full pl-10 pr-9 p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 font-medium placeholder-gray-400"
                  autoFocus
                />
                {isSearchingParada && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-amber-600"></div>
                  </div>
                )}
              </div>

              {/* Lista flotante de sugerencias encontradas desde Maps */}
              {nuevaParadaSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800">
                  {nuevaParadaSuggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setNuevaParadaDireccion(sug.display_name);
                        setNuevaParadaCoords({ lat: parseFloat(sug.lat), lon: parseFloat(sug.lon) });
                        setIsNuevaParadaSelected(true);
                        setNuevaParadaSuggestions([]);
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

              {nuevaParadaCoords && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                  <Check className="w-3.5 h-3.5" />
                  <span>Dirección validada en Maps</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddStopModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAgregarParadaEnCurso}
                disabled={isAddingStop || !nuevaParadaDireccion.trim()}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md"
              >
                {isAddingStop ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <span>Agregar Parada</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
