'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTracking } from '@/hooks/useAppTracking';
import { duenioReportesService } from '@/lib/api';
import { 
  Users, 
  ArrowLeft, 
  DollarSign, 
  TrendingUp, 
  Building,
  RefreshCw,
  Printer,
  Search,
  AlertCircle,
  Percent,
  CheckCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface LiquidacionChofer {
  choferId: string;
  numeroChofer: string;
  nombreCompleto: string;
  dni: string;
  telefono: string;
  remiseriaNombre: string;
  comisionAgenciaPct: number;
  viajesCompletados: number;
  facturacionBruta: number;
  comisionChofer: number;
  saldoAgencia: number;
}

export default function InformeChoferesPage() {
  const { user } = useAuth();
  const router = useRouter();
  useAppTracking('DUENIO_INFORME_LIQUIDACIONES_CHOFERES');

  const [remiserias, setRemiserias] = useState<{ id: string; nombre: string }[]>([]);
  const [selectedRemiseria, setSelectedRemiseria] = useState<string>('todas');
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionChofer[]>([]);
  
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
        const resRem = await duenioReportesService.getMisRemiserias();
        if (resRem.success && resRem.data) {
          setRemiserias(resRem.data);
        }
        await fetchReportData('todas');
      } catch (error) {
        console.error('Error inicializando informe choferes:', error);
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
      const response = await duenioReportesService.getInformeChoferes(remId === 'todas' ? undefined : remId);
      if (response.success && response.data) {
        setLiquidaciones(response.data);
      } else {
        toast.error(response.message || 'Error al obtener liquidaciones');
      }
    } catch (error) {
      console.error('Error al obtener liquidaciones de choferes:', error);
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
    toast.success('Liquidaciones de choferes recalculadas');
  };

  const handlePrint = () => {
    window.print();
  };

  // Filtrar choferes por el buscador
  const filteredLiquidaciones = liquidaciones.filter(liq => 
    liq.nombreCompleto.toLowerCase().includes(searchQuery.toLowerCase()) ||
    liq.numeroChofer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    liq.remiseriaNombre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calcular totales sumados
  const totalFacturacionBruta = filteredLiquidaciones.reduce((sum, l) => sum + l.facturacionBruta, 0);
  const totalComisionChoferes = filteredLiquidaciones.reduce((sum, l) => sum + l.comisionChofer, 0);
  const totalNetoAgencia = filteredLiquidaciones.reduce((sum, l) => sum + l.saldoAgencia, 0);
  const totalViajesCompletados = filteredLiquidaciones.reduce((sum, l) => sum + l.viajesCompletados, 0);

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
                <Users className="w-6 h-6 text-red-600 mr-2" />
                <h1 className="text-xl font-bold text-gray-900">Liquidación y Rendimiento por Chofer</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handleRefresh}
                disabled={loadingReport}
                className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-all active:scale-95 disabled:opacity-50"
                title="Actualizar liquidaciones"
              >
                <RefreshCw className={`w-5 h-5 ${loadingReport ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center space-x-1.5 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:text-gray-900 transition-all font-medium text-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Liquidación</span>
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
          <h2 className="text-xl text-gray-600">Rendimiento e Informe de Liquidación por Chofer</h2>
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
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-800 border border-red-100">
              Período de Liquidación: Acumulado Histórico Completado
            </span>
          </div>
        </div>

        {loadingReport && liquidaciones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="loading-spinner mb-4"></div>
            <p className="text-sm text-gray-500">Calculando saldo de comisiones...</p>
          </div>
        ) : (
          <>
            {/* Totales consolidados de la grilla */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 print:grid-cols-4 print:gap-4">
              <div className="bg-white rounded-xl border shadow-sm p-6 relative overflow-hidden">
                <div className="absolute right-4 top-4 p-2 bg-gray-50 text-gray-600 rounded-lg">
                  <DollarSign className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Facturado Bruto</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-2">
                  ${totalFacturacionBruta.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </h3>
                <p className="text-xs text-gray-500 mt-1">{totalViajesCompletados} viajes en total</p>
              </div>

              <div className="bg-white rounded-xl border shadow-sm p-6 relative overflow-hidden">
                <div className="absolute right-4 top-4 p-2 bg-green-50 text-green-600 rounded-lg">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Neto Agencia</p>
                <h3 className="text-2xl font-bold text-green-600 mt-2">
                  ${totalNetoAgencia.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </h3>
                <p className="text-xs text-green-600 mt-1 font-semibold flex items-center">
                  <Percent className="w-3.5 h-3.5 mr-0.5" />
                  <span>Comisión cobrada de remiserías</span>
                </p>
              </div>

              <div className="bg-white rounded-xl border shadow-sm p-6 relative overflow-hidden">
                <div className="absolute right-4 top-4 p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Users className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Comisión Choferes</p>
                <h3 className="text-2xl font-bold text-blue-600 mt-2">
                  ${totalComisionChoferes.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </h3>
                <p className="text-xs text-gray-500 mt-1">Total a liquidar a choferes</p>
              </div>

              <div className="bg-white rounded-xl border shadow-sm p-6 relative overflow-hidden">
                <div className="absolute right-4 top-4 p-2 bg-purple-50 text-purple-600 rounded-lg">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Choferes Activos</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-2">
                  {filteredLiquidaciones.filter(l => l.facturacionBruta > 0).length}
                </h3>
                <p className="text-xs text-gray-500 mt-1">Con viajes facturados</p>
              </div>
            </div>

            {/* Grilla principal */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden mb-8">
              <div className="p-6 border-b flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 print:hidden">
                <h3 className="text-lg font-bold text-gray-900 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-red-500" />
                  <span>Liquidaciones por Chofer ({filteredLiquidaciones.length})</span>
                </h3>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar Chofer por Nombre o N°..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-1.5 w-80 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {filteredLiquidaciones.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-base font-semibold">No se encontraron liquidaciones</p>
                  <p className="text-xs mt-1">Intente cambiar el filtro de agencia o realizar otra búsqueda</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-left">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">N° Chofer</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre Completo</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Agencia</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Viajes</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Facturación Bruta</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">% Comisión</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">A pagar Chofer</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Neto Agencia</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredLiquidaciones.map((l) => (
                        <tr key={l.choferId} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 font-mono">
                            {l.numeroChofer}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                            {l.nombreCompleto}
                            <div className="text-xs text-gray-400 font-normal">{l.telefono}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {l.remiseriaNombre}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center font-semibold">
                            {l.viajesCompletados}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                            ${l.facturacionBruta.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800">
                              {100 - l.comisionAgenciaPct}% / {l.comisionAgenciaPct}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600 text-right">
                            ${l.comisionChofer.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600 text-right">
                            ${l.saldoAgencia.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    
                    {/* Totales sumarios en la tabla */}
                    <tfoot className="bg-gray-50 border-t-2 font-bold text-gray-900">
                      <tr>
                        <td className="px-6 py-4 text-sm" colSpan={3}>Totales Consolidados</td>
                        <td className="px-6 py-4 text-center text-sm">{totalViajesCompletados}</td>
                        <td className="px-6 py-4 text-right text-sm">
                          ${totalFacturacionBruta.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>
                        <td></td>
                        <td className="px-6 py-4 text-right text-sm text-blue-600">
                          ${totalComisionChoferes.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-green-600">
                          ${totalNetoAgencia.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Strategic warning for driver payout */}
            <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4 text-sm text-yellow-800 flex items-start print:hidden">
              <span className="text-xl mr-2 mt-0.5">⚠️</span>
              <div>
                <strong className="block font-bold mb-0.5">Liquidación de Comisiones</strong>
                <span>
                  Los cálculos de liquidación mostrados corresponden a los viajes con estado <strong>COMPLETADO</strong>. El porcentaje de comisión se lee dinámicamente de cada remisería (ej: 30% agencia / 70% chofer), garantizando que las tarifas configuradas por agencia se calculen con total precisión.
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}