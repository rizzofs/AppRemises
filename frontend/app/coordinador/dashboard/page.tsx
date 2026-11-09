'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { io, Socket } from 'socket.io-client';
import { coordinadorDashboardService, clienteAuthService, choferService, vehiculoService } from '@/lib/api';
import { useAppTracking } from '@/hooks/useAppTracking';
import { 
  Car, 
  Clock, 
  Calendar, 
  MapPin, 
  Plus, 
  Users, 
  AlertCircle,
  Search,
  Filter,
  Bell,
  TrendingUp,
  DollarSign,
  Phone,
  Mail,
  MapPin as LocationIcon,
  AlertTriangle,
  LogOut,
  User,
  Loader2,
  CheckCircle2,
  X,
  PanelRight,
  Zap,
  Sparkles,
  ArrowRight,
  Download,
  Eye,
  RotateCcw,
  FileText,
  XCircle,
  History,
  Volume2,
  VolumeX,
  ArrowLeftRight,
  Printer,
  CloudRain,
  Moon,
  Sun,
  ShieldAlert,
  HelpCircle,
  Check
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

/**
 * Formatea una sugerencia de dirección de Nominatim de forma limpia y concisa.
 * Preserva la altura/número que el usuario haya escrito si la base cartográfica solo tiene la calle.
 */
function formatCleanAddress(sug: any, userInput?: string): { mainText: string; secondaryText: string; fullAddress: string } {
  if (!sug) return { mainText: '', secondaryText: '', fullAddress: '' };

  const addr = sug.address || {};

  // 1. Nombre de la calle principal
  let street = addr.road || addr.pedestrian || addr.street || sug.name || '';
  if (!street && sug.display_name) {
    street = sug.display_name.split(',')[0].trim();
  }

  // 2. Extraer número de puerta: primero de Nominatim, si no del texto que escribió el usuario
  let number = addr.house_number || '';
  if (!number && userInput) {
    const numMatch = userInput.match(/\b\d{1,5}\b/);
    if (numMatch) {
      number = numMatch[0];
    }
  }

  // Verificar si la calle ya incluye el número para no duplicar
  const streetHasNumber = /\b\d{1,5}\b/.test(street);
  const streetWithNumber = streetHasNumber || !number ? street : `${street} ${number}`;

  // 3. Barrio y Ciudad
  const barrio = addr.neighbourhood || addr.suburb || addr.quarter || addr.residential || '';
  const city = addr.city || addr.town || addr.village || addr.municipality || 'Chivilcoy';

  const secondaryParts: string[] = [];
  if (barrio && barrio.toLowerCase() !== city.toLowerCase()) {
    secondaryParts.push(barrio);
  }
  if (city) {
    secondaryParts.push(city);
  }
  const secondaryText = secondaryParts.join(', ');

  // Dirección concisa y amigable para el input
  const fullAddress = city
    ? `${streetWithNumber}, ${city}`
    : streetWithNumber;

  return {
    mainText: streetWithNumber,
    secondaryText,
    fullAddress
  };
}

export default function CoordinadorDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  useAppTracking('COORDINADOR_DASHBOARD_ACCESS');
  
  const [activeTab, setActiveTab] = useState('en-curso');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [choferesConectados, setChoferesConectados] = useState<any[]>([]);
  const [todosLosChoferes, setTodosLosChoferes] = useState<any[]>([]);
  const [todosLosVehiculos, setTodosLosVehiculos] = useState<any[]>([]);

  // 1. Alarma Acústica y Visual en Central para Nuevos Pedidos
  const [sonidoAlarmaHabilitado, setSonidoAlarmaHabilitado] = useState(true);
  const [alertaNuevoViajeBanner, setAlertaNuevoViajeBanner] = useState<any>(null);

  // 2. Carga Ultrarrápida Express (< 5s - Atajo F2)
  const [isExpressModalOpen, setIsExpressModalOpen] = useState(false);
  const [expressData, setExpressData] = useState({
    telefono: '',
    nombre: '',
    apellido: '',
    origen: '',
    destino: '',
    precio: '3500',
    choferId: '',
    observaciones: '',
    prioridad: 'NORMAL' as 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE'
  });
  const [predictiveSuggestions, setPredictiveSuggestions] = useState<any[]>([]);
  const [selectedPredictiveClient, setSelectedPredictiveClient] = useState<any>(null);
  const [creandoViajeExpress, setCreandoViajeExpress] = useState(false);
  const [expressOrigenSuggestions, setExpressOrigenSuggestions] = useState<any[]>([]);
  const [expressDestinoSuggestions, setExpressDestinoSuggestions] = useState<any[]>([]);
  const [isExpressOrigenSelected, setIsExpressOrigenSelected] = useState(false);
  const [isExpressDestinoSelected, setIsExpressDestinoSelected] = useState(false);
  const [expressOrigenCoords, setExpressOrigenCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [expressDestinoCoords, setExpressDestinoCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [buscandoExpressOrigen, setBuscandoExpressOrigen] = useState(false);
  const [buscandoExpressDestino, setBuscandoExpressDestino] = useState(false);
  const [distanciaExpressEstimada, setDistanciaExpressEstimada] = useState<number | null>(null);
  const [calculandoPrecioExpress, setCalculandoPrecioExpress] = useState(false);

  // 4. Reasignación Rápida de Móvil en Caliente (1 clic)
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [viajeAReasignar, setViajeAReasignar] = useState<any>(null);
  const [nuevoChoferIdReasignar, setNuevoChoferIdReasignar] = useState('');
  const [motivoReasignar, setMotivoReasignar] = useState('Desperfecto mecánico / Pinchadura');
  const [otroMotivoReasignar, setOtroMotivoReasignar] = useState('');
  const [reasignandoEnCaliente, setReasignandoEnCaliente] = useState(false);

  // 5. Historial y Auditoría de Cancelaciones
  const [viajesHistorial, setViajesHistorial] = useState<any[]>([]);
  const [subTabHistorial, setSubTabHistorial] = useState<'lista' | 'auditoria'>('lista');
  const [historialFiltroEstado, setHistorialFiltroEstado] = useState<'TODOS' | 'COMPLETADO' | 'CANCELADO'>('TODOS');
  const [historialFiltroFecha, setHistorialFiltroFecha] = useState<'hoy' | 'semana' | 'mes' | 'todos'>('todos');
  const [selectedHistorialViaje, setSelectedHistorialViaje] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [auditoriaData, setAuditoriaData] = useState<any>(null);
  const [loadingAuditoria, setLoadingAuditoria] = useState(false);
  const [filtroCanceladoPor, setFiltroCanceladoPor] = useState<'TODOS' | 'CLIENTE' | 'CHOFER' | 'COORDINADOR'>('TODOS');

  // Modal de Asignación de Auto/Chofer
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedViajeId, setSelectedViajeId] = useState('');
  const [selectedChoferId, setSelectedChoferId] = useState('');
  const [selectedVehiculoId, setSelectedVehiculoId] = useState('');
  const [asignandoViaje, setAsignandoViaje] = useState(false);

  // Despacho Óptimo por Lotes (Batch Matching tipo Uber)
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchResult, setBatchResult] = useState<any>(null);
  const [isLoadingBatch, setIsLoadingBatch] = useState(false);
  const [isApplyingBatch, setIsApplyingBatch] = useState(false);

  const abrirModalLoteOptimo = async () => {
    setIsLoadingBatch(true);
    setIsBatchModalOpen(true);
    try {
      const res = await coordinadorDashboardService.getDespachoOptimo();
      if (res && res.success) {
        setBatchResult(res);
      } else {
        toast.error(res?.message || 'Error al calcular lote de despacho');
      }
    } catch (error) {
      console.error('Error calculando lote:', error);
      toast.error('Error al conectar con el optimizador de despacho');
    } finally {
      setIsLoadingBatch(false);
    }
  };

  const aplicarLoteOptimo = async () => {
    if (!batchResult || !batchResult.matches || batchResult.matches.length === 0) return;
    setIsApplyingBatch(true);
    try {
      const matchesPayload = batchResult.matches.map((m: any) => ({
        viajeId: m.viajeId,
        choferId: m.choferId,
        vehiculoId: m.vehiculoId
      }));

      const res = await coordinadorDashboardService.aplicarDespachoOptimo(matchesPayload);
      if (res && res.success) {
        toast.success(res.message || '¡Lote de viajes despachado con éxito!');
        setIsBatchModalOpen(false);
        setBatchResult(null);
        fetchData();
      } else {
        toast.error(res?.message || 'Error al aplicar las asignaciones');
      }
    } catch (error) {
      console.error('Error aplicando lote:', error);
      toast.error('Error de red al aplicar el lote');
    } finally {
      setIsApplyingBatch(false);
    }
  };

  // Real data state
  const [stats, setStats] = useState({
    viajesEnCurso: 0,
    viajesSinAsignar: 0,
    viajesReservados: 0,
    viajesHistorial: 0,
    choferesDisponibles: 0,
    vehiculosDisponibles: 0,
    tiempoPromedio: '12 min'
  });
  const [viajesEnCurso, setViajesEnCurso] = useState<any[]>([]);
  const [viajesSinAsignar, setViajesSinAsignar] = useState<any[]>([]);
  const [reservas, setReservas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState(1); // 1 = DNI, 2 = Complete details, 3 = Trip details
  const [dniSearch, setDniSearch] = useState('');
  const [buscandoDni, setBuscandoDni] = useState(false);
  
  const [clientData, setClientData] = useState({
    id: '',
    nombre: '',
    apellido: '',
    telefono: '',
    email: '',
    direccion: ''
  });

  const [tripData, setTripData] = useState({
    origen: '',
    destino: '',
    precio: '1500',
    fecha: new Date().toISOString().split('T')[0],
    hora: new Date().toTimeString().slice(0, 5),
    tipoViaje: 'inmediato' as 'inmediato' | 'programado',
    observaciones: '',
    prioridad: 'NORMAL' as 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE'
  });

  const [creandoViaje, setCreandoViaje] = useState(false);
  const [creandoCliente, setCreandoCliente] = useState(false);
  const [distanciaEstimada, setDistanciaEstimada] = useState<number | null>(null);
  const [origenSuggestions, setOrigenSuggestions] = useState<any[]>([]);
  const [destinoSuggestions, setDestinoSuggestions] = useState<any[]>([]);
  const [direccionSuggestions, setDireccionSuggestions] = useState<any[]>([]);
  const [isOrigenSelected, setIsOrigenSelected] = useState(false);
  const [isDestinoSelected, setIsDestinoSelected] = useState(false);
  const [isDireccionSelected, setIsDireccionSelected] = useState(false);
  const [origenCoords, setOrigenCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [destinoCoords, setDestinoCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [frequentAddresses, setFrequentAddresses] = useState<{ origenes: string[]; destinos: string[] }>({
    origenes: [],
    destinos: []
  });

  const fetchData = async () => {
    try {
      // 1. Stats
      const statsRes = await coordinadorDashboardService.getDashboardStats();
      // 2. Viajes en curso
      const enCursoRes = await coordinadorDashboardService.getViajesEnCurso();
      // 3. Viajes sin asignar
      const sinAsignarRes = await coordinadorDashboardService.getViajesSinAsignar();
      // 4. Reservas
      const reservasRes = await coordinadorDashboardService.getViajesReservados();
      // 5. Historial (finalizados y anulados)
      const historialRes = await coordinadorDashboardService.getViajesHistorial();
      // 6. Drivers online
      const choferesRes = await coordinadorDashboardService.getChoferesTiempoReal();
      // 7. Todos los choferes y vehículos de la remisería para asignación manual
      const [allChoferesRes, allVehiculosRes] = await Promise.all([
        choferService.getAll(),
        vehiculoService.getAll()
      ]);

      if (allChoferesRes.success && allChoferesRes.data) {
        setTodosLosChoferes(allChoferesRes.data.filter((c: any) => c.estado === 'ACTIVO'));
      }
      if (allVehiculosRes.success && allVehiculosRes.data) {
        setTodosLosVehiculos(allVehiculosRes.data.filter((v: any) => v.estado === 'ACTIVO'));
      }

      if (statsRes.success && statsRes.data) {
        setStats({
          viajesEnCurso: statsRes.data.viajesEnCurso || 0,
          viajesSinAsignar: statsRes.data.viajesSinAsignar || 0,
          viajesReservados: statsRes.data.reservasActivas || 0,
          viajesHistorial: (statsRes.data.viajesFinalizados || 0) + (statsRes.data.viajesCancelados || 0) || (historialRes.data?.length || 0),
          choferesDisponibles: statsRes.data.totalChoferes || 0,
          vehiculosDisponibles: statsRes.data.totalVehiculos || 0,
          tiempoPromedio: '12 min'
        });
      }

      const mapViaje = (v: any) => {
        const clienteName = v.clienteNombre || (v.cliente ? `${v.cliente.nombre} ${v.cliente.apellido}` : 'S/N');
        const clienteTel = v.clienteTelefono || (v.cliente ? v.cliente.telefono : 'S/N');
        const choferName = v.chofer ? `${v.chofer.nombre} ${v.chofer.apellido}` : 'Sin Asignar';
        const vehObj = v.vehiculo || v.chofer?.vehiculo;
        const vehiculoName = vehObj ? `${vehObj.patente} (${vehObj.marca} ${vehObj.modelo})` : 'Sin Asignar';
        const formattedTime = new Date(v.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const formattedDate = new Date(v.fecha).toLocaleDateString();

        const estadoLabel =
          v.estado === 'ACEPTADO'
            ? 'Auto Asignado'
            : v.estado === 'EN_CAMINO'
            ? 'Chofer en Camino'
            : v.estado === 'EN_CURSO'
            ? 'En Viaje'
            : v.estado === 'COMPLETADO'
            ? 'Finalizado'
            : v.estado === 'CANCELADO'
            ? 'Anulado'
            : v.estado;

        return {
          id: v.id,
          cliente: clienteName,
          telefono: clienteTel,
          origen: v.origen,
          destino: v.destino,
          precio: v.precio,
          observaciones: v.observaciones,
          chofer: choferName,
          vehiculo: vehiculoName,
          estado: estadoLabel,
          estadoRaw: v.estado,
          tiempo: formattedTime,
          prioridad: v.prioridad || 'NORMAL',
          fecha: formattedDate,
          hora: formattedTime,
          tipo: 'Única',
          motivoCancelacion: v.motivoCancelacion,
          canceladoPor: v.canceladoPor,
          costoCancelacion: v.costoCancelacion,
          metodoPago: v.metodoPago,
          pagaCon: v.pagaCon,
          vueltoEstimado: v.vueltoEstimado,
          distanciaKmConPasajero: v.distanciaKmConPasajero,
          distanciaKmSinPasajero: v.distanciaKmSinPasajero,
          rawFecha: v.fecha,
          rawViaje: v
        };
      };

      if (enCursoRes.success && enCursoRes.data) {
        setViajesEnCurso(enCursoRes.data.map(mapViaje));
      }
      if (sinAsignarRes.success && sinAsignarRes.data) {
        setViajesSinAsignar(sinAsignarRes.data.map(mapViaje));
      }
      if (historialRes.success && historialRes.data) {
        setViajesHistorial(historialRes.data.map(mapViaje));
      }
      if (reservasRes.success && reservasRes.data) {
        setReservas(reservasRes.data.map((r: any) => {
          const formattedDate = new Date(r.fechaInicio).toLocaleDateString();
          return {
            id: r.id,
            cliente: r.clienteNombre,
            telefono: r.clienteTelefono,
            origen: r.origen,
            destino: r.destino,
            fecha: formattedDate,
            hora: r.horaInicio,
            tipo: r.tipo === 'PERIODICA' ? 'Periódica' : 'Única'
          };
        }));
      }
      if (choferesRes.success && choferesRes.data) {
        setChoferesConectados(choferesRes.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Reproducción acústica agradable de timbre central para nuevos pedidos
  const reproducirAlarmaNuevoViaje = () => {
    if (!sonidoAlarmaHabilitado) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now); // D5
        osc1.frequency.setValueAtTime(880, now + 0.12); // A5
        osc2.frequency.setValueAtTime(880, now);
        osc2.frequency.setValueAtTime(1174.66, now + 0.12); // D6
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.65);
        osc2.stop(now + 0.65);
      }
    } catch {}
  };

  // Cargar estado de sonido guardado
  useEffect(() => {
    try {
      const soundSaved = localStorage.getItem('coordinador_alarma_sonido');
      if (soundSaved !== null) {
        setSonidoAlarmaHabilitado(soundSaved === 'true');
      }
    } catch {}
  }, []);

  const toggleSonidoAlarma = () => {
    const nextVal = !sonidoAlarmaHabilitado;
    setSonidoAlarmaHabilitado(nextVal);
    try {
      localStorage.setItem('coordinador_alarma_sonido', String(nextVal));
    } catch {}
    if (nextVal) {
      toast.success('🔊 Alarma acústica activada para nuevos pedidos');
      reproducirAlarmaNuevoViaje();
    } else {
      toast('🔇 Alarma acústica silenciada', { icon: '🔕' });
    }
  };

  // Conexión WebSocket para notificaciones sonoras inmediatas (Cancelaciones de clientes y Alertas SOS)
  useEffect(() => {
    const remId = user?.coordinador?.remiseriaId || (user as any)?.remiseriaId;
    if (!remId) return;

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    const socket: Socket = io(socketUrl, {
      transports: ['websocket'],
      withCredentials: true,
    });

    socket.on('connect', () => {
      socket.emit('join_room', { remiseriaId: remId });
    });

    // Alerta sonora inmediata de cancelación de viaje por cliente
    socket.on('viaje_cancelado', (data: any) => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(450, now);
          osc.frequency.setValueAtTime(280, now + 0.15);
          gain.gain.setValueAtTime(0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.45);
        }
      } catch {}

      toast(
        `🚨 ¡Viaje cancelado por cliente!\nMotivo: ${data.motivo || 'No especificado'}\n${
          data.debeAbonarMinimo ? `⚠️ Auto a menos de 10 cuadras: Corresponde viaje mínimo ($${data.costoCancelacion})` : ''
        }`,
        {
          duration: 9000,
          style: { background: '#991b1b', color: '#fff', fontWeight: 'bold' }
        }
      );
      fetchData();
    });

    // Alerta SOS de emergencia en vivo
    socket.on('alerta_sos_recibida', (data: any) => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.linearRampToValueAtTime(1200, now + 0.3);
          osc.frequency.linearRampToValueAtTime(800, now + 0.6);
          gain.gain.setValueAtTime(0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.9);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.9);
        }
      } catch {}

      toast(
        `🚨 ¡ALERTA SOS DE EMERGENCIA!\nPasajero: ${data.clienteNombre} (${data.clienteTelefono})\nViaje ID: #${data.viajeId}`,
        {
          duration: 15000,
          icon: '🚨',
          style: { background: '#7f1d1d', color: '#fff', fontWeight: 'black', fontSize: '14px' }
        }
      );
      fetchData();
    });

    socket.on('nuevo_viaje_recibido', (viaje: any) => {
      reproducirAlarmaNuevoViaje();
      if (viaje) {
        setAlertaNuevoViajeBanner(viaje);
      }
      fetchData();
    });

    socket.on('viaje_estado_actualizado', (data: any) => {
      if (data?.estado && data.estado !== 'PENDIENTE') {
        setAlertaNuevoViajeBanner((prev: any) =>
          prev && (!data.viajeId || prev.id === data.viajeId) ? null : prev
        );
      }
      fetchData();
    });

    socket.on('parada_virtual_actualizada', () => {
      fetchData();
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.coordinador?.remiseriaId, (user as any)?.remiseriaId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Efecto para buscar autocompletado de origen
  useEffect(() => {
    if (isOrigenSelected || !tripData.origen || tripData.origen.length < 3) {
      setOrigenSuggestions([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await coordinadorDashboardService.geocode(tripData.origen);
        if (res.success && res.data) {
          setOrigenSuggestions(res.data);
        }
      } catch (err) {
        console.error('Error fetching geocoding for origen:', err);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [tripData.origen, isOrigenSelected]);

  // Efecto para buscar autocompletado de destino
  useEffect(() => {
    if (isDestinoSelected || !tripData.destino || tripData.destino.length < 3) {
      setDestinoSuggestions([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await coordinadorDashboardService.geocode(tripData.destino);
        if (res.success && res.data) {
          setDestinoSuggestions(res.data);
        }
      } catch (err) {
        console.error('Error fetching geocoding for destino:', err);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [tripData.destino, isDestinoSelected]);

  // Efecto para buscar autocompletado de dirección particular del cliente
  useEffect(() => {
    if (isDireccionSelected || !clientData.direccion || clientData.direccion.length < 3) {
      setDireccionSuggestions([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await coordinadorDashboardService.geocode(clientData.direccion);
        if (res.success && res.data) {
          setDireccionSuggestions(res.data);
        }
      } catch (err) {
        console.error('Error fetching geocoding for direccion:', err);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [clientData.direccion, isDireccionSelected]);

  // Manejador de cálculo de precio cuando cambian origen o destino
  useEffect(() => {
    const calcularPrecioAutomatico = async () => {
      if (tripData.origen && tripData.destino && origenCoords && destinoCoords) {
        try {
          const res = await coordinadorDashboardService.calcularPrecio(
            tripData.origen,
            tripData.destino,
            {
              latOrigen: origenCoords.lat,
              lonOrigen: origenCoords.lon,
              latDestino: destinoCoords.lat,
              lonDestino: destinoCoords.lon
            }
          );
          if (res.success && res.data) {
            const nuevoPrecio = res.data.precio ?? res.data.precioEstimado ?? res.data.precioSugerido;
            if (nuevoPrecio !== undefined && nuevoPrecio !== null) {
              setTripData((prev) => ({ ...prev, precio: nuevoPrecio.toString() }));
            }
            if (res.data.distanciaKm !== undefined) {
              setDistanciaEstimada(res.data.distanciaKm);
            }
          }
        } catch (err) {
          console.error('Error calculando precio automático:', err);
        }
      }
    };

    calcularPrecioAutomatico();
  }, [origenCoords, destinoCoords]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const handleBuscarDni = async () => {
    if (!dniSearch) {
      toast.error('Ingrese un DNI');
      return;
    }
    setBuscandoDni(true);
    try {
      const res = await clienteAuthService.buscarClientePorDni(dniSearch);
      if (res.success && res.data) {
        const c = res.data;
        setClientData({
          id: c.id,
          nombre: c.nombre,
          apellido: c.apellido,
          telefono: c.telefono,
          email: c.email || '',
          direccion: c.direccion || ''
        });

        let origenes: string[] = [];
        let destinos: string[] = [];
        if (c.viajes && Array.isArray(c.viajes)) {
          origenes = Array.from<string>(new Set(c.viajes.map((v: any) => v.origen as string))).slice(0, 3);
          destinos = Array.from<string>(new Set(c.viajes.map((v: any) => v.destino as string))).slice(0, 3);
        }
        setFrequentAddresses({ origenes, destinos });

        toast.success('Cliente encontrado');
        setModalStep(3);
      } else {
        toast('Cliente no registrado. Ingrese los datos para crearlo.', { icon: 'ℹ️' });
        setClientData({
          id: '',
          nombre: '',
          apellido: '',
          telefono: '',
          email: '',
          direccion: ''
        });
        setModalStep(2);
      }
    } catch (err) {
      toast.error('Error al buscar cliente');
    } finally {
      setBuscandoDni(false);
    }
  };

  const handleCrearCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientData.nombre || !clientData.apellido || !clientData.telefono || !dniSearch) {
      toast.error('Complete los datos requeridos');
      return;
    }
    setCreandoCliente(true);
    try {
      const res = await coordinadorDashboardService.createCliente({
        ...clientData,
        dni: dniSearch
      });
      if (res.success && res.data) {
        toast.success('Cliente registrado exitosamente');
        setClientData((prev) => ({ ...prev, id: res.data.id }));
        setModalStep(3);
      } else {
        toast.error(res.message || 'Error al registrar cliente');
      }
    } catch (err) {
      toast.error('Error al registrar cliente');
    } finally {
      setCreandoCliente(false);
    }
  };

  const handleCrearViaje = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripData.origen || !tripData.destino) {
      toast.error('Complete origen y destino');
      return;
    }
    setCreandoViaje(true);
    try {
      const payload = {
        origen: tripData.origen,
        destino: tripData.destino,
        precio: tripData.precio || '1500',
        fecha: tripData.tipoViaje === 'inmediato' 
          ? new Date().toISOString() 
          : new Date(`${tripData.fecha}T${tripData.hora}:00`).toISOString(),
        clienteNombre: `${clientData.nombre} ${clientData.apellido}`,
        clienteTelefono: clientData.telefono,
        clienteEmail: clientData.email || '',
        clienteId: clientData.id || null,
        prioridad: tripData.prioridad,
        observaciones: tripData.observaciones
      };

      const res = await coordinadorDashboardService.createViaje(payload);
      if (res.success) {
        toast.success('Viaje creado exitosamente');
        setIsModalOpen(false);
        setModalStep(1);
        setDniSearch('');
        setClientData({ id: '', nombre: '', apellido: '', telefono: '', email: '', direccion: '' });
        setTripData({
          origen: '',
          destino: '',
          precio: '1500',
          fecha: new Date().toISOString().split('T')[0],
          hora: new Date().toTimeString().slice(0, 5),
          tipoViaje: 'inmediato',
          observaciones: '',
          prioridad: 'NORMAL'
        });
        fetchData();
      } else {
        toast.error(res.message || 'Error al crear viaje');
      }
    } catch (err) {
      toast.error('Error al crear viaje');
    } finally {
      setCreandoViaje(false);
    }
  };

  const choferesParaAsignar = [
    ...choferesConectados.map((c: any) => ({ ...c, isOnline: true })),
    ...todosLosChoferes.filter(
      (c: any) => !choferesConectados.some((conn: any) => conn.id === c.id)
    )
  ];

  const openAssignModalForViaje = (viaje: any) => {
    setSelectedViajeId(viaje.id);
    const defaultChofer = choferesParaAsignar[0];
    if (defaultChofer) {
      setSelectedChoferId(defaultChofer.id);
      setSelectedVehiculoId(defaultChofer.vehiculo?.id || defaultChofer.vehiculoId || '');
    }
    setIsAssignModalOpen(true);
  };

  const openAssignModalForChofer = (chofer: any) => {
    if (viajesSinAsignar.length === 0) {
      toast.error('No hay viajes pendientes sin asignar en este momento');
      return;
    }
    setSelectedChoferId(chofer.id);
    setSelectedVehiculoId(chofer.vehiculo?.id || chofer.vehiculoId || '');
    setSelectedViajeId(viajesSinAsignar[0].id);
    setIsAssignModalOpen(true);
  };

  const handleChoferSelectChange = (choferId: string) => {
    setSelectedChoferId(choferId);
    const found = choferesParaAsignar.find((c: any) => c.id === choferId);
    if (found && (found.vehiculo?.id || found.vehiculoId)) {
      setSelectedVehiculoId(found.vehiculo?.id || found.vehiculoId);
    }
  };

  const handleAsignarViaje = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedViajeId) {
      toast.error('Seleccione el viaje a asignar');
      return;
    }
    if (!selectedChoferId) {
      toast.error('Seleccione un chofer para el viaje');
      return;
    }

    setAsignandoViaje(true);
    try {
      const res = await coordinadorDashboardService.asignarViaje(selectedViajeId, {
        choferId: selectedChoferId,
        vehiculoId: selectedVehiculoId || undefined
      });

      if (res.success) {
        toast.success('¡Auto y chofer asignados exitosamente!');
        setIsAssignModalOpen(false);
        setSelectedViajeId('');
        setSelectedChoferId('');
        setSelectedVehiculoId('');
        fetchData();
      } else {
        toast.error(res.message || 'Error al asignar el auto');
      }
    } catch (error) {
      toast.error('Error al asignar el viaje');
    } finally {
      setAsignandoViaje(false);
    }
  };

  const handleCancelarViaje = async (viajeId: string) => {
    if (!window.confirm('¿Confirmas que deseas cancelar este viaje?')) return;
    try {
      const res = await coordinadorDashboardService.actualizarEstadoViaje(viajeId, 'CANCELADO');
      if (res.success) {
        toast.success('Viaje cancelado correctamente');
        fetchData();
      } else {
        toast.error(res.message || 'Error al cancelar el viaje');
      }
    } catch (error) {
      toast.error('Error al cancelar el viaje');
    }
  };

  const handleRepetirViaje = (viaje: any) => {
    setTripData((prev) => ({
      ...prev,
      origen: viaje.origen || '',
      destino: viaje.destino || '',
      precio: viaje.precio ? viaje.precio.toString() : '1500',
      fecha: new Date().toISOString().split('T')[0],
      hora: new Date().toTimeString().slice(0, 5),
      tipoViaje: 'inmediato',
      observaciones: viaje.observaciones ? `Re-despacho: ${viaje.observaciones}` : 'Re-despacho de viaje previo'
    }));
    const nombreParts = (viaje.cliente || '').split(' ');
    setClientData((prev) => ({
      ...prev,
      nombre: nombreParts[0] || viaje.cliente || '',
      apellido: nombreParts.slice(1).join(' ') || '',
      telefono: viaje.telefono !== 'S/N' ? viaje.telefono : ''
    }));
    setModalStep(3);
    setIsModalOpen(true);
    toast.success('Datos del viaje precargados. Puedes editar y confirmar el nuevo pedido.');
  };

  const abrirDetalleViaje = (viaje: any) => {
    setSelectedHistorialViaje(viaje);
    setIsDetailModalOpen(true);
  };

  const exportarHistorialCSV = () => {
    if (filteredHistorial.length === 0) {
      toast.error('No hay viajes en la lista para exportar');
      return;
    }

    const headers = [
      'ID',
      'Fecha',
      'Hora',
      'Cliente',
      'Telefono',
      'Origen',
      'Destino',
      'Chofer',
      'Vehiculo',
      'Importe',
      'Estado',
      'Medio de Pago',
      'Motivo Cancelacion',
      'Cancelado Por',
      'Costo Cancelacion'
    ];

    const rows = filteredHistorial.map((v) => [
      v.id,
      v.fecha,
      v.hora,
      `"${(v.cliente || '').replace(/"/g, '""')}"`,
      `"${v.telefono || ''}"`,
      `"${(v.origen || '').replace(/"/g, '""')}"`,
      `"${(v.destino || '').replace(/"/g, '""')}"`,
      `"${(v.chofer || '').replace(/"/g, '""')}"`,
      `"${(v.vehiculo || '').replace(/"/g, '""')}"`,
      v.precio || 0,
      v.estadoRaw,
      v.metodoPago || 'EFECTIVO',
      `"${(v.motivoCancelacion || '').replace(/"/g, '""')}"`,
      v.canceladoPor || '',
      v.costoCancelacion || 0
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `viajes_planilla_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Planilla CSV descargada con éxito');
  };

  // 1. Carga ultrarrápida express (< 5s - Atajo F2)
  const abrirModalExpress = () => {
    setExpressData({
      telefono: '',
      nombre: '',
      apellido: '',
      origen: '',
      destino: '',
      precio: '3500',
      choferId: '',
      observaciones: '',
      prioridad: 'NORMAL'
    });
    setPredictiveSuggestions([]);
    setSelectedPredictiveClient(null);
    setExpressOrigenSuggestions([]);
    setExpressDestinoSuggestions([]);
    setIsExpressOrigenSelected(false);
    setIsExpressDestinoSelected(false);
    setExpressOrigenCoords(null);
    setExpressDestinoCoords(null);
    setDistanciaExpressEstimada(null);
    setCalculandoPrecioExpress(false);
    setIsExpressModalOpen(true);
  };

  // Atajo global de teclado para Despacho Express: F2 o Alt+N
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        abrirModalExpress();
      } else if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        abrirModalExpress();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Búsqueda predictiva mientras el despachador tipea en el modal Express
  useEffect(() => {
    const term = expressData.telefono.trim().length >= 3 ? expressData.telefono.trim() : expressData.nombre.trim();
    if (!term || term.length < 2) {
      setPredictiveSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await coordinadorDashboardService.searchClientesPredictivo(term);
        if (res && res.success && res.data) {
          setPredictiveSuggestions(res.data);
        }
      } catch (err) {
        console.error('Error predictive search:', err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [expressData.telefono, expressData.nombre]);

  // Autocompletado de dirección de origen para Despacho Express
  useEffect(() => {
    if (!isExpressModalOpen || isExpressOrigenSelected || !expressData.origen || expressData.origen.trim().length < 3) {
      setExpressOrigenSuggestions([]);
      return;
    }
    setBuscandoExpressOrigen(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await coordinadorDashboardService.geocode(expressData.origen.trim());
        if (res && res.success && res.data) {
          setExpressOrigenSuggestions(res.data);
        }
      } catch (err) {
        console.error('Error fetching geocoding for express origen:', err);
      } finally {
        setBuscandoExpressOrigen(false);
      }
    }, 300);

    return () => {
      clearTimeout(delayDebounceFn);
      setBuscandoExpressOrigen(false);
    };
  }, [expressData.origen, isExpressOrigenSelected, isExpressModalOpen]);

  // Autocompletado de dirección de destino para Despacho Express
  useEffect(() => {
    if (!isExpressModalOpen || isExpressDestinoSelected || !expressData.destino || expressData.destino.trim().length < 3) {
      setExpressDestinoSuggestions([]);
      return;
    }
    setBuscandoExpressDestino(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await coordinadorDashboardService.geocode(expressData.destino.trim());
        if (res && res.success && res.data) {
          setExpressDestinoSuggestions(res.data);
        }
      } catch (err) {
        console.error('Error fetching geocoding for express destino:', err);
      } finally {
        setBuscandoExpressDestino(false);
      }
    }, 300);

    return () => {
      clearTimeout(delayDebounceFn);
      setBuscandoExpressDestino(false);
    };
  }, [expressData.destino, isExpressDestinoSelected, isExpressModalOpen]);

  // Función para calcular o recalcular la tarifa en Despacho Express
  const ejecutarCalculoPrecioExpress = async () => {
    const origenTrim = expressData.origen?.trim();
    const destinoTrim = expressData.destino?.trim();

    if (!origenTrim || origenTrim.length < 3) return;
    if (!destinoTrim || destinoTrim.length < 3) return;

    setCalculandoPrecioExpress(true);
    try {
      const res = await coordinadorDashboardService.calcularPrecio(
        origenTrim,
        destinoTrim,
        {
          latOrigen: expressOrigenCoords?.lat,
          lonOrigen: expressOrigenCoords?.lon,
          latDestino: expressDestinoCoords?.lat,
          lonDestino: expressDestinoCoords?.lon
        }
      );

      if (res && res.success && res.data) {
        const nuevoPrecio = res.data.precio ?? res.data.precioEstimado ?? res.data.precioSugerido;
        if (nuevoPrecio !== undefined && nuevoPrecio !== null) {
          setExpressData((prev) => ({ ...prev, precio: nuevoPrecio.toString() }));
        }
        if (res.data.distanciaKm !== undefined) {
          setDistanciaExpressEstimada(res.data.distanciaKm);
        }
        // Si el backend geocodificó y devolvió coordenadas, las preservamos
        if (res.data.coords?.origen && !expressOrigenCoords) {
          setExpressOrigenCoords(res.data.coords.origen);
        }
        if (res.data.coords?.destino && !expressDestinoCoords) {
          setExpressDestinoCoords(res.data.coords.destino);
        }
      }
    } catch (err) {
      console.error('Error calculando tarifa sugerida express:', err);
    } finally {
      setCalculandoPrecioExpress(false);
    }
  };

  // Cálculo automático de tarifa para Despacho Express
  useEffect(() => {
    if (!isExpressModalOpen) return;
    const origenTrim = expressData.origen?.trim();
    const destinoTrim = expressData.destino?.trim();

    if (!origenTrim || origenTrim.length < 3 || !destinoTrim || destinoTrim.length < 3 || destinoTrim.toLowerCase() === 'a convenir') {
      if (!destinoTrim || destinoTrim.toLowerCase() === 'a convenir') {
        setDistanciaExpressEstimada(null);
      }
      return;
    }

    const timer = setTimeout(() => {
      ejecutarCalculoPrecioExpress();
    }, 450);

    return () => clearTimeout(timer);
  }, [expressData.origen, expressData.destino, expressOrigenCoords, expressDestinoCoords, isExpressModalOpen]);

  const seleccionarClientePredictivo = (c: any) => {
    setSelectedPredictiveClient(c);
    setExpressData((prev) => ({
      ...prev,
      telefono: c.telefono || prev.telefono,
      nombre: c.nombre || prev.nombre,
      apellido: c.apellido || prev.apellido,
      origen: c.origenesHabituales?.[0] || c.direccion || prev.origen,
      destino: c.destinosHabituales?.[0] || prev.destino
    }));
    setIsExpressOrigenSelected(true);
    setIsExpressDestinoSelected(true);
    setExpressOrigenSuggestions([]);
    setExpressDestinoSuggestions([]);
    setPredictiveSuggestions([]);
  };

  const handleSubmitExpress = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!expressData.telefono.trim() || !expressData.origen.trim()) {
      toast.error('Teléfono y origen son obligatorios');
      return;
    }

    setCreandoViajeExpress(true);
    try {
      const res = await coordinadorDashboardService.crearViajeExpress({
        telefono: expressData.telefono,
        nombre: expressData.nombre,
        apellido: expressData.apellido,
        origen: expressData.origen,
        destino: expressData.destino || 'A convenir',
        precio: expressData.precio,
        choferId: expressData.choferId || undefined,
        observaciones: expressData.observaciones,
        prioridad: expressData.prioridad
      });

      if (res && res.success) {
        toast.success(res.message || '¡Viaje express despachado con éxito!');
        setIsExpressModalOpen(false);
        fetchData();
      } else {
        toast.error(res?.message || 'Error al despachar viaje express');
      }
    } catch (err) {
      console.error('Error despachando express:', err);
      toast.error('Error de red al despachar viaje express');
    } finally {
      setCreandoViajeExpress(false);
    }
  };

  // 3. Reasignación rápida en caliente de móvil (1 clic)
  const abrirModalReasignar = (viaje: any) => {
    setViajeAReasignar(viaje);
    setNuevoChoferIdReasignar('');
    setMotivoReasignar('Desperfecto mecánico / Pinchadura');
    setOtroMotivoReasignar('');
    setIsReassignModalOpen(true);
  };

  const handleConfirmarReasignar = async () => {
    if (!viajeAReasignar || !nuevoChoferIdReasignar) {
      toast.error('Debe seleccionar el nuevo chofer de reemplazo');
      return;
    }

    const motivoFinal = motivoReasignar === 'Otro' ? otroMotivoReasignar || 'Reasignación operativa' : motivoReasignar;

    setReasignandoEnCaliente(true);
    try {
      const res = await coordinadorDashboardService.reasignarViaje(viajeAReasignar.id, {
        nuevoChoferId: nuevoChoferIdReasignar,
        motivo: motivoFinal
      });

      if (res && res.success) {
        toast.success(res.message || '¡Viaje transferido exitosamente al nuevo móvil!');
        setIsReassignModalOpen(false);
        setViajeAReasignar(null);
        fetchData();
      } else {
        toast.error(res?.message || 'No se pudo reasignar el viaje');
      }
    } catch (err) {
      console.error('Error reasignando viaje:', err);
      toast.error('Error al reasignar el viaje en caliente');
    } finally {
      setReasignandoEnCaliente(false);
    }
  };

  // 4. Auditoría de cancelaciones y vista imprimible
  const cargarAuditoriaCancelaciones = async () => {
    setLoadingAuditoria(true);
    try {
      const res = await coordinadorDashboardService.getAuditoriaCancelaciones({
        canceladoPor: filtroCanceladoPor !== 'TODOS' ? filtroCanceladoPor : undefined
      });
      if (res && res.success && res.data) {
        setAuditoriaData(res.data);
      }
    } catch (err) {
      console.error('Error cargando auditoría:', err);
    } finally {
      setLoadingAuditoria(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'historial' && subTabHistorial === 'auditoria') {
      cargarAuditoriaCancelaciones();
    }
  }, [activeTab, subTabHistorial, filtroCanceladoPor]);

  const imprimirPlanillaTurno = () => {
    window.print();
  };

  const selectedViajeObj = viajesSinAsignar.find((v) => v.id === selectedViajeId);

  const filterList = (items: any[]) => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter((item: any) => {
      const cliente = (item.cliente || '').toLowerCase();
      const telefono = (item.telefono || '').toLowerCase();
      const origen = (item.origen || '').toLowerCase();
      const destino = (item.destino || '').toLowerCase();
      const chofer = (item.chofer || `${item.nombre || ''} ${item.apellido || ''}`).toLowerCase();
      const vehiculo = (item.vehiculo || (item.vehiculo?.patente ? `${item.vehiculo.patente} ${item.vehiculo.marca} ${item.vehiculo.modelo}` : '')).toLowerCase();
      return (
        cliente.includes(term) ||
        telefono.includes(term) ||
        origen.includes(term) ||
        destino.includes(term) ||
        chofer.includes(term) ||
        vehiculo.includes(term)
      );
    });
  };

  const filterHistorial = (items: any[]) => {
    let filtered = items;

    if (historialFiltroEstado !== 'TODOS') {
      filtered = filtered.filter((v) => v.estadoRaw === historialFiltroEstado);
    }

    if (historialFiltroFecha !== 'todos') {
      const now = new Date();
      filtered = filtered.filter((v) => {
        if (!v.rawFecha) return true;
        const tripDate = new Date(v.rawFecha);
        if (historialFiltroFecha === 'hoy') {
          return tripDate.toDateString() === now.toDateString();
        } else if (historialFiltroFecha === 'semana') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return tripDate >= sevenDaysAgo;
        } else if (historialFiltroFecha === 'mes') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return tripDate >= thirtyDaysAgo;
        }
        return true;
      });
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((item: any) => {
        const cliente = (item.cliente || '').toLowerCase();
        const telefono = (item.telefono || '').toLowerCase();
        const origen = (item.origen || '').toLowerCase();
        const destino = (item.destino || '').toLowerCase();
        const chofer = (item.chofer || '').toLowerCase();
        const vehiculo = (item.vehiculo || '').toLowerCase();
        const motivo = (item.motivoCancelacion || '').toLowerCase();
        const canceladoPor = (item.canceladoPor || '').toLowerCase();
        const id = (item.id || '').toLowerCase();
        return (
          cliente.includes(term) ||
          telefono.includes(term) ||
          origen.includes(term) ||
          destino.includes(term) ||
          chofer.includes(term) ||
          vehiculo.includes(term) ||
          motivo.includes(term) ||
          canceladoPor.includes(term) ||
          id.includes(term)
        );
      });
    }

    return filtered;
  };

  const filteredEnCurso = filterList(viajesEnCurso);
  const filteredSinAsignar = filterList(viajesSinAsignar);
  const filteredReservas = filterList(reservas);
  const filteredChoferes = filterList(choferesConectados);
  const filteredHistorial = filterHistorial(viajesHistorial);

  const historialTotalCount = filteredHistorial.length;
  const historialCompletadosCount = filteredHistorial.filter((v) => v.estadoRaw === 'COMPLETADO').length;
  const historialCanceladosCount = filteredHistorial.filter((v) => v.estadoRaw === 'CANCELADO').length;
  const historialTotalRecaudado = filteredHistorial
    .filter((v) => v.estadoRaw === 'COMPLETADO')
    .reduce((acc, v) => acc + (Number(v.precio) || 0), 0);
  const historialEfectividad =
    historialTotalCount > 0 ? Math.round((historialCompletadosCount / historialTotalCount) * 100) : 100;

  const tabs = [
    { id: 'en-curso', label: 'Viajes en Curso', icon: Car, count: stats.viajesEnCurso },
    { id: 'sin-asignar', label: 'Sin Asignar', icon: Clock, count: stats.viajesSinAsignar, alert: stats.viajesSinAsignar > 0 },
    { id: 'reservados', label: 'Reservados', icon: Calendar, count: stats.viajesReservados },
    { id: 'conectados', label: 'Conectados', icon: Users, count: choferesConectados.length },
    { id: 'historial', label: 'Finalizados / Anulados', icon: CheckCircle2, count: viajesHistorial.length }
  ];

  const hasAlerts = stats.viajesSinAsignar > 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col overflow-x-hidden w-full">
      {/* Header */}
      <div className="bg-white shadow-sm border-b shrink-0">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-3 sm:py-4 gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard Coordinador</h1>
              <p className="text-xs sm:text-sm text-gray-600">Bienvenido, {user?.coordinador?.nombre || user?.email}</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Botón Despacho Express F2 */}
              <button 
                type="button"
                onClick={abrirModalExpress}
                className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg flex items-center space-x-1.5 text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
                title="Carga ultrarrápida express para pedidos telefónicos (< 5s). Atajo: Tecla F2"
              >
                <Zap className="h-4 w-4 fill-current text-yellow-200" />
                <span>⚡ Despacho Express (F2)</span>
              </button>

              {/* Botón Silenciar/Activar Alarma de Despacho */}
              <button
                type="button"
                onClick={toggleSonidoAlarma}
                className={`p-2 rounded-lg transition-colors border ${
                  sonidoAlarmaHabilitado
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                    : 'text-gray-400 bg-gray-100 border-gray-200 hover:bg-gray-200'
                }`}
                title={sonidoAlarmaHabilitado ? '🔊 Alarma acústica activada (clic para silenciar)' : '🔇 Alarma acústica silenciada (clic para activar sonido)'}
              >
                {sonidoAlarmaHabilitado ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>

              {/* Botón Nuevo Viaje Rápido */}
              <button 
                type="button"
                onClick={() => {
                  setModalStep(1);
                  setIsModalOpen(true);
                }}
                className="bg-green-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg flex items-center space-x-1.5 hover:bg-green-700 transition-colors text-xs sm:text-sm font-semibold shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Nuevo Viaje</span>
              </button>

              {/* Cierre de Caja */}
              <Link 
                href="/coordinador/cierre"
                className="bg-emerald-600 text-white px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg flex items-center space-x-1.5 hover:bg-emerald-700 transition-colors text-xs sm:text-sm font-medium"
              >
                <DollarSign className="h-4 w-4" />
                <span className="hidden md:inline">Cierre de Caja Chofer</span>
                <span className="md:hidden">Caja</span>
              </Link>

              {/* Mapa en tiempo real */}
              <Link 
                href="/coordinador/mapa"
                className="bg-blue-600 text-white px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg flex items-center space-x-1.5 hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium"
              >
                <MapPin className="h-4 w-4" />
                <span className="hidden md:inline">Ver Mapa</span>
                <span className="md:hidden">Mapa</span>
              </Link>

              {/* Toggle Sidebar en Desktop */}
              <button
                type="button"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                title={isSidebarOpen ? "Ocultar panel lateral" : "Mostrar panel de acciones"}
                className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 text-xs sm:text-sm font-medium transition-colors"
              >
                <PanelRight className="h-4 w-4 text-gray-500" />
                <span>{isSidebarOpen ? 'Ocultar Lateral' : 'Panel Rápido'}</span>
              </button>

              {/* Cerrar sesión */}
              <button 
                type="button"
                onClick={handleLogout}
                className="bg-red-600 text-white px-3 py-1.5 sm:py-2 rounded-lg flex items-center space-x-1 hover:bg-red-700 transition-colors text-xs sm:text-sm font-medium"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Banner de Notificación y Alerta Visual de Nuevo Pedido Entrante */}
      {alertaNuevoViajeBanner && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-3 sm:p-4 shadow-lg shrink-0 border-b-2 border-orange-700 animate-in slide-in-from-top-3 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-3">
              <span className="p-2 bg-white/20 rounded-full animate-bounce shrink-0">
                <Bell className="h-5 w-5 text-white" />
              </span>
              <div>
                <p className="font-extrabold text-sm sm:text-base flex items-center space-x-2">
                  <span>🚨 ¡NUEVO PEDIDO ENTRANTE!</span>
                  <span className="bg-black/25 text-xs px-2 py-0.5 rounded font-mono">
                    #{alertaNuevoViajeBanner.id ? alertaNuevoViajeBanner.id.slice(-6) : 'NUEVO'}
                  </span>
                </p>
                <p className="text-xs text-amber-100 mt-0.5">
                  <strong>Pasajero:</strong> {alertaNuevoViajeBanner.clienteNombre || alertaNuevoViajeBanner.cliente || 'Pasajero'} ({alertaNuevoViajeBanner.clienteTelefono || alertaNuevoViajeBanner.telefono || 'Sin Tel'}) • <strong>Origen:</strong> {alertaNuevoViajeBanner.origen} ➔ <strong>Destino:</strong> {alertaNuevoViajeBanner.destino}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('sin-asignar');
                  openAssignModalForViaje(alertaNuevoViajeBanner);
                  setAlertaNuevoViajeBanner(null);
                }}
                className="bg-white text-orange-800 hover:bg-amber-50 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-md transition-all hover:scale-105 cursor-pointer flex items-center space-x-1"
              >
                <Car className="h-3.5 w-3.5" />
                <span>Asignar Móvil Inmediato</span>
              </button>
              <button
                type="button"
                onClick={() => setAlertaNuevoViajeBanner(null)}
                className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10"
                title="Cerrar aviso"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alerta de viajes sin asignar */}
      {hasAlerts && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 sm:p-4 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-900">
                  ¡Atención! Tienes {stats.viajesSinAsignar} viaje{stats.viajesSinAsignar > 1 ? 's' : ''} sin asignar
                </p>
                <p className="text-xs text-red-700">
                  Asigna choferes y vehículos lo antes posible para evitar retrasos
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
              <button 
                type="button"
                onClick={abrirModalLoteOptimo}
                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow transition-all hover:scale-105 cursor-pointer"
              >
                <Zap className="h-3.5 w-3.5 fill-current" />
                <span>Despacho Óptimo (Lote)</span>
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('sin-asignar')}
                className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors"
              >
                Ver Viajes
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row min-w-0 min-h-0 w-full overflow-hidden">
        {/* Panel principal - Tablas */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto">
          {/* Estadísticas rápidas */}
          <div className="bg-white shadow-sm border-b p-3 sm:p-4 shrink-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
              <div className="text-center p-2 rounded-lg bg-blue-50/40 border border-blue-100/50">
                <div className="text-xl sm:text-2xl font-bold text-blue-600">{stats.viajesEnCurso}</div>
                <div className="text-xs sm:text-sm text-gray-600">En Curso</div>
              </div>
              <div className={`text-center p-2 rounded-lg border ${hasAlerts ? 'bg-red-50 border-red-200' : 'bg-amber-50/40 border-amber-100/50'}`}>
                <div className={`text-xl sm:text-2xl font-bold flex items-center justify-center gap-1 ${hasAlerts ? 'text-red-600' : 'text-yellow-600'}`}>
                  <span>{stats.viajesSinAsignar}</span>
                  {hasAlerts && (
                    <span className="inline-block animate-pulse">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    </span>
                  )}
                </div>
                <div className="text-xs sm:text-sm text-gray-600">Sin Asignar</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-green-50/40 border border-green-100/50">
                <div className="text-xl sm:text-2xl font-bold text-green-600">{stats.choferesDisponibles}</div>
                <div className="text-xs sm:text-sm text-gray-600">Choferes</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-purple-50/40 border border-purple-100/50">
                <div className="text-xl sm:text-2xl font-bold text-purple-600">{stats.vehiculosDisponibles}</div>
                <div className="text-xs sm:text-sm text-gray-600">Vehículos</div>
              </div>
            </div>
          </div>

          {/* Barra de búsqueda */}
          <div className="bg-white shadow-sm border-b p-3 sm:p-4 shrink-0">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Buscar por cliente, teléfono, chofer, dirección..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button 
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2">
                <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white">
                  <option>Hoy</option>
                  <option>Esta semana</option>
                  <option>Este mes</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tabs de navegación */}
          <div className="bg-white shadow-sm border-b shrink-0">
            <nav className="flex space-x-2 sm:space-x-6 px-3 sm:px-6 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-3 px-2 border-b-2 font-medium text-xs sm:text-sm flex items-center space-x-1.5 shrink-0 transition-colors relative ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 font-bold'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } ${tab.alert ? 'bg-red-50/50' : ''}`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  <span className={`py-0.5 px-2 rounded-full text-xs font-semibold ${
                    tab.alert 
                      ? 'bg-red-100 text-red-900 animate-pulse' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          {/* Contenido de las tablas */}
          <div className="flex-1 p-3 sm:p-5 lg:p-6 w-full min-w-0">
            {activeTab === 'en-curso' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Viajes en Curso ({filteredEnCurso.length})</h3>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm divide-y divide-gray-200 table-auto lg:table-fixed">
                      <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-3 sm:px-4 py-3 w-36 lg:w-[15%]">Cliente</th>
                          <th className="px-3 sm:px-4 py-3 min-w-[130px] lg:w-[22%]">Origen</th>
                          <th className="px-3 sm:px-4 py-3 min-w-[130px] lg:w-[22%]">Destino</th>
                          <th className="px-3 sm:px-4 py-3 w-32 lg:w-[13%]">Chofer</th>
                          <th className="px-3 sm:px-4 py-3 w-32 lg:w-[12%]">Vehículo</th>
                          <th className="px-3 sm:px-4 py-3 w-28 lg:w-[8%]">Estado</th>
                          <th className="px-3 sm:px-4 py-3 w-20 lg:w-[6%]">Hora</th>
                          <th className="px-3 sm:px-4 py-3 w-36 lg:w-[12%] text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredEnCurso.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                              <Car className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                              <p className="font-semibold text-gray-700">No hay viajes en curso en este momento</p>
                              <p className="text-xs text-gray-400 mt-1">Los viajes aceptados por los choferes aparecerán aquí.</p>
                            </td>
                          </tr>
                        ) : (
                          filteredEnCurso.map((viaje) => (
                            <tr key={viaje.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-3 sm:px-4 py-3">
                                <div className="font-medium text-gray-900 text-xs sm:text-sm truncate" title={viaje.cliente}>
                                  {viaje.cliente}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center space-x-1.5 mt-0.5">
                                  <span className="truncate">{viaje.telefono}</span>
                                  {viaje.telefono && viaje.telefono !== 'S/N' && (
                                    <a
                                      href={`https://wa.me/${viaje.telefono.replace(/\D/g, '')}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-emerald-600 hover:text-emerald-800 text-[10px] font-bold"
                                      title="Enviar WhatsApp"
                                    >
                                      WA
                                    </a>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 sm:px-4 py-3">
                                <div className="text-xs sm:text-sm text-gray-900 line-clamp-2 leading-snug" title={viaje.origen}>
                                  <LocationIcon className="h-3.5 w-3.5 mr-1 inline text-blue-500 shrink-0" />
                                  <span>{viaje.origen}</span>
                                </div>
                              </td>
                              <td className="px-3 sm:px-4 py-3">
                                <div className="text-xs sm:text-sm text-gray-900 line-clamp-2 leading-snug" title={viaje.destino}>
                                  <LocationIcon className="h-3.5 w-3.5 mr-1 inline text-emerald-500 shrink-0" />
                                  <span>{viaje.destino}</span>
                                </div>
                              </td>
                              <td className="px-3 sm:px-4 py-3">
                                <div className="text-xs sm:text-sm font-medium text-gray-900 truncate" title={viaje.chofer}>
                                  {viaje.chofer}
                                </div>
                              </td>
                              <td className="px-3 sm:px-4 py-3">
                                <div className="text-xs font-semibold text-gray-900 truncate" title={viaje.vehiculo}>
                                  {viaje.vehiculo}
                                </div>
                              </td>
                              <td className="px-3 sm:px-4 py-3">
                                <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800 whitespace-nowrap">
                                  {viaje.estado}
                                </span>
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-xs font-mono text-gray-600 whitespace-nowrap">
                                {viaje.tiempo}
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-right">
                                <div className="flex flex-wrap gap-1.5 justify-end items-center">
                                  {/* Ver en Mapa */}
                                  <Link
                                    href="/coordinador/mapa"
                                    className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-semibold border border-blue-200 transition-colors inline-flex items-center space-x-1"
                                    title="Rastrear chofer en el mapa en tiempo real"
                                  >
                                    <MapPin className="h-3 w-3" />
                                    <span>Mapa</span>
                                  </Link>

                                  {/* Reasignar Móvil en Caliente */}
                                  <button
                                    type="button"
                                    onClick={() => abrirModalReasignar(viaje)}
                                    className="px-2 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded text-xs font-semibold border border-amber-200 transition-colors inline-flex items-center space-x-1"
                                    title="Reasignar en caliente a otro móvil por desperfecto mecánico, pinchadura o demora"
                                  >
                                    <ArrowLeftRight className="h-3 w-3" />
                                    <span>Reasignar</span>
                                  </button>

                                  {/* Llamar Cliente */}
                                  {viaje.telefono && viaje.telefono !== 'S/N' && (
                                    <a
                                      href={`tel:${viaje.telefono}`}
                                      className="p-1 text-gray-500 hover:text-green-600 rounded hover:bg-green-50 transition-colors border border-gray-200 hover:border-green-300"
                                      title={`Llamar cliente (${viaje.telefono})`}
                                    >
                                      <Phone className="h-3.5 w-3.5" />
                                    </a>
                                  )}

                                  {/* Cancelar Viaje */}
                                  <button
                                    type="button"
                                    onClick={() => handleCancelarViaje(viaje.id)}
                                    className="px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded text-xs font-semibold border border-red-200 transition-colors inline-flex items-center space-x-1"
                                    title="Cancelar viaje (por solicitud del cliente o fuerza mayor)"
                                  >
                                    <X className="h-3 w-3" />
                                    <span>Cancelar</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'sin-asignar' && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-semibold text-gray-900">Viajes Sin Asignar ({filteredSinAsignar.length})</h3>
                    {hasAlerts && (
                      <div className="flex items-center space-x-1.5 bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-medium">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>Requiere atención</span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={abrirModalLoteOptimo}
                    className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 shadow-md transition-all hover:scale-[1.02] cursor-pointer"
                  >
                    <Zap className="h-4 w-4 fill-current" />
                    <span>Despacho Óptimo por Lotes (AI / Uber)</span>
                  </button>
                </div>
                <div className="bg-white rounded-xl shadow-sm border-2 border-red-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm divide-y divide-gray-200 table-auto lg:table-fixed">
                      <thead className="bg-red-50 text-xs font-semibold text-red-700 uppercase tracking-wider">
                        <tr>
                          <th className="px-3 sm:px-4 py-3 w-40 lg:w-[18%]">Cliente</th>
                          <th className="px-3 sm:px-4 py-3 min-w-[140px] lg:w-[25%]">Origen</th>
                          <th className="px-3 sm:px-4 py-3 min-w-[140px] lg:w-[25%]">Destino</th>
                          <th className="px-3 sm:px-4 py-3 w-24 lg:w-[12%]">Prioridad</th>
                          <th className="px-3 sm:px-4 py-3 w-20 lg:w-[8%]">Tiempo</th>
                          <th className="px-3 sm:px-4 py-3 w-32 lg:w-[12%] text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredSinAsignar.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                              <p className="font-semibold text-gray-700">¡Todo al día! No hay viajes pendientes de asignación</p>
                              <p className="text-xs text-gray-400 mt-1">Todos los pedidos tienen móvil asignado o han concluido.</p>
                            </td>
                          </tr>
                        ) : (
                          filteredSinAsignar.map((viaje) => (
                            <tr key={viaje.id} className="hover:bg-red-50/30 transition-colors">
                              <td className="px-3 sm:px-4 py-3">
                                <div className="font-medium text-gray-900 text-xs sm:text-sm truncate" title={viaje.cliente}>
                                  {viaje.cliente}
                                </div>
                                <div className="text-xs text-gray-500 truncate mt-0.5">{viaje.telefono}</div>
                              </td>
                              <td className="px-3 sm:px-4 py-3">
                                <div className="text-xs sm:text-sm text-gray-900 line-clamp-2 leading-snug" title={viaje.origen}>
                                  <LocationIcon className="h-3.5 w-3.5 mr-1 inline text-blue-500 shrink-0" />
                                  <span>{viaje.origen}</span>
                                </div>
                              </td>
                              <td className="px-3 sm:px-4 py-3">
                                <div className="text-xs sm:text-sm text-gray-900 line-clamp-2 leading-snug" title={viaje.destino}>
                                  <LocationIcon className="h-3.5 w-3.5 mr-1 inline text-emerald-500 shrink-0" />
                                  <span>{viaje.destino}</span>
                                </div>
                              </td>
                              <td className="px-3 sm:px-4 py-3">
                                <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                                  viaje.prioridad === 'URGENTE' 
                                    ? 'bg-red-100 text-red-800 animate-pulse'
                                    : viaje.prioridad === 'ALTA'
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {viaje.prioridad}
                                </span>
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-xs font-mono text-gray-600 whitespace-nowrap">
                                {viaje.tiempo}
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-right">
                                {viaje.chofer ? (
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 animate-pulse">
                                      <Clock className="w-3 h-3 mr-1" />
                                      {viaje.chofer} (Esperando aceptación)
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => openAssignModalForViaje(viaje)}
                                      className="text-[11px] text-gray-500 hover:text-gray-800 underline cursor-pointer"
                                    >
                                      Reasignar otro móvil
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openAssignModalForViaje(viaje)}
                                    className="bg-red-600 hover:bg-red-700 text-white px-2.5 sm:px-3 py-1.5 rounded-lg font-semibold text-xs shadow-sm transition-colors inline-flex items-center space-x-1"
                                  >
                                    <Car className="h-3.5 w-3.5" />
                                    <span>Asignar Auto</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'reservados' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Viajes Reservados ({filteredReservas.length})</h3>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm divide-y divide-gray-200 table-auto lg:table-fixed">
                      <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-3 sm:px-4 py-3 w-40 lg:w-[20%]">Cliente</th>
                          <th className="px-3 sm:px-4 py-3 min-w-[140px] lg:w-[25%]">Origen</th>
                          <th className="px-3 sm:px-4 py-3 min-w-[140px] lg:w-[25%]">Destino</th>
                          <th className="px-3 sm:px-4 py-3 w-28 lg:w-[15%]">Fecha</th>
                          <th className="px-3 sm:px-4 py-3 w-20 lg:w-[8%]">Hora</th>
                          <th className="px-3 sm:px-4 py-3 w-24 lg:w-[7%]">Tipo</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredReservas.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                              <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                              <p className="font-semibold text-gray-700">No hay reservas programadas</p>
                              <p className="text-xs text-gray-400 mt-1">Los viajes agendados con anticipación aparecerán aquí.</p>
                            </td>
                          </tr>
                        ) : (
                          filteredReservas.map((reserva) => (
                            <tr key={reserva.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-3 sm:px-4 py-3 font-medium text-gray-900 text-xs sm:text-sm">
                                <div>{reserva.cliente}</div>
                                <div className="text-xs text-gray-500">{reserva.telefono}</div>
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-900">{reserva.origen}</td>
                              <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-900">{reserva.destino}</td>
                              <td className="px-3 sm:px-4 py-3 text-xs text-gray-600">{reserva.fecha}</td>
                              <td className="px-3 sm:px-4 py-3 text-xs font-mono text-gray-600">{reserva.hora}</td>
                              <td className="px-3 sm:px-4 py-3">
                                <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                  {reserva.tipo}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'conectados' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Choferes Conectados ({filteredChoferes.length})</h3>
                </div>
                {filteredChoferes.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
                    <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="font-semibold text-gray-700">No hay choferes conectados en este momento</p>
                    <p className="text-xs text-gray-400 mt-1">Cuando los choferes inicien sesión en su app, aparecerán listados aquí.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredChoferes.map((chofer) => (
                      <div key={chofer.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-bold text-gray-900 text-sm">
                            {chofer.nombre} {chofer.apellido}
                          </div>
                          <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                            chofer.estado === 'disponible' 
                              ? 'bg-green-100 text-green-800' 
                              : chofer.estado === 'en_viaje'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {chofer.estado === 'en_viaje'
                              ? 'En Viaje'
                              : chofer.estado === 'disponible'
                              ? 'Disponible'
                              : chofer.estado === 'en_pausa'
                              ? 'En Pausa'
                              : chofer.estado || 'Conectado'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 space-y-1 mb-3">
                          <div className="flex items-center space-x-1">
                            <Car className="h-3.5 w-3.5 text-gray-400" />
                            <span>{chofer.vehiculo ? `${chofer.vehiculo.marca} ${chofer.vehiculo.modelo} (${chofer.vehiculo.patente})` : 'Auto Propio'}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Phone className="h-3.5 w-3.5 text-gray-400" />
                            <span>{chofer.telefono}</span>
                          </div>
                          {chofer.estado === 'en_viaje' ? (
                            <div className="inline-flex items-center text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded mt-1">
                              🚕 En viaje con pasajero / yendo al origen
                            </div>
                          ) : chofer.enParadaVirtual ? (
                            <div className="inline-flex items-center text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded mt-1">
                              📍 Esperando en Parada Base (FIFO)
                            </div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => openAssignModalForChofer(chofer)}
                          disabled={viajesSinAsignar.length === 0 || chofer.estado === 'en_viaje'}
                          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center space-x-1.5"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>{chofer.estado === 'en_viaje' ? 'Móvil Ocupado en Viaje' : 'Asignar Viaje Pendiente'}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'historial' && (
              <div>
                {/* Header de la pestaña con filtros y botones */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                      <span>Viajes Finalizados y Anulados</span>
                      <span className="text-sm font-semibold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
                        {historialTotalCount} {historialTotalCount === 1 ? 'viaje' : 'viajes'}
                      </span>
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Auditoría operativa de viajes completados y cancelaciones de la agencia.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Switcher de Sub-pestaña */}
                    <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
                      <button
                        type="button"
                        onClick={() => setSubTabHistorial('lista')}
                        className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                          subTabHistorial === 'lista'
                            ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        📋 Planilla de Viajes
                      </button>
                      <button
                        type="button"
                        onClick={() => setSubTabHistorial('auditoria')}
                        className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center space-x-1 ${
                          subTabHistorial === 'auditoria'
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'text-rose-700 hover:bg-rose-50'
                        }`}
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                        <span>Auditoría Cancelaciones</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        fetchData();
                        toast.success('Historial actualizado');
                      }}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors border border-gray-200"
                      title="Refrescar datos del historial"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Actualizar</span>
                    </button>

                    <button
                      type="button"
                      onClick={imprimirPlanillaTurno}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors shadow-sm"
                      title="Imprimir planilla física del turno para archivo de la remisería"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>Imprimir Planilla</span>
                    </button>

                    <button
                      type="button"
                      onClick={exportarHistorialCSV}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors shadow-sm"
                      title="Descargar listado en planilla CSV/Excel"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Exportar CSV</span>
                    </button>
                  </div>
                </div>

                {subTabHistorial === 'lista' ? (
                  <>
                    {/* Tarjetas resumen KPI */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                      <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-sm bg-gradient-to-br from-white to-emerald-50/40">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-emerald-800">Finalizados</span>
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="text-2xl font-bold text-emerald-700 mt-1">
                          {historialCompletadosCount}
                        </div>
                        <p className="text-[11px] font-medium text-emerald-600 mt-0.5">
                          ${historialTotalRecaudado.toLocaleString()} facturado
                        </p>
                      </div>

                      <div className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-sm bg-gradient-to-br from-white to-rose-50/40">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-rose-800">Anulados</span>
                          <XCircle className="h-4 w-4 text-rose-600" />
                        </div>
                        <div className="text-2xl font-bold text-rose-700 mt-1">
                          {historialCanceladosCount}
                        </div>
                        <p className="text-[11px] font-medium text-rose-600 mt-0.5">
                          {historialTotalCount > 0 ? Math.round((historialCanceladosCount / historialTotalCount) * 100) : 0}% cancelaciones
                        </p>
                      </div>

                      <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-sm bg-gradient-to-br from-white to-blue-50/40">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-blue-800">Efectividad</span>
                          <TrendingUp className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="text-2xl font-bold text-blue-700 mt-1">
                          {historialEfectividad}%
                        </div>
                        <p className="text-[11px] font-medium text-blue-600 mt-0.5">
                          Viajes concretados
                        </p>
                      </div>

                      <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm bg-gradient-to-br from-white to-gray-50">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-700">Total Período</span>
                          <History className="h-4 w-4 text-gray-500" />
                        </div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">
                          {historialTotalCount}
                        </div>
                        <p className="text-[11px] font-medium text-gray-500 mt-0.5">
                          Procesados en la vista
                        </p>
                      </div>
                    </div>

                    {/* Subfiltros de Estado y Rango de Fecha */}
                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      {/* Filtro por Estado */}
                      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
                        <span className="text-xs font-semibold text-gray-500 mr-1 shrink-0">Estado:</span>
                        <button
                          type="button"
                          onClick={() => setHistorialFiltroEstado('TODOS')}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                            historialFiltroEstado === 'TODOS'
                              ? 'bg-gray-900 text-white shadow-sm'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Todos ({viajesHistorial.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistorialFiltroEstado('COMPLETADO')}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 shrink-0 ${
                            historialFiltroEstado === 'COMPLETADO'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Finalizados ({viajesHistorial.filter((v) => v.estadoRaw === 'COMPLETADO').length})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistorialFiltroEstado('CANCELADO')}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 shrink-0 ${
                            historialFiltroEstado === 'CANCELADO'
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                          }`}
                        >
                          <XCircle className="h-3 w-3" />
                          <span>Anulados ({viajesHistorial.filter((v) => v.estadoRaw === 'CANCELADO').length})</span>
                        </button>
                      </div>

                      {/* Filtro por Período de Fecha */}
                      <div className="flex items-center space-x-1 overflow-x-auto">
                        <span className="text-xs font-semibold text-gray-500 mr-1 shrink-0">Fecha:</span>
                        {(
                          [
                            { id: 'hoy', label: 'Hoy' },
                            { id: 'semana', label: '7 días' },
                            { id: 'mes', label: 'Este mes' },
                            { id: 'todos', label: 'Histórico' }
                          ] as const
                        ).map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setHistorialFiltroFecha(f.id)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors shrink-0 ${
                              historialFiltroFecha === f.id
                                ? 'bg-blue-600 text-white font-bold'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tabla de Viajes Finalizados y Anulados */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm divide-y divide-gray-200 table-auto">
                          <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <tr>
                              <th className="px-3 sm:px-4 py-3 min-w-[95px] w-24">Fecha / Hora</th>
                              <th className="px-3 sm:px-4 py-3 min-w-[130px] w-36">Cliente</th>
                              <th className="px-3 sm:px-4 py-3 min-w-[150px]">Origen</th>
                              <th className="px-3 sm:px-4 py-3 min-w-[150px]">Destino</th>
                              <th className="px-3 sm:px-4 py-3 min-w-[140px] w-40">Chofer / Móvil</th>
                              <th className="px-3 sm:px-4 py-3 min-w-[90px] w-28">Tarifa / Pago</th>
                              <th className="px-3 sm:px-4 py-3 min-w-[95px] w-28 text-center">Estado</th>
                              <th className="px-3 sm:px-4 py-3 min-w-[140px]">Detalle / Motivo</th>
                              <th className="px-3 sm:px-4 py-3 min-w-[110px] w-28 text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {filteredHistorial.length === 0 ? (
                              <tr>
                                <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                                  <FileText className="h-9 w-9 mx-auto mb-2 text-gray-300" />
                                  <p className="font-semibold text-gray-700">No hay viajes en el historial para los filtros seleccionados.</p>
                                  <p className="text-xs text-gray-400 mt-1">Prueba cambiando el rango de fecha o el estado seleccionado.</p>
                                </td>
                              </tr>
                            ) : (
                              filteredHistorial.map((viaje) => {
                                const isCompletado = viaje.estadoRaw === 'COMPLETADO';
                                const isCancelado = viaje.estadoRaw === 'CANCELADO';

                                return (
                                  <tr
                                    key={viaje.id}
                                    className={`transition-colors hover:bg-gray-50/80 ${
                                      isCancelado ? 'bg-rose-50/20' : ''
                                    }`}
                                  >
                                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                                      <div className="font-semibold text-gray-900 text-xs">{viaje.fecha}</div>
                                      <div className="text-[11px] font-mono text-gray-500 flex items-center mt-0.5">
                                        <Clock className="h-3 w-3 mr-1 text-gray-400" />
                                        <span>{viaje.hora}</span>
                                      </div>
                                    </td>

                                    <td className="px-3 sm:px-4 py-3">
                                      <div className="font-medium text-gray-900 text-xs sm:text-sm truncate max-w-[140px]" title={viaje.cliente}>
                                        {viaje.cliente}
                                      </div>
                                      <div className="text-xs text-gray-500 flex items-center space-x-1.5 mt-0.5">
                                        <span className="truncate max-w-[90px]">{viaje.telefono}</span>
                                        {viaje.telefono && viaje.telefono !== 'S/N' && (
                                          <a
                                            href={`https://wa.me/${viaje.telefono.replace(/\D/g, '')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-emerald-600 hover:text-emerald-800 text-[10px] font-bold"
                                            title="Enviar WhatsApp"
                                          >
                                            WA
                                          </a>
                                        )}
                                      </div>
                                    </td>

                                    <td className="px-3 sm:px-4 py-3">
                                      <div className="text-xs sm:text-sm text-gray-900 line-clamp-2 leading-snug" title={viaje.origen}>
                                        <LocationIcon className="h-3.5 w-3.5 mr-1 inline text-blue-500 shrink-0" />
                                        <span>{viaje.origen}</span>
                                      </div>
                                    </td>

                                    <td className="px-3 sm:px-4 py-3">
                                      <div className="text-xs sm:text-sm text-gray-900 line-clamp-2 leading-snug" title={viaje.destino}>
                                        <LocationIcon className="h-3.5 w-3.5 mr-1 inline text-emerald-500 shrink-0" />
                                        <span>{viaje.destino}</span>
                                      </div>
                                    </td>

                                    <td className="px-3 sm:px-4 py-3">
                                      <div className="text-xs sm:text-sm font-semibold text-gray-900 truncate" title={viaje.chofer}>
                                        {viaje.chofer}
                                      </div>
                                      <div className="text-[11px] text-gray-500 truncate" title={viaje.vehiculo}>
                                        {viaje.vehiculo}
                                      </div>
                                    </td>

                                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                                      <div className="text-sm font-bold text-gray-900">
                                        ${Number(viaje.precio || 0).toLocaleString()}
                                      </div>
                                      <span className={`inline-block text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                                        viaje.metodoPago === 'TRANSFERENCIA'
                                          ? 'bg-purple-100 text-purple-800'
                                          : 'bg-gray-100 text-gray-700'
                                      }`}>
                                        {viaje.metodoPago || 'EFECTIVO'}
                                      </span>
                                    </td>

                                    <td className="px-3 sm:px-4 py-3 text-center whitespace-nowrap">
                                      {isCompletado ? (
                                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                          <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                                          Finalizado
                                        </span>
                                      ) : isCancelado ? (
                                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                                          <XCircle className="h-3 w-3 mr-1 text-rose-600" />
                                          Anulado
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                          {viaje.estado}
                                        </span>
                                      )}
                                    </td>

                                    <td className="px-3 sm:px-4 py-3">
                                      {isCancelado ? (
                                        <div className="text-xs">
                                          <div className="flex items-center space-x-1">
                                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-rose-200 text-rose-900">
                                              {viaje.canceladoPor || 'S/D'}
                                            </span>
                                            <span className="text-rose-900 font-medium line-clamp-1" title={viaje.motivoCancelacion || 'Sin motivo'}>
                                              {viaje.motivoCancelacion || 'Sin motivo especificado'}
                                            </span>
                                          </div>
                                          {viaje.costoCancelacion > 0 && (
                                            <div className="text-[10px] text-rose-700 font-bold mt-0.5">
                                              Cobro mín: ${viaje.costoCancelacion}
                                            </div>
                                          )}
                                        </div>
                                      ) : isCompletado ? (
                                        <div className="text-xs text-gray-600">
                                          {viaje.distanciaKmConPasajero ? (
                                            <span className="font-semibold text-gray-700">
                                              {Number(viaje.distanciaKmConPasajero).toFixed(1)} km recorridos
                                            </span>
                                          ) : (
                                            <span className="text-emerald-700 font-medium">Viaje completado OK</span>
                                          )}
                                          {viaje.observaciones && (
                                            <p className="text-[11px] text-gray-500 line-clamp-1 italic mt-0.5" title={viaje.observaciones}>
                                              {viaje.observaciones}
                                            </p>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-xs text-gray-400">-</span>
                                      )}
                                    </td>

                                    <td className="px-3 sm:px-4 py-3 text-right whitespace-nowrap">
                                      <div className="flex items-center justify-end space-x-1.5">
                                        <button
                                          type="button"
                                          onClick={() => abrirDetalleViaje(viaje)}
                                          className="p-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                                          title="Ver desglose completo del viaje"
                                        >
                                          <Eye className="h-3.5 w-3.5" />
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleRepetirViaje(viaje)}
                                          className="p-1.5 text-gray-700 hover:text-emerald-700 bg-gray-100 hover:bg-emerald-50 rounded-lg transition-colors border border-gray-200 hover:border-emerald-300"
                                          title="Re-solicitar / Despachar nuevo viaje con estos datos"
                                        >
                                          <RotateCcw className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Vista Analítica de Auditoría de Cancelaciones */
                  <div className="space-y-4">
                    {/* KPI Cards de Cancelaciones */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      <div className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-sm bg-gradient-to-br from-white to-rose-50/40">
                        <span className="text-[11px] font-bold text-rose-800 uppercase">Total Cancelados</span>
                        <div className="text-2xl font-black text-rose-700 mt-1">
                          {auditoriaData?.metricas?.totalCancelados ?? filteredHistorial.filter(v => v.estadoRaw === 'CANCELADO').length}
                        </div>
                        <p className="text-[10px] text-rose-600 mt-0.5">Viajes anulados</p>
                      </div>

                      <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-sm bg-gradient-to-br from-white to-amber-50/40">
                        <span className="text-[11px] font-bold text-amber-800 uppercase">Por Cliente</span>
                        <div className="text-2xl font-black text-amber-700 mt-1">
                          {auditoriaData?.metricas?.canceladosCliente ?? filteredHistorial.filter(v => v.canceladoPor === 'CLIENTE').length}
                        </div>
                        <p className="text-[10px] text-amber-600 mt-0.5">Desistieron del viaje</p>
                      </div>

                      <div className="bg-white p-3.5 rounded-xl border border-orange-200 shadow-sm bg-gradient-to-br from-white to-orange-50/40">
                        <span className="text-[11px] font-bold text-orange-800 uppercase">Por Chofer</span>
                        <div className="text-2xl font-black text-orange-700 mt-1">
                          {auditoriaData?.metricas?.canceladosChofer ?? filteredHistorial.filter(v => v.canceladoPor === 'CHOFER').length}
                        </div>
                        <p className="text-[10px] text-orange-600 mt-0.5">Rechazo en ruta / Falla</p>
                      </div>

                      <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-sm bg-gradient-to-br from-white to-blue-50/40">
                        <span className="text-[11px] font-bold text-blue-800 uppercase">Por Central</span>
                        <div className="text-2xl font-black text-blue-700 mt-1">
                          {auditoriaData?.metricas?.canceladosCoordinador ?? filteredHistorial.filter(v => v.canceladoPor === 'COORDINADOR' || (!v.canceladoPor && v.estadoRaw === 'CANCELADO')).length}
                        </div>
                        <p className="text-[10px] text-blue-600 mt-0.5">Operador / Sin flota</p>
                      </div>

                      <div className="bg-white p-3.5 rounded-xl border border-purple-200 shadow-sm bg-gradient-to-br from-white to-purple-50/40">
                        <span className="text-[11px] font-bold text-purple-800 uppercase">Con Cobro Mínimo</span>
                        <div className="text-2xl font-black text-purple-700 mt-1">
                          {auditoriaData?.metricas?.conCostoMinimo ?? filteredHistorial.filter(v => v.costoCancelacion > 0).length}
                        </div>
                        <p className="text-[10px] text-purple-600 mt-0.5">Auto &lt; 10 cuadras</p>
                      </div>

                      <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-sm bg-gradient-to-br from-white to-emerald-50/40">
                        <span className="text-[11px] font-bold text-emerald-800 uppercase">Penalizaciones</span>
                        <div className="text-2xl font-black text-emerald-700 mt-1">
                          ${(auditoriaData?.metricas?.totalRecaudadoCancelaciones ?? filteredHistorial.reduce((acc: number, v: any) => acc + (v.costoCancelacion || 0), 0)).toLocaleString()}
                        </div>
                        <p className="text-[10px] text-emerald-600 mt-0.5">Recaudación mínima</p>
                      </div>
                    </div>

                    {/* Ranking de Motivos más frecuentes y Filtros */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* Top Motivos */}
                      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-3 flex items-center space-x-1.5">
                          <AlertCircle className="h-4 w-4 text-rose-500" />
                          <span>Cuellos de Botella (Ranking de Motivos)</span>
                        </h4>
                        <div className="space-y-2.5">
                          {(auditoriaData?.metricas?.rankingMotivos || []).length === 0 ? (
                            <p className="text-xs text-gray-400">No hay cancelaciones registradas en el período.</p>
                          ) : (
                            (auditoriaData?.metricas?.rankingMotivos || []).slice(0, 5).map((item: any, idx: number) => {
                              const total = auditoriaData?.metricas?.totalCancelados || 1;
                              const pct = Math.round((item.cantidad / total) * 100);
                              return (
                                <div key={idx} className="space-y-1">
                                  <div className="flex justify-between text-xs">
                                    <span className="font-medium text-gray-800 truncate">{item.motivo}</span>
                                    <span className="font-bold text-gray-600 ml-2">{item.cantidad} ({pct}%)</span>
                                  </div>
                                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className={`h-1.5 rounded-full ${
                                        idx === 0 ? 'bg-rose-500' : idx === 1 ? 'bg-orange-500' : 'bg-amber-400'
                                      }`}
                                      style={{ width: `${Math.max(pct, 5)}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Tabla detallada de cancelaciones con filtro rápido */}
                      <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-gray-700">Filtrar por Responsable:</span>
                          <div className="flex items-center space-x-1">
                            {(['TODOS', 'CLIENTE', 'CHOFER', 'COORDINADOR'] as const).map((resp) => (
                              <button
                                key={resp}
                                type="button"
                                onClick={() => setFiltroCanceladoPor(resp)}
                                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                                  filtroCanceladoPor === resp
                                    ? 'bg-rose-600 text-white shadow-sm'
                                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                                }`}
                              >
                                {resp === 'TODOS' ? 'Todos' : resp === 'CLIENTE' ? 'Cliente' : resp === 'CHOFER' ? 'Chofer' : 'Central'}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="overflow-x-auto max-h-80">
                          <table className="w-full text-left text-xs divide-y divide-gray-200">
                            <thead className="bg-gray-50 text-gray-500 uppercase font-semibold">
                              <tr>
                                <th className="px-3 py-2">Fecha/Hora</th>
                                <th className="px-3 py-2">Pasajero</th>
                                <th className="px-3 py-2">Chofer Asignado</th>
                                <th className="px-3 py-2">Cancelado Por</th>
                                <th className="px-3 py-2">Motivo</th>
                                <th className="px-3 py-2 text-right">Costo</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {loadingAuditoria ? (
                                <tr>
                                  <td colSpan={6} className="py-8 text-center text-gray-400">
                                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-1" />
                                    <span>Cargando auditoría...</span>
                                  </td>
                                </tr>
                              ) : (auditoriaData?.viajes || []).length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="py-8 text-center text-gray-400">
                                    No hay cancelaciones para el filtro seleccionado.
                                  </td>
                                </tr>
                              ) : (
                                (auditoriaData?.viajes || []).map((v: any) => (
                                  <tr key={v.id} className="hover:bg-rose-50/30 transition-colors">
                                    <td className="px-3 py-2 whitespace-nowrap font-mono text-gray-600">
                                      {new Date(v.fecha).toLocaleDateString()} {new Date(v.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="px-3 py-2 font-medium text-gray-900">
                                      {v.clienteNombre || (v.cliente ? `${v.cliente.nombre} ${v.cliente.apellido}` : 'S/N')}
                                      <div className="text-[10px] text-gray-400 font-mono">{v.clienteTelefono || v.cliente?.telefono}</div>
                                    </td>
                                    <td className="px-3 py-2 text-gray-700">
                                      {v.chofer ? `${v.chofer.nombre} ${v.chofer.apellido}` : <span className="text-gray-400 italic">Sin móvil</span>}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap">
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                        v.canceladoPor === 'CLIENTE' ? 'bg-amber-100 text-amber-800' :
                                        v.canceladoPor === 'CHOFER' ? 'bg-orange-100 text-orange-800' :
                                        'bg-blue-100 text-blue-800'
                                      }`}>
                                        {v.canceladoPor || 'COORDINADOR'}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-gray-800 max-w-xs truncate" title={v.motivoCancelacion || 'Sin motivo'}>
                                      {v.motivoCancelacion || 'Sin motivo especificado'}
                                    </td>
                                    <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">
                                      {v.costoCancelacion > 0 ? (
                                        <span className="text-rose-600 font-bold">${v.costoCancelacion}</span>
                                      ) : (
                                        <span className="text-gray-400">$0</span>
                                      )}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Panel lateral derecho - Botones de acción */}
        {isSidebarOpen && (
          <div className="w-full lg:w-64 xl:w-72 2xl:w-80 bg-white shadow-md border-t lg:border-t-0 lg:border-l shrink-0">
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-md font-bold text-gray-900">Acciones Rápidas</h3>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="hidden lg:flex text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
                  title="Ocultar panel lateral"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <div className="space-y-3">
                {/* Despacho Express F2 */}
                <button
                  type="button"
                  onClick={abrirModalExpress}
                  className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white px-4 py-3 rounded-xl flex items-center space-x-3 transition-all shadow-md font-bold text-sm cursor-pointer"
                >
                  <Zap className="h-5 w-5 fill-current text-yellow-200" />
                  <span>⚡ Despacho Express (F2)</span>
                </button>

                <button 
                  type="button"
                  onClick={() => {
                    setModalStep(1);
                    setIsModalOpen(true);
                  }}
                  className="w-full bg-green-600 text-white px-4 py-2.5 rounded-xl flex items-center space-x-3 hover:bg-green-700 transition-colors shadow-sm font-medium text-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>Nuevo Viaje Completo</span>
                </button>

                <button 
                  type="button"
                  onClick={() => setActiveTab('historial')}
                  className={`w-full px-4 py-2.5 rounded-xl flex items-center space-x-3 transition-colors shadow-sm font-medium text-sm ${
                    activeTab === 'historial'
                      ? 'bg-emerald-700 text-white font-bold ring-2 ring-emerald-400'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Historial y Auditoría</span>
                </button>

                <button 
                  type="button"
                  onClick={abrirModalLoteOptimo}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-4 py-2.5 rounded-xl flex items-center space-x-3 transition-all shadow font-bold text-sm"
                >
                  <Zap className="h-4 w-4 fill-current" />
                  <span>Despacho Óptimo (Lote)</span>
                </button>

                <Link 
                  href="/coordinador/reservas"
                  className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-xl flex items-center space-x-3 hover:bg-blue-700 transition-colors shadow-sm font-medium text-sm"
                >
                  <Calendar className="h-4 w-4" />
                  <span>Nueva Reserva</span>
                </Link>

                <Link 
                  href="/coordinador/choferes"
                  className="w-full bg-purple-600 text-white px-4 py-2.5 rounded-xl flex items-center space-x-3 hover:bg-purple-700 transition-colors shadow-sm font-medium text-sm"
                >
                  <Users className="h-4 w-4" />
                  <span>Gestionar Choferes</span>
                </Link>

                <Link 
                  href="/coordinador/cierre"
                  className="w-full bg-emerald-600 text-white px-4 py-2.5 rounded-xl flex items-center space-x-3 hover:bg-emerald-700 transition-colors shadow-sm font-medium text-sm"
                >
                  <DollarSign className="h-4 w-4" />
                  <span>Cierre de Caja Chofer</span>
                </Link>

                <Link 
                  href="/coordinador/mapa"
                  className="w-full bg-indigo-600 text-white px-4 py-2.5 rounded-xl flex items-center space-x-3 hover:bg-indigo-700 transition-colors shadow-sm font-medium text-sm"
                >
                  <MapPin className="h-4 w-4" />
                  <span>Ver Mapa en Vivo</span>
                </Link>

                <Link 
                  href="/coordinador/reportes"
                  className="w-full bg-gray-800 text-white px-4 py-2.5 rounded-xl flex items-center space-x-3 hover:bg-gray-900 transition-colors shadow-sm font-medium text-sm"
                >
                  <TrendingUp className="h-4 w-4" />
                  <span>Reportes y Métricas</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Paso a Paso - Nuevo Viaje */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-100 transform transition-all">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-t-2xl text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">Nuevo Viaje</h3>
                <p className="text-xs text-blue-100">Crear viaje manual - Paso {modalStep} de 3</p>
              </div>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              {modalStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">DNI del Cliente</label>
                    <div className="flex space-x-2">
                      <input 
                        type="text" 
                        value={dniSearch}
                        onChange={(e) => setDniSearch(e.target.value)}
                        placeholder="Ej: 38450123"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleBuscarDni();
                          }
                        }}
                      />
                      <button 
                        type="button"
                        onClick={handleBuscarDni}
                        disabled={buscandoDni}
                        className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center min-w-[90px]"
                      >
                        {buscandoDni ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Ingresa el DNI del cliente para autocompletar sus datos y viajes anteriores.
                    </p>
                  </div>
                </div>
              )}

              {modalStep === 2 && (
                <form onSubmit={handleCrearCliente} className="space-y-3">
                  <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    El cliente no existe en la base de datos. Complete los siguientes datos básicos:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Nombre *</label>
                      <input 
                        type="text"
                        required
                        value={clientData.nombre}
                        onChange={(e) => setClientData({ ...clientData, nombre: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Apellido *</label>
                      <input 
                        type="text"
                        required
                        value={clientData.apellido}
                        onChange={(e) => setClientData({ ...clientData, apellido: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Teléfono *</label>
                    <input 
                      type="text"
                      required
                      value={clientData.telefono}
                      onChange={(e) => setClientData({ ...clientData, telefono: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div className="relative">
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Dirección Particular</label>
                    <input 
                      type="text"
                      value={clientData.direccion}
                      onChange={(e) => {
                        setClientData({ ...clientData, direccion: e.target.value });
                        setIsDireccionSelected(false);
                      }}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                      placeholder="Calle y número..."
                    />
                    {direccionSuggestions.length > 0 && !isDireccionSelected && (
                      <div className="absolute z-10 w-full bg-white mt-1 border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto divide-y divide-gray-100">
                        {direccionSuggestions.map((sug, idx) => {
                          const clean = formatCleanAddress(sug, clientData.direccion);
                          return (
                            <div
                              key={idx}
                              onClick={() => {
                                setClientData({ ...clientData, direccion: clean.fullAddress });
                                setIsDireccionSelected(true);
                                setDireccionSuggestions([]);
                              }}
                              className="p-2 hover:bg-gray-50 cursor-pointer text-xs"
                            >
                              <div className="font-semibold text-gray-800">{clean.mainText}</div>
                              {clean.secondaryText && (
                                <div className="text-[11px] text-gray-500 truncate">{clean.secondaryText}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between pt-3">
                    <button 
                      type="button" 
                      onClick={() => setModalStep(1)}
                      className="text-gray-500 text-xs hover:underline"
                    >
                      ← Volver a buscar
                    </button>
                    <button 
                      type="submit" 
                      disabled={creandoCliente}
                      className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-medium hover:bg-blue-700 transition-colors flex items-center space-x-1"
                    >
                      {creandoCliente ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span>Guardar y Continuar →</span>}
                    </button>
                  </div>
                </form>
              )}

              {modalStep === 3 && (
                <form onSubmit={handleCrearViaje} className="space-y-3">
                  <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-semibold text-gray-800">{clientData.nombre} {clientData.apellido}</span>
                      <span className="text-gray-500 ml-2">({clientData.telefono})</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setModalStep(1)}
                      className="text-blue-600 hover:underline"
                    >
                      Cambiar
                    </button>
                  </div>

                  <div className="relative">
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Punto de Origen *</label>
                    <input 
                      type="text"
                      required
                      value={tripData.origen}
                      onChange={(e) => {
                        setTripData({ ...tripData, origen: e.target.value });
                        setIsOrigenSelected(false);
                      }}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                      placeholder="Dirección de recogida..."
                    />
                    {origenSuggestions.length > 0 && !isOrigenSelected && (
                      <div className="absolute z-20 w-full bg-white mt-1 border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto divide-y divide-gray-100">
                        {origenSuggestions.map((sug, idx) => {
                          const clean = formatCleanAddress(sug, tripData.origen);
                          return (
                            <div
                              key={idx}
                              onClick={() => {
                                setTripData({ ...tripData, origen: clean.fullAddress });
                                setIsOrigenSelected(true);
                                setOrigenSuggestions([]);
                                if (sug.lat && sug.lon) {
                                  setOrigenCoords({ lat: parseFloat(sug.lat), lon: parseFloat(sug.lon) });
                                }
                              }}
                              className="p-2 hover:bg-gray-50 cursor-pointer text-xs"
                            >
                              <div className="font-semibold text-gray-800">{clean.mainText}</div>
                              {clean.secondaryText && (
                                <div className="text-[11px] text-gray-500 truncate">{clean.secondaryText}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Punto de Destino *</label>
                    <input 
                      type="text"
                      required
                      value={tripData.destino}
                      onChange={(e) => {
                        setTripData({ ...tripData, destino: e.target.value });
                        setIsDestinoSelected(false);
                      }}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                      placeholder="Dirección de destino..."
                    />
                    {destinoSuggestions.length > 0 && !isDestinoSelected && (
                      <div className="absolute z-20 w-full bg-white mt-1 border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto divide-y divide-gray-100">
                        {destinoSuggestions.map((sug, idx) => {
                          const clean = formatCleanAddress(sug, tripData.destino);
                          return (
                            <div
                              key={idx}
                              onClick={() => {
                                setTripData({ ...tripData, destino: clean.fullAddress });
                                setIsDestinoSelected(true);
                                setDestinoSuggestions([]);
                                if (sug.lat && sug.lon) {
                                  setDestinoCoords({ lat: parseFloat(sug.lat), lon: parseFloat(sug.lon) });
                                }
                              }}
                              className="p-2 hover:bg-gray-50 cursor-pointer text-xs"
                            >
                              <div className="font-semibold text-gray-800">{clean.mainText}</div>
                              {clean.secondaryText && (
                                <div className="text-[11px] text-gray-500 truncate">{clean.secondaryText}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Precio ($)</label>
                      <input 
                        type="number"
                        value={tripData.precio}
                        onChange={(e) => setTripData({ ...tripData, precio: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-semibold text-emerald-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Prioridad</label>
                      <select 
                        value={tripData.prioridad}
                        onChange={(e: any) => setTripData({ ...tripData, prioridad: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="BAJA">Baja</option>
                        <option value="NORMAL">Normal</option>
                        <option value="ALTA">Alta</option>
                        <option value="URGENTE">Urgente</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Observaciones</label>
                    <textarea 
                      value={tripData.observaciones}
                      onChange={(e) => setTripData({ ...tripData, observaciones: e.target.value })}
                      placeholder="Ej: Tocar timbre 2B, tiene equipaje..."
                      rows={2}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button 
                      type="button" 
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 text-xs font-medium hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      disabled={creandoViaje}
                      className="bg-green-600 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-green-700 transition-colors flex items-center space-x-1"
                    >
                      {creandoViaje ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span>Confirmar y Despachar</span>}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: ⚡ Carga Ultrarrápida Express Telefónica (< 5s) */}
      {isExpressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-orange-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header del Modal Express */}
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black flex items-center space-x-2">
                  <Zap className="h-5 w-5 fill-current text-yellow-200" />
                  <span>Despacho Telefónico Express</span>
                </h3>
                <p className="text-xs text-amber-100 mt-0.5">
                  Carga en &lt; 5s · Búsqueda predictiva por teléfono o apellido
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsExpressModalOpen(false)}
                className="p-1 rounded-full hover:bg-white/20 text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitExpress} className="p-5 space-y-3.5">
              {/* Teléfono y Búsqueda Predictiva */}
              <div className="relative">
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  📞 Teléfono del Pasajero *
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={expressData.telefono}
                  onChange={(e) => setExpressData({ ...expressData, telefono: e.target.value })}
                  placeholder="Ej: 2364123456"
                  className="w-full px-3.5 py-2.5 border-2 border-orange-300 rounded-xl text-base font-semibold focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />

                {/* Dropdown Predictivo si hay coincidencias */}
                {predictiveSuggestions.length > 0 && (
                  <div className="absolute z-30 w-full bg-white mt-1 border border-orange-200 rounded-xl shadow-xl max-h-52 overflow-y-auto divide-y divide-gray-100">
                    <div className="p-2 bg-orange-50 text-[11px] font-bold text-orange-800 uppercase">
                      Clientes habituales encontrados:
                    </div>
                    {predictiveSuggestions.map((c: any) => (
                      <div
                        key={c.id}
                        onClick={() => seleccionarClientePredictivo(c)}
                        className="p-2.5 hover:bg-orange-50/60 cursor-pointer text-xs transition-colors"
                      >
                        <div className="flex justify-between font-bold text-gray-900">
                          <span>{c.nombreCompleto}</span>
                          <span className="font-mono text-orange-600">{c.telefono}</span>
                        </div>
                        {c.origenesHabituales?.length > 0 && (
                          <div className="text-[11px] text-gray-500 mt-1 flex flex-wrap gap-1">
                            {c.origenesHabituales.slice(0, 2).map((orig: string, i: number) => (
                              <span key={i} className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">
                                📍 {orig}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Nombre y Apellido */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nombre</label>
                  <input
                    type="text"
                    value={expressData.nombre}
                    onChange={(e) => setExpressData({ ...expressData, nombre: e.target.value })}
                    placeholder="Ej: Juan"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Apellido</label>
                  <input
                    type="text"
                    value={expressData.apellido}
                    onChange={(e) => setExpressData({ ...expressData, apellido: e.target.value })}
                    placeholder="Ej: Pérez"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                  />
                </div>
              </div>

              {/* Origen y Destino */}
              <div className="relative">
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center justify-between">
                  <span>📍 Origen (Dirección de recogida) *</span>
                  {buscandoExpressOrigen && (
                    <span className="flex items-center text-[11px] text-blue-600 font-normal">
                      <Loader2 className="w-3 h-3 animate-spin mr-1" /> Buscando...
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  required
                  value={expressData.origen}
                  onChange={(e) => {
                    setExpressData({ ...expressData, origen: e.target.value });
                    setIsExpressOrigenSelected(false);
                  }}
                  placeholder="Ej: Av. San Martín 450"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                {expressOrigenSuggestions.length > 0 && !isExpressOrigenSelected && (
                  <div className="absolute z-30 left-0 right-0 bg-white mt-1 border border-blue-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-gray-100">
                    <div className="px-3 py-1.5 bg-blue-50 text-[11px] font-bold text-blue-800 uppercase">
                      Direcciones sugeridas:
                    </div>
                    {expressOrigenSuggestions.map((sug, idx) => {
                      const clean = formatCleanAddress(sug, expressData.origen);
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setExpressData((prev) => ({ ...prev, origen: clean.fullAddress }));
                            setIsExpressOrigenSelected(true);
                            setExpressOrigenSuggestions([]);
                            if (sug.lat && sug.lon) {
                              setExpressOrigenCoords({ lat: parseFloat(sug.lat), lon: parseFloat(sug.lon) });
                            }
                          }}
                          className="p-2.5 hover:bg-blue-50/70 cursor-pointer text-xs text-gray-800 transition-colors flex items-start space-x-2"
                        >
                          <span className="text-blue-500 mt-0.5 shrink-0">📍</span>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-gray-900 leading-tight">{clean.mainText}</span>
                            {clean.secondaryText && (
                              <span className="text-[11px] text-gray-500 truncate">{clean.secondaryText}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="relative">
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center justify-between">
                  <span>🏁 Destino (Opcional o a convenir)</span>
                  {buscandoExpressDestino && (
                    <span className="flex items-center text-[11px] text-emerald-600 font-normal">
                      <Loader2 className="w-3 h-3 animate-spin mr-1" /> Buscando...
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={expressData.destino}
                  onChange={(e) => {
                    setExpressData({ ...expressData, destino: e.target.value });
                    setIsExpressDestinoSelected(false);
                  }}
                  placeholder="Ej: Hospital Municipal / Terminal"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                {expressDestinoSuggestions.length > 0 && !isExpressDestinoSelected && (
                  <div className="absolute z-30 left-0 right-0 bg-white mt-1 border border-emerald-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-gray-100">
                    <div className="px-3 py-1.5 bg-emerald-50 text-[11px] font-bold text-emerald-800 uppercase">
                      Direcciones sugeridas:
                    </div>
                    {expressDestinoSuggestions.map((sug, idx) => {
                      const clean = formatCleanAddress(sug, expressData.destino);
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setExpressData((prev) => ({ ...prev, destino: clean.fullAddress }));
                            setIsExpressDestinoSelected(true);
                            setExpressDestinoSuggestions([]);
                            if (sug.lat && sug.lon) {
                              setExpressDestinoCoords({ lat: parseFloat(sug.lat), lon: parseFloat(sug.lon) });
                            }
                          }}
                          className="p-2.5 hover:bg-emerald-50/70 cursor-pointer text-xs text-gray-800 transition-colors flex items-start space-x-2"
                        >
                          <span className="text-emerald-500 mt-0.5 shrink-0">🏁</span>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-gray-900 leading-tight">{clean.mainText}</span>
                            {clean.secondaryText && (
                              <span className="text-[11px] text-gray-500 truncate">{clean.secondaryText}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Asignar Móvil Inmediato */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  🚖 Despachar al Móvil Directo (Opcional)
                </label>
                <select
                  value={expressData.choferId}
                  onChange={(e) => setExpressData({ ...expressData, choferId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white"
                >
                  <option value="">Dejar en cola sin asignar (Automático)</option>
                  {choferesParaAsignar.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {c.apellido} — {c.vehiculo?.patente || 'Auto'} ({c.estado || 'Disponible'})
                      {c.enParadaVirtual ? ' [En Base]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tarifa y Observaciones */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-gray-700 uppercase">
                      Tarifa Estimada ($)
                    </label>
                    <button
                      type="button"
                      onClick={ejecutarCalculoPrecioExpress}
                      disabled={calculandoPrecioExpress || !expressData.origen || !expressData.destino}
                      className="text-[10px] text-amber-700 hover:text-amber-900 font-bold underline cursor-pointer disabled:opacity-40"
                      title="Recalcular tarifa con el origen y destino actuales"
                    >
                      {calculandoPrecioExpress ? 'Calculando...' : '⚡ Recalcular'}
                    </button>
                  </div>
                  <input
                    type="number"
                    value={expressData.precio}
                    onChange={(e) => setExpressData({ ...expressData, precio: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-bold text-emerald-700 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  {calculandoPrecioExpress && (
                    <p className="text-[11px] text-blue-600 font-medium mt-1 flex items-center">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Calculando tarifa...
                    </p>
                  )}
                  {!calculandoPrecioExpress && distanciaExpressEstimada !== null && (
                    <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center">
                      <span>🛣️ Distancia est.: {distanciaExpressEstimada} km</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Prioridad</label>
                  <select
                    value={expressData.prioridad}
                    onChange={(e: any) => setExpressData({ ...expressData, prioridad: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="ALTA">Alta</option>
                    <option value="URGENTE">Urgente</option>
                  </select>
                </div>
              </div>

              {/* Botones */}
              <div className="flex justify-end space-x-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsExpressModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 text-xs font-semibold hover:bg-gray-50"
                >
                  Cancelar (Esc)
                </button>
                <button
                  type="submit"
                  disabled={creandoViajeExpress}
                  className="flex-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {creandoViajeExpress ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Despachando...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 fill-current text-yellow-200" />
                      <span>⚡ Despachar Viaje Ya (Enter)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: 🔄 Reasignación Rápida de Móvil en Caliente */}
      {isReassignModalOpen && viajeAReasignar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-amber-600 to-orange-600 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold flex items-center space-x-2">
                  <ArrowLeftRight className="h-5 w-5" />
                  <span>Reasignar Móvil en Caliente</span>
                </h3>
                <p className="text-xs text-amber-100 mt-0.5">
                  Transferir viaje a otro chofer sin cancelar el pedido
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsReassignModalOpen(false);
                  setViajeAReasignar(null);
                }}
                className="p-1 rounded-full hover:bg-white/20 text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Resumen del Viaje */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="font-bold text-gray-700">Pasajero:</span>
                  <span className="font-semibold text-gray-900">{viajeAReasignar.cliente}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-gray-700">Origen:</span>
                  <span className="text-gray-900 truncate max-w-[200px]">{viajeAReasignar.origen}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-gray-700">Móvil Actual:</span>
                  <span className="text-red-700 font-bold">{viajeAReasignar.chofer} ({viajeAReasignar.vehiculo})</span>
                </div>
              </div>

              {/* Selector de Nuevo Chofer */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Nuevo Chofer de Reemplazo *
                </label>
                <select
                  value={nuevoChoferIdReasignar}
                  onChange={(e) => setNuevoChoferIdReasignar(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white"
                >
                  <option value="">Seleccione el chofer que toma el viaje...</option>
                  {choferesParaAsignar
                    .filter((c) => c.id !== viajeAReasignar.rawViaje?.choferId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} {c.apellido} — {c.vehiculo?.patente || 'Auto'} ({c.estado || 'Disponible'})
                        {c.enParadaVirtual ? ' [En Base]' : ''}
                      </option>
                    ))}
                </select>
              </div>

              {/* Motivo de la Reasignación */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Motivo de la Transferencia
                </label>
                <div className="space-y-1.5">
                  {[
                    'Desperfecto mecánico / Pinchadura',
                    'Demora excesiva / Tránsito trabado',
                    'Chofer no responde la radio/app',
                    'Cambio de turno / Relevo',
                    'Otro'
                  ].map((mot) => (
                    <label key={mot} className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        name="motivoReasignar"
                        value={mot}
                        checked={motivoReasignar === mot}
                        onChange={(e) => setMotivoReasignar(e.target.value)}
                        className="text-orange-600 focus:ring-orange-500"
                      />
                      <span>{mot}</span>
                    </label>
                  ))}
                </div>

                {motivoReasignar === 'Otro' && (
                  <input
                    type="text"
                    value={otroMotivoReasignar}
                    onChange={(e) => setOtroMotivoReasignar(e.target.value)}
                    placeholder="Especifique el motivo..."
                    className="w-full mt-2 px-3 py-1.5 border border-gray-300 rounded-lg text-xs"
                  />
                )}
              </div>

              {/* Botones */}
              <div className="flex justify-end space-x-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsReassignModalOpen(false);
                    setViajeAReasignar(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 text-xs font-semibold hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarReasignar}
                  disabled={reasignandoEnCaliente || !nuevoChoferIdReasignar}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-xl text-xs shadow transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  {reasignandoEnCaliente ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Transfiriendo viaje...</span>
                    </>
                  ) : (
                    <>
                      <ArrowLeftRight className="h-4 w-4" />
                      <span>Confirmar Transferencia Inmediata</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Asignación Manual */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-red-600 to-rose-600 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold flex items-center space-x-2">
                  <Car className="h-6 w-6" />
                  <span>Asignar Móvil y Chofer</span>
                </h3>
                <p className="text-xs text-red-100 mt-1">
                  Despachar auto para viaje pendiente
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="p-1 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleAsignarViaje} className="p-6 space-y-4">
              {selectedViajeObj && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-600">Cliente:</span>
                    <span className="font-bold text-gray-900">{selectedViajeObj.cliente}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-600">Origen:</span>
                    <span className="text-gray-900 truncate max-w-[220px]">{selectedViajeObj.origen}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-600">Destino:</span>
                    <span className="text-gray-900 truncate max-w-[220px]">{selectedViajeObj.destino}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Chofer Asignado *
                </label>
                <select
                  required
                  value={selectedChoferId}
                  onChange={(e) => handleChoferSelectChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none bg-white"
                >
                  <option value="">Seleccione un chofer disponible...</option>
                  {choferesParaAsignar.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {c.apellido} — {c.vehiculo?.patente || 'Auto propio'} ({c.estado || 'Disponible'})
                      {c.enParadaVirtual ? ' [En Base]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Vehículo
                </label>
                <select
                  value={selectedVehiculoId}
                  onChange={(e) => setSelectedVehiculoId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none bg-white"
                >
                  <option value="">Vehículo por defecto del chofer</option>
                  {todosLosVehiculos.map((v: any) => (
                    <option key={v.id} value={v.id}>
                      {v.patente} — {v.marca} {v.modelo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={asignandoViaje || !selectedChoferId}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 px-4 rounded-xl font-bold text-sm shadow transition-colors flex items-center justify-center space-x-2"
                >
                  {asignandoViaje ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Asignando...</span>
                    </>
                  ) : (
                    <>
                      <Car className="h-4 w-4" />
                      <span>Confirmar Despacho</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Despacho Óptimo por Lotes (Batch Matching) */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold flex items-center space-x-2">
                  <Zap className="h-6 w-6 fill-current text-amber-200" />
                  <span>Despacho Óptimo por Lotes</span>
                </h3>
                <p className="text-xs text-amber-100 mt-1">
                  Algoritmo Global de Asignación Bipartita (Kuhn-Munkres / Uber-style)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="p-1 rounded-full hover:bg-white/20 text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {isLoadingBatch ? (
                <div className="py-12 text-center text-gray-500 space-y-3">
                  <Loader2 className="h-10 w-10 text-orange-500 animate-spin mx-auto" />
                  <p className="font-semibold text-gray-800 text-base">Optimizando matriz de emparejamiento...</p>
                  <p className="text-xs text-gray-400">
                    Calculando distancias geodésicas, paradas FIFO y equidad de ingresos.
                  </p>
                </div>
              ) : !batchResult || !batchResult.matches || batchResult.matches.length === 0 ? (
                <div className="py-10 text-center text-gray-500">
                  <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-2" />
                  <p className="font-bold text-gray-800 text-base">No hay asignaciones automáticas disponibles</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {batchResult?.message || 'Asegúrese de tener viajes pendientes y choferes conectados.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-center">
                      <span className="text-xs text-amber-800 font-semibold block">Emparejamientos</span>
                      <span className="text-2xl font-black text-amber-600">{batchResult.matches.length}</span>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-center">
                      <span className="text-xs text-blue-800 font-semibold block">Viajes en Cola</span>
                      <span className="text-2xl font-black text-blue-600">{batchResult.totalViajes}</span>
                    </div>
                    <div className="p-3 bg-green-50 rounded-xl border border-green-200 text-center">
                      <span className="text-xs text-green-800 font-semibold block">Choferes Libres</span>
                      <span className="text-2xl font-black text-green-600">{batchResult.totalChoferes}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Asignaciones Optimizadas Sugeridas
                    </h4>
                    {batchResult.matches.map((m: any, idx: number) => (
                      <div key={idx} className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <p className="font-bold text-gray-900 text-sm">
                            {m.viaje.clienteNombre || 'Pasajero'}
                          </p>
                          <p className="text-gray-600">
                            <strong>Origen:</strong> {m.viaje.origen}
                          </p>
                          <p className="text-gray-600">
                            <strong>Destino:</strong> {m.viaje.destino}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-orange-700 text-sm block">
                            🚖 {m.chofer.nombre} {m.chofer.apellido}
                          </span>
                          <span className="text-gray-500 text-[11px] block">
                            {m.chofer.vehiculo ? `${m.chofer.vehiculo.marca} (${m.chofer.vehiculo.patente})` : 'Auto Propio'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium text-sm transition-colors"
                >
                  Cerrar
                </button>
                {batchResult && batchResult.matches?.length > 0 && (
                  <button
                    type="button"
                    onClick={aplicarLoteOptimo}
                    disabled={isApplyingBatch}
                    className="flex-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white py-2.5 px-5 rounded-xl font-bold transition-all flex items-center justify-center space-x-2 disabled:opacity-50 text-sm shadow-lg hover:shadow-orange-200 cursor-pointer"
                  >
                    {isApplyingBatch ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Despachando flota...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 fill-current" />
                        <span>Confirmar y Despachar Lote ({batchResult.matches.length} Viajes)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 6: Detalle Completo de Viaje del Historial */}
      {isDetailModalOpen && selectedHistorialViaje && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-gray-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Auditoría de Viaje #{selectedHistorialViaje.id.slice(-6)}</span>
                </h3>
                <p className="text-xs text-blue-100 mt-0.5">
                  {selectedHistorialViaje.fecha} a las {selectedHistorialViaje.hora}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  setSelectedHistorialViaje(null);
                }}
                className="p-1 rounded-full hover:bg-white/20 text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-gray-500 uppercase font-bold text-[10px] block mb-1">Cliente / Pasajero</span>
                  <p className="font-bold text-gray-900 text-sm">{selectedHistorialViaje.cliente}</p>
                  <p className="text-gray-600 font-mono mt-0.5">{selectedHistorialViaje.telefono}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-gray-500 uppercase font-bold text-[10px] block mb-1">Móvil Interviniente</span>
                  <p className="font-bold text-gray-900 text-sm">{selectedHistorialViaje.chofer}</p>
                  <p className="text-gray-600 mt-0.5">{selectedHistorialViaje.vehiculo}</p>
                </div>
              </div>

              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <div>
                  <span className="text-gray-500 font-bold uppercase text-[10px] block">Origen de recogida</span>
                  <p className="text-gray-900 font-medium text-xs mt-0.5">{selectedHistorialViaje.origen}</p>
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <span className="text-gray-500 font-bold uppercase text-[10px] block">Destino</span>
                  <p className="text-gray-900 font-medium text-xs mt-0.5">{selectedHistorialViaje.destino}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Tarifa</span>
                  <span className="text-base font-black text-emerald-700">${Number(selectedHistorialViaje.precio || 0).toLocaleString()}</span>
                </div>
                <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-200">
                  <span className="text-[10px] uppercase font-bold text-blue-800 block">Medio de Pago</span>
                  <span className="text-xs font-bold text-blue-900 block mt-1">{selectedHistorialViaje.metodoPago || 'EFECTIVO'}</span>
                </div>
                <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-200">
                  <span className="text-[10px] uppercase font-bold text-purple-800 block">Estado</span>
                  <span className="text-xs font-bold text-purple-900 block mt-1">{selectedHistorialViaje.estado}</span>
                </div>
              </div>

              {selectedHistorialViaje.motivoCancelacion && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-1">
                  <span className="font-bold text-[10px] uppercase block">Detalles de Cancelación:</span>
                  <p><strong>Cancelado por:</strong> {selectedHistorialViaje.canceladoPor || 'Central'}</p>
                  <p><strong>Motivo:</strong> {selectedHistorialViaje.motivoCancelacion}</p>
                  {selectedHistorialViaje.costoCancelacion > 0 && (
                    <p className="font-bold text-rose-700">Cobro de viaje mínimo: ${selectedHistorialViaje.costoCancelacion}</p>
                  )}
                </div>
              )}

              {/* Registro de Auditoría del Chat entre Cliente y Chofer */}
              {(() => {
                let chatMsgs: any[] = [];
                try {
                  const rawChat = selectedHistorialViaje.rawViaje?.mensajesChat || selectedHistorialViaje.mensajesChat;
                  if (rawChat) {
                    chatMsgs = typeof rawChat === 'string' ? JSON.parse(rawChat) : rawChat;
                  }
                } catch {}
                if (!Array.isArray(chatMsgs) || chatMsgs.length === 0) return null;
                return (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <span className="font-bold text-[10px] uppercase text-slate-700">
                        Registro de Chat Previo al Viaje ({chatMsgs.length} mensajes)
                      </span>
                      <span className="text-[10px] text-slate-500">Respaldo de auditoría</span>
                    </div>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {chatMsgs.map((m: any, idx: number) => (
                        <div
                          key={m.id || idx}
                          className={`p-2 rounded-lg text-xs border ${
                            m.remitente === 'CHOFER'
                              ? 'bg-blue-50 border-blue-200 text-blue-950'
                              : 'bg-white border-gray-200 text-gray-800'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] text-gray-500 mb-0.5">
                            <span className="font-bold uppercase">
                              {m.remitente === 'CHOFER' ? '🚕 Chofer' : '👤 Pasajero'} ({m.remitenteNombre || m.remitente})
                            </span>
                            {m.timestamp && (
                              <span>
                                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <p className="font-medium">{m.texto}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-4 bg-gray-50 border-t flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  setSelectedHistorialViaje(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-100 font-semibold text-xs"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  handleRepetirViaje(selectedHistorialViaje);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs flex items-center space-x-1.5 shadow-sm"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Re-solicitar Viaje</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
