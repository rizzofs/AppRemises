'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { choferService } from '@/lib/api';
import {
  Fuel,
  Wrench,
  DollarSign,
  TrendingUp,
  Plus,
  Trash2,
  Calendar,
  Gauge,
  Droplets,
  AlertCircle,
  FileText,
  Sparkles,
  Layers,
  X,
  Flame,
} from 'lucide-react';
import toast from 'react-hot-toast';

type CategoriaForm =
  | 'NAFTA_GASOIL'
  | 'GNC'
  | 'REPARACION'
  | 'MANTENIMIENTO'
  | 'LAVADO'
  | 'PEAJE'
  | 'OTRO';

const CATEGORIAS_CONFIG: Record<
  CategoriaForm,
  { label: string; icon: any; color: string; bg: string; border: string; unidad?: string }
> = {
  NAFTA_GASOIL: {
    label: 'Nafta / Gasoil',
    icon: Fuel,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    unidad: 'Litros (L)',
  },
  GNC: {
    label: 'GNC (Gas)',
    icon: Flame,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    unidad: 'Metros Cúbicos (m³)',
  },
  REPARACION: {
    label: 'Reparación',
    icon: Wrench,
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
  },
  MANTENIMIENTO: {
    label: 'Mantenimiento',
    icon: Layers,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
  },
  LAVADO: {
    label: 'Lavadero',
    icon: Droplets,
    color: 'text-sky-600',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
  },
  PEAJE: {
    label: 'Peaje',
    icon: AlertCircle,
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
  },
  OTRO: {
    label: 'Otro',
    icon: FileText,
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
  },
};

