'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTracking } from '@/hooks/useAppTracking';
import { duenioReportesService } from '@/lib/api';
import { 
  DollarSign, 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Award, 
  Building,
  RefreshCw,
  Printer,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface SemanaDesglose {
  semana: string;
  total: number;
}

export default function InformeMensualPage() {
  const { user } = useAuth();
  const router = useRouter();
  useAppTracking('DUENIO_INFORME_MENSUAL');

  const [remiserias, setRemiserias] = useState<{ id: string; nombre: string }[]>([]);
  const [selectedRemiseria, setSelectedRemiseria] = useState<string>('todas');
  
  const [totalMes, setTotalMes] = useState<number>(0);
  const [totalMesAnterior, setTotalMesAnterior] = useState<number>(0);
  const [variacion, setVariacion] = useState<number>(0);
  const [viajesCompletados, setViajesCompletados] = useState<number>(0);
  const [ticketPromedio, setTicketPromedio] = useState<number>(0);
  const [desgloseSemanas, setDesgloseSemanas] = useState<SemanaDesglose[]>([]);
  const [choferDestacado, setChoferDestacado] = useState<{ nombre: string; total: number } | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);

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
        console.error('Error inicializando informe mensual:', error);
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
      const response = await duenioReportesService.getInformeMensual(remId === 'todas' ? undefined : remId);
      if (response.success && response.data) {
        setTotalMes(response.data.totalMes);
        setTotalMesAnterior(response.data.totalMesAnterior);
        setVariacion(response.data.variacion);
        setViajesCompletados(response.data.viajesCompletados);
        setTicketPromedio(response.data.ticketPromedio);
        setDesgloseSemanas(response.data.desgloseSemanas);
        setChoferDestacado(response.data.choferDestacado);
      } else {
        toast.error(response.message || 'Error al obtener informe mensual');
      }
    } catch (error) {
      console.error('Error al obtener informe mensual:', error);
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
    toast.success('Auditoría mensual recalculada');
  };

  const handlePrint = () => {
    window.print();
  };

  // Encontrar el valor máximo de semana para calcular porcentajes de progreso
  const maxFacturadoSemana = Math.max(...desgloseSemanas.map(s => s.total), 1);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm print:hidden">
        <div className="flex items-center">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mr-4 text-amber-600">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Informe Mensual</h2>
            <p className="text-sm text-slate-500">Rendimiento financiero del mes en curso.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={loadingReport}
            className="btn bg-slate-100 text-slate-700 hover:bg-slate-200 border-transparent disabled:opacity-50"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loadingReport ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button
            onClick={handlePrint}
            className="btn btn-primary shadow-md shadow-primary-500/20"
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:p-0">
        
        {/* Titulo en Impresión */}
        <div className="hidden print:block mb-8 border-b pb-4">
          <h1 className="text-3xl font-bold text-gray-900">App Remises</h1>
          <h2 className="text-xl text-gray-600">Informe Mensual de Recaudación y Desglose por Periodos</h2>
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
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-800 border border-yellow-100">
              Mes Operativo: {new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>

        {loadingReport && !totalMes ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="loading-spinner mb-4"></div>
            <p className="text-sm text-gray-500">Calculando balance mensual...</p>
          </div>
        ) : (
          <>
            {/* Métricas clave */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 print:grid-cols-4 print:gap-4">
              {/* Facturado Mes */}
              <div className="bg-white rounded-xl border shadow-sm p-6 relative overflow-hidden">
                <div className="absolute right-4 top-4 p-2 bg-green-50 text-green-600 rounded-lg">
                  <DollarSign className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Facturado</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-2">
                  ${totalMes.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </h3>
                <div className="text-xs mt-1 font-semibold flex items-center">
                  {variacion >= 0 ? (
                    <span className="text-green-600 flex items-center">
                      <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                      +{variacion.toFixed(1)}% vs. mes anterior
                    </span>
                  ) : (
                    <span className="text-red-600 flex items-center">
                      <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                      {variacion.toFixed(1)}% vs. mes anterior
                    </span>
                  )}
                </div>
              </div>

              {/* Viajes Completados */}
              <div className="bg-white rounded-xl border shadow-sm p-6 relative overflow-hidden">
                <div className="absolute right-4 top-4 p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Activity className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Viajes Completados</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-2">
                  {viajesCompletados}
                </h3>
                <p className="text-xs text-gray-500 mt-1">Servicios finalizados con éxito</p>
              </div>

              {/* Ticket Promedio */}
              <div className="bg-white rounded-xl border shadow-sm p-6 relative overflow-hidden">
                <div className="absolute right-4 top-4 p-2 bg-purple-50 text-purple-600 rounded-lg">
                  <DollarSign className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ticket Promedio</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-2">
                  ${ticketPromedio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </h3>
                <p className="text-xs text-gray-500 mt-1">Ingreso medio por viaje</p>
              </div>

              {/* Chofer MVP */}
              <div className="bg-white rounded-xl border shadow-sm p-6 relative overflow-hidden">
                <div className="absolute right-4 top-4 p-2 bg-yellow-50 text-yellow-600 rounded-lg">
                  <Award className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Chofer MVP del Mes</p>
                <h3 className="text-lg font-bold text-gray-900 mt-2 truncate max-w-[170px]" title={choferDestacado?.nombre}>
                  {choferDestacado && choferDestacado.total > 0 ? choferDestacado.nombre : 'Sin Viajes'}
                </h3>
                <p className="text-xs text-green-600 mt-1 font-semibold">
                  {choferDestacado && choferDestacado.total > 0 ? `Recaudó $${choferDestacado.total.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : 'Sin datos'}
                </p>
              </div>
            </div>

            {/* Desglose de ingresos por semanas del mes (Progress Bars) */}
            <div className="bg-white rounded-xl border shadow-sm p-6 mb-8 print:border-none print:shadow-none">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                <Activity className="w-5 h-5 mr-2 text-yellow-600" />
                Distribución y Balance por Semanas
              </h3>

              <div className="space-y-6">
                {desgloseSemanas.map((semana, idx) => {
                  const widthPercent = (semana.total / maxFacturadoSemana) * 100;
                  return (
                    <div key={idx} className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-semibold text-gray-700">{semana.semana}</span>
                        <strong className="text-gray-900">
                          ${semana.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                      
                      <div className="w-full bg-gray-100 h-3.5 rounded-full overflow-hidden border">
                        <div 
                          className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full transition-all duration-1000"
                          style={{ width: `${Math.max(2, widthPercent)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {desgloseSemanas.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                  <AlertCircle className="w-12 h-12 text-gray-300 mb-2" />
                  <span>Sin datos disponibles en este mes</span>
                </div>
              )}
            </div>

            {/* Resumen mensual comparativo e Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Balance General</h3>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-gray-600 font-medium">Facturado este Mes:</span>
                    <strong className="text-gray-900">${totalMes.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-gray-600 font-medium">Facturado Mes Anterior:</span>
                    <span className="text-gray-700">${totalMesAnterior.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-gray-600 font-medium">Variación en Ingresos:</span>
                    {variacion >= 0 ? (
                      <span className="font-semibold text-green-600">+{variacion.toFixed(1)}% de incremento mensual</span>
                    ) : (
                      <span className="font-semibold text-red-600">{variacion.toFixed(1)}% de descenso mensual</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">Viajes Promedio Semanales:</span>
                    <strong className="text-blue-600">{Math.round(viajesCompletados / 4)} viajes / semana</strong>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border shadow-sm p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Recomendaciones del Mes</h3>
                  <div className="text-sm text-gray-600 space-y-3">
                    <p className="flex items-start">
                      <span className="inline-block p-1 bg-yellow-50 text-yellow-600 rounded mr-2 mt-0.5">🌟</span>
                      <span>
                        El chofer destacado del mes es <strong>{choferDestacado?.nombre}</strong>, aportando una recaudación individual de <strong>${choferDestacado?.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>. Se aconseja reconocer el esfuerzo para promover la retención y rendimiento.
                      </span>
                    </p>
                    <p className="flex items-start">
                      <span className="inline-block p-1 bg-green-50 text-green-600 rounded mr-2 mt-0.5">📈</span>
                      <span>
                        El ticket promedio de tu flota se sitúa en <strong>${ticketPromedio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>. Monitorear esta cifra ayuda a evaluar tarifas en periodos inflacionarios o de alta demanda.
                      </span>
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t mt-4 text-xs text-gray-500">
                  * Este reporte compila datos consolidados que permiten evaluar el crecimiento del negocio SaaS y tomar decisiones financieras con precisión.
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}