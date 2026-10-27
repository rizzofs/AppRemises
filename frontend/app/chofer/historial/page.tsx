'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { coordinadorDashboardService, choferService } from '@/lib/api';
import { DollarSign, Calendar, Fuel, FileText, User, Clock, RefreshCw, ChevronDown, ChevronUp, MapPin, Navigation } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ChoferHistorialPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'viajes' | 'cierres'>('viajes');
  const [viajes, setViajes] = useState<any[]>([]);
  const [loadingViajes, setLoadingViajes] = useState(false);
  const [liquidaciones, setLiquidaciones] = useState<any[]>([]);
  const [loadingCierres, setLoadingCierres] = useState(false);
  const [expandedLiq, setExpandedLiq] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadViajes();
    loadCierres();
  }, [user]);

  const loadViajes = async () => {
    try {
      setLoadingViajes(true);
      const response = await choferService.getMisViajes(user?.chofer?.id);
      if (response.success && response.data) {
        setViajes(response.data);
      }
    } catch (error) {
      console.error('Error loading driver trips:', error);
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

  const toggleExpand = (id: string) => {
    setExpandedLiq(expandedLiq === id ? null : id);
  };

  if (!user) return null;

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto pb-24">
      {/* Selector de Pestañas (Tabs) */}
      <div className="flex border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-1 shadow-sm transition-colors">
        <button
          onClick={() => setActiveTab('viajes')}
          className={`flex-1 py-2.5 text-center text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'viajes'
              ? 'bg-primary-500 text-white shadow-sm'
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
          className={`flex-1 py-2.5 text-center text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'cierres'
              ? 'bg-primary-500 text-white shadow-sm'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white'
          }`}
        >
          Cierres de Caja Chofer
        </button>
      </div>

      {activeTab === 'viajes' ? (
        <div className="space-y-3">
          {loadingViajes ? (
            <div className="text-center py-12">
              <div className="loading-spinner border-primary-500 mx-auto"></div>
              <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">Cargando viajes...</p>
            </div>
          ) : viajes.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 text-center transition-colors">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-800 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-500 dark:text-slate-400 font-medium text-sm">Aún no tienes viajes registrados</p>
              <p className="text-xs text-gray-400 dark:text-slate-400 mt-1">Tus viajes completados aparecerán aquí.</p>
            </div>
          ) : (
            viajes.map((v) => (
              <div key={v.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 space-y-2.5 transition-colors">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-2">
                  <span className="text-xs text-gray-400 dark:text-slate-400">
                    {new Date(v.fecha).toLocaleDateString('es-AR')} - {new Date(v.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        v.estado === 'COMPLETADO'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : v.estado === 'CANCELADO'
                          ? 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400'
                          : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                      }`}
                    >
                      {v.estado}
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white text-sm">
                      ${Number(v.precio || 0).toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-gray-800 dark:text-slate-200 font-medium">{v.origen}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Navigation className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <span className="text-gray-800 dark:text-slate-200 font-medium">{v.destino}</span>
                  </div>
                  {(v.distanciaKmConPasajero > 0 || v.distanciaKmSinPasajero > 0) && (
                    <div className="flex items-center gap-2 pt-1.5 border-t border-gray-50 dark:border-slate-800 text-[11px] text-gray-500 dark:text-slate-400">
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
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-sm font-bold text-gray-800 dark:text-white">Tus liquidaciones registradas</h3>
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
              <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">Cargando cierres de caja...</p>
            </div>
          ) : liquidaciones.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 text-center transition-colors">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-800 mb-3">
                <DollarSign className="h-6 w-6 text-gray-400 dark:text-slate-400" />
              </div>
              <p className="text-gray-500 dark:text-slate-400 font-medium text-sm">No tienes cierres registrados</p>
              <p className="text-xs text-gray-400 dark:text-slate-400 mt-1">Cuando el coordinador te liquide la caja, verás los detalles aquí.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {liquidaciones.map((liq) => {
                const isExpanded = expandedLiq === liq.id;
                const coordinadorNombre = liq.coordinador?.coordinador?.nombre || liq.coordinador?.duenio?.nombre || liq.coordinador?.email || 'N/A';
                const esProp = user?.chofer?.esPropietario;

                return (
                  <div
                    key={liq.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-200"
                  >
                    {/* Encabezado Principal */}
                    <div
                      onClick={() => toggleExpand(liq.id)}
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50/50 dark:hover:bg-slate-800/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl text-emerald-600 dark:text-emerald-400">
                          <DollarSign className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 dark:text-slate-400">
                            {new Date(liq.fecha).toLocaleDateString('es-AR')} - {new Date(liq.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                          </p>
                          <p className="text-sm font-bold text-gray-800 dark:text-white">
                            Recaudado: ${liq.totalRecaudado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                          {esProp ? 'Cerrado' : `Mi Comisión: $${liq.comisionChofer.toLocaleString('es-AR')}`}
                        </span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </div>
                    </div>

                    {/* Detalle Desplegable */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-gray-50 dark:border-slate-800 pt-3 bg-slate-50/30 dark:bg-slate-800/40 text-xs text-gray-600 dark:text-slate-300 space-y-2.5">
                        <div className="grid grid-cols-2 gap-y-2">
                          <div className="flex flex-col">
                            <span className="text-gray-400 dark:text-slate-400 font-medium">Recaudación Total</span>
                            <span className="font-bold text-gray-800 dark:text-white">${liq.totalRecaudado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          
                          <div className="flex flex-col">
                            <span className="text-gray-400 dark:text-slate-400 font-medium">Comisión Agencia ({esProp ? liq.comisionAgencia / liq.totalRecaudado * 100 : '20'}%)</span>
                            <span className="font-bold text-red-600 dark:text-red-400">-${liq.comisionAgencia.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                          </div>

                          {!esProp && (
                            <>
                              <div className="flex flex-col">
                                <span className="text-gray-400 dark:text-slate-400 font-medium">Combustible Descontado</span>
                                <span className="font-bold text-orange-600 dark:text-orange-400">-${liq.combustible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                              </div>

                              <div className="flex flex-col">
                                <span className="text-gray-400 dark:text-slate-400 font-medium">Ganancia Propietario Auto</span>
                                <span className="font-bold text-purple-700 dark:text-purple-400">${liq.gananciaPropietario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                              </div>
                            </>
                          )}

                          <div className="flex flex-col col-span-2 pt-1 border-t border-gray-100 dark:border-slate-700">
                            <span className="text-gray-400 dark:text-slate-400 font-medium">
                              {esProp ? 'Sobrante Dueño de Auto (Mi Ganancia)' : 'Comisión Chofer (Mi Salario)'}
                            </span>
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                              ${liq.comisionChofer.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-gray-100 dark:border-slate-700 flex flex-col gap-1 text-[11px] text-gray-500 dark:text-slate-400">
                          <p className="flex justify-between">
                            <span>Cobrado por:</span>
                            <span className="font-semibold text-gray-700 dark:text-slate-200">{coordinadorNombre} ({liq.coordinador?.email})</span>
                          </p>
                          {liq.observaciones && (
                            <p className="bg-white dark:bg-slate-800 p-2 rounded border border-gray-200 dark:border-slate-700 mt-1 italic text-gray-600 dark:text-slate-300">
                              &quot;{liq.observaciones}&quot;
                            </p>
                          )}
                        </div>
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
