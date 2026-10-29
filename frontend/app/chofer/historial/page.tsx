'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { coordinadorDashboardService, choferService } from '@/lib/api';
import {
  DollarSign,
  Calendar,
  Fuel,
  FileText,
  User,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  MapPin,
  Navigation,
  Search,
  X,
  Banknote,
  CreditCard,
  UserCheck,
  Car,
  Layers,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';

type DateFilterType = 'TODOS' | 'HOY' | 'AYER' | 'SEMANA' | 'FECHA_EXACTA' | 'PERIODO';

// Formato local YYYY-MM-DD
const toLocalYMD = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function ChoferHistorialPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'viajes' | 'cierres'>('viajes');
  const [viewMode, setViewMode] = useState<'turnos' | 'lista'>('turnos');
  const [searchTerm, setSearchTerm] = useState('');

  // Filtros de fecha y período
  const [filterType, setFilterType] = useState<DateFilterType>('TODOS');
  const [fechaExacta, setFechaExacta] = useState<string>(() => toLocalYMD(new Date()));
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');

  // Datos
  const [viajes, setViajes] = useState<any[]>([]);
  const [turnos, setTurnos] = useState<any[]>([]);
  const [loadingViajes, setLoadingViajes] = useState(false);
  const [liquidaciones, setLiquidaciones] = useState<any[]>([]);
  const [loadingCierres, setLoadingCierres] = useState(false);

  // Estados de acordeón
  const [expandedTurnos, setExpandedTurnos] = useState<Record<string, boolean>>({});
  const [expandedLiq, setExpandedLiq] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadData();
    loadCierres();
  }, [user]);

  const loadData = async () => {
    try {
      setLoadingViajes(true);
      const [viajesRes, turnosRes] = await Promise.all([
        choferService.getMisViajes(user?.chofer?.id),
        choferService.getMisTurnos(user?.chofer?.id),
      ]);

      if (viajesRes.success && viajesRes.data) {
        setViajes(viajesRes.data);
      }
      if (turnosRes.success && turnosRes.data) {
        setTurnos(turnosRes.data);
        // Expandir por defecto el turno activo o el más reciente
        const initialExpanded: Record<string, boolean> = {};
        turnosRes.data.forEach((t: any, idx: number) => {
          if (t.activo || idx === 0) {
            initialExpanded[t.id] = true;
          }
        });
        setExpandedTurnos(initialExpanded);
      }
    } catch (error) {
      console.error('Error cargando historial del chofer:', error);
      toast.error('Error al cargar datos de viajes y turnos');
    } finally {
      setLoadingViajes(false);
    }
  };

  const loadCierres = async () => {
    try {
      setLoadingCierres(true);
      const response = await coordinadorDashboardService.getHistorialChofer();
      if (response.success && response.data) {
        setLiquidaciones(response.data);
      } else {
        toast.error('Error al cargar historial de cierres');
      }
    } catch (error) {
      console.error('Error loading driver closures:', error);
      toast.error('Error al cargar cierres de caja');
    } finally {
      setLoadingCierres(false);
    }
  };

  const toggleExpandTurno = (id: string) => {
    setExpandedTurnos((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAllTurnos = (turnosList: any[]) => {
    const allExp: Record<string, boolean> = {};
    turnosList.forEach((t) => {
      allExp[t.id] = true;
    });
    allExp['sin-turno'] = true;
    setExpandedTurnos(allExp);
  };

  const collapseAllTurnos = () => {
    setExpandedTurnos({});
  };

  const toggleExpand = (id: string) => {
    setExpandedLiq(expandedLiq === id ? null : id);
  };

  // Navegación rápida para fecha exacta
  const handlePrevDay = () => {
    const d = new Date(fechaExacta + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setFechaExacta(toLocalYMD(d));
  };

  const handleNextDay = () => {
    const d = new Date(fechaExacta + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    setFechaExacta(toLocalYMD(d));
  };

  const handleToday = () => {
    setFechaExacta(toLocalYMD(new Date()));
  };

  // Helper para verificar si una fecha cae en el filtro actual
  const isInDateFilter = (dateVal: string | Date | null | undefined): boolean => {
    if (!dateVal) return false;
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return false;
    const ymd = toLocalYMD(d);

    if (filterType === 'TODOS') return true;

    if (filterType === 'HOY') {
      return ymd === toLocalYMD(new Date());
    }

    if (filterType === 'AYER') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return ymd === toLocalYMD(yesterday);
    }

    if (filterType === 'SEMANA') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);
      return d >= weekAgo;
    }

    if (filterType === 'FECHA_EXACTA') {
      if (!fechaExacta) return true;
      return ymd === fechaExacta;
    }

    if (filterType === 'PERIODO') {
      if (fechaDesde && ymd < fechaDesde) return false;
      if (fechaHasta && ymd > fechaHasta) return false;
      return true;
    }

    return true;
  };

  // Filtrado de Viajes por Fecha y Término de Búsqueda
  const viajesFiltrados = useMemo(() => {
    return viajes.filter((v) => {
      // 1. Filtro de fecha
      if (!isInDateFilter(v.fecha)) return false;

      // 2. Filtro de búsqueda rápida
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();

      const origen = (v.origen || '').toLowerCase();
      const destino = (v.destino || '').toLowerCase();
      const precioStr = String(v.precio || '');
      const clienteNombre = (
        v.clienteNombre ||
        (v.cliente ? `${v.cliente.nombre || ''} ${v.cliente.apellido || ''}` : '')
      ).toLowerCase();
      const clienteTel = (v.clienteTelefono || v.cliente?.telefono || '').toLowerCase();
      const estado = (v.estado || '').toLowerCase();
      const metodo = (v.metodoPago || 'EFECTIVO').toLowerCase();
      const fechaStr = v.fecha ? new Date(v.fecha).toLocaleDateString('es-AR') : '';

      const matchMetodo =
        (metodo === 'transferencia' && (term.includes('trans') || term.includes('mp') || term.includes('tarj'))) ||
        (metodo === 'efectivo' && (term.includes('efec') || term.includes('cash')));

      return (
        origen.includes(term) ||
        destino.includes(term) ||
        precioStr.includes(term) ||
        `$${precioStr}`.includes(term) ||
        clienteNombre.includes(term) ||
        clienteTel.includes(term) ||
        estado.includes(term) ||
        fechaStr.includes(term) ||
        matchMetodo
      );
    });
  }, [viajes, filterType, fechaExacta, fechaDesde, fechaHasta, searchTerm]);

  // Agrupación de Viajes por Turno
  const turnosAgrupados = useMemo(() => {
    // Ordenar turnos del más reciente al más antiguo
    const sortedTurnos = [...turnos].sort(
      (a, b) => new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime()
    );

    // Mapear cada turno con sus viajes
    const groupsMap = new Map<string, { turno: any; viajes: any[] }>();
    sortedTurnos.forEach((t) => {
      groupsMap.set(t.id, { turno: t, viajes: [] });
    });

    const viajesSinTurno: any[] = [];

    viajesFiltrados.forEach((v) => {
      const vTime = new Date(v.fecha).getTime();

      // Buscar el turno que abarca este viaje
      const matchingTurno = sortedTurnos.find((t) => {
        const start = new Date(t.fechaInicio).getTime();
        // Margen de 15 minutos previo por si inició el viaje antes de abrir turno
        if (t.activo) {
          return vTime >= start - 15 * 60 * 1000;
        }
        if (t.fechaFin) {
          const end = new Date(t.fechaFin).getTime();
          return vTime >= start - 15 * 60 * 1000 && vTime <= end + 20 * 60 * 1000;
        }
        // Turno no activo y sin fecha fin: ventana de hasta 16 horas
        return vTime >= start - 15 * 60 * 1000 && vTime <= start + 16 * 3600 * 1000;
      });

      if (matchingTurno && groupsMap.has(matchingTurno.id)) {
        groupsMap.get(matchingTurno.id)!.viajes.push(v);
      } else {
        viajesSinTurno.push(v);
      }
    });

    const result: Array<{
      id: string;
      isCustomGroup?: boolean;
      title: string;
      subTitle: string;
      fechaInicio: Date;
      fechaFin: Date | null;
      duracion: string;
      activo: boolean;
      vehiculoInfo: string | null;
      turno: any | null;
      viajes: any[];
      totalRecaudado: number;
      totalViajes: number;
      kmTotal: number;
      kmConPasajero: number;
      kmSinPasajero: number;
    }> = [];

    // Procesar los turnos
    groupsMap.forEach(({ turno, viajes: turnoViajes }) => {
      // Filtrar el turno por fecha si no tiene viajes asociados en el período filtrado
      const turnoInDate =
        isInDateFilter(turno.fechaInicio) ||
        (turno.fechaFin && isInDateFilter(turno.fechaFin)) ||
        turno.activo;

      // Si hay término de búsqueda activo y el turno no tiene viajes que coincidan, ocultar el turno
      if (searchTerm.trim() && turnoViajes.length === 0) {
        return;
      }

      // Si no cae en el filtro de fecha y tampoco tiene viajes filtrados, ignorar
      if (!turnoInDate && turnoViajes.length === 0) {
        return;
      }

      const fInicio = new Date(turno.fechaInicio);
      const fFin = turno.fechaFin ? new Date(turno.fechaFin) : null;

      // Cálculo de duración
      const endTime = fFin ? fFin.getTime() : turno.activo ? Date.now() : fInicio.getTime();
      const diffMins = Math.max(0, Math.floor((endTime - fInicio.getTime()) / (1000 * 60)));
      const durHours = Math.floor(diffMins / 60);
      const durRestMins = diffMins % 60;
      const duracionStr =
        durHours > 0 ? `${durHours}h ${durRestMins}m` : `${durRestMins} min`;

      // Formato de horas
      const horaInicioStr = fInicio.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const horaFinStr = fFin
        ? fFin.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
        : turno.activo
        ? 'En curso'
        : 'Finalizado';

      const fechaStr = fInicio.toLocaleDateString('es-AR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      const totalRecaudado = turnoViajes.reduce((sum, v) => sum + Number(v.precio || 0), 0);
      const kmConPas = turnoViajes.reduce((sum, v) => sum + Number(v.distanciaKmConPasajero || 0), 0);
      const kmSinPas = turnoViajes.reduce((sum, v) => sum + Number(v.distanciaKmSinPasajero || 0), 0);
      const kmTotal = turno.kmTotalConectado || kmConPas + kmSinPas;

      let vehiculoInfo = null;
      if (turno.vehiculo) {
        vehiculoInfo = `${turno.vehiculo.patente}${
          turno.vehiculo.marca ? ` - ${turno.vehiculo.marca} ${turno.vehiculo.modelo || ''}` : ''
        }`;
      }

      result.push({
        id: turno.id,
        title: fechaStr,
        subTitle: `${horaInicioStr} a ${horaFinStr} (${duracionStr})`,
        fechaInicio: fInicio,
        fechaFin: fFin,
        duracion: duracionStr,
        activo: Boolean(turno.activo),
        vehiculoInfo,
        turno,
        viajes: turnoViajes,
        totalRecaudado,
        totalViajes: turnoViajes.length,
        kmTotal,
        kmConPasajero: kmConPas,
        kmSinPasajero: kmSinPas,
      });
    });

    // Si hay viajes sin turno asignado, agregarlos al final
    if (viajesSinTurno.length > 0) {
      const totalRec = viajesSinTurno.reduce((sum, v) => sum + Number(v.precio || 0), 0);
      const kmCon = viajesSinTurno.reduce((sum, v) => sum + Number(v.distanciaKmConPasajero || 0), 0);
      const kmSin = viajesSinTurno.reduce((sum, v) => sum + Number(v.distanciaKmSinPasajero || 0), 0);

      result.push({
        id: 'sin-turno',
        isCustomGroup: true,
        title: 'Otros Viajes / Sin Turno Asignado',
        subTitle: `${viajesSinTurno.length} ${viajesSinTurno.length === 1 ? 'viaje registrado' : 'viajes registrados'}`,
        fechaInicio: new Date(viajesSinTurno[0]?.fecha || Date.now()),
        fechaFin: null,
        duracion: '-',
        activo: false,
        vehiculoInfo: null,
        turno: null,
        viajes: viajesSinTurno,
        totalRecaudado: totalRec,
        totalViajes: viajesSinTurno.length,
        kmTotal: kmCon + kmSin,
        kmConPasajero: kmCon,
        kmSinPasajero: kmSin,
      });
    }

    return result;
  }, [turnos, viajesFiltrados, filterType, fechaExacta, fechaDesde, fechaHasta, searchTerm]);

  // Métricas totales del período filtrado
  const metricasPeriodo = useMemo(() => {
    const totalRecaudado = viajesFiltrados.reduce((sum, v) => sum + Number(v.precio || 0), 0);
    const totalKmConPas = viajesFiltrados.reduce(
      (sum, v) => sum + Number(v.distanciaKmConPasajero || 0),
      0
    );
    const cantTurnos = turnosAgrupados.filter((g) => !g.isCustomGroup).length;

    return {
      totalRecaudado,
      totalViajes: viajesFiltrados.length,
      cantTurnos,
      totalKmConPas,
    };
  }, [viajesFiltrados, turnosAgrupados]);

  // Filtrado de Cierres de Caja en tiempo real
  const liquidacionesFiltradas = useMemo(() => {
    return liquidaciones.filter((liq) => {
      // 1. Filtro de fecha
      if (!isInDateFilter(liq.fecha)) return false;

      // 2. Filtro de término de búsqueda
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();

      const coordNombre = (
        liq.coordinador?.coordinador?.nombre ||
        liq.coordinador?.duenio?.nombre ||
        liq.coordinador?.email ||
        ''
      ).toLowerCase();
      const coordEmail = (liq.coordinador?.email || '').toLowerCase();
      const obs = (liq.observaciones || '').toLowerCase();
      const totalStr = String(liq.totalRecaudado || '');
      const comisionStr = String(liq.comisionChofer || '');
      const fechaStr = liq.fecha ? new Date(liq.fecha).toLocaleDateString('es-AR') : '';

      const matchViajeIncluido = liq.viajes?.some((v: any) => {
        const orig = (v.origen || '').toLowerCase();
        const dest = (v.destino || '').toLowerCase();
        const cli = (v.clienteNombre || '').toLowerCase();
        const pr = String(v.precio || '');
        return orig.includes(term) || dest.includes(term) || cli.includes(term) || pr.includes(term);
      });

      return (
        coordNombre.includes(term) ||
        coordEmail.includes(term) ||
        obs.includes(term) ||
        totalStr.includes(term) ||
        `$${totalStr}`.includes(term) ||
        comisionStr.includes(term) ||
        fechaStr.includes(term) ||
        matchViajeIncluido
      );
    });
  }, [liquidaciones, filterType, fechaExacta, fechaDesde, fechaHasta, searchTerm]);

  // Renderizar tarjeta individual de viaje
  const renderViajeCard = (v: any) => {
    const clienteLabel =
      v.clienteNombre ||
      (v.cliente ? `${v.cliente.nombre} ${v.cliente.apellido || ''}`.trim() : null);

    return (
      <div
        key={v.id}
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xs border border-gray-100 dark:border-slate-800 p-3 space-y-2 transition-colors hover:border-gray-200 dark:hover:border-slate-700"
      >
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-1.5">
          <span className="text-[11px] text-gray-400 dark:text-slate-400">
            {new Date(v.fecha).toLocaleDateString('es-AR')} -{' '}
            {new Date(v.fecha).toLocaleTimeString('es-AR', {
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            hs
          </span>
          <div className="flex items-center gap-1.5">
            {/* Badge Método de Pago */}
            {v.metodoPago === 'TRANSFERENCIA' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                <CreditCard className="w-3 h-3" />
                Transferencia
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                <Banknote className="w-3 h-3" />
                Efectivo
              </span>
            )}

            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                v.estado === 'COMPLETADO'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  : v.estado === 'CANCELADO'
                  ? 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400'
                  : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
              }`}
            >
              {v.estado}
            </span>
            <span className="font-black text-gray-900 dark:text-white text-xs sm:text-sm">
              ${Number(v.precio || 0).toLocaleString('es-AR')}
            </span>
          </div>
        </div>

        <div className="space-y-1 text-xs">
          <div className="flex items-start gap-2">
            <MapPin className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
            <span className="text-gray-800 dark:text-slate-200 font-medium truncate">{v.origen}</span>
          </div>
          <div className="flex items-start gap-2">
            <Navigation className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
            <span className="text-gray-800 dark:text-slate-200 font-medium truncate">{v.destino}</span>
          </div>

          {clienteLabel && (
            <div className="flex items-center gap-1.5 text-gray-500 dark:text-slate-400 text-[11px] pt-0.5">
              <User className="w-3 h-3 text-gray-400" />
              <span>
                Pasajero: <strong className="text-gray-700 dark:text-slate-300">{clienteLabel}</strong>
              </span>
              {v.clienteTelefono && (
                <span className="text-gray-400 text-[10px]">({v.clienteTelefono})</span>
              )}
            </div>
          )}

          {(v.distanciaKmConPasajero > 0 || v.distanciaKmSinPasajero > 0) && (
            <div className="flex items-center gap-2 pt-1 border-t border-gray-50 dark:border-slate-800 text-[10px] text-gray-500 dark:text-slate-400">
              {v.distanciaKmConPasajero > 0 && (
                <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-medium">
                  {v.distanciaKmConPasajero} km c/ pasajero
                </span>
              )}
              {v.distanciaKmSinPasajero > 0 && (
                <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium">
                  {v.distanciaKmSinPasajero} km s/ pasajero
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!user) return null;

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto pb-24">
      {/* Selector de Pestañas (Tabs) */}
      <div className="flex border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-1 shadow-2xs transition-colors">
        <button
          onClick={() => setActiveTab('viajes')}
          className={`flex-1 py-2 text-center text-xs sm:text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'viajes'
              ? 'bg-primary-500 text-white shadow-2xs'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white'
          }`}
        >
          Historial de Viajes
        </button>
        <button
          onClick={() => {
            setActiveTab('cierres');
            loadCierres();
          }}
          className={`flex-1 py-2 text-center text-xs sm:text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'cierres'
              ? 'bg-primary-500 text-white shadow-2xs'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white'
          }`}
        >
          Cierres de Caja Chofer
        </button>
      </div>

      {/* Selector de Filtro de Fecha / Período */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-3 shadow-2xs space-y-2.5 transition-colors">
        <div className="flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-slate-300">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-primary-500" />
            <span>Filtro de Período</span>
          </div>
          {filterType !== 'TODOS' && (
            <button
              onClick={() => {
                setFilterType('TODOS');
                setFechaDesde('');
                setFechaHasta('');
              }}
              className="text-[11px] text-primary-600 dark:text-primary-400 hover:underline"
            >
              Ver todos
            </button>
          )}
        </div>

        {/* Chips de Selección Rápida */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {[
            { id: 'TODOS', label: 'Todos' },
            { id: 'HOY', label: 'Hoy' },
            { id: 'AYER', label: 'Ayer' },
            { id: 'SEMANA', label: '7 Días' },
            { id: 'FECHA_EXACTA', label: 'Día exacto' },
            { id: 'PERIODO', label: 'Período' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilterType(item.id as DateFilterType)}
              className={`py-1.5 px-2 text-[11px] font-semibold rounded-lg border transition-all text-center ${
                filterType === item.id
                  ? 'bg-primary-500 text-white border-primary-500 shadow-2xs'
                  : 'bg-gray-50 dark:bg-slate-800/80 text-gray-600 dark:text-slate-300 border-gray-200/80 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Selector Desplegable si seleccionó FECHA EXACTA */}
        {filterType === 'FECHA_EXACTA' && (
          <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <button
              onClick={handlePrevDay}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-100 transition-colors"
              title="Día anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex-1 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary-500 shrink-0" />
              <input
                type="date"
                value={fechaExacta}
                onChange={(e) => setFechaExacta(e.target.value)}
                className="w-full py-1.5 px-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 font-semibold"
              />
            </div>

            <button
              onClick={handleNextDay}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-100 transition-colors"
              title="Día siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={handleToday}
              className="text-[11px] font-bold px-2 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800"
            >
              Hoy
            </button>
          </div>
        )}

        {/* Selector Desplegable si seleccionó PERÍODO */}
        {filterType === 'PERIODO' && (
          <div className="pt-2 border-t border-gray-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 mb-1">
                Desde:
              </label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full py-1.5 px-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 font-medium"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 mb-1">
                Hasta:
              </label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full py-1.5 px-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 font-medium"
              />
            </div>
          </div>
        )}
      </div>

      {/* Barra Resumen Métrico del Período */}
      {activeTab === 'viajes' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-2.5 text-center shadow-2xs">
            <p className="text-[10px] text-gray-400 dark:text-slate-400 font-medium">Recaudación</p>
            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
              ${metricasPeriodo.totalRecaudado.toLocaleString('es-AR')}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-2.5 text-center shadow-2xs">
            <p className="text-[10px] text-gray-400 dark:text-slate-400 font-medium">Total Viajes</p>
            <p className="text-sm font-black text-gray-800 dark:text-white">
              {metricasPeriodo.totalViajes}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-2.5 text-center shadow-2xs">
            <p className="text-[10px] text-gray-400 dark:text-slate-400 font-medium">Turnos</p>
            <p className="text-sm font-black text-primary-600 dark:text-primary-400">
              {metricasPeriodo.cantTurnos}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-2.5 text-center shadow-2xs">
            <p className="text-[10px] text-gray-400 dark:text-slate-400 font-medium">Km Pasajeros</p>
            <p className="text-sm font-black text-slate-700 dark:text-slate-200">
              {metricasPeriodo.totalKmConPas.toFixed(1)} km
            </p>
          </div>
        </div>
      )}

      {/* Barra de Búsqueda Rápida */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={
            activeTab === 'viajes'
              ? 'Buscar viaje por calle, cliente, importe ($), pago...'
              : 'Buscar rendición por coordinador, importe, fecha, viaje...'
          }
          className="w-full pl-9 pr-9 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-xs transition-colors"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-0.5"
            title="Limpiar búsqueda"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Indicador de resultados cuando hay filtro de búsqueda */}
      {searchTerm.trim() && (
        <div className="flex justify-between items-center px-1 text-xs text-gray-500 dark:text-slate-400">
          <span>
            Resultados de búsqueda:{' '}
            <strong>
              {activeTab === 'viajes' ? viajesFiltrados.length : liquidacionesFiltradas.length}
            </strong>
          </span>
          <button
            onClick={() => setSearchTerm('')}
            className="text-primary-600 dark:text-primary-400 hover:underline text-[11px]"
          >
            Borrar búsqueda
          </button>
        </div>
      )}

      {/* Pestaña: Historial de Viajes */}
      {activeTab === 'viajes' ? (
        <div className="space-y-3">
          {/* Barra de controles de vista: Por Turnos vs Lista Plana */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Vista:</span>
              <div className="flex bg-gray-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-medium">
                <button
                  onClick={() => setViewMode('turnos')}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                    viewMode === 'turnos'
                      ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-2xs font-bold'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-800'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Por Turnos
                </button>
                <button
                  onClick={() => setViewMode('lista')}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                    viewMode === 'lista'
                      ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-2xs font-bold'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-800'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Lista Continua
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {viewMode === 'turnos' && turnosAgrupados.length > 0 && (
                <button
                  onClick={() => {
                    const areAllExpanded = turnosAgrupados.every((g) => expandedTurnos[g.id]);
                    if (areAllExpanded) {
                      collapseAllTurnos();
                    } else {
                      expandAllTurnos(turnosAgrupados);
                    }
                  }}
                  className="text-[11px] text-gray-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 underline font-medium"
                >
                  {turnosAgrupados.every((g) => expandedTurnos[g.id])
                    ? 'Colapsar todos'
                    : 'Expandir todos'}
                </button>
              )}

              <button
                onClick={loadData}
                disabled={loadingViajes}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                title="Recargar datos"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingViajes ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {loadingViajes ? (
            <div className="text-center py-12">
              <div className="loading-spinner border-primary-500 mx-auto"></div>
              <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                Cargando viajes y turnos...
              </p>
            </div>
          ) : viajes.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-gray-100 dark:border-slate-800 p-6 text-center transition-colors">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-800 mb-3">
                <Clock className="h-6 w-6 text-gray-400 dark:text-slate-400" />
              </div>
              <p className="text-gray-500 dark:text-slate-400 font-medium text-sm">
                Aún no tienes viajes registrados
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-400 mt-1">
                Tus viajes completados aparecerán aquí agrupados por turnos.
              </p>
            </div>
          ) : viajesFiltrados.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-gray-100 dark:border-slate-800 p-6 text-center transition-colors">
              <Search className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-700 dark:text-slate-300 font-semibold text-sm">
                No se encontraron viajes en este período
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Prueba seleccionando otro rango de fechas o limpiando el buscador.
              </p>
            </div>
          ) : viewMode === 'turnos' ? (
            /* Vista Agrupada por Turnos */
            <div className="space-y-3">
              {turnosAgrupados.map((group) => {
                const isExpanded = Boolean(expandedTurnos[group.id]);

                return (
                  <div
                    key={group.id}
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                      group.activo
                        ? 'border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-xs'
                        : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs'
                    }`}
                  >
                    {/* Encabezado del Turno (Click para Expandir/Colapsar) */}
                    <div
                      onClick={() => toggleExpandTurno(group.id)}
                      className="p-3.5 cursor-pointer hover:bg-gray-50/70 dark:hover:bg-slate-800/40 select-none transition-colors"
                    >
                      {/* Fila 1: Badges y Total del Turno */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {group.activo ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                              Turno En Curso
                            </span>
                          ) : group.isCustomGroup ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              <Layers className="w-3 h-3 text-slate-400" />
                              Otros
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300">
                              <Clock className="w-3 h-3 text-gray-400" />
                              Turno Finalizado
                            </span>
                          )}

                          <span className="text-xs font-bold text-gray-900 dark:text-white capitalize">
                            {group.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                            ${group.totalRecaudado.toLocaleString('es-AR')}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {/* Fila 2: Horarios, Vehículo y Chips de Estadísticas */}
                      <div className="flex flex-wrap items-center justify-between text-xs text-gray-500 dark:text-slate-400 gap-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px]">{group.subTitle}</span>
                          {group.vehiculoInfo && (
                            <span className="inline-flex items-center gap-1 text-gray-600 dark:text-slate-300 font-medium bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                              <Car className="w-3 h-3 text-primary-500" />
                              {group.vehiculoInfo}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className="bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-md font-bold">
                            {group.totalViajes} {group.totalViajes === 1 ? 'viaje' : 'viajes'}
                          </span>
                          {group.kmTotal > 0 && (
                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md font-medium">
                              {group.kmTotal.toFixed(1)} km
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Contenido Desplegable: Listado de Viajes del Turno */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 dark:border-slate-800/80 p-3 sm:p-4 bg-slate-50/50 dark:bg-slate-950/40 space-y-2.5">
                        {group.viajes.length === 0 ? (
                          <div className="text-center py-3 text-xs text-gray-400 dark:text-slate-500 italic">
                            No se realizaron viajes durante este turno.
                          </div>
                        ) : (
                          group.viajes.map((v) => renderViajeCard(v))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Vista Lista Plana Continua */
            <div className="space-y-3">
              {viajesFiltrados.map((v) => renderViajeCard(v))}
            </div>
          )}
        </div>
      ) : (
        /* Pestaña: Cierres de Caja Chofer */
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-sm font-bold text-gray-800 dark:text-white">
              Tus liquidaciones registradas
            </h3>
            <button
              onClick={loadCierres}
              disabled={loadingCierres}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              title="Recargar cierres"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingCierres ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingCierres ? (
            <div className="text-center py-12">
              <div className="loading-spinner border-primary-500 mx-auto"></div>
              <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                Cargando cierres de caja...
              </p>
            </div>
          ) : liquidaciones.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-gray-100 dark:border-slate-800 p-6 text-center transition-colors">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-800 mb-3">
                <DollarSign className="h-6 w-6 text-gray-400 dark:text-slate-400" />
              </div>
              <p className="text-gray-500 dark:text-slate-400 font-medium text-sm">
                No tienes cierres registrados
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-400 mt-1">
                Cuando el coordinador te liquide la caja, verás los detalles aquí.
              </p>
            </div>
          ) : liquidacionesFiltradas.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-gray-100 dark:border-slate-800 p-6 text-center transition-colors">
              <Search className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-700 dark:text-slate-300 font-semibold text-sm">
                No se encontraron liquidaciones en este período
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Prueba seleccionando otro rango de fechas o limpiando el buscador.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {liquidacionesFiltradas.map((liq) => {
                const isExpanded = expandedLiq === liq.id;
                const coordinadorNombre =
                  liq.coordinador?.coordinador?.nombre ||
                  liq.coordinador?.duenio?.nombre ||
                  liq.coordinador?.email ||
                  'Coordinador de Agencia';
                const rolCoordinador =
                  liq.coordinador?.rol === 'DUENIO'
                    ? 'Administración / Dueño'
                    : 'Coordinador de Turno';
                const esProp = user?.chofer?.esPropietario;

                return (
                  <div
                    key={liq.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xs overflow-hidden transition-all duration-200"
                  >
                    {/* Encabezado Principal */}
                    <div
                      onClick={() => toggleExpand(liq.id)}
                      className="p-4 flex flex-col gap-2.5 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-slate-800/50"
                    >
                      {/* Fila superior: Icono, Fecha, Montos */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl text-emerald-600 dark:text-emerald-400">
                            <DollarSign className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 dark:text-slate-400">
                              {new Date(liq.fecha).toLocaleDateString('es-AR')} -{' '}
                              {new Date(liq.fecha).toLocaleTimeString('es-AR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              hs
                            </p>
                            <p className="text-sm font-bold text-gray-800 dark:text-white">
                              Recaudado: ${liq.totalRecaudado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                            {esProp
                              ? 'Cerrado'
                              : `Mi Ganancia: $${liq.comisionChofer.toLocaleString('es-AR')}`}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {/* Prominente: A QUÉ COORDINADOR LE ENTREGÓ EL DINERO / CIERRE */}
                      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/60 px-3 py-2 rounded-xl text-xs">
                        <UserCheck className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
                        <div className="flex-1">
                          <span className="text-gray-500 dark:text-slate-400">Dinero entregado a: </span>
                          <strong className="text-gray-900 dark:text-white">{coordinadorNombre}</strong>{' '}
                          <span className="text-[11px] text-primary-600 dark:text-primary-400 font-medium">
                            ({rolCoordinador})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Detalle Desplegable */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-gray-50 dark:border-slate-800 pt-3 bg-slate-50/30 dark:bg-slate-800/40 text-xs text-gray-600 dark:text-slate-300 space-y-3">
                        <div className="grid grid-cols-2 gap-y-2">
                          <div className="flex flex-col">
                            <span className="text-gray-400 dark:text-slate-400 font-medium">
                              Recaudación Total
                            </span>
                            <span className="font-bold text-gray-800 dark:text-white">
                              ${liq.totalRecaudado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="flex flex-col">
                            <span className="text-gray-400 dark:text-slate-400 font-medium">
                              Comisión Agencia (
                              {esProp
                                ? Math.round((liq.comisionAgencia / liq.totalRecaudado) * 100)
                                : '20'}
                              %)
                            </span>
                            <span className="font-bold text-red-600 dark:text-red-400">
                              -${liq.comisionAgencia.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          {!esProp && (
                            <>
                              <div className="flex flex-col">
                                <span className="text-gray-400 dark:text-slate-400 font-medium">
                                  Combustible Descontado
                                </span>
                                <span className="font-bold text-orange-600 dark:text-orange-400">
                                  -${liq.combustible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>

                              <div className="flex flex-col">
                                <span className="text-gray-400 dark:text-slate-400 font-medium">
                                  Ganancia Propietario Auto
                                </span>
                                <span className="font-bold text-purple-700 dark:text-purple-400">
                                  ${liq.gananciaPropietario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </>
                          )}

                          <div className="flex flex-col col-span-2 pt-1 border-t border-gray-100 dark:border-slate-700">
                            <span className="text-gray-400 dark:text-slate-400 font-medium">
                              {esProp
                                ? 'Sobrante Dueño de Auto (Mi Ganancia)'
                                : 'Comisión Chofer (Mi Salario)'}
                            </span>
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                              ${liq.comisionChofer.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {/* Detalle del Coordinador / Turno */}
                        <div className="pt-2 border-t border-gray-100 dark:border-slate-700 flex flex-col gap-1 text-[11px] text-gray-500 dark:text-slate-400">
                          <p className="flex justify-between">
                            <span>Receptor de la liquidación:</span>
                            <span className="font-semibold text-gray-700 dark:text-slate-200">
                              {coordinadorNombre} ({liq.coordinador?.email})
                            </span>
                          </p>
                          {liq.observaciones && (
                            <p className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-gray-200 dark:border-slate-700 mt-1 italic text-gray-600 dark:text-slate-300">
                              &quot;{liq.observaciones}&quot;
                            </p>
                          )}
                        </div>

                        {/* Listado de viajes incluidos en esta rendición */}
                        {liq.viajes && liq.viajes.length > 0 && (
                          <div className="pt-2 border-t border-gray-100 dark:border-slate-700 space-y-1.5">
                            <p className="text-[11px] font-bold text-gray-700 dark:text-slate-300">
                              Viajes liquidados en este cierre ({liq.viajes.length}):
                            </p>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {liq.viajes.map((viajeLiq: any) => (
                                <div
                                  key={viajeLiq.id}
                                  className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-gray-100 dark:border-slate-700/60 flex items-center justify-between gap-2 text-[11px]"
                                >
                                  <div className="truncate flex-1">
                                    <p className="font-medium text-gray-800 dark:text-slate-200 truncate">
                                      {viajeLiq.origen} ➔ {viajeLiq.destino}
                                    </p>
                                    {viajeLiq.clienteNombre && (
                                      <p className="text-[10px] text-gray-400 dark:text-slate-400 truncate">
                                        Pasajero: {viajeLiq.clienteNombre}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span
                                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                        viajeLiq.metodoPago === 'TRANSFERENCIA'
                                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                      }`}
                                    >
                                      {viajeLiq.metodoPago === 'TRANSFERENCIA' ? 'Transf.' : 'Efec.'}
                                    </span>
                                    <span className="font-bold text-gray-900 dark:text-white">
                                      ${Number(viajeLiq.precio || 0).toLocaleString('es-AR')}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
