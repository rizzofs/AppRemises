'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTracking } from '@/hooks/useAppTracking';
import { 
  ArrowLeft, 
  TrendingUp, 
  BarChart3, 
  Calendar, 
  Users, 
  Car, 
  DollarSign,
  Clock,
  Download,
  Filter,
  Eye
} from 'lucide-react';
import Link from 'next/link';

interface ReporteData {
  periodo: string;
  totalViajes: number;
  viajesCompletados: number;
  viajesCancelados: number;
  totalRecaudado: number;
  promedioCalificacion: number;
  choferesActivos: number;
  tiempoPromedioViaje: number;
  topChoferes: Array<{
    nombre: string;
    viajes: number;
    calificacion: number;
    recaudacion: number;
  }>;
  viajesPorHora: Array<{
    hora: string;
    cantidad: number;
  }>;
}

export default function Reportes() {
  const { user } = useAuth();
  useAppTracking('COORDINADOR_REPORTES');
  
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('hoy');
  const [reporteData, setReporteData] = useState<ReporteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Datos de ejemplo
  const datosEjemplo: ReporteData = {
    periodo: 'Hoy',
    totalViajes: 45,
    viajesCompletados: 42,
    viajesCancelados: 3,
    totalRecaudado: 125000,
    promedioCalificacion: 4.7,
    choferesActivos: 12,
    tiempoPromedioViaje: 25,
    topChoferes: [
      { nombre: 'Juan Pérez', viajes: 8, calificacion: 4.9, recaudacion: 22000 },
      { nombre: 'María González', viajes: 7, calificacion: 4.8, recaudacion: 19500 },
      { nombre: 'Carlos López', viajes: 6, calificacion: 4.7, recaudacion: 16800 }
    ],
    viajesPorHora: [
      { hora: '08:00', cantidad: 3 },
      { hora: '09:00', cantidad: 5 },
      { hora: '10:00', cantidad: 7 },
      { hora: '11:00', cantidad: 4 },
      { hora: '12:00', cantidad: 8 },
      { hora: '13:00', cantidad: 6 },
      { hora: '14:00', cantidad: 4 },
      { hora: '15:00', cantidad: 5 },
      { hora: '16:00', cantidad: 3 }
    ]
  };

  useEffect(() => {
    setTimeout(() => {
      setReporteData(datosEjemplo);
      setIsLoading(false);
    }, 1000);
  }, []);

  const periodos = [
    { value: 'hoy', label: 'Hoy' },
    { value: 'ayer', label: 'Ayer' },
    { value: 'semana', label: 'Esta Semana' },
    { value: 'mes', label: 'Este Mes' },
    { value: 'personalizado', label: 'Personalizado' }
  ];

  const getCalificacionEstrellas = (calificacion: number) => {
    return '★'.repeat(Math.floor(calificacion)) + '☆'.repeat(5 - Math.floor(calificacion));
  };

  const exportarReporte = () => {
    // Aquí iría la lógica para exportar el reporte
    console.log('Exportando reporte...');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando reportes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center">
              <Link 
                href="/coordinador/dashboard"
                className="mr-4 p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Reportes y Estadísticas</h1>
                <p className="text-sm text-gray-600">Análisis de rendimiento y métricas</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <select
                value={periodoSeleccionado}
                onChange={(e) => setPeriodoSeleccionado(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {periodos.map((periodo) => (
                  <option key={periodo.value} value={periodo.value}>
                    {periodo.label}
                  </option>
                ))}
              </select>
              
              <button
                onClick={exportarReporte}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download className="h-4 w-4" />
                <span>Exportar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {reporteData && (
          <>
            {/* Métricas principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Car className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Viajes</p>
                    <p className="text-2xl font-bold text-gray-900">{reporteData.totalViajes}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Completados</p>
                    <p className="text-2xl font-bold text-gray-900">{reporteData.viajesCompletados}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <DollarSign className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Recaudación</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ${reporteData.totalRecaudado.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Users className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Choferes Activos</p>
                    <p className="text-2xl font-bold text-gray-900">{reporteData.choferesActivos}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Top Choferes */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    Top Choferes
                  </h3>
                </div>
                
                <div className="p-6">
                  <div className="space-y-4">
                    {reporteData.topChoferes.map((chofer, index) => (
                      <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </div>
                          
                          <div>
                            <h4 className="font-semibold text-gray-900">{chofer.nombre}</h4>
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <span>{chofer.viajes} viajes</span>
                              <span className="text-yellow-500">
                                {getCalificacionEstrellas(chofer.calificacion)}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">
                            ${chofer.recaudacion.toLocaleString()}
                          </p>
                          <p className="text-sm text-gray-600">Recaudación</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Estadísticas adicionales */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <BarChart3 className="h-5 w-5 mr-2" />
                    Estadísticas Adicionales
                  </h3>
                </div>
                
                <div className="p-6 space-y-6">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Promedio Calificación</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-yellow-500">
                        {getCalificacionEstrellas(reporteData.promedioCalificacion)}
                      </span>
                      <span className="font-semibold">{reporteData.promedioCalificacion.toFixed(1)}</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Tiempo Promedio Viaje</span>
                    <span className="font-semibold">{reporteData.tiempoPromedioViaje} min</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Viajes Cancelados</span>
                    <span className="font-semibold text-red-600">{reporteData.viajesCancelados}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Tasa de Completación</span>
                    <span className="font-semibold text-green-600">
                      {((reporteData.viajesCompletados / reporteData.totalViajes) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Gráfico de viajes por hora */}
            <div className="mt-8 bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Viajes por Hora
                </h3>
              </div>
              
              <div className="p-6">
                <div className="flex items-end space-x-2 h-48">
                  {reporteData.viajesPorHora.map((item, index) => {
                    const maxCantidad = Math.max(...reporteData.viajesPorHora.map(v => v.cantidad));
                    const altura = (item.cantidad / maxCantidad) * 100;
                    
                    return (
                      <div key={index} className="flex-1 flex flex-col items-center">
                        <div 
                          className="w-full bg-blue-500 rounded-t"
                          style={{ height: `${altura}%` }}
                        ></div>
                        <span className="text-xs text-gray-600 mt-2">{item.hora}</span>
                        <span className="text-xs font-medium text-gray-900">{item.cantidad}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 