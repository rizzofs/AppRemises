'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

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
      // 5. Drivers online
      const choferesRes = await coordinadorDashboardService.getChoferesTiempoReal();
      // 6. Todos los choferes y vehículos de la remisería para asignación manual
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
          tipo: 'Única'
        };
      };

      if (enCursoRes.success && enCursoRes.data) {
        setViajesEnCurso(enCursoRes.data.map(mapViaje));
      }
      if (sinAsignarRes.success && sinAsignarRes.data) {
        setViajesSinAsignar(sinAsignarRes.data.map(mapViaje));
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

  useEffect(() => {
    fetchData();
    // Actualización cada 10 segundos
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

  // Efecto para calcular precio basado en origen, destino y coordenadas
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (tripData.origen.trim() && tripData.destino.trim()) {
        try {
          const coords = {
            latOrigen: origenCoords?.lat,
            lonOrigen: origenCoords?.lon,
            latDestino: destinoCoords?.lat,
            lonDestino: destinoCoords?.lon
          };
          const res = await coordinadorDashboardService.calcularPrecio(tripData.origen, tripData.destino, coords);
          if (res.success && res.data) {
            setTripData(prev => ({
              ...prev,
              precio: res.data.precioEstimado.toString()
            }));
            setDistanciaEstimada(res.data.distanciaKm);
          } else {
            setDistanciaEstimada(null);
          }
        } catch (err) {
          console.error('Error auto calculating price:', err);
          setDistanciaEstimada(null);
        }
      } else {
        setDistanciaEstimada(null);
      }
    }, 800);

    return () => clearTimeout(delayDebounceFn);
  }, [tripData.origen, tripData.destino, origenCoords, destinoCoords]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleSelectOrigen = (s: any) => {
    setIsOrigenSelected(true);
    setTripData(prev => ({
      ...prev,
      origen: s.display_name
    }));
    setOrigenCoords({
      lat: parseFloat(s.lat),
      lon: parseFloat(s.lon)
    });
    setOrigenSuggestions([]);
  };

  const handleSelectDestino = (s: any) => {
    setIsDestinoSelected(true);
    setTripData(prev => ({
      ...prev,
      destino: s.display_name
    }));
    setDestinoCoords({
      lat: parseFloat(s.lat),
      lon: parseFloat(s.lon)
    });
    setDestinoSuggestions([]);
  };

  const handleSelectDireccion = (s: any) => {
    setIsDireccionSelected(true);
    setClientData(prev => ({
      ...prev,
      direccion: s.display_name
    }));
    setDireccionSuggestions([]);
  };

  const handleBuscarDni = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dniSearch || dniSearch.length < 7) {
      toast.error('Ingrese un DNI válido (mínimo 7 caracteres)');
      return;
    }
    setBuscandoDni(true);
    try {
      const res = await clienteAuthService.buscarClientePorDni(dniSearch);
      if (res.success && res.data) {
        setClientData({
          id: res.data.id,
          nombre: res.data.nombre,
          apellido: res.data.apellido,
          telefono: res.data.telefono,
          email: res.data.email || '',
          direccion: res.data.direccion || ''
        });
        setFrequentAddresses({
          origenes: res.data.direccionesFrecuentes?.origenes || [],
          destinos: res.data.direccionesFrecuentes?.destinos || []
        });
        toast.success(`Cliente encontrado: ${res.data.nombre} ${res.data.apellido}`);
        setModalStep(3); // Go to trip details
      } else {
        setClientData({
          id: '',
          nombre: '',
          apellido: '',
          telefono: '',
          email: '',
          direccion: ''
        });
        setFrequentAddresses({
          origenes: [],
          destinos: []
        });
        toast.error('Cliente no encontrado. Complete los datos para registrarlo.');
        setModalStep(2); // Complete details
      }
    } catch (err) {
      toast.error('Error al buscar cliente');
      setModalStep(2);
    } finally {
      setBuscandoDni(false);
    }
  };

  const handleRegistrarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientData.nombre || !clientData.apellido || !clientData.telefono || !clientData.direccion) {
      toast.error('Complete todos los campos obligatorios');
      return;
    }
    setCreandoCliente(true);
    try {
      const res = await coordinadorDashboardService.createCliente({
        nombre: clientData.nombre,
        apellido: clientData.apellido,
        dni: dniSearch,
        telefono: clientData.telefono,
        email: clientData.email,
        direccion: clientData.direccion
      });
      if (res.success && res.data) {
        setClientData(prev => ({
          ...prev,
          id: res.data.id
        }));
        setFrequentAddresses({
          origenes: clientData.direccion ? [clientData.direccion] : [],
          destinos: []
        });
        toast.success('Cliente registrado exitosamente');
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
        // Reset states
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

  // Combinar choferes conectados primero y luego el resto de los choferes activos de la remisería
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
    } else {
      setSelectedChoferId('');
      setSelectedVehiculoId(todosLosVehiculos[0]?.id || '');
    }
    setIsAssignModalOpen(true);
  };

  const openAssignModalForChofer = (chofer: any) => {
    if (viajesSinAsignar.length === 0) {
      toast.error('No hay viajes pendientes sin asignar en este momento');
      return;
    }
    setSelectedViajeId(viajesSinAsignar[0].id);
    setSelectedChoferId(chofer.id);
    setSelectedVehiculoId(chofer.vehiculo?.id || chofer.vehiculoId || '');
    setIsAssignModalOpen(true);
  };

  const handleChoferSelectChange = (choferId: string) => {
    setSelectedChoferId(choferId);
    const found = choferesParaAsignar.find((c: any) => c.id === choferId);
    if (found?.vehiculo?.id || found?.vehiculoId) {
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

  const filteredEnCurso = filterList(viajesEnCurso);
  const filteredSinAsignar = filterList(viajesSinAsignar);
  const filteredReservas = filterList(reservas);
  const filteredChoferes = filterList(choferesConectados);

  const tabs = [
    { id: 'en-curso', label: 'Viajes en Curso', icon: Car, count: stats.viajesEnCurso },
    { id: 'sin-asignar', label: 'Sin Asignar', icon: Clock, count: stats.viajesSinAsignar, alert: stats.viajesSinAsignar > 0 },
    { id: 'reservados', label: 'Reservados', icon: Calendar, count: stats.viajesReservados },
    { id: 'conectados', label: 'Conectados', icon: Users, count: choferesConectados.length }
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
              {/* Botón Nuevo Viaje Rápido */}
              <button 
                onClick={() => {
                  setModalStep(1);
                  setIsModalOpen(true);
                }}
                className="bg-green-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg flex items-center space-x-1.5 hover:bg-green-700 transition-colors text-xs sm:text-sm font-semibold shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Nuevo Viaje</span>
              </button>

              {/* Notificaciones */}
              <button className="relative p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors">
                <Bell className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center font-bold">
                  3
                </span>
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
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                title={isSidebarOpen ? "Ocultar panel lateral" : "Mostrar panel de acciones"}
                className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 text-xs sm:text-sm font-medium transition-colors"
              >
                <PanelRight className="h-4 w-4 text-gray-500" />
                <span>{isSidebarOpen ? 'Ocultar Lateral' : 'Panel Rápido'}</span>
              </button>

              {/* Cerrar sesión */}
              <button 
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
                onClick={abrirModalLoteOptimo}
                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow transition-all hover:scale-105 cursor-pointer"
              >
                <Zap className="h-3.5 w-3.5 fill-current" />
                <span>Despacho Óptimo (Lote)</span>
              </button>
              <button 
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

          {/* Contenido de las tablas - Ocupa todo el espacio adaptándose al tamaño de pantalla */}
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
                          <th className="px-3 sm:px-4 py-3 min-w-[130px] lg:w-[16%]">Origen</th>
                          <th className="px-3 sm:px-4 py-3 min-w-[130px] lg:w-[16%]">Destino</th>
                          <th className="px-3 sm:px-4 py-3 w-28 lg:w-[12%]">Chofer</th>
                          <th className="px-3 sm:px-4 py-3 w-32 lg:w-[13%]">Vehículo</th>
                          <th className="px-3 sm:px-4 py-3 w-24 lg:w-[10%]">Estado</th>
                          <th className="px-3 sm:px-4 py-3 w-16 lg:w-[6%]">Tiempo</th>
                          <th className="px-3 sm:px-4 py-3 w-32 lg:w-[12%] text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredEnCurso.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                              <Car className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                              <p className="font-medium text-gray-600">No hay viajes en curso en este momento.</p>
                            </td>
                          </tr>
                        ) : (
                          filteredEnCurso.map((viaje) => (
                            <tr key={viaje.id} className="hover:bg-gray-50/70 transition-colors">
                              <td className="px-3 sm:px-4 py-3">
                                <div className="font-medium text-gray-900 truncate" title={viaje.cliente}>
                                  {viaje.cliente}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center mt-0.5 truncate" title={viaje.telefono}>
                                  <Phone className="h-3 w-3 mr-1 shrink-0 text-gray-400" />
                                  <span>{viaje.telefono}</span>
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
                              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                              <p className="font-medium text-gray-700">¡Al día! No hay viajes pendientes de asignación.</p>
                            </td>
                          </tr>
                        ) : (
                          filteredSinAsignar.map((viaje) => (
                            <tr key={viaje.id} className="hover:bg-red-50/50 bg-red-25/30 transition-colors">
                              <td className="px-3 sm:px-4 py-3">
                                <div className="font-medium text-gray-900 truncate" title={viaje.cliente}>
                                  {viaje.cliente}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center mt-0.5 truncate" title={viaje.telefono}>
                                  <Phone className="h-3 w-3 mr-1 shrink-0 text-gray-400" />
                                  <span>{viaje.telefono}</span>
                                </div>
                              </td>
                              <td className="px-3 sm:px-4 py-3">
                                <div className="text-xs sm:text-sm text-gray-900 line-clamp-2 leading-snug" title={viaje.origen}>
                                  <LocationIcon className="h-3.5 w-3.5 mr-1 inline text-red-500 shrink-0" />
                                  <span>{viaje.origen}</span>
                                </div>
                              </td>
                              <td className="px-3 sm:px-4 py-3">
                                <div className="text-xs sm:text-sm text-gray-900 line-clamp-2 leading-snug" title={viaje.destino}>
                                  <LocationIcon className="h-3.5 w-3.5 mr-1 inline text-red-500 shrink-0" />
                                  <span>{viaje.destino}</span>
                                </div>
                              </td>
                              <td className="px-3 sm:px-4 py-3">
                                <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800 animate-pulse whitespace-nowrap">
                                  {viaje.prioridad}
                                </span>
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-xs font-mono text-gray-700 whitespace-nowrap">
                                {viaje.tiempo}
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => openAssignModalForViaje(viaje)}
                                  className="bg-red-600 hover:bg-red-700 text-white px-2.5 sm:px-3 py-1.5 rounded-lg font-semibold text-xs shadow-sm transition-colors inline-flex items-center space-x-1"
                                >
                                  <Car className="h-3.5 w-3.5" />
                                  <span>Asignar Auto</span>
                                </button>
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
                          <th className="px-3 sm:px-4 py-3 min-w-[140px] lg:w-[28%]">Origen</th>
                          <th className="px-3 sm:px-4 py-3 min-w-[140px] lg:w-[28%]">Destino</th>
                          <th className="px-3 sm:px-4 py-3 w-24 lg:w-[10%]">Fecha</th>
                          <th className="px-3 sm:px-4 py-3 w-20 lg:w-[8%]">Hora</th>
                          <th className="px-3 sm:px-4 py-3 w-20 lg:w-[6%] text-right">Tipo</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredReservas.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                              <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                              <p className="font-medium text-gray-600">No hay reservas pendientes programadas.</p>
                            </td>
                          </tr>
                        ) : (
                          filteredReservas.map((reserva) => (
                            <tr key={reserva.id} className="hover:bg-gray-50/70 transition-colors">
                              <td className="px-3 sm:px-4 py-3">
                                <div className="font-medium text-gray-900 truncate" title={reserva.cliente}>
                                  {reserva.cliente}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center mt-0.5 truncate" title={reserva.telefono}>
                                  <Phone className="h-3 w-3 mr-1 shrink-0 text-gray-400" />
                                  <span>{reserva.telefono}</span>
                                </div>
                              </td>
                              <td className="px-3 sm:px-4 py-3">
                                <div className="text-xs sm:text-sm text-gray-900 line-clamp-2 leading-snug" title={reserva.origen}>
                                  <LocationIcon className="h-3.5 w-3.5 mr-1 inline text-blue-500 shrink-0" />
                                  <span>{reserva.origen}</span>
                                </div>
                              </td>
                              <td className="px-3 sm:px-4 py-3">
                                <div className="text-xs sm:text-sm text-gray-900 line-clamp-2 leading-snug" title={reserva.destino}>
                                  <LocationIcon className="h-3.5 w-3.5 mr-1 inline text-emerald-500 shrink-0" />
                                  <span>{reserva.destino}</span>
                                </div>
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-800 whitespace-nowrap">
                                {reserva.fecha}
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-xs font-mono text-gray-700 whitespace-nowrap">
                                {reserva.hora}
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-right">
                                <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                                  reserva.tipo === 'Periódica' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                                }`}>
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
                  <button onClick={() => {
                    coordinadorDashboardService.getChoferesTiempoReal().then(res => {
                      if (res.success) setChoferesConectados(res.data || []);
                    });
                  }} className="text-xs sm:text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 flex items-center font-medium transition-colors">
                    Actualizar
                  </button>
                </div>
                {filteredChoferes.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
                    <Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p className="font-medium">No hay choferes conectados en este momento.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm divide-y divide-gray-200 table-auto lg:table-fixed">
                        <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          <tr>
                            <th className="px-3 sm:px-4 py-3 w-48 lg:w-[35%]">Chofer</th>
                            <th className="px-3 sm:px-4 py-3 w-44 lg:w-[32%]">Vehículo</th>
                            <th className="px-3 sm:px-4 py-3 w-28 lg:w-[15%]">Estado</th>
                            <th className="px-3 sm:px-4 py-3 w-32 lg:w-[18%] text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredChoferes.map((chofer) => (
                            <tr key={chofer.id} className="hover:bg-gray-50/70 transition-colors">
                              <td className="px-3 sm:px-4 py-3">
                                <div className="flex items-center space-x-2.5">
                                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">
                                    {chofer.nombre?.charAt(0)}{chofer.apellido?.charAt(0)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-medium text-gray-900 truncate" title={`${chofer.nombre} ${chofer.apellido}`}>
                                      {chofer.nombre} {chofer.apellido}
                                    </div>
                                    <div className="text-xs text-gray-500 flex items-center truncate" title={chofer.telefono}>
                                      <Phone className="h-3 w-3 mr-1 shrink-0 text-gray-400" />
                                      <span>{chofer.telefono}</span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 sm:px-4 py-3">
                                {chofer.vehiculo ? (
                                  <div className="min-w-0">
                                    <div className="text-sm text-gray-900 font-medium truncate">{chofer.vehiculo.patente}</div>
                                    <div className="text-xs text-gray-500 truncate">{chofer.vehiculo.marca} {chofer.vehiculo.modelo}</div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">Sin asignar</span>
                                )}
                              </td>
                              <td className="px-3 sm:px-4 py-3">
                                <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800 items-center whitespace-nowrap">
                                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                                  Online
                                </span>
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => openAssignModalForChofer(chofer)}
                                  className="text-blue-700 hover:text-blue-900 font-semibold bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs transition-colors inline-block"
                                >
                                  Asignar Viaje
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
                  onClick={() => setIsSidebarOpen(false)}
                  className="hidden lg:flex text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
                  title="Ocultar panel lateral"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <div className="space-y-3">
                <button 
                  onClick={() => {
                    setModalStep(1);
                    setIsModalOpen(true);
                  }}
                  className="w-full bg-green-600 text-white px-4 py-2.5 rounded-xl flex items-center space-x-3 hover:bg-green-700 transition-colors shadow-sm font-medium text-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>Nuevo Viaje</span>
                </button>

                <Link 
                  href="/coordinador/choferes"
                  className="w-full bg-purple-600 text-white px-4 py-2.5 rounded-xl flex items-center space-x-3 hover:bg-purple-700 transition-colors shadow-sm font-medium text-sm"
                >
                  <Users className="h-4 w-4" />
                  <span>Gestionar Choferes</span>
                </Link>

                <Link 
                  href="/coordinador/reportes"
                  className="w-full bg-gray-600 text-white px-4 py-2.5 rounded-xl flex items-center space-x-3 hover:bg-gray-700 transition-colors shadow-sm font-medium text-sm"
                >
                  <TrendingUp className="h-4 w-4" />
                  <span>Reportes</span>
                </Link>
              </div>

              {/* Información adicional */}
              <div className="mt-6 pt-5 border-t border-gray-200">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Información Rápida</h4>
                
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-gray-600">Vehículos disponibles:</span>
                    <span className="font-semibold text-gray-900">{stats.vehiculosDisponibles}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-gray-600">Choferes activos:</span>
                    <span className="font-bold text-green-600">{choferesConectados.length}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-gray-600">Viajes hoy:</span>
                    <span className="font-semibold text-gray-900">{stats.viajesEnCurso + stats.viajesSinAsignar}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-gray-600">Tiempo promedio:</span>
                    <span className="font-semibold text-gray-900">{stats.tiempoPromedio}</span>
                  </div>

                  {hasAlerts && (
                    <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                        <span className="text-xs font-semibold text-red-800">
                          {stats.viajesSinAsignar} viaje{stats.viajesSinAsignar > 1 ? 's' : ''} pendiente{stats.viajesSinAsignar > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Paso a Paso - Nuevo Viaje */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-100 transform transition-all">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-t-2xl text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">Nuevo Viaje</h3>
                <p className="text-xs text-blue-100">Crear viaje manual - Paso {modalStep} de 3</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="bg-gray-100 h-1.5 w-full flex">
              <div className={`h-full bg-green-500 transition-all duration-300 ${
                modalStep === 1 ? 'w-1/3' : modalStep === 2 ? 'w-2/3' : 'w-full'
              }`}></div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* STEP 1: Pedir DNI */}
              {modalStep === 1 && (
                <form onSubmit={handleBuscarDni} className="space-y-4">
                  <div className="text-center py-2">
                    <User className="h-12 w-12 text-blue-500 mx-auto mb-2" />
                    <h4 className="font-semibold text-gray-800">Buscar Pasajero</h4>
                    <p className="text-sm text-gray-500">Ingrese el DNI para verificar si el cliente ya está registrado en el sistema.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">DNI del Cliente *</label>
                    <input
                      type="text"
                      required
                      value={dniSearch}
                      onChange={(e) => setDniSearch(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg tracking-wider text-center font-semibold text-black"
                      placeholder="12345678"
                      maxLength={8}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={buscandoDni}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 font-semibold transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {buscandoDni ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Buscando cliente...</span>
                      </>
                    ) : (
                      <>
                        <Search className="h-5 w-5" />
                        <span>Buscar y Continuar</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* STEP 2: Completar Datos del Cliente */}
              {modalStep === 2 && (
                <form onSubmit={handleRegistrarCliente} className="space-y-4">
                  <div className="text-left mb-2">
                    <h4 className="font-semibold text-gray-800 text-lg">Registrar Pasajero</h4>
                    <p className="text-sm text-gray-500">El DNI <strong className="text-blue-600">{dniSearch}</strong> no está registrado. Complete los datos mínimos para crear su cuenta.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                      <input
                        type="text"
                        required
                        value={clientData.nombre}
                        onChange={(e) => setClientData({ ...clientData, nombre: e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '') })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                        placeholder="Juan"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Apellido *</label>
                      <input
                        type="text"
                        required
                        value={clientData.apellido}
                        onChange={(e) => setClientData({ ...clientData, apellido: e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '') })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                        placeholder="Pérez"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono *</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <input
                        type="tel"
                        required
                        value={clientData.telefono}
                        onChange={(e) => setClientData({ ...clientData, telefono: e.target.value.replace(/[^0-9+]/g, '') })}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                        placeholder="+541112345678"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dirección Particular *</label>
                    <div className="relative">
                      <LocationIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <input
                        type="text"
                        required
                        value={clientData.direccion}
                        onChange={(e) => {
                          setClientData({ ...clientData, direccion: e.target.value });
                          setIsDireccionSelected(false);
                        }}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                        placeholder="Av. Rivadavia 1234"
                      />
                      {direccionSuggestions.length > 0 && (
                        <ul className="absolute z-[100] w-full bg-white border border-gray-200 mt-1 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-gray-100 text-black">
                          {direccionSuggestions.map((s, idx) => (
                            <li 
                              key={idx}
                              onClick={() => handleSelectDireccion(s)}
                              className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-sm transition-colors text-left flex items-start space-x-2"
                            >
                              <LocationIcon className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                              <span className="font-medium text-gray-800">{s.display_name}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email (Opcional)</label>
                    <input
                      type="email"
                      value={clientData.email}
                      onChange={(e) => setClientData({ ...clientData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                      placeholder="juanperez@ejemplo.com"
                    />
                  </div>

                  <div className="flex justify-between space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setModalStep(1)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                    >
                      Atrás
                    </button>
                    <button
                      type="submit"
                      disabled={creandoCliente}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-semibold transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                      {creandoCliente ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Registrando...</span>
                        </>
                      ) : (
                        <span>Registrar y Continuar</span>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: Detalles del Viaje */}
              {modalStep === 3 && (
                <form onSubmit={handleCrearViaje} className="space-y-4">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-2 flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                      {clientData.nombre.charAt(0)}{clientData.apellido.charAt(0)}
                    </div>
                    <div>
                      <h5 className="font-semibold text-gray-800">{clientData.nombre} {clientData.apellido}</h5>
                      <p className="text-xs text-gray-500">Tel: {clientData.telefono} | DNI: {dniSearch}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Dirección de Origen *</label>
                      <div className="relative">
                        <LocationIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <input
                          type="text"
                          required
                          value={tripData.origen}
                          onChange={(e) => {
                            setTripData({ ...tripData, origen: e.target.value });
                            setOrigenCoords(null);
                            setIsOrigenSelected(false);
                          }}
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                          placeholder="Calle y altura (Origen)"
                        />
                        {origenSuggestions.length > 0 && (
                          <ul className="absolute z-[100] w-full bg-white border border-gray-200 mt-1 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-gray-100 text-black">
                            {origenSuggestions.map((s, idx) => (
                              <li 
                                key={idx}
                                onClick={() => handleSelectOrigen(s)}
                                className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-sm transition-colors text-left flex items-start space-x-2"
                              >
                                <LocationIcon className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                                <span className="font-medium text-gray-800">{s.display_name}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {frequentAddresses.origenes.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1 items-center">
                          <span className="text-[10px] text-gray-400 mr-1 uppercase font-semibold">Frecuentes:</span>
                          {frequentAddresses.origenes.map((addr, idx) => (
                             <button
                               key={idx}
                               type="button"
                               onClick={() => setTripData(prev => ({ ...prev, origen: addr }))}
                               className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-0.5 rounded-full border border-blue-100 transition-colors"
                             >
                               {addr}
                             </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Dirección de Destino *</label>
                      <div className="relative">
                        <LocationIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <input
                          type="text"
                          required
                          value={tripData.destino}
                          onChange={(e) => {
                            setTripData({ ...tripData, destino: e.target.value });
                            setDestinoCoords(null);
                            setIsDestinoSelected(false);
                          }}
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                          placeholder="Calle y altura (Destino)"
                        />
                        {destinoSuggestions.length > 0 && (
                          <ul className="absolute z-[100] w-full bg-white border border-gray-200 mt-1 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-gray-100 text-black">
                            {destinoSuggestions.map((s, idx) => (
                              <li 
                                key={idx}
                                onClick={() => handleSelectDestino(s)}
                                className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-sm transition-colors text-left flex items-start space-x-2"
                              >
                                <LocationIcon className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                                <span className="font-medium text-gray-800">{s.display_name}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {frequentAddresses.destinos.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1 items-center">
                          <span className="text-[10px] text-gray-400 mr-1 uppercase font-semibold">Frecuentes:</span>
                          {frequentAddresses.destinos.map((addr, idx) => (
                             <button
                               key={idx}
                               type="button"
                               onClick={() => setTripData(prev => ({ ...prev, destino: addr }))}
                               className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-100 transition-colors"
                             >
                               {addr}
                             </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cuándo viajar</label>
                        <select
                          value={tripData.tipoViaje}
                          onChange={(e) => setTripData({ ...tripData, tipoViaje: e.target.value as 'inmediato' | 'programado' })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                        >
                          <option value="inmediato">Ahora mismo</option>
                          <option value="programado">Horario específico</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                        <select
                          value={tripData.prioridad}
                          onChange={(e) => setTripData({ ...tripData, prioridad: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                        >
                          <option value="BAJA">Baja</option>
                          <option value="NORMAL">Normal</option>
                          <option value="ALTA">Alta</option>
                          <option value="URGENTE">Urgente</option>
                        </select>
                      </div>
                    </div>

                    {tripData.tipoViaje === 'programado' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Reserva *</label>
                          <input
                            type="date"
                            required
                            value={tripData.fecha}
                            onChange={(e) => setTripData({ ...tripData, fecha: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Hora de Reserva *</label>
                          <input
                            type="time"
                            required
                            value={tripData.hora}
                            onChange={(e) => setTripData({ ...tripData, hora: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Precio Estimado ($) *</label>
                        <input
                          type="number"
                          required
                          value={tripData.precio}
                          onChange={(e) => setTripData({ ...tripData, precio: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                          placeholder="1500"
                          min="1"
                        />
                      </div>
                      {distanciaEstimada !== null && (
                        <div className="flex flex-col justify-end pb-2">
                          <span className="text-xs text-gray-500">Distancia aproximada:</span>
                          <span className="text-sm font-bold text-gray-800">{distanciaEstimada} KM</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                      <textarea
                        value={tripData.observaciones}
                        onChange={(e) => setTripData({ ...tripData, observaciones: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                        rows={2}
                        placeholder="Notas para el chofer..."
                      />
                    </div>
                  </div>

                  <div className="flex justify-between space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setModalStep(clientData.id ? 1 : 2)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                    >
                      Atrás
                    </button>
                    <button
                      type="submit"
                      disabled={creandoViaje}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-semibold transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                      {creandoViaje ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Creando viaje...</span>
                        </>
                      ) : (
                        <span>Crear Viaje</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Asignación de Auto y Chofer */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-100 transform transition-all">
            <div className="bg-gradient-to-r from-red-600 to-orange-600 p-6 rounded-t-2xl text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Car className="h-6 w-6" />
                  <span>Asignar Auto al Viaje</span>
                </h3>
                <p className="text-xs text-red-100 mt-1">
                  Selecciona el chofer y vehículo para atender la solicitud del cliente
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

            <form onSubmit={handleAsignarViaje} className="p-6 space-y-5">
              {/* Selección o Resumen del Viaje Pendiente */}
              {viajesSinAsignar.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Viaje Pendiente *
                  </label>
                  <select
                    value={selectedViajeId}
                    onChange={(e) => setSelectedViajeId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 text-black text-sm"
                    required
                  >
                    {viajesSinAsignar.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.cliente} — {v.origen} → {v.destino} ({v.tiempo})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedViajeObj && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <div>
                      <span className="text-xs text-gray-500 block">Pasajero</span>
                      <span className="font-bold text-gray-900">{selectedViajeObj.cliente}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500 block">Teléfono</span>
                      <span className="font-medium text-gray-800">{selectedViajeObj.telefono}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Origen</span>
                    <span className="font-medium text-gray-900">{selectedViajeObj.origen}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Destino</span>
                    <span className="font-medium text-gray-900">{selectedViajeObj.destino}</span>
                  </div>
                  {selectedViajeObj.observaciones && (
                    <div>
                      <span className="text-xs text-gray-500 block">Observaciones</span>
                      <span className="text-gray-700 italic">{selectedViajeObj.observaciones}</span>
                    </div>
                  )}
                  {selectedViajeObj.precio && (
                    <div className="pt-1 flex justify-between items-center text-xs">
                      <span className="text-gray-500">Tarifa estimada:</span>
                      <span className="font-bold text-base text-emerald-700">${selectedViajeObj.precio}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Selección de Chofer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seleccionar Chofer *
                </label>
                {choferesParaAsignar.length === 0 ? (
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">
                    No hay choferes activos registrados en esta remisería.
                  </p>
                ) : (
                  <select
                    value={selectedChoferId}
                    onChange={(e) => handleChoferSelectChange(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-black text-sm"
                    required
                  >
                    <option value="">-- Seleccione un chofer --</option>
                    {choferesParaAsignar.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.isOnline ? '🟢 [ONLINE] ' : '⚪ [ACTIVO] '}
                        {c.nombre} {c.apellido}
                        {c.vehiculo ? ` — Auto: ${c.vehiculo.patente} (${c.vehiculo.marca} ${c.vehiculo.modelo})` : ' — Sin auto fijo'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Selección de Vehículo (Auto) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seleccionar Auto (Vehículo)
                </label>
                <select
                  value={selectedVehiculoId}
                  onChange={(e) => setSelectedVehiculoId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-black text-sm"
                >
                  <option value="">-- Usar vehículo del chofer / Sin especificar --</option>
                  {todosLosVehiculos.map((veh: any) => (
                    <option key={veh.id} value={veh.id}>
                      {veh.patente} — {veh.marca} {veh.modelo} ({veh.color})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Si el chofer ya tiene un auto vinculado, se selecciona automáticamente, o puedes asignarle otro vehículo disponible.
                </p>
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
                  className="flex-1 bg-red-600 text-white py-2.5 px-5 rounded-xl hover:bg-red-700 font-semibold transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 text-sm shadow-lg"
                >
                  {asignandoViaje ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Asignando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Confirmar y Asignar Auto</span>
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
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Zap className="h-6 w-6 fill-current" />
                  <span>Despacho Óptimo por Lotes</span>
                </h3>
                <p className="text-xs text-amber-100 mt-1">
                  Algoritmo Global de Asignación Bipartita (Kuhn-Munkres / Uber-style)
                </p>
              </div>
              <button
                onClick={() => setIsBatchModalOpen(false)}
                className="p-1 rounded-full hover:bg-white/20 transition-colors text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {isLoadingBatch ? (
                <div className="py-12 text-center space-y-4">
                  <Loader2 className="h-10 w-10 animate-spin text-amber-500 mx-auto" />
                  <p className="text-sm font-semibold text-gray-700">
                    Calculando matriz de distancias y tiempos de llegada óptimos...
                  </p>
                  <p className="text-xs text-gray-400 max-w-md mx-auto">
                    Evaluando todas las combinaciones posibles entre choferes libres y viajes pendientes para minimizar la espera global.
                  </p>
                </div>
              ) : !batchResult || batchResult.matches?.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h4 className="text-base font-bold text-gray-800">
                    {batchResult?.mensaje || 'No hay suficientes viajes o choferes libres para formar un lote'}
                  </h4>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    Para ejecutar una asignación por lotes se requiere al menos 1 viaje pendiente y 1 chofer conectado y disponible.
                  </p>
                </div>
              ) : (
                <>
                  {/* Banner de Métricas del Lote */}
                  <div className="grid grid-cols-3 gap-3 bg-gradient-to-br from-amber-50 to-orange-50 p-4 rounded-xl border border-amber-200">
                    <div className="text-center">
                      <span className="block text-2xl font-black text-amber-600">
                        {batchResult.matches.length}
                      </span>
                      <span className="text-[11px] font-semibold text-gray-600 uppercase">
                        Viajes Asignados
                      </span>
                    </div>
                    <div className="text-center border-x border-amber-200">
                      <span className="block text-2xl font-black text-emerald-600">
                        {batchResult.ahorroTotalMinutos > 0 ? `-${batchResult.ahorroTotalMinutos} min` : 'Óptimo'}
                      </span>
                      <span className="text-[11px] font-semibold text-gray-600 uppercase">
                        Ahorro de Espera
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="block text-2xl font-black text-blue-600">
                        {batchResult.porcentajeMejora > 0 ? `+${batchResult.porcentajeMejora}%` : '100%'}
                      </span>
                      <span className="text-[11px] font-semibold text-gray-600 uppercase">
                        Eficiencia Flota
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    💡 <strong>¿Cómo funciona?</strong> A diferencia de asignar choferes uno a uno al azar, el algoritmo evalúa a todos los pasajeros y autos simultáneamente, encontrando el reparto que minimiza el tiempo total que espera cada cliente y el gasto de nafta de los choferes.
                  </p>

                  {/* Lista de Asignaciones Sugeridas */}
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Asignaciones Sugeridas en este Lote:
                    </h4>
                    {batchResult.matches.map((m: any, idx: number) => (
                      <div
                        key={m.viajeId}
                        className="p-3.5 rounded-xl border border-gray-200 bg-white hover:border-amber-400 hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        {/* Pasajero y Viaje */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                              {idx + 1}
                            </span>
                            <span className="font-semibold text-sm text-gray-900 truncate">
                              {m.viaje.clienteNombre}
                            </span>
                            {m.viaje.tiempoEsperaMinutos > 0 && (
                              <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                                Espera: {m.viaje.tiempoEsperaMinutos}m
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 truncate mt-1 pl-7">
                            📍 {m.viaje.origen} ➔ {m.viaje.destino}
                          </p>
                        </div>

                        {/* Indicador de Distancia / ETA */}
                        <div className="flex items-center justify-center px-2 py-1 bg-amber-50 rounded-lg text-amber-800 text-xs font-bold shrink-0">
                          <span>{m.distanciaKm} km (~{m.etaMinutos} min)</span>
                        </div>

                        {/* Chofer Asignado */}
                        <div className="flex-1 min-w-0 text-left sm:text-right pl-7 sm:pl-0">
                          <p className="text-xs font-bold text-gray-900 truncate">
                            🚗 {m.chofer.nombre} {m.chofer.apellido}
                          </p>
                          <p className="text-[11px] text-gray-500 truncate">
                            {m.vehiculo ? `${m.vehiculo.patente} (${m.vehiculo.marca} ${m.vehiculo.modelo})` : 'Auto Vinculado'}
                          </p>
                          {(m.chofer.minutosEsperandoTurno !== undefined || m.chofer.recaudadoHoy !== undefined) && (
                            <p className="text-[10px] text-emerald-700 font-medium truncate mt-0.5">
                              ⏱️ En fila: {m.chofer.minutosEsperandoTurno ?? 0}m · 💰 Hoy: ${(m.chofer.recaudadoHoy ?? 0).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Botones de Acción */}
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
    </div>
  );
}