export default function ChoferGastosPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [gastos, setGastos] = useState<any[]>([]);
  const [resumen, setResumen] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<string>('TODOS');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [categoriaSel, setCategoriaSel] = useState<CategoriaForm>('NAFTA_GASOIL');
  const [formMonto, setFormMonto] = useState('');
  const [formVolumen, setFormVolumen] = useState('');
  const [formKm, setFormKm] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formFecha, setFormFecha] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    cargarDatos();
  }, [user]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const choferId = user?.chofer?.id;
      const [gastosRes, resumenRes] = await Promise.all([
        choferService.getMisGastos({ choferId }),
        choferService.getResumenFinanciero({ choferId }),
      ]);

      if (gastosRes.success && gastosRes.data) {
        setGastos(gastosRes.data);
      }
      if (resumenRes.success && resumenRes.data) {
        setResumen(resumenRes.data);
      }
    } catch (error) {
      console.error('Error cargando gastos:', error);
      toast.error('Error al cargar información de gastos');
    } finally {
      setLoading(false);
    }
  };

  const handleCrearGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMonto || parseFloat(formMonto) <= 0) {
      toast.error('Ingresa un monto válido mayor a 0');
      return;
    }

    setSubmitting(true);
    try {
      let tipoFinal: 'COMBUSTIBLE' | 'REPARACION' | 'MANTENIMIENTO' | 'PEAJE' | 'LAVADO' | 'OTRO' =
        'OTRO';
      let subtipoCombustibleFinal: 'NAFTA_GASOIL' | 'GNC' | undefined = undefined;

      if (categoriaSel === 'NAFTA_GASOIL') {
        tipoFinal = 'COMBUSTIBLE';
        subtipoCombustibleFinal = 'NAFTA_GASOIL';
      } else if (categoriaSel === 'GNC') {
        tipoFinal = 'COMBUSTIBLE';
        subtipoCombustibleFinal = 'GNC';
      } else {
        tipoFinal = categoriaSel;
      }

      const res = await choferService.crearGasto({
        tipo: tipoFinal,
        subtipoCombustible: subtipoCombustibleFinal,
        monto: parseFloat(formMonto),
        kilometraje: formKm ? parseFloat(formKm) : undefined,
        litros: formVolumen ? parseFloat(formVolumen) : undefined,
        descripcion: formDescripcion.trim() || undefined,
        fecha: formFecha ? new Date(formFecha).toISOString() : undefined,
        choferId: user?.chofer?.id,
      });

      if (res.success) {
        toast.success('Gasto registrado exitosamente');
        setModalAbierto(false);
        // Reset form
        setFormMonto('');
        setFormVolumen('');
        setFormKm('');
        setFormDescripcion('');
        setFormFecha(new Date().toISOString().split('T')[0]);
        await cargarDatos();
      } else {
        toast.error(res.message || 'Error al guardar gasto');
      }
    } catch (error) {
      toast.error('Error de red al guardar gasto');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEliminarGasto = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este registro de gasto?')) return;
    try {
      const res = await choferService.eliminarGasto(id, user?.chofer?.id);
      if (res.success) {
        toast.success('Gasto eliminado');
        await cargarDatos();
      } else {
        toast.error(res.message || 'Error al eliminar');
      }
    } catch {
      toast.error('Error al eliminar gasto');
    }
  };

  const resolverConfigGasto = (gasto: any) => {
    if (gasto.tipo === 'COMBUSTIBLE') {
      if (gasto.subtipoCombustible === 'GNC') {
        return CATEGORIAS_CONFIG.GNC;
      }
      return CATEGORIAS_CONFIG.NAFTA_GASOIL;
    }
    return CATEGORIAS_CONFIG[gasto.tipo as CategoriaForm] || CATEGORIAS_CONFIG.OTRO;
  };

  const gastosFiltrados = gastos.filter((g) => {
    if (filtroTipo === 'TODOS') return true;
    if (filtroTipo === 'NAFTA_GASOIL') {
      return g.tipo === 'COMBUSTIBLE' && g.subtipoCombustible !== 'GNC';
    }
    if (filtroTipo === 'GNC') {
      return g.tipo === 'COMBUSTIBLE' && g.subtipoCombustible === 'GNC';
    }
    return g.tipo === filtroTipo;
  });

  if (!user) return null;

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto pb-28">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Control de Gastos</h2>
          <p className="text-xs text-gray-500">Nafta, Gasoil, GNC, mecánica y mantenimiento</p>
        </div>
        <button
          onClick={() => setModalAbierto(true)}
          className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Cargar Gasto</span>
        </button>
      </div>

      {/* Balance y Resumen Financiero del Mes */}
      {resumen && (
        <div className="space-y-3">
          {/* Card Ganancia Neta Real */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider text-slate-300 font-medium">
                Balance del Mes
              </span>
              <span className="text-[11px] bg-white/10 text-slate-200 px-2 py-0.5 rounded-full">
                {resumen.ingresos?.totalViajes || 0} viajes realizados
              </span>
            </div>

            <div className="flex items-baseline justify-between mt-1">
              <div>
                <p className="text-xs text-slate-400">Ganancia Neta (Bolsillo)</p>
                <p
                  className={`text-2xl font-black ${
                    resumen.balance?.gananciaNetaReal >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  ${Number(resumen.balance?.gananciaNetaReal || 0).toLocaleString('es-AR', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Gastos Totales</p>
                <p className="text-lg font-bold text-rose-300">
                  -${Number(resumen.gastos?.totalGastos || 0).toLocaleString('es-AR', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>

            {/* Desglose de Combustible separado por Nafta/Gasoil y GNC */}
            <div className="grid grid-cols-4 gap-1.5 mt-4 pt-3 border-t border-white/10 text-center text-xs">
              {/* Nafta / Gasoil */}
              <div className="bg-white/5 rounded-lg p-1.5">
                <p className="text-amber-400 text-[10px] font-semibold">⛽ Nafta/Gasoil</p>
                <p className="font-bold text-white text-xs mt-0.5">
                  ${Number(resumen.gastos?.totalNaftaGasoil || 0).toLocaleString('es-AR')}
                </p>
                <p className="text-[10px] text-slate-400">
                  {resumen.gastos?.totalLitrosNaftaGasoil || 0} L
                </p>
              </div>

              {/* GNC */}
              <div className="bg-white/5 rounded-lg p-1.5">
                <p className="text-emerald-400 text-[10px] font-semibold">🟢 GNC</p>
                <p className="font-bold text-white text-xs mt-0.5">
                  ${Number(resumen.gastos?.totalGNC || 0).toLocaleString('es-AR')}
                </p>
                <p className="text-[10px] text-slate-400">
                  {resumen.gastos?.totalM3GNC || 0} m³
                </p>
              </div>

              {/* Reparaciones / Mecánica */}
              <div className="bg-white/5 rounded-lg p-1.5">
                <p className="text-slate-300 text-[10px] font-semibold">🔧 Mecánica</p>
                <p className="font-bold text-white text-xs mt-0.5">
                  ${Number(
                    (resumen.gastos?.totalReparaciones || 0) +
                      (resumen.gastos?.totalMantenimiento || 0)
                  ).toLocaleString('es-AR')}
                </p>
                <p className="text-[10px] text-slate-400">Taller/Service</p>
              </div>

              {/* Otros */}
              <div className="bg-white/5 rounded-lg p-1.5">
                <p className="text-slate-300 text-[10px] font-semibold">💵 Otros</p>
                <p className="font-bold text-white text-xs mt-0.5">
                  ${Number(resumen.gastos?.totalOtros || 0).toLocaleString('es-AR')}
                </p>
                <p className="text-[10px] text-slate-400">Lavados/Peajes</p>
              </div>
            </div>
          </div>

          {/* Métricas de Odometría y Rendimiento */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                <Gauge className="w-4 h-4 text-primary-500" />
                <span>Km Conectado</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {resumen.kilometraje?.kmTotalConectado || 0}{' '}
                <span className="text-xs font-normal text-gray-500">km</span>
              </p>
              <div className="flex justify-between text-[11px] text-gray-500 mt-1 pt-1 border-t border-gray-100">
                <span className="text-emerald-600 font-medium">
                  {resumen.kilometraje?.kmConPasajero || 0} km c/pas.
                </span>
                <span className="text-amber-600 font-medium">
                  {resumen.kilometraje?.kmSinPasajero || 0} km s/pas.
                </span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span>Costo x Kilómetro</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                ${resumen.kilometraje?.costoPorKm || '0.00'}{' '}
                <span className="text-xs font-normal text-gray-500">/ km</span>
              </p>
              <div className="text-[11px] text-gray-500 mt-1 pt-1 border-t border-gray-100 truncate">
                <span>Ocupación productiva: {resumen.kilometraje?.porcentajeOcupado || 0}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtros de Categoría */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        {[
          { key: 'TODOS', label: 'Todos' },
          { key: 'NAFTA_GASOIL', label: '⛽ Nafta/Gasoil' },
          { key: 'GNC', label: '🟢 GNC' },
          { key: 'REPARACION', label: '🔧 Reparaciones' },
          { key: 'MANTENIMIENTO', label: '⚙️ Mantenimiento' },
          { key: 'LAVADO', label: '🧼 Lavadero' },
          { key: 'OTRO', label: 'Otros' },
        ].map((item) => {
          const isSelected = filtroTipo === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setFiltroTipo(item.key)}
              className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Listado de Gastos */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
          Registros ({gastosFiltrados.length})
        </h3>

        {loading ? (
          <div className="text-center py-10 bg-white rounded-xl border border-gray-100">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs text-gray-400">Cargando gastos...</p>
          </div>
        ) : gastosFiltrados.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300 p-6">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
              <Fuel className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-gray-700">Sin gastos registrados</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
              Carga tus gastos de Nafta, GNC, repuestos o mantenimientos para tener el control de tus ganancias netas.
            </p>
            <button
              onClick={() => setModalAbierto(true)}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 bg-primary-50 px-3.5 py-2 rounded-lg hover:bg-primary-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Cargar primer gasto
            </button>
          </div>
        ) : (
          gastosFiltrados.map((gasto) => {
            const config = resolverConfigGasto(gasto);
            const Icon = config.icon;
            const fechaStr = new Date(gasto.fecha).toLocaleDateString('es-AR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });

            const esGnc = gasto.tipo === 'COMBUSTIBLE' && gasto.subtipoCombustible === 'GNC';

            return (
              <div
                key={gasto.id}
                className="bg-white rounded-xl border border-gray-200/80 p-3.5 shadow-sm flex items-center justify-between gap-3 hover:border-gray-300 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl ${config.bg} ${config.border} border flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{config.label}</span>
                      <span className="text-[11px] text-gray-400">• {fechaStr}</span>
                    </div>

                    {gasto.descripcion && (
                      <p className="text-xs text-gray-600 line-clamp-1">{gasto.descripcion}</p>
                    )}

                    <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                      {gasto.litros && (
                        <span
                          className={`font-medium px-1.5 py-0.5 rounded ${
                            esGnc
                              ? 'text-emerald-700 bg-emerald-50'
                              : 'text-amber-700 bg-amber-50'
                          }`}
                        >
                          {gasto.litros} {esGnc ? 'm³' : 'L'}
                        </span>
                      )}
                      {gasto.kilometraje && (
                        <span className="font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                          {Number(gasto.kilometraje).toLocaleString('es-AR')} km
                        </span>
                      )}
                      {gasto.vehiculo && (
                        <span className="text-gray-400">Pat: {gasto.vehiculo.patente}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">
                      -${Number(gasto.monto).toLocaleString('es-AR', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleEliminarGasto(gasto.id)}
                    className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Eliminar gasto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal / Dialog para Cargar Gasto */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center font-bold">
                  $
                </div>
                <h3 className="text-base font-bold text-gray-900">Cargar Nuevo Gasto</h3>
              </div>
              <button
                onClick={() => setModalAbierto(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCrearGasto} className="space-y-4 text-sm">
              {/* Selector de Categoría (Separando Nafta/Gasoil de GNC) */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Tipo de Gasto
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {/* Botón especial Nafta/Gasoil */}
                  <button
                    type="button"
                    onClick={() => setCategoriaSel('NAFTA_GASOIL')}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                      categoriaSel === 'NAFTA_GASOIL'
                        ? 'bg-amber-50 border-amber-300 text-amber-800 ring-2 ring-amber-500 font-semibold shadow-xs'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Fuel className="w-4 h-4 text-amber-600" />
                    <div className="text-left">
                      <p className="font-bold">Nafta / Gasoil</p>
                      <p className="text-[10px] text-gray-400">En Litros (L)</p>
                    </div>
                  </button>

                  {/* Botón especial GNC */}
                  <button
                    type="button"
                    onClick={() => setCategoriaSel('GNC')}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                      categoriaSel === 'GNC'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-500 font-semibold shadow-xs'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Flame className="w-4 h-4 text-emerald-600" />
                    <div className="text-left">
                      <p className="font-bold">GNC (Gas)</p>
                      <p className="text-[10px] text-gray-400">En m³</p>
                    </div>
                  </button>
                </div>

                {/* Otras categorías */}
                <div className="grid grid-cols-3 gap-1.5">
                  {(['REPARACION', 'MANTENIMIENTO', 'LAVADO', 'PEAJE', 'OTRO'] as const).map(
                    (t) => {
                      const cfg = CATEGORIAS_CONFIG[t];
                      const Icon = cfg.icon;
                      const selected = categoriaSel === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setCategoriaSel(t)}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl border text-[11px] font-medium transition-all ${
                            selected
                              ? `${cfg.bg} ${cfg.border} ${cfg.color} ring-2 ring-primary-500 font-semibold shadow-xs`
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className="w-4 h-4 mb-1" />
                          <span>{cfg.label}</span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Monto ($) */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Monto ($ ARS) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-gray-400 font-bold">$</span>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="Ej: 15000"
                    value={formMonto}
                    onChange={(e) => setFormMonto(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-hidden text-base font-bold text-gray-900"
                  />
                </div>
              </div>

              {/* Campo para Litros o Metros Cúbicos según sea Nafta o GNC */}
              {(categoriaSel === 'NAFTA_GASOIL' || categoriaSel === 'GNC') && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {categoriaSel === 'GNC'
                      ? 'Metros Cúbicos (m³) cargados (opcional)'
                      : 'Litros (L) cargados (opcional)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder={categoriaSel === 'GNC' ? 'Ej: 14.5' : 'Ej: 30.0'}
                    value={formVolumen}
                    onChange={(e) => setFormVolumen(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-hidden text-sm"
                  />
                </div>
              )}

              {/* Kilometraje del vehículo al momento del gasto */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Odómetro en tablero (km opcional)
                </label>
                <input
                  type="number"
                  placeholder="Ej: 145200"
                  value={formKm}
                  onChange={(e) => setFormKm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-hidden text-sm"
                />
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={formFecha}
                  onChange={(e) => setFormFecha(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-hidden text-sm"
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Descripción / Observaciones (opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder={
                    categoriaSel === 'GNC'
                      ? 'Ej: Carga completa en YPF'
                      : categoriaSel === 'NAFTA_GASOIL'
                      ? 'Ej: Nafta Súper / Infinia / Diésel'
                      : 'Ej: Cambio de pastillas de freno, filtro de aceite, etc.'
                  }
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-hidden text-sm"
                />
              </div>

              {/* Botones de acción */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold shadow-sm transition-all disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : 'Guardar Gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
