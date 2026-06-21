'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTracking } from '@/hooks/useAppTracking';
import { choferService, coordinadorDashboardService } from '@/lib/api';
import { Chofer, Viaje, LiquidacionPendienteResumen } from '@/types';
import { ArrowLeft, DollarSign, Calendar, Fuel, FileText, User, Shield, CheckCircle2, AlertTriangle, Coins, RefreshCw, Clock } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function CierreCajaPage() {
  const { user } = useAuth();
  const router = useRouter();
  useAppTracking('COORDINADOR_CIERRE_CAJA');

  const [choferes, setChoferes] = useState<Chofer[]>([]);
  const [selectedChoferId, setSelectedChoferId] = useState<string>('');
  const [loadingChoferes, setLoadingChoferes] = useState(true);
  
  const [pendingData, setPendingData] = useState<LiquidacionPendienteResumen | null>(null);
  const [loadingPending, setLoadingPending] = useState(false);

  // Resumen del turno del coordinador (hoy)
  const [resumenTurno, setResumenTurno] = useState<any>(null);
  const [loadingResumen, setLoadingResumen] = useState(false);

  // Form Inputs
  const [combustible, setCombustible] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadChoferes();
    loadResumenTurno();
  }, [user]);

  const loadResumenTurno = async () => {
    try {
      setLoadingResumen(true);
      const response = await coordinadorDashboardService.getResumenCoordinador();
      if (response.success && response.data) {
        setResumenTurno(response.data);
      } else {
        toast.error('Error al cargar el resumen del turno');
      }
    } catch (error) {
      console.error('Error loading shift summary:', error);
    } finally {
      setLoadingResumen(false);
    }
  };

  const loadChoferes = async () => {
    try {
      setLoadingChoferes(true);
      const response = await choferService.getAll();
      if (response.success && response.data) {
        // Filtrar choferes activos o suspendidos (para poder liquidar si es necesario)
        const activos = response.data.filter(c => c.estado !== 'DADO_DE_BAJA');
        setChoferes(activos);
      } else {
        toast.error('Error al cargar la lista de choferes');
      }
    } catch (error) {
      console.error('Error loading choferes:', error);
      toast.error('Error al cargar choferes');
    } finally {
      setLoadingChoferes(false);
    }
  };

  const handleChoferChange = async (choferId: string) => {
    setSelectedChoferId(choferId);
    setPendingData(null);
    setCombustible('');
    setObservaciones('');
    
    if (!choferId) return;

    try {
      setLoadingPending(true);
      const response = await coordinadorDashboardService.getLiquidacionesPendientes(choferId);
      if (response.success && response.data) {
        setPendingData(response.data);
      } else {
        toast.error(response.message || 'Error al obtener viajes pendientes');
      }
    } catch (error) {
      console.error('Error fetching pending box closure:', error);
      toast.error('Error al obtener viajes pendientes');
    } finally {
      setLoadingPending(false);
    }
  };

  // Cálculos dinámicos en frontend basados en combustible ingresado
  const getCalculos = () => {
    if (!pendingData) return { totalRecaudado: 0, comisionChofer: 0, comisionAgencia: 0, gananciaPropietario: 0 };
    
    const { chofer, resumen } = pendingData;
    const totalRecaudado = resumen.totalRecaudado;
    const combustibleVal = parseFloat(combustible) || 0;

    let comisionChofer = 0;
    let comisionAgencia = 0;
    let gananciaPropietario = 0;

    if (chofer.esPropietario) {
      comisionAgencia = (totalRecaudado * chofer.comisionDuenioAuto) / 100;
      comisionChofer = totalRecaudado - comisionAgencia;
      gananciaPropietario = 0;
    } else {
      comisionChofer = (totalRecaudado * chofer.comisionPorcentaje) / 100;
      comisionAgencia = (totalRecaudado * chofer.comisionDuenioAuto) / 100;
      gananciaPropietario = Math.max(0, totalRecaudado - comisionChofer - comisionAgencia - combustibleVal);
    }

    return {
      totalRecaudado,
      comisionChofer,
      comisionAgencia,
      gananciaPropietario
    };
  };

  const calculos = getCalculos();

  const handleSubmitCierre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChoferId || !pendingData) return;

    if (pendingData.viajes.length === 0) {
      toast.error('No hay viajes completados para liquidar.');
      return;
    }

    const confirmMessage = pendingData.chofer.esPropietario
      ? `¿Confirmas el cierre de caja de ${pendingData.chofer.nombre} ${pendingData.chofer.apellido}? \nComisión Agencia a cobrar: $${calculos.comisionAgencia.toLocaleString('es-AR')}`
      : `¿Confirmas el cierre de caja de ${pendingData.chofer.nombre} ${pendingData.chofer.apellido}? \nCombustible: $${(parseFloat(combustible) || 0).toLocaleString('es-AR')} \nComisión Agencia: $${calculos.comisionAgencia.toLocaleString('es-AR')}`;

    if (!confirm(confirmMessage)) return;

    try {
      setIsSubmitting(true);
      const payload = {
        choferId: selectedChoferId,
        combustible: parseFloat(combustible) || 0,
        observaciones: observaciones.trim()
      };

      const response = await coordinadorDashboardService.crearLiquidacion(payload);
      if (response.success) {
        toast.success('Cierre de caja y liquidación registrados exitosamente');
        // Limpiar estados
        setPendingData(null);
        setSelectedChoferId('');
        setCombustible('');
        setObservaciones('');
        // Recargar choferes y resumen del turno
        loadChoferes();
        loadResumenTurno();
      } else {
        toast.error(response.message || 'Error al guardar liquidación');
      }
    } catch (error) {
      console.error('Error saving box closure:', error);
      toast.error('Error al registrar cierre de caja');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link
                href="/coordinador/dashboard"
                className="flex items-center text-slate-600 hover:text-slate-900 mr-4 font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Dashboard
              </Link>
              <span className="h-6 w-px bg-slate-200 mr-4" />
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-700">
                  <DollarSign className="w-5 h-5" />
                </div>
                <h1 className="text-xl font-bold text-slate-800">Cierre de Caja Chofer</h1>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => { loadChoferes(); loadResumenTurno(); }}
                disabled={loadingChoferes || loadingResumen}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                title="Recargar datos"
              >
                <RefreshCw className={`w-4 h-4 ${(loadingChoferes || loadingResumen) ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Columna Izquierda: Selector de Chofer y Parámetros */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-500" />
                Seleccionar Chofer
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="choferSelect" className="block text-sm font-medium text-slate-700 mb-2">
                    Chofer Activo
                  </label>
                  {loadingChoferes ? (
                    <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
                  ) : (
                    <select
                      id="choferSelect"
                      value={selectedChoferId}
                      onChange={(e) => handleChoferChange(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-800 font-medium"
                    >
                      <option value="">-- Elegir un chofer --</option>
                      {choferes.map((chofer) => (
                        <option key={chofer.id} value={chofer.id}>
                          {chofer.nombre} {chofer.apellido} (#{chofer.numeroChofer}) {chofer.esPropietario ? '[Dueño]' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {pendingData && (
                  <div className="pt-4 border-t border-slate-100">
                    <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                      <h3 className="text-sm font-bold text-blue-800 mb-2">Detalles del Chofer</h3>
                      <div className="space-y-1.5 text-xs text-blue-900">
                        <p className="flex justify-between">
                          <span>Condición:</span>
                          <span className="font-semibold">{pendingData.chofer.esPropietario ? 'Propietario de auto' : 'Chofer comisionista'}</span>
                        </p>
                        {!pendingData.chofer.esPropietario && (
                          <p className="flex justify-between">
                            <span>Comisión Chofer:</span>
                            <span className="font-semibold">{pendingData.chofer.comisionPorcentaje}% de recaudación</span>
                          </p>
                        )}
                        <p className="flex justify-between">
                          <span>Comisión Agencia:</span>
                          <span className="font-semibold">{pendingData.chofer.comisionDuenioAuto}% de recaudación</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {pendingData && (
              <form onSubmit={handleSubmitCierre} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <Coins className="w-5 h-5 text-emerald-500" />
                  Parámetros de Liquidación
                </h2>

                {!pendingData.chofer.esPropietario ? (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="combustibleInput" className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
                        <Fuel className="w-4 h-4 text-orange-500" />
                        Gasto en Combustible (Nafta/GNC)
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 font-medium">$</span>
                        <input
                          type="number"
                          id="combustibleInput"
                          min="0"
                          step="0.01"
                          value={combustible}
                          onChange={(e) => setCombustible(e.target.value)}
                          className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-800 font-bold text-lg"
                          placeholder="0.00"
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Este importe se descontará del saldo del dueño del vehículo.</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-start gap-2.5">
                    <Shield className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Chofer Propietario</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Al ser dueño del vehículo, la agencia solo le retiene su comisión (20% o el configurado). El combustible no se deduce en caja.
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="observacionesInput" className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-slate-400" />
                    Observaciones
                  </label>
                  <textarea
                    id="observacionesInput"
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-800 text-sm"
                    placeholder="Detalles sobre el combustible, estado del auto, etc."
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || pendingData.viajes.length === 0}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Realizar Cierre de Caja
                </button>
              </form>
            )}
          </div>

          {/* Columna Derecha: Viajes Pendientes y Cuadro de Resultados */}
          <div className="lg:col-span-2 space-y-6">
            {!selectedChoferId ? (
              <div className="space-y-6">
                {/* Resumen del Turno */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-indigo-500" />
                      Resumen Financiero de Mi Turno (Hoy)
                    </h2>
                    <span className="text-xs text-slate-400 font-medium">Auto-rendición al dueño</span>
                  </div>

                  {loadingResumen ? (
                    <div className="py-8 text-center">
                      <div className="loading-spinner border-primary-500 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm">Cargando resumen de caja...</p>
                    </div>
                  ) : resumenTurno ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 shadow-sm">
                        <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider text-[10px]">Total Recaudado</span>
                        <span className="text-2xl font-black text-slate-800 block mt-1">
                          ${(resumenTurno.resumen?.totalRecaudado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-1 block">Bruto en viajes liquidados</span>
                      </div>

                      <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100 shadow-sm">
                        <span className="text-xs text-emerald-700 font-bold block uppercase tracking-wider text-[10px]">Agencia (Retenido)</span>
                        <span className="text-2xl font-black text-emerald-800 block mt-1">
                          ${(resumenTurno.resumen?.totalComisionAgencia || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-emerald-600 mt-1 block">Rendir al propietario</span>
                      </div>

                      <div className="bg-orange-50/50 rounded-xl p-4 border border-orange-100 shadow-sm">
                        <span className="text-xs text-orange-700 font-bold block uppercase tracking-wider text-[10px]">Combustible</span>
                        <span className="text-2xl font-black text-orange-800 block mt-1">
                          ${(resumenTurno.resumen?.totalCombustible || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-orange-600 mt-1 block">Tickets descontados</span>
                      </div>

                      <div className="bg-purple-50/50 rounded-xl p-4 border border-purple-100 shadow-sm">
                        <span className="text-xs text-purple-700 font-bold block uppercase tracking-wider text-[10px]">Ganancia Propietarios</span>
                        <span className="text-2xl font-black text-purple-800 block mt-1">
                          ${(resumenTurno.resumen?.totalGananciaPropietario || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-purple-600 mt-1 block">Neto vehículos alquilados</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No se pudo cargar el resumen del turno.</p>
                  )}
                </div>

                {/* Historial de Cierres Hoy */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      Cierres de Caja Procesados Hoy ({resumenTurno?.liquidaciones?.length || 0})
                    </h3>
                  </div>

                  {loadingResumen ? (
                    <div className="p-8 text-center">
                      <div className="loading-spinner border-primary-500 mx-auto" />
                    </div>
                  ) : resumenTurno?.liquidaciones?.length === 0 ? (
                    <div className="p-12 text-center">
                      <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <h4 className="text-sm font-bold text-slate-700">Sin cierres hoy</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        Aún no has registrado ningún cierre de caja chofer en tu turno de hoy. Selecciona un chofer a la izquierda para empezar.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-left">
                        <thead className="bg-slate-50/50">
                          <tr>
                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Hora</th>
                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Chofer</th>
                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Recaudado</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Agencia</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Combustible</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Neto Prop.</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                          {resumenTurno?.liquidaciones?.map((liq: any) => (
                            <tr key={liq.id} className="hover:bg-slate-50/30 transition-colors text-slate-700 text-xs">
                              <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-500">
                                {new Date(liq.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-800">
                                {liq.chofer?.nombre} {liq.chofer?.apellido}
                                <div className="text-[10px] text-slate-400 font-normal">#{liq.chofer?.numeroChofer}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  liq.chofer?.esPropietario 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {liq.chofer?.esPropietario ? 'Dueño Auto' : 'Comisionista'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-slate-800">
                                ${liq.totalRecaudado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-emerald-700 font-bold bg-emerald-50/20">
                                ${liq.comisionAgencia.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-orange-700 font-medium">
                                ${liq.combustible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-purple-700 font-bold">
                                ${liq.gananciaPropietario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : loadingPending ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
                <div className="loading-spinner border-primary-500 mx-auto mb-4" />
                <p className="text-slate-500">Buscando viajes pendientes de liquidar...</p>
              </div>
            ) : pendingData ? (
              <div className="space-y-6">
                {/* Cuadro Resumen Financiero */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Cálculo de Liquidación</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <span className="text-xs text-slate-500 font-semibold block uppercase">Total Recaudado</span>
                      <span className="text-2xl font-black text-slate-800 block mt-1">
                        ${calculos.totalRecaudado.toLocaleString('es-AR')}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        {pendingData.viajes.length} viaje{pendingData.viajes.length > 1 ? 's' : ''} completados
                      </span>
                    </div>

                    <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
                      <span className="text-xs text-emerald-700 font-semibold block uppercase">Comisión Agencia</span>
                      <span className="text-2xl font-black text-emerald-800 block mt-1">
                        ${calculos.comisionAgencia.toLocaleString('es-AR')}
                      </span>
                      <span className="text-[10px] text-emerald-600 mt-1 block font-medium">
                        Retención ({pendingData.chofer.comisionDuenioAuto}%)
                      </span>
                    </div>

                    <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                      <span className="text-xs text-blue-700 font-semibold block uppercase">Comisión Chofer</span>
                      <span className="text-2xl font-black text-blue-800 block mt-1">
                        ${calculos.comisionChofer.toLocaleString('es-AR')}
                      </span>
                      <span className="text-[10px] text-blue-600 mt-1 block font-medium">
                        {pendingData.chofer.esPropietario 
                          ? `Sobrante dueño (${100 - pendingData.chofer.comisionDuenioAuto}%)`
                          : `Salario chofer (${pendingData.chofer.comisionPorcentaje}%)`}
                      </span>
                    </div>

                    {!pendingData.chofer.esPropietario && (
                      <div className="bg-purple-50/50 rounded-xl p-4 border border-purple-100">
                        <span className="text-xs text-purple-700 font-semibold block uppercase">Ganancia Propietario</span>
                        <span className="text-2xl font-black text-purple-800 block mt-1">
                          ${calculos.gananciaPropietario.toLocaleString('es-AR')}
                        </span>
                        <span className="text-[10px] text-purple-600 mt-1 block font-medium">
                          Remanente del vehículo
                        </span>
                      </div>
                    )}
                  </div>

                  {pendingData.viajes.length === 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex gap-3 text-sm text-yellow-800">
                      <AlertTriangle className="w-5 h-5 shrink-0 text-yellow-500" />
                      <div>
                        <p className="font-semibold">Sin viajes pendientes</p>
                        <p className="text-xs mt-0.5 text-yellow-700">
                          Este chofer no tiene viajes completados que no hayan sido liquidados previamente. No se puede realizar el cierre.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tabla de Viajes */}
                {pendingData.viajes.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <h3 className="text-md font-bold text-slate-800">Viajes a Liquidar</h3>
                      <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                        {pendingData.viajes.length} viajes
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50/50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Fecha/Hora</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Cliente</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Origen / Destino</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Importe</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                          {pendingData.viajes.map((viaje: Viaje) => (
                            <tr key={viaje.id} className="hover:bg-slate-50/30 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  <div>
                                    <div className="font-semibold text-slate-800">
                                      {new Date(viaje.fecha).toLocaleDateString('es-AR')}
                                    </div>
                                    <div className="text-xs text-slate-400">
                                      {new Date(viaje.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 font-medium">
                                {viaje.clienteNombre || 'S/N'}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">
                                <div>
                                  <span className="font-medium text-slate-700">Orig:</span> {viaje.origen}
                                </div>
                                <div className="mt-0.5">
                                  <span className="font-medium text-slate-700">Dest:</span> {viaje.destino}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-slate-900">
                                ${Number(viaje.precio).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
