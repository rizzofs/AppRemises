'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTracking } from '@/hooks/useAppTracking';
import { clienteService } from '@/lib/api';
import { ViajeCliente, ReservaCliente } from '@/types';
import { 
  Car, 
  Calendar, 
  Clock, 
  MapPin, 
  Navigation,
  XCircle, 
  ChevronRight, 
  RotateCcw, 
  Phone,
  Trash2,
  AlertTriangle,
  History,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

export default function MisViajesPage() {
  const { user } = useAuth();
  const router = useRouter();
  useAppTracking('CLIENTE_MIS_VIAJES');

  const [activeTab, setActiveTab] = useState<'activas' | 'historial'>('activas');
  const [viajes, setViajes] = useState<ViajeCliente[]>([]);
  const [reservas, setReservas] = useState<ReservaCliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancelarId, setCancelarId] = useState<string | null>(null);
  const [cancelarTipo, setCancelarTipo] = useState<'viaje' | 'reserva' | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);

  useEffect(() => {
    if (!user || user.rol !== 'CLIENTE') {
      router.push('/login');
      return;
    }
    loadData();
  }, [user, router]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [viajesRes, reservasRes] = await Promise.all([
        clienteService.getViajes(),
        clienteService.getReservas()
      ]);

      if (viajesRes.success) {
        setViajes(viajesRes.data || []);
      }
      if (reservasRes.success) {
        setReservas(reservasRes.data || []);
      }
    } catch (error) {
      console.error('Error cargando viajes/reservas:', error);
      toast.error('Error al cargar la información');
    } finally {
      setIsLoading(false);
    }
  };

  const openCancelModal = (id: string, tipo: 'viaje' | 'reserva') => {
    setCancelarId(id);
    setCancelarTipo(tipo);
  };

  const closeCancelModal = () => {
    setCancelarId(null);
    setCancelarTipo(null);
  };

  const handleCancelar = async () => {
    if (!cancelarId || !cancelarTipo) return;
    setIsCanceling(true);

    try {
      let response;
      if (cancelarTipo === 'viaje') {
        response = await clienteService.cancelarViaje(cancelarId);
      } else {
        response = await clienteService.cancelarReserva(cancelarId);
      }

      if (response.success) {
        toast.success(`${cancelarTipo === 'viaje' ? 'Viaje' : 'Reserva'} cancelado/a exitosamente`);
        loadData();
      } else {
        toast.error(response.message || `Error al cancelar`);
      }
    } catch (error) {
      console.error(error);
      toast.error('Error de red al intentar cancelar');
    } finally {
      setIsCanceling(false);
      closeCancelModal();
    }
  };

  // Filtrar activos
  const viajesActivos = viajes.filter(v => ['PENDIENTE', 'ACEPTADO', 'EN_CAMINO', 'EN_CURSO'].includes(v.estado));
  const reservasActivas = reservas.filter(r => (r.estado as string) === 'ACTIVA');

  // Filtrar pasados/historial
  const viajesPasados = viajes.filter(v => ['COMPLETADO', 'CANCELADO'].includes(v.estado));
  const reservasPasadas = reservas.filter(r => ['CANCELADA', 'COMPLETADA'].includes(r.estado as string));

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'PENDIENTE':
        return <span className="bg-yellow-50 text-yellow-700 border border-yellow-200 px-2.5 py-0.5 rounded-full text-xs font-semibold animate-pulse">Buscando Chofer</span>;
      case 'ACEPTADO':
      case 'EN_CAMINO':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-xs font-semibold">Chofer en Camino</span>;
      case 'EN_CURSO':
        return <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full text-xs font-semibold">En Curso</span>;
      case 'COMPLETADO':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-semibold">Completado</span>;
      case 'CANCELADO':
      case 'CANCELADA':
        return <span className="bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-full text-xs font-semibold">Cancelado</span>;
      default:
        return <span className="bg-gray-50 text-gray-700 border border-gray-200 px-2.5 py-0.5 rounded-full text-xs font-semibold">{estado}</span>;
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 pb-20 transition-colors">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 shadow-sm border-b border-gray-200 dark:border-slate-800 sticky top-0 z-10 transition-colors">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Mis Viajes y Reservas</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">Administra tus traslados programados y en curso</p>
          </div>
          <button 
            onClick={loadData}
            className="p-2 text-gray-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            title="Refrescar datos"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Pestañas */}
        <div className="flex bg-white dark:bg-slate-900 rounded-xl p-1 shadow-sm border border-gray-100 dark:border-slate-800 mb-6 transition-colors">
          <button
            onClick={() => setActiveTab('activas')}
            className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'activas' 
                ? 'bg-primary-600 text-white shadow' 
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-950 dark:hover:text-white'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            <span>Activos ({viajesActivos.length + reservasActivas.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('historial')}
            className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'historial' 
                ? 'bg-primary-600 text-white shadow' 
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-950 dark:hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historial ({viajesPasados.length + reservasPasadas.length})</span>
          </button>
        </div>

        {/* Acciones Rápidas */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Link 
            href="/cliente/app" 
            className="bg-white dark:bg-slate-900 hover:bg-primary-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-sm hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-950/60 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 mb-2 group-hover:scale-110 transition-transform">
              <Car className="w-6 h-6" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white text-sm">Pedir Remís Ahora</span>
            <span className="text-xs text-gray-500 dark:text-slate-400 mt-1">Viaje inmediato</span>
          </Link>
          <Link 
            href="/cliente/reserva" 
            className="bg-white dark:bg-slate-900 hover:bg-primary-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-sm hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2 group-hover:scale-110 transition-transform">
              <Calendar className="w-6 h-6" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white text-sm">Programar Viaje</span>
            <span className="text-xs text-gray-500 dark:text-slate-400 mt-1">Reserva anticipada</span>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mb-4"></div>
            <span>Cargando tus solicitudes...</span>
          </div>
        ) : (
          <div className="space-y-6">
            
            {activeTab === 'activas' ? (
              // PESTAÑA ACTIVAS
              <>
                {/* 1. VIAJES ACTIVOS */}
                {viajesActivos.length > 0 && (
                  <div>
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Viajes en Curso o Pedidos</h2>
                    <div className="space-y-4">
                      {viajesActivos.map((viaje) => (
                        <div key={viaje.id} className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-gray-150 dark:border-slate-800 relative overflow-hidden transition-colors">
                          {/* Franja de estado */}
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center space-x-2">
                              <span className="p-2 bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 rounded-lg">
                                <Car className="w-5 h-5" />
                              </span>
                              <div>
                                <h3 className="font-bold text-gray-900 dark:text-white text-sm">Viaje Inmediato</h3>
                                <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center">
                                  <Clock className="w-3.5 h-3.5 mr-1" />
                                  {new Date(viaje.fecha).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            {getEstadoBadge(viaje.estado)}
                          </div>

                          {/* Ruta */}
                          <div className="space-y-2 border-l-2 border-dashed border-gray-200 dark:border-slate-700 ml-4 pl-4 relative mb-4">
                            <div className="relative">
                              <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-green-500"></div>
                              <span className="text-xs text-gray-500 dark:text-slate-400 block">Origen</span>
                              <span className="text-sm text-gray-900 dark:text-white font-medium block leading-tight">{viaje.origen}</span>
                            </div>
                            <div className="relative mt-2">
                              <div className="absolute -left-[21px] top-1.5 w-2 h-2 bg-red-500"></div>
                              <span className="text-xs text-gray-500 dark:text-slate-400 block">Destino</span>
                              <span className="text-sm text-gray-900 dark:text-white font-medium block leading-tight">{viaje.destino}</span>
                            </div>
                          </div>

                          {/* Chofer asignado */}
                          {viaje.chofer ? (
                            <div className="bg-gray-50 dark:bg-slate-800/80 rounded-xl p-3 flex justify-between items-center mb-4 border border-transparent dark:border-slate-700">
                              <div className="flex items-center space-x-3">
                                <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-gray-600 dark:text-slate-200 font-bold text-sm">
                                  {viaje.chofer.nombre.charAt(0)}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-gray-900 dark:text-white">{viaje.chofer.nombre}</p>
                                  {viaje.chofer.vehiculo && (
                                    <p className="text-xs text-gray-500 dark:text-slate-400">
                                      {viaje.chofer.vehiculo.marca} {viaje.chofer.vehiculo.modelo} • <span className="font-semibold bg-gray-250 dark:bg-slate-700 px-1 py-0.5 rounded text-gray-800 dark:text-slate-200">{viaje.chofer.vehiculo.patente}</span>
                                    </p>
                                  )}
                                </div>
                              </div>
                              <a 
                                href={`tel:${viaje.chofer.telefono}`}
                                className="p-2 bg-white dark:bg-slate-700 border border-gray-250 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-full text-gray-600 dark:text-slate-200"
                                title="Llamar chofer"
                              >
                                <Phone className="w-4 h-4" />
                              </a>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 dark:text-amber-300 bg-yellow-50 dark:bg-amber-950/40 text-yellow-800 border border-yellow-100 dark:border-amber-800/60 rounded-xl p-3 flex items-center mb-4">
                              <AlertCircle className="w-4 h-4 mr-2 text-yellow-600 dark:text-amber-400 shrink-0" />
                              <span>Esperando asignación de conductor por el coordinador</span>
                            </div>
                          )}

                          {/* Footer tarjeta */}
                          <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-slate-800">
                            <div>
                              <span className="text-xs text-gray-500 dark:text-slate-400 block">Costo estimado</span>
                              <span className="text-lg font-bold text-gray-950 dark:text-white">${viaje.precio}</span>
                            </div>
                            {['PENDIENTE', 'ACEPTADO', 'EN_CAMINO'].includes(viaje.estado) && (
                              <button
                                onClick={() => openCancelModal(viaje.id, 'viaje')}
                                className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xs font-semibold flex items-center gap-1 py-2 px-3 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Cancelar Viaje</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. RESERVAS ACTIVAS */}
                {reservasActivas.length > 0 && (
                  <div>
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Reservas Programadas</h2>
                    <div className="space-y-4">
                      {reservasActivas.map((reserva) => (
                        <div key={reserva.id} className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-gray-150 dark:border-slate-800 transition-colors">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center space-x-2">
                              <span className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
                                <Calendar className="w-5 h-5" />
                              </span>
                              <div>
                                <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                                  Reserva {reserva.tipoReserva === 'periodica' ? 'Periódica' : 'Única'}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center">
                                  <Clock className="w-3.5 h-3.5 mr-1" />
                                  {new Date(reserva.fechaInicio).toLocaleDateString()} a las {reserva.horaInicio} hs
                                </p>
                              </div>
                            </div>
                            {getEstadoBadge(reserva.estado)}
                          </div>

                          {/* Detalles periocidad */}
                          {reserva.tipoReserva === 'periodica' && (
                            <div className="mb-3 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-lg p-2.5 flex items-center border border-transparent dark:border-emerald-800/40">
                              <span className="font-medium mr-1">Días:</span> {reserva.diasSemana ? reserva.diasSemana.join(', ') : ''}
                              {reserva.fechaFin && (
                                <span className="ml-2 pl-2 border-l border-emerald-200 dark:border-emerald-800">
                                  <span className="font-medium">Hasta:</span> {new Date(reserva.fechaFin).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Ruta */}
                          <div className="space-y-2 border-l-2 border-dashed border-gray-250 dark:border-slate-700 ml-4 pl-4 relative mb-4">
                            <div className="relative">
                              <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-green-500"></div>
                              <span className="text-xs text-gray-500 dark:text-slate-400 block">Origen</span>
                              <span className="text-sm text-gray-900 dark:text-white font-medium block leading-tight">{reserva.origen}</span>
                            </div>
                            <div className="relative mt-2">
                              <div className="absolute -left-[21px] top-1.5 w-2 h-2 bg-red-500"></div>
                              <span className="text-xs text-gray-500 dark:text-slate-400 block">Destino</span>
                              <span className="text-sm text-gray-900 dark:text-white font-medium block leading-tight">{reserva.destino}</span>
                            </div>
                          </div>

                          {reserva.observaciones && (
                            <p className="text-xs text-gray-650 dark:text-slate-300 bg-gray-50 dark:bg-slate-800/70 p-2.5 rounded-lg mb-4 italic border border-transparent dark:border-slate-700">
                              &quot;{reserva.observaciones}&quot;
                            </p>
                          )}

                          {/* Footer */}
                          <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-slate-800">
                            <span className="text-xs text-gray-400 dark:text-slate-400">Creada el {new Date(reserva.createdAt).toLocaleDateString()}</span>
                            <button
                              onClick={() => openCancelModal(reserva.id, 'reserva')}
                              className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xs font-semibold flex items-center gap-1 py-2 px-3 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Cancelar Reserva</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {viajesActivos.length === 0 && reservasActivas.length === 0 && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border border-gray-150 dark:border-slate-800 shadow-sm flex flex-col items-center transition-colors">
                    <Car className="w-12 h-12 text-gray-300 dark:text-slate-600 mb-3" />
                    <h3 className="font-bold text-gray-800 dark:text-white mb-1">No tienes viajes activos</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">Pide un auto ahora o agenda uno para más tarde en pocos clicks</p>
                    <Link 
                      href="/cliente/app" 
                      className="bg-primary-600 hover:bg-primary-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg transition-colors text-sm"
                    >
                      Pedir mi primer Auto
                    </Link>
                  </div>
                )}
              </>
            ) : (
              // PESTAÑA HISTORIAL
              <>
                <div className="space-y-4">
                  {/* Historial Combinado de Viajes y Reservas */}
                  {[...viajesPasados.map(v => ({ ...v, itemType: 'viaje' as const })), ...reservasPasadas.map(r => ({ ...r, itemType: 'reserva' as const }))].length > 0 ? (
                    [...viajesPasados.map(v => ({ ...v, itemType: 'viaje' as const })), ...reservasPasadas.map(r => ({ ...r, itemType: 'reserva' as const }))]
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((item) => {
                        const isViaje = item.itemType === 'viaje';
                        return (
                          <div key={item.id} className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-gray-150 dark:border-slate-800 opacity-80 hover:opacity-100 transition-all">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center space-x-2">
                                <span className={`p-2 rounded-lg ${isViaje ? 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'}`}>
                                  {isViaje ? <Car className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                                </span>
                                <div>
                                  <h4 className="font-bold text-gray-800 dark:text-white text-sm">
                                    {isViaje ? 'Viaje Inmediato' : `Reserva ${item.tipoReserva === 'periodica' ? 'Periódica' : 'Única'}`}
                                  </h4>
                                  <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center">
                                    <Clock className="w-3.5 h-3.5 mr-1" />
                                    {isViaje ? new Date(item.fecha).toLocaleString() : new Date(item.fechaInicio).toLocaleDateString() + ' ' + item.horaInicio}
                                  </p>
                                </div>
                              </div>
                              {getEstadoBadge(item.estado)}
                            </div>

                            {/* Ruta */}
                            <div className="text-xs text-gray-600 dark:text-slate-300 space-y-1 mb-2">
                              <p><span className="font-semibold text-gray-700 dark:text-slate-200">De:</span> {item.origen}</p>
                              <p><span className="font-semibold text-gray-700 dark:text-slate-200">A:</span> {item.destino}</p>
                            </div>

                            <div className="flex justify-between items-center pt-2.5 border-t border-gray-100 dark:border-slate-800 text-xs">
                              {isViaje ? (
                                <span className="font-bold text-gray-800 dark:text-white">Costo: ${item.precio}</span>
                              ) : (
                                <span className="text-gray-500 dark:text-slate-400">Reservada</span>
                              )}
                              {isViaje && item.chofer && (
                                <span className="text-gray-500 dark:text-slate-400">Chofer: {item.chofer.nombre}</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border border-gray-150 dark:border-slate-800 shadow-sm flex flex-col items-center transition-colors">
                      <History className="w-12 h-12 text-gray-300 dark:text-slate-600 mb-3" />
                      <h3 className="font-bold text-gray-800 dark:text-white mb-1">Tu historial está vacío</h3>
                      <p className="text-sm text-gray-500 dark:text-slate-400">Aquí aparecerán tus traslados completados y cancelaciones pasadas</p>
                    </div>
                  )}
                </div>
              </>
            )}

          </div>
        )}
      </div>

      {/* CONFIRMATION DIALOG */}
      {cancelarId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-slate-800 animate-scale-up transition-colors">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            
            <h3 className="font-bold text-lg text-gray-900 dark:text-white text-center mb-2">¿Confirmas la cancelación?</h3>
            <p className="text-sm text-gray-600 dark:text-slate-300 text-center mb-6">
              Esta acción no se puede deshacer y cancelará el/la {cancelarTipo === 'viaje' ? 'viaje inmediato solicitado' : 'reserva programada'} permanentemente.
            </p>

            <div className="flex space-x-3">
              <button
                onClick={closeCancelModal}
                disabled={isCanceling}
                className="flex-1 py-3 bg-gray-150 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 font-bold rounded-xl transition-colors text-sm"
              >
                Cerrar
              </button>
              <button
                onClick={handleCancelar}
                disabled={isCanceling}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 transition-colors text-sm flex items-center justify-center space-x-1"
              >
                {isCanceling && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>}
                <span>Sí, Cancelar</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
