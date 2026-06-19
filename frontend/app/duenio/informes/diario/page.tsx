'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTracking } from '@/hooks/useAppTracking';
import { duenioReportesService } from '@/lib/api';
import { 
  Calendar, 
  ArrowLeft, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Car, 
  MapPin, 
  Search, 
  RefreshCw, 
  Printer, 
  AlertCircle, 
  Building,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Resumen {
  totalFacturado: number;
  viajesCompletados: number;
  viajesCancelados: number;
  viajesPendientes: number;
  ticketPromedio: number;
  tasaCancelacion: number;
}

interface Viaje {
  id: string;
  origen: string;
  destino: string;
  precio: number;
  estado: 'PENDIENTE' | 'EN_CURSO' | 'COMPLETADO' | 'CANCELADO';
  fecha: string;
  cliente: string;
  chofer: string;
  patente: string;
}

export default function InformeDiarioPage() {
  const { user } = useAuth();
  const router = useRouter();
  useAppTracking('DUENIO_INFORME_DIARIO');

  const [remiserias, setRemiserias] = useState<{ id: string; nombre: string }[]>([]);
  const [selectedRemiseria, setSelectedRemiseria] = useState<string>('todas');
  
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [viajes, setViajes] = useState<Viaje[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user || user.rol !== 'DUENIO') {
      router.push('/login');
      return;
    }

    const initData = async () => {
      try {
        setLoading(true);
        // Cargar remiserías del dueño
        const resRem = await duenioReportesService.getMisRemiserias();
        if (resRem.success && resRem.data) {
          setRemiserias(resRem.data);
        }
        await fetchReportData('todas');
      } catch (error) {
        console.error('Error inicializando informe diario:', error);
        toast.error('Error al cargar datos iniciales');
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [user, router]);

  const fetchReportData = async (remId: string) => {
    try {
      setLoadingReport(true);
      const response = await duenioReportesService.getInformeDiario(remId === 'todas' ? undefined : remId);
      if (response.success && response.data) {
        setResumen(response.data.resumen);
        setViajes(response.data.viajes);
      } else {
        toast.error(response.message || 'Error al obtener informe diario');
      }
    } catch (error) {
      console.error('Error al obtener informe diario:', error);
      toast.error('Error al conectar con el servidor');
    } finally {
      setLoadingReport(false);
    }
  };

  const handleRemiseriaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedRemiseria(value);
    fetchReportData(value);
  };

  const handleRefresh = () => {
    fetchReportData(selectedRemiseria);
    toast.success('Datos actualizados en vivo');
  };

  const handlePrint = () => {
    window.print();
  };

  // Filtrar viajes por la caja de búsqueda
  const filteredViajes = viajes.filter(v => 
    v.chofer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.patente.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.origen.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.destino.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/duenio/dashboard')}
                className="flex items-center text-gray-600 hover:text-gray-900 mr-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 mr-1" />
                <span>Volver</span>
              </button>
              <div className="h-6 w-[1px] bg-gray-200 mr-4"></div>
              <div className="flex items-center">
                <Calendar className="w-6 h-6 text-blue-600 mr-2" />
                <h1 className="text-xl font-bold text-gray-900">Informe Diario de Facturación</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handleRefresh}
                disabled={loadingReport}
                className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-all active:scale-95 disabled:opacity-50"
                title="Actualizar datos"
              >
                <RefreshCw className={`w-5 h-5 ${loadingReport ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center space-x-1.5 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:text-gray-900 transition-all font-medium text-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Reporte</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:p-0">
        
        {/* Titulo en Impresión */}
        <div className="hidden print:block mb-8 border-b pb-4">
          <h1 className="text-3xl font-bold text-gray-900">App Remises</h1>
          <h2 className="text-xl text-gray-600">Informe Diario de Recaudación</h2>
          <p className="text-sm text-gray-500 mt-2">
            Generado: {new Date().toLocaleString('es-AR')} | Operador: {user?.duenio?.nombre}
          </p>
        </div>

        {/* Filtros superiores */}
        <div className="bg-white rounded-xl shadow-sm border p-5 mb-8 flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 print:hidden">
          <div className="flex items-center space-x-3">
            <Building className="w-5 h-5 text-gray-400" />
            <div>
              <label htmlFor="remiseria" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Filtrar por Agencia
              </label>
              <select
                id="remiseria"
                value={selectedRemiseria}
                onChange={handleRemiseriaChange}
                className="mt-1 block w-64 pl-3 pr-10 py-1.5 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-lg sm:text-sm shadow-sm"
              >
                <option value="todas">Todas las Agencias (Consolidado)</option>
                {remiserias.map(r => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-100">
              Fecha Operativa: {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>

        {loadingReport && !resumen ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="loading-spinner mb-4"></div>
            <p className="text-sm text-gray-500">Calculando ingresos diarios...</p>
          </div>
        ) : (
          <>
            {/* Tarjetas de métricas premium */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 print:grid-cols-4 print:gap-4">
              {/* Recaudación */}
              <div className="bg-white rounded-xl border shadow-sm p-6 relative overflow-hidden transition-all hover:shadow-md">
                <div className="absolute right-4 top-4 p-2 bg-green-50 text-green-600 rounded-lg">
                  <DollarSign className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recaudación Total</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-2">
                  ${resumen?.totalFacturado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </h3>
                <p className="text-xs text-green-600 mt-1 font-medium flex items-center">
                  <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                  <span>Ingreso Bruto de Hoy</span>
                </p>
              </div>

              {/* Viajes Completados */}
              <div className="bg-white rounded-xl border shadow-sm p-6 relative overflow-hidden transition-all hover:shadow-md">
                <div className="absolute right-4 top-4 p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Viajes Completados</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-2">
                  {resumen?.viajesCompletados}
                </h3>
                <p className="text-xs text-gray-500 mt-1 flex items-center">
                  <Clock className="w-3.5 h-3.5 mr-0.5 text-blue-500" />
                  <span>{resumen?.viajesPendientes} en curso o pendientes</span>
                </p>
              </div>

              {/* Ticket Promedio */}
              <div className="bg-white rounded-xl border shadow-sm p-6 relative overflow-hidden transition-all hover:shadow-md">
                <div className="absolute right-4 top-4 p-2 bg-purple-50 text-purple-600 rounded-lg">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ticket Promedio</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-2">
                  ${resumen?.ticketPromedio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </h3>
                <p className="text-xs text-gray-500 mt-1">Valor medio por viaje</p>
              </div>

              {/* Tasa de Cancelación */}
              <div className="bg-white rounded-xl border shadow-sm p-6 relative overflow-hidden transition-all hover:shadow-md">
                <div className="absolute right-4 top-4 p-2 bg-red-50 text-red-600 rounded-lg">
                  <XCircle className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tasa de Cancelación</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-2">
                  {resumen?.tasaCancelacion.toFixed(1)}%
                </h3>
                <p className="text-xs text-red-500 mt-1 font-medium">
                  {resumen?.viajesCancelados} viajes rechazados o cancelados
                </p>
              </div>
            </div>

            {/* Listado de viajes */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="p-6 border-b flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 print:hidden">
                <h3 className="text-lg font-bold text-gray-900 flex items-center">
                  <Car className="w-5 h-5 mr-2 text-blue-500" />
                  <span>Listado de Viajes de Hoy ({filteredViajes.length})</span>
                </h3>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar por Chofer, Patente o Cliente..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-1.5 w-80 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {filteredViajes.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-base font-semibold">No se encontraron viajes hoy</p>
                  <p className="text-xs mt-1">Intente cambiar el filtro de agencia o realizar otra búsqueda</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-left">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Hora</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Chofer</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Patente</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Origen / Destino</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Precio</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredViajes.map((viaje) => (
                        <tr key={viaje.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {new Date(viaje.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            {viaje.chofer}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            <span className="font-mono bg-gray-100 border px-1.5 py-0.5 rounded text-xs">
                              {viaje.patente}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {viaje.cliente}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                            <div className="truncate" title={viaje.origen}>
                              <strong className="text-gray-500 text-xs mr-1">O:</strong> {viaje.origen}
                            </div>
                            <div className="truncate mt-0.5" title={viaje.destino}>
                              <strong className="text-gray-500 text-xs mr-1">D:</strong> {viaje.destino}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                              viaje.estado === 'COMPLETADO' ? 'bg-green-50 text-green-700 border border-green-100' :
                              viaje.estado === 'CANCELADO' ? 'bg-red-50 text-red-700 border border-red-100' :
                              viaje.estado === 'EN_CURSO' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                              'bg-yellow-50 text-yellow-700 border border-yellow-100'
                            }`}>
                              {viaje.estado}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                            ${viaje.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}