'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { remiseriaService, duenioReportesService } from '@/lib/api';
import { Remiseria } from '@/types';
import {
  DollarSign,
  TrendingUp,
  Truck,
  Car,
  Users,
  Calendar,
  Clock,
  ArrowRight,
  RefreshCw,
  Eye,
  EyeOff,
  Phone,
  Briefcase,
  UserCheck,
  Settings,
  ChevronRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { TELEFONOS_FIJOS } from '@/lib/constants/telefonos';

type PeriodType = 'hoy' | 'semana' | 'mes';

export default function DuenioDashboard() {
  const { user } = useAuth();
  const router = useRouter();

  const [remiserias, setRemiserias] = useState<Remiseria[]>([]);
  const [selectedRemiseriaId, setSelectedRemiseriaId] = useState<string>('todas');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAmount, setShowAmount] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('hoy');

  // Datos de métricas financieras y operativas
  const [diarioData, setDiarioData] = useState<any>(null);
  const [semanalData, setSemanalData] = useState<any>(null);
  const [mensualData, setMensualData] = useState<any>(null);

  const loadData = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      // 1. Cargar remiserías del dueño
      const remRes = await remiseriaService.getAll();
      let userRems: Remiseria[] = [];
      if (remRes.success && remRes.data) {
        userRems = remRes.data.filter(r =>
          r.duenios?.some(d => d.duenioId === user?.duenio?.id)
        );
        setRemiserias(userRems);
      }

      const targetId = selectedRemiseriaId !== 'todas' ? selectedRemiseriaId : undefined;

      // 2. Cargar informes en paralelo
      const [diarioRes, semanalRes, mensualRes] = await Promise.all([
        duenioReportesService.getInformeDiario(targetId),
        duenioReportesService.getInformeSemanal(targetId),
        duenioReportesService.getInformeMensual(targetId),
      ]);

      if (diarioRes.success) setDiarioData(diarioRes.data);
      if (semanalRes.success) setSemanalData(semanalRes.data);
      if (mensualRes.success) setMensualData(mensualRes.data);

      if (isManualRefresh) {
        toast.success('Métricas actualizadas al instante', { icon: '⚡' });
      }
    } catch (error) {
      console.error('Error al cargar métricas del dueño:', error);
      toast.error('No se pudieron actualizar los datos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, selectedRemiseriaId]);

  useEffect(() => {
    if (!user || user.rol !== 'DUENIO') {
      router.push('/login');
      return;
    }
    loadData();
  }, [user, router, loadData]);

  // Cálculos de métricas según período seleccionado
  const getPeriodMetrics = () => {
    if (period === 'hoy') {
      return {
        totalFacturado: diarioData?.resumen?.totalFacturado || 0,
        viajesCompletados: diarioData?.resumen?.viajesCompletados || 0,
        viajesPendientes: diarioData?.resumen?.viajesPendientes || 0,
        ticketPromedio: diarioData?.resumen?.ticketPromedio || 0,
        subtitle: 'Recaudación de hoy',
        tasaCancelacion: diarioData?.resumen?.tasaCancelacion || 0,
      };
    }
    if (period === 'semana') {
      return {
        totalFacturado: semanalData?.totalSemana || 0,
        viajesCompletados: semanalData?.viajesCompletados || 0,
        viajesPendientes: diarioData?.resumen?.viajesPendientes || 0,
        ticketPromedio: (semanalData?.viajesCompletados || 0) > 0
          ? (semanalData?.totalSemana || 0) / semanalData.viajesCompletados
          : 0,
        subtitle: 'Últimos 7 días',
        variacion: semanalData?.variacion || 0,
      };
    }
    return {
      totalFacturado: mensualData?.totalMes || 0,
      viajesCompletados: mensualData?.viajesCompletados || 0,
      viajesPendientes: diarioData?.resumen?.viajesPendientes || 0,
      ticketPromedio: mensualData?.ticketPromedio || 0,
      subtitle: 'Acumulado del mes',
      variacion: 0,
    };
  };

  const metrics = getPeriodMetrics();

  // Contadores de flota activa
  const totalCoordinadores = remiserias.reduce((acc, r) =>
    acc + (r.coordinadores?.filter(c => c.activo).length || 0), 0
  );
  const totalChoferesActivos = remiserias.reduce((acc, r) =>
    acc + (r.choferes?.filter(c => c.estado === 'ACTIVO').length || 0), 0
  );
  const totalVehiculos = remiserias.reduce((acc, r) =>
    acc + (r.vehiculos?.filter(v => v.estado === 'ACTIVO').length || 0), 0
  );

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(val);
  };

  const ultimosViajes = diarioData?.viajes?.slice(0, 6) || [];

  if (loading && !diarioData) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500 animate-pulse">Cargando panel ejecutivo...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Barra superior de estado / Sucursal y Refresco táctil */}
      <div className="flex items-center justify-between gap-2 bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse ring-4 ring-emerald-50 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">En Vivo</span>
              <span className="text-xs font-bold text-slate-800 px-2 py-0.5 bg-slate-100 rounded-lg border border-slate-200 truncate">
                {remiserias[0]?.nombreFantasia || 'Remises Bruno'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Panel Dueño • Vista Ejecutiva</p>
          </div>
        </div>

        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all active:scale-95"
          title="Actualizar datos"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-primary-600' : ''}`} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      {/* TARJETA FINANCIERA HERO (Estilo Fintech / Billetera móvil ejecutiva) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 shadow-xl shadow-slate-900/10 border border-slate-800">
        {/* Glow decorativo sutil */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header de la tarjeta: Título + Selector de Período (Hoy / Sem / Mes) */}
        <div className="flex items-center justify-between gap-2 relative z-10 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {metrics.subtitle}
            </span>
            <button
              onClick={() => setShowAmount(!showAmount)}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title={showAmount ? 'Ocultar saldo' : 'Mostrar saldo'}
            >
              {showAmount ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Segmented Control de Período */}
          <div className="flex items-center bg-white/10 p-1 rounded-xl backdrop-blur-md">
            <button
              onClick={() => setPeriod('hoy')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                period === 'hoy'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => setPeriod('semana')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                period === 'semana'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setPeriod('mes')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                period === 'mes'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Mes
            </button>
          </div>
        </div>

        {/* Monto Principal */}
        <div className="relative z-10 mb-6">
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              {showAmount ? formatMoney(metrics.totalFacturado) : '••••••••'}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">Facturación neta registrada en el sistema</p>
        </div>

        {/* Sub-KPIs Operativos estilo App Cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 relative z-10 pt-4 border-t border-white/10">
          <div className="bg-white/5 rounded-2xl p-2.5 sm:p-3 backdrop-blur-xs border border-white/5">
            <p className="text-[11px] font-medium text-slate-400 leading-tight">Viajes Hechos</p>
            <p className="text-lg sm:text-xl font-bold text-emerald-400 mt-1">
              {metrics.viajesCompletados}
            </p>
          </div>

          <div className="bg-white/5 rounded-2xl p-2.5 sm:p-3 backdrop-blur-xs border border-white/5">
            <p className="text-[11px] font-medium text-slate-400 leading-tight">En Curso Ahora</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-lg sm:text-xl font-bold text-sky-400">
                {metrics.viajesPendientes}
              </span>
              {metrics.viajesPendientes > 0 && (
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
              )}
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl p-2.5 sm:p-3 backdrop-blur-xs border border-white/5">
            <p className="text-[11px] font-medium text-slate-400 leading-tight">Ticket Prom.</p>
            <p className="text-sm sm:text-base font-bold text-amber-300 mt-1 truncate">
              {showAmount ? formatMoney(metrics.ticketPromedio) : '•••'}
            </p>
          </div>
        </div>
      </div>

      {/* RADAR DE FLOTA & ACCIÓN RÁPIDA */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 leading-tight">Flota y Operación</h3>
              <p className="text-[11px] text-slate-500">Móviles y personal operativo</p>
            </div>
          </div>
          <Link
            href="/duenio/choferes"
            className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            Ver Flota <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Link
            href="/duenio/choferes"
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100"
          >
            <span className="text-lg font-extrabold text-slate-900">{totalChoferesActivos}</span>
            <span className="text-[11px] text-slate-500 font-medium">Choferes</span>
          </Link>

          <Link
            href="/duenio/vehiculos"
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100"
          >
            <span className="text-lg font-extrabold text-slate-900">{totalVehiculos}</span>
            <span className="text-[11px] text-slate-500 font-medium">Vehículos</span>
          </Link>

          <Link
            href="/duenio/coordinadores"
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100"
          >
            <span className="text-lg font-extrabold text-slate-900">{totalCoordinadores}</span>
            <span className="text-[11px] text-slate-500 font-medium">En Base</span>
          </Link>
        </div>
      </div>

      {/* ACCIONES RÁPIDAS TÁCTILES (QUICK ACTION TILES) */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 mb-2">
          Acciones Rápidas
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {/* Cierre Diario */}
          <Link
            href="/duenio/informes/diario"
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-primary-300 hover:shadow-sm active:scale-95 transition-all text-center group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-1.5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 leading-tight">Cierre Día</span>
            <span className="text-[10px] text-slate-400">Recaudación</span>
          </Link>

          {/* Liquidaciones */}
          <Link
            href="/duenio/liquidaciones"
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-emerald-300 hover:shadow-sm active:scale-95 transition-all text-center group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 leading-tight">Liquidaciones</span>
            <span className="text-[10px] text-slate-400">Choferes</span>
          </Link>

          {/* Clientes Cta Cte */}
          <Link
            href="/duenio/clientes"
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-indigo-300 hover:shadow-sm active:scale-95 transition-all text-center group"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1.5 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <UserCheck className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 leading-tight">Cuentas Cte</span>
            <span className="text-[10px] text-slate-400">Cobranzas</span>
          </Link>

          {/* ART & Empresas */}
          <Link
            href="/duenio/art"
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-purple-300 hover:shadow-sm active:scale-95 transition-all text-center group"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-1.5 group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <Briefcase className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 leading-tight">ART</span>
            <span className="text-[10px] text-slate-400">Empresas</span>
          </Link>

          {/* Tarifas */}
          <Link
            href="/duenio/configuracion"
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-amber-300 hover:shadow-sm active:scale-95 transition-all text-center group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-1.5 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <Settings className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 leading-tight">Tarifas</span>
            <span className="text-[10px] text-slate-400">Precios/km</span>
          </Link>

          {/* Llamada a Base */}
          <a
            href={`tel:${TELEFONOS_FIJOS[0].tel}`}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-rose-300 hover:shadow-sm active:scale-95 transition-all text-center group"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-1.5 group-hover:bg-rose-600 group-hover:text-white transition-colors">
              <Phone className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 leading-tight">Llamar Base</span>
            <span className="text-[10px] text-slate-400">Operadores</span>
          </a>
        </div>
      </div>

      {/* FEED DE ÚLTIMOS VIAJES EN VIVO */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary-600" />
            <h3 className="font-bold text-sm text-slate-900">Últimos Viajes de Hoy</h3>
          </div>
          <Link
            href="/duenio/informes/diario"
            className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            Ver todos ({diarioData?.viajes?.length || 0}) <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {ultimosViajes.length === 0 ? (
          <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Car className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">Aún no hay viajes registrados hoy</p>
            <p className="text-xs text-slate-400 mt-0.5">A medida que los coordinadores y choferes operen, aparecerán aquí al instante.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {ultimosViajes.map((viaje: any) => {
              const isCompletado = viaje.estado === 'COMPLETADO';
              const isCancelado = viaje.estado === 'CANCELADO';
              const isEnCurso = viaje.estado === 'EN_CURSO' || viaje.estado === 'PENDIENTE';

              return (
                <div
                  key={viaje.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 border border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isCompletado
                          ? 'bg-emerald-100 text-emerald-800'
                          : isCancelado
                          ? 'bg-red-100 text-red-800'
                          : 'bg-sky-100 text-sky-800'
                      }`}>
                        {viaje.estado}
                      </span>
                      <span className="text-xs font-semibold text-slate-800 truncate">
                        {viaje.cliente}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 truncate">
                      {viaje.origen} → {viaje.destino}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Chofer: <span className="text-slate-600 font-medium">{viaje.chofer}</span> ({viaje.patente})
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-extrabold text-slate-900">
                      {formatMoney(viaje.precio)}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      {new Date(viaje.fecha).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
