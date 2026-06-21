'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { coordinadorDashboardService, clienteAuthService } from '@/lib/api';
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
  X
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
  const [choferesConectados, setChoferesConectados] = useState<any[]>([]);

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
      // 5. Drivers
      const choferesRes = await coordinadorDashboardService.getChoferesTiempoReal();

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
        const vehiculoName = v.vehiculo ? `${v.vehiculo.patente}` : 'Sin Asignar';
        const formattedTime = new Date(v.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const formattedDate = new Date(v.fecha).toLocaleDateString();

        return {
          id: v.id,
          cliente: clienteName,
          telefono: clienteTel,
          origen: v.origen,
          destino: v.destino,
          chofer: choferName,
          vehiculo: vehiculoName,
          estado: v.estado === 'EN_CURSO' ? 'En Curso' : v.estado,
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

  const tabs = [
    { id: 'en-curso', label: 'Viajes en Curso', icon: Car, count: stats.viajesEnCurso },
    { id: 'sin-asignar', label: 'Sin Asignar', icon: Clock, count: stats.viajesSinAsignar, alert: stats.viajesSinAsignar > 0 },
    { id: 'reservados', label: 'Reservados', icon: Calendar, count: stats.viajesReservados },
    { id: 'conectados', label: 'Conectados', icon: Users, count: choferesConectados.length }
  ];

  const hasAlerts = stats.viajesSinAsignar > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard Coordinador</h1>
              <p className="text-sm text-gray-600">Bienvenido, {user?.coordinador?.nombre || user?.email}</p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Notificaciones */}
              <button className="relative p-2 text-gray-600 hover:text-gray-900">
                <Bell className="h-6 w-6" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  3
                </span>
              </button>
              
              {/* Cierre de Caja */}
              <Link 
                href="/coordinador/cierre"
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-emerald-700 transition-colors"
              >
                <DollarSign className="h-4 w-4" />
                <span>Cierre de Caja Chofer</span>
              </Link>

              {/* Mapa en tiempo real */}
              <Link 
                href="/coordinador/mapa"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700"
              >
                <MapPin className="h-4 w-4" />
                <span>Ver Mapa</span>
              </Link>

              {/* Cerrar sesión */}
              <button 
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-red-700 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Alerta de viajes sin asignar */}
      {hasAlerts && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-400 mr-3" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">
                ¡Atención! Tienes {stats.viajesSinAsignar} viaje{stats.viajesSinAsignar > 1 ? 's' : ''} sin asignar
              </p>
              <p className="text-sm text-red-700">
                Asigna choferes y vehículos lo antes posible para evitar retrasos
              </p>
            </div>
            <button 
              onClick={() => setActiveTab('sin-asignar')}
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Ver Viajes
            </button>
          </div>
        </div>
      )}

      <div className="flex h-screen">
        {/* Panel principal - Tablas */}
        <div className="flex-1 flex flex-col">
          {/* Estadísticas rápidas */}
          <div className="bg-white shadow-sm border-b p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.viajesEnCurso}</div>
                <div className="text-sm text-gray-600">En Curso</div>
              </div>
              <div className={`text-center ${hasAlerts ? 'bg-red-50 rounded-lg p-2 border-2 border-red-200' : ''}`}>
                <div className={`text-2xl font-bold ${hasAlerts ? 'text-red-600' : 'text-yellow-600'}`}>
                  {stats.viajesSinAsignar}
                  {hasAlerts && (
                    <span className="ml-2 inline-block animate-pulse">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600">Sin Asignar</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.choferesDisponibles}</div>
                <div className="text-sm text-gray-600">Choferes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.vehiculosDisponibles}</div>
                <div className="text-sm text-gray-600">Vehículos</div>
              </div>
            </div>
          </div>

          {/* Barra de búsqueda */}
          <div className="bg-white shadow-sm border-b p-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="text"
                    placeholder="Buscar por cliente, chofer, dirección..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Filter className="h-4 w-4" />
                  <span>Filtros</span>
                </button>
                
                <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option>Hoy</option>
                  <option>Esta semana</option>
                  <option>Este mes</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tabs de navegación */}
          <div className="bg-white shadow-sm border-b">
            <nav className="flex space-x-8 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 relative ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } ${tab.alert ? 'bg-red-50 rounded-t-lg' : ''}`}
                >
                  <tab.icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                  <span className={`py-1 px-2 rounded-full text-xs ${
                    tab.alert 
                      ? 'bg-red-100 text-red-900 animate-pulse' 
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    {tab.count}
                  </span>
                  {tab.alert && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Contenido de las tablas - Ocupa todo el espacio restante */}
          <div className="flex-1 overflow-auto">
            {activeTab === 'en-curso' && (
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Viajes en Curso</h3>
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origen</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destino</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chofer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehículo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tiempo</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {viajesEnCurso.map((viaje) => (
                        <tr key={viaje.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{viaje.cliente}</div>
                              <div className="text-sm text-gray-500 flex items-center">
                                <Phone className="h-3 w-3 mr-1" />
                                {viaje.telefono}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 flex items-center">
                              <LocationIcon className="h-3 w-3 mr-1" />
                              {viaje.origen}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 flex items-center">
                              <LocationIcon className="h-3 w-3 mr-1" />
                              {viaje.destino}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{viaje.chofer}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{viaje.vehiculo}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              {viaje.estado}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{viaje.tiempo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'sin-asignar' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Viajes Sin Asignar</h3>
                  {hasAlerts && (
                    <div className="flex items-center space-x-2 bg-red-100 text-red-800 px-3 py-1 rounded-full">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-medium">Requiere atención</span>
                    </div>
                  )}
                </div>
                <div className="bg-white rounded-lg shadow overflow-hidden border-2 border-red-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-red-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-red-600 uppercase tracking-wider">Cliente</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-red-600 uppercase tracking-wider">Origen</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-red-600 uppercase tracking-wider">Destino</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-red-600 uppercase tracking-wider">Prioridad</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-red-600 uppercase tracking-wider">Tiempo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-red-600 uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {viajesSinAsignar.map((viaje) => (
                        <tr key={viaje.id} className="hover:bg-red-50 bg-red-25">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{viaje.cliente}</div>
                              <div className="text-sm text-gray-500 flex items-center">
                                <Phone className="h-3 w-3 mr-1" />
                                {viaje.telefono}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 flex items-center">
                              <LocationIcon className="h-3 w-3 mr-1" />
                              {viaje.origen}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 flex items-center">
                              <LocationIcon className="h-3 w-3 mr-1" />
                              {viaje.destino}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 animate-pulse">
                              {viaje.prioridad}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{viaje.tiempo}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button className="text-red-600 hover:text-red-900 font-semibold">Asignar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'reservados' && (
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Viajes Reservados</h3>
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origen</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destino</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reservas.map((reserva) => (
                        <tr key={reserva.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{reserva.cliente}</div>
                              <div className="text-sm text-gray-500 flex items-center">
                                <Phone className="h-3 w-3 mr-1" />
                                {reserva.telefono}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 flex items-center">
                              <LocationIcon className="h-3 w-3 mr-1" />
                              {reserva.origen}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 flex items-center">
                              <LocationIcon className="h-3 w-3 mr-1" />
                              {reserva.destino}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{reserva.fecha}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{reserva.hora}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{reserva.tipo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'conectados' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Choferes Conectados ({choferesConectados.length})</h3>
                  <button onClick={() => {
                    coordinadorDashboardService.getChoferesTiempoReal().then(res => {
                      if (res.success) setChoferesConectados(res.data || []);
                    });
                  }} className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100 flex items-center">
                    Actualizar
                  </button>
                </div>
                {choferesConectados.length === 0 ? (
                  <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    No hay choferes conectados en este momento.
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow overflow-hidden border">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chofer</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehículo</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {choferesConectados.map((chofer) => (
                          <tr key={chofer.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3">
                                  {chofer.nombre.charAt(0)}{chofer.apellido.charAt(0)}
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{chofer.nombre} {chofer.apellido}</div>
                                  <div className="text-sm text-gray-500 flex items-center">
                                    <Phone className="h-3 w-3 mr-1" />
                                    {chofer.telefono}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {chofer.vehiculo ? (
                                <div>
                                  <div className="text-sm text-gray-900 font-medium">{chofer.vehiculo.patente}</div>
                                  <div className="text-sm text-gray-500">{chofer.vehiculo.marca} {chofer.vehiculo.modelo}</div>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-500 italic">Sin asignar</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 flex items-center">
                                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                                Online
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button className="text-blue-600 hover:text-blue-900 font-semibold bg-blue-50 px-3 py-1 rounded">Asignar Viaje</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Panel lateral derecho - Botones de acción */}
        <div className="w-80 bg-white shadow-lg border-l">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Acciones Rápidas</h3>
            
            <div className="space-y-4">
              <button 
                onClick={() => {
                  setModalStep(1);
                  setIsModalOpen(true);
                }}
                className="w-full bg-green-600 text-white px-4 py-3 rounded-lg flex items-center space-x-3 hover:bg-green-700 transition-colors text-left"
              >
                <Plus className="h-5 w-5" />
                <span>Nuevo Viaje</span>
              </button>


              <Link 
                href="/coordinador/choferes"
                className="w-full bg-purple-600 text-white px-4 py-3 rounded-lg flex items-center space-x-3 hover:bg-purple-700 transition-colors"
              >
                <Users className="h-5 w-5" />
                <span>Gestionar Choferes</span>
              </Link>

              <Link 
                href="/coordinador/reportes"
                className="w-full bg-gray-600 text-white px-4 py-3 rounded-lg flex items-center space-x-3 hover:bg-gray-700 transition-colors"
              >
                <TrendingUp className="h-5 w-5" />
                <span>Reportes</span>
              </Link>
            </div>

            {/* Información adicional */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-4">Información Rápida</h4>
              
              <div className="space-y-3">
                 <div className="flex items-center justify-between text-sm">
                   <span className="text-gray-600">Vehículos disponibles:</span>
                   <span className="font-medium">{stats.vehiculosDisponibles}</span>
                 </div>
                 
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Choferes activos:</span>
                    <span className="font-medium text-green-600 font-bold">{choferesConectados.length}</span>
                  </div>
                 
                 <div className="flex items-center justify-between text-sm">
                   <span className="text-gray-600">Viajes hoy:</span>
                   <span className="font-medium">{stats.viajesEnCurso + stats.viajesSinAsignar}</span>
                 </div>

                 <div className="flex items-center justify-between text-sm">
                   <span className="text-gray-600">Tiempo promedio:</span>
                   <span className="font-medium">{stats.tiempoPromedio}</span>
                 </div>

                {hasAlerts && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium text-red-800">
                        {stats.viajesSinAsignar} viaje{stats.viajesSinAsignar > 1 ? 's' : ''} pendiente{stats.viajesSinAsignar > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
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
    </div>
  );
}