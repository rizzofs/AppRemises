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
  GraduationCap
} from 'lucide-react';
import { DireccionFrecuente } from '@/types';

// Generador de tono de campana / timbre de llegada (Web Audio API nativo)
function reproducirAlertaLlegada() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;

      // Primer tono
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

      // Segundo tono más alto (campana)
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

  // Vibración háptica en celulares
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200, 100, 300]);
    } catch {
      // ignore
    }
  }
}
import { clienteService, coordinadorDashboardService } from '@/lib/api';
import Link from 'next/link';

export default function ClienteApp() {
  const { user } = useAuth();
  const router = useRouter();

  // Inputs y Autocompletado
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [origenSuggestions, setOrigenSuggestions] = useState<any[]>([]);
  const [destinoSuggestions, setDestinoSuggestions] = useState<any[]>([]);
  const [isOrigenSelected, setIsOrigenSelected] = useState(false);
  const [isDestinoSelected, setIsDestinoSelected] = useState(false);
  
  // Coordenadas
  const [origenCoords, setOrigenCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [destinoCoords, setDestinoCoords] = useState<{ lat: number; lon: number } | null>(null);

  // Estados del Proceso
  const [isCalculando, setIsCalculando] = useState(false);
  const [presupuesto, setPresupuesto] = useState<any>(null);
  const [observaciones, setObservaciones] = useState('');
  
  // Viaje Activo y Polling
  const [activeViaje, setActiveViaje] = useState<any | null>(null);
  const [estadoViaje, setEstadoViaje] = useState<'IDLE' | 'BUSCANDO' | 'ACEPTADO' | 'EN_CAMINO' | 'EN_CURSO'>('IDLE');
  const [isRequesting, setIsRequesting] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

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
      } catch (e) {
        // fallback
      }
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
      } catch (e) {
        // fallback
      }
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

  useEffect(() => {
    activeViajeRef.current = activeViaje;
  }, [activeViaje]);

  const notificarLlegadaChofer = (viajeInfo?: any) => {
    reproducirAlertaLlegada();
    const viajeTarget = viajeInfo || activeViajeRef.current;
    const choferNombre = viajeTarget?.chofer?.nombre || 'El chofer';
    const vehiculo = viajeTarget?.vehiculo || viajeTarget?.chofer?.vehiculo;
    const autoStr = vehiculo ? ` (${vehiculo.marca} ${vehiculo.modelo} - ${vehiculo.patente})` : '';

    toast(
      `🚕 ¡${choferNombre}${autoStr} está en la puerta esperándote!`,
      {
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
          body: `${choferNombre}${autoStr} está esperándote afuera.`,
          icon: '/favicon.ico',
        });
      } catch {
        // ignore
      }
    }
  };

  // Conexión WebSocket para recibir avisos en tiempo real inmediatamente
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
          if (previousEstadoRef.current !== 'EN_CAMINO') {
            notificarLlegadaChofer(data.viaje);
          }
          setEstadoViaje('EN_CAMINO');
          setActiveViaje((prev: any) => ({ ...(prev || {}), estado: 'EN_CAMINO', ...(data.viaje || {}) }));
        } else if (data.estado === 'COMPLETADO') {
          toast.success('¡Viaje finalizado! Gracias por viajar con nosotros.', { duration: 6000 });
          resetRequestState();
        } else if (data.estado === 'CANCELADO') {
          toast.error('El viaje fue cancelado.');
          resetRequestState();
        } else if (data.estado === 'EN_CURSO') {
          setEstadoViaje('EN_CURSO');
          setActiveViaje((prev: any) => ({ ...(prev || {}), estado: 'EN_CURSO' }));
        }
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
    // Buscar si ya tiene un viaje activo en curso y consultar disponibilidad
    buscarViajeActivo();
    cargarDisponibilidad();

    const dispInterval = setInterval(cargarDisponibilidad, 6000);
    return () => clearInterval(dispInterval);
  }, [user, router]);

  // Buscar viaje activo inicial
  const buscarViajeActivo = async () => {
    try {
      const res = await clienteService.getViajes();
      if (res.success && res.data) {
        const activos = res.data.filter((v: any) => 
          ['PENDIENTE', 'ACEPTADO', 'EN_CAMINO', 'EN_CURSO'].includes(v.estado)
        );
        if (activos.length > 0) {
          // Tomar el más reciente
          const viaje = activos[0];
          actualizarEstadoSegunViaje(viaje);
        }
      }
    } catch (error) {
      console.error('Error buscando viajes activos:', error);
    }
  };

  // Ayudante para setear estado según viaje
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

  // Polling del viaje activo cada 5 segundos
  useEffect(() => {
    if (!activeViaje) return;

    const interval = setInterval(async () => {
      try {
        const res = await clienteService.getViajes();
        if (res.success && res.data) {
          const vActualizado = res.data.find((v: any) => v.id === activeViaje.id);
          
          if (!vActualizado) {
            // El viaje desapareció o se limpió
            resetRequestState();
            return;
          }

          if (vActualizado.estado === 'COMPLETADO') {
            toast.success('¡Viaje finalizado! Gracias por viajar con nosotros.', { duration: 6000 });
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
    }, 5000);

    return () => clearInterval(interval);
  }, [activeViaje]);

  // Limpiar estados de pedido de auto
  const resetRequestState = () => {
    setActiveViaje(null);
    setEstadoViaje('IDLE');
    setPresupuesto(null);
    setOrigen('');
    setDestino('');
    setOrigenCoords(null);
    setDestinoCoords(null);
    setIsOrigenSelected(false);
    setIsDestinoSelected(false);
    setObservaciones('');
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
      } catch (err) {
        console.error('Error en geocodificación origen:', err);
      }
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
      } catch (err) {
        console.error('Error en geocodificación destino:', err);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [destino, isDestinoSelected]);

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
    } catch (error) {
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
      const payload: any = {
        origen,
        destino
      };
      if (origenCoords) {
        payload.latitudOrigen = origenCoords.lat;
        payload.longitudOrigen = origenCoords.lon;
      }
      if (destinoCoords) {
        payload.latitudDestino = destinoCoords.lat;
        payload.longitudDestino = destinoCoords.lon;
      }

      const res = await clienteService.calcularPrecio(
        origen,
        destino,
        origenCoords?.lat,
        origenCoords?.lon,
        destinoCoords?.lat,
        destinoCoords?.lon
      );
      
      // Si la API no devolvió coordenadas reales o falló, podemos meter OSRM local o confiar en el backend
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
      const payload = {
        origen,
        destino,
        latitudOrigen: origenCoords?.lat,
        longitudOrigen: origenCoords?.lon,
        latitudDestino: destinoCoords?.lat,
        longitudDestino: destinoCoords?.lon,
        observaciones: observaciones || undefined
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

  const cancelarViaje = async () => {
    if (!activeViaje) return;
    if (!window.confirm('¿Estás seguro de que quieres cancelar el viaje?')) return;

    setIsCanceling(true);
    try {
      const res = await clienteService.cancelarViaje(activeViaje.id);
      if (res.success) {
        toast.success('Viaje cancelado exitosamente');
        resetRequestState();
      } else {
        toast.error(res.message || 'Error al cancelar viaje');
      }
    } catch (error) {
      toast.error('Error al intentar cancelar viaje');
    } finally {
      setIsCanceling(false);
    }
  };

  if (!user) return null;

  return (
    <div className="relative flex flex-col h-[calc(100vh-8rem)] bg-gray-50 dark:bg-slate-950 transition-colors">
      
      {/* MAPA DE FONDO (Usa Google Maps si hay API Key configurada, o el mapa libre sin requerir API Key) */}
      <div className="absolute inset-0 bg-slate-100 dark:bg-slate-950 z-0">
        {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
          <div
            className="w-full h-full bg-cover bg-center opacity-30 dark:opacity-20"
            style={{
              backgroundImage: `url(https://maps.googleapis.com/maps/api/staticmap?center=-34.6037,-58.3816&zoom=13&size=800x600&maptype=roadmap&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY})`,
              filter: 'grayscale(60%) contrast(90%)'
            }}
          ></div>
        ) : (
          <div
            className="w-full h-full opacity-35 dark:opacity-20"
            style={{
              backgroundImage:
                'radial-gradient(#94a3b8 1px, transparent 1px), linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)',
              backgroundSize: '20px 20px, 80px 80px, 80px 80px'
            }}
          ></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-transparent to-white/90 dark:from-slate-950/70 dark:via-transparent dark:to-slate-950/90"></div>
        {estadoViaje === 'IDLE' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-8 text-center select-none pointer-events-none">
            <Compass className="w-16 h-16 mb-2 text-slate-300 dark:text-slate-600 animate-pulse" />
            <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">¿A dónde quieres ir hoy?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mt-1">Ingresa el origen y destino para comenzar tu viaje en remís</p>
          </div>
        )}
      </div>

      {/* CONTROLES SUPERIORES (Ingreso de dirección) */}
      {estadoViaje === 'IDLE' && (
        <div className="z-20 p-4 w-full max-w-lg mx-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-150 dark:border-slate-800 transition-colors">
            <div className="p-4 space-y-4">
              
              {/* Input de Origen */}
              <div className="relative z-20">
                <div className="flex gap-3 items-center">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 transition-colors"
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

              <div className="w-0.5 h-4 bg-gray-200 dark:bg-slate-700 ml-[7px] -my-2"></div>

              {/* Input de Destino */}
              <div className="relative z-10">
                <div className="flex gap-3 items-center">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
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
                      placeholder="¿A dónde quieres ir? (Destino)"
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

              {/* Chips de Lugares Frecuentes / Favoritas */}
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
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200/80 dark:border-slate-700/80 hover:border-primary-500 dark:hover:border-primary-500 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 shrink-0 shadow-2xs transition-all active:scale-95"
                        title={`${dir.alias}: ${dir.direccion}`}
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

          {/* Indicador de Disponibilidad de Vehículos y Tarjeta de Demora Aproximada */}
          {disponibilidad && (
            <div className="mt-3 space-y-2 relative z-0">
              {disponibilidad.hayAutosDisponibles ? (
                <div className="bg-emerald-50/95 dark:bg-emerald-950/70 backdrop-blur-sm border border-emerald-200 dark:border-emerald-800/60 rounded-xl px-4 py-3 shadow-sm flex items-center justify-between transition-colors">
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
                <div className="bg-amber-50/95 dark:bg-amber-950/70 backdrop-blur-sm border border-amber-200 dark:border-amber-800/60 rounded-xl p-3.5 shadow-sm space-y-2 transition-colors">
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
                            ? `Hay ${disponibilidad.autosEnViaje} ${
                                disponibilidad.autosEnViaje === 1 ? 'auto realizando un viaje' : 'autos realizando viajes'
                              }. Tu pedido será asignado apenas se libere una unidad.`
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

      {/* ÁREA INFERIOR (Presupuesto o Estado del Viaje en curso) */}
      <div className="mt-auto z-10 w-full max-w-lg mx-auto p-4 animate-slide-up">
        
        {/* Caso 1: Ingresó origen y destino pero no calculó */}
        {estadoViaje === 'IDLE' && origen && destino && !presupuesto && !isCalculando && (
          <button 
            onClick={calcularPrecio}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl py-4 shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2 text-sm"
          >
            <span>Confirmar Destino</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {/* Caso 2: Calculando */}
        {isCalculando && (
          <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xl text-center space-y-3 transition-colors">
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
                  <span className="text-xxs text-gray-400 dark:text-slate-500 block">Tarifa fija</span>
                </div>
              </div>

              {/* Notas opcionales */}
              <div>
                <label className="block text-xxs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Indicaciones para el chofer</label>
                <input 
                  type="text" 
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Ej: Portón verde, depto B..."
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div className="flex gap-2">
                <div className="flex-1 bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 py-2.5 rounded-xl flex items-center justify-center gap-2 font-semibold text-xs select-none">
                  <CreditCard className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  Pago en Efectivo
                </div>
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-250 dark:border-slate-800 shadow-xl p-6 text-center space-y-4 transition-colors">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 bg-primary-100 dark:bg-primary-950/60 rounded-full animate-ping"></div>
              <div className="relative bg-primary-600 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-lg">
                <Navigation className="w-8 h-8 rotate-45" />
              </div>
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">Buscando conductor...</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Tu solicitud ha sido enviada al coordinador de la remisería</p>
              {disponibilidad && !disponibilidad.hayAutosDisponibles && (
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 rounded-lg text-amber-900 dark:text-amber-200 text-xs font-semibold">
                  <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>
                    Demora estimada: {disponibilidad.demoraMin} a {disponibilidad.demoraMax} min
                  </span>
                </div>
              )}
            </div>
            
            <div className="h-1.5 w-full bg-gray-150 dark:bg-slate-800 rounded-full overflow-hidden mt-6">
              <div className="h-full bg-primary-600 w-1/3 rounded-full animate-pulse-loader"></div>
            </div>

            <button 
              onClick={cancelarViaje}
              disabled={isCanceling}
              className="mt-6 text-red-500 hover:text-red-700 font-bold text-xs flex items-center justify-center mx-auto gap-1 py-2 px-4 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl"
            >
              {isCanceling ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              <span>Cancelar solicitud de viaje</span>
            </button>
          </div>
        )}

        {/* Caso 5: Viaje Aceptado / Chofer en camino */}
        {['ACEPTADO', 'EN_CAMINO', 'EN_CURSO'].includes(estadoViaje) && activeViaje && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-150 dark:border-slate-800 overflow-hidden transition-colors">
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
                <p className="text-xxs text-emerald-100 mt-0.5">
                  {estadoViaje === 'EN_CURSO' ? 'Buen viaje a tu destino' : 'El chofer se encuentra en camino'}
                </p>
              </div>
            )}
            
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-4">
                {activeViaje.chofer?.fotoUrl ? (
                  <img
                    src={activeViaje.chofer.fotoUrl}
                    alt={activeViaje.chofer.nombre || 'Chofer'}
                    className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full object-cover border-2 border-emerald-500 shadow-sm"
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
                  <span className="text-xxs text-gray-400 dark:text-slate-500 block">Total</span>
                  <p className="font-black text-lg text-gray-950 dark:text-white">${activeViaje.precio}</p>
                </div>
              </div>

              {/* Botones de comunicación */}
              <div className="flex gap-2">
                {activeViaje.chofer?.telefono && (
                  <a 
                    href={`tel:${activeViaje.chofer.telefono}`}
                    className="flex-1 py-2.5 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 font-bold text-gray-700 dark:text-slate-200 text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                    <span>Llamar</span>
                  </a>
                )}
                <a 
                  href={`https://wa.me/${activeViaje.chofer?.telefono || ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 font-bold text-gray-700 dark:text-slate-200 text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                  <span>WhatsApp</span>
                </a>
              </div>

              {estadoViaje !== 'EN_CURSO' && (
                <button 
                  onClick={cancelarViaje}
                  disabled={isCanceling}
                  className="w-full text-red-500 hover:text-red-700 font-bold text-xs mt-2 py-2 flex items-center justify-center gap-1 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl"
                >
                  {isCanceling ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>Cancelar viaje</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}