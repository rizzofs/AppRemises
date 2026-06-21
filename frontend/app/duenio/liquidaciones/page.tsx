'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { coordinadorDashboardService } from '@/lib/api';
import { DollarSign, Calendar, Fuel, FileText, User, Clock, Search, Shield, RefreshCw, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function HistorialLiquidacionesPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [liquidaciones, setLiquidaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<'all' | 'propietario' | 'comisionista'>('all');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadHistorial();
  }, [user]);

  const loadHistorial = async () => {
    try {
      setLoading(true);
      const response = await coordinadorDashboardService.getHistorialDuenio();
      if (response.success && response.data) {
        setLiquidaciones(response.data);
      } else {
        toast.error('Error al cargar el historial de liquidaciones');
      }
    } catch (error) {
      console.error('Error loading settlements history:', error);
      toast.error('Error al cargar el historial');
    } finally {
      setLoading(false);
    }
  };

  // Filtrado de liquidaciones
  const filteredLiquidaciones = liquidaciones.filter((liq) => {
    const choferNombre = `${liq.chofer?.nombre || ''} ${liq.chofer?.apellido || ''}`.toLowerCase();
    const coordinadorNombre = `${liq.coordinador?.coordinador?.nombre || ''} ${liq.coordinador?.duenio?.nombre || ''} ${liq.coordinador?.email || ''}`.toLowerCase();
    
    const matchesSearch = choferNombre.includes(searchTerm.toLowerCase()) || 
                          coordinadorNombre.includes(searchTerm.toLowerCase());

    const matchesTipo = filterTipo === 'all' || 
                        (filterTipo === 'propietario' && liq.chofer?.esPropietario) ||
                        (filterTipo === 'comisionista' && !liq.chofer?.esPropietario);

    return matchesSearch && matchesTipo;
  });

  // Totales generales de las liquidaciones filtradas
  const totalRecaudado = filteredLiquidaciones.reduce((sum, l) => sum + l.totalRecaudado, 0);
  const totalAgencia = filteredLiquidaciones.reduce((sum, l) => sum + l.comisionAgencia, 0);
  const totalCombustible = filteredLiquidaciones.reduce((sum, l) => sum + l.combustible, 0);
  const totalGananciaPropietario = filteredLiquidaciones.reduce((sum, l) => sum + l.gananciaPropietario, 0);

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Historial de Liquidaciones y Cierres</h2>
          <p className="text-sm text-slate-500">Historial completo de rendiciones de choferes procesadas por coordinadores.</p>
        </div>
        <button
          onClick={loadHistorial}
          disabled={loading}
          className="btn btn-outline border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar Historial
        </button>
      </div>

      {/* Tarjetas Informativas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Recaudado</span>
            <span className="text-2xl font-black text-slate-900 block mt-1">
              ${totalRecaudado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-400 mt-1 block">Bruto en viajes cerrados</span>
          </div>
          <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider block">Comisión Agencia</span>
            <span className="text-2xl font-black text-emerald-800 block mt-1">
              ${totalAgencia.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-emerald-600 mt-1 block font-medium">Ingresos de la agencia</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Shield className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-orange-700 uppercase tracking-wider block">Gasto Combustible</span>
            <span className="text-2xl font-black text-orange-800 block mt-1">
              ${totalCombustible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-orange-600 mt-1 block">Tickets descontados</span>
          </div>
          <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
            <Fuel className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider block">Ganancia Propietarios</span>
            <span className="text-2xl font-black text-purple-800 block mt-1">
              ${totalGananciaPropietario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-purple-600 mt-1 block">Remanente de autos</span>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Contenedor de Tabla y Filtros */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por chofer o coordinador..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value as any)}
            className="w-full sm:max-w-[200px] px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-white cursor-pointer text-slate-700"
          >
            <option value="all">Todas las condiciones</option>
            <option value="propietario">Chofer Propietario</option>
            <option value="comisionista">Chofer Comisionista</option>
          </select>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="text-center py-16">
            <div className="loading-spinner border-primary-500 mx-auto"></div>
            <p className="mt-4 text-slate-500">Cargando liquidaciones...</p>
          </div>
        ) : filteredLiquidaciones.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron liquidaciones</h3>
            <p className="text-gray-500 max-w-sm mx-auto text-sm">
              {searchTerm || filterTipo !== 'all'
                ? 'Prueba modificando tus filtros de búsqueda.'
                : 'Aún no se han registrado cierres de caja en tus remiserías.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha / Hora</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Chofer</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cobrado Por</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Recaudado</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Comisión Agencia</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Combustible</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ganancia Prop.</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Notas</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredLiquidaciones.map((liq) => {
                  const creadorNombre = liq.coordinador?.coordinador?.nombre || liq.coordinador?.duenio?.nombre || liq.coordinador?.email || 'N/A';
                  return (
                    <tr key={liq.id} className="hover:bg-slate-50/50 transition-colors text-sm text-slate-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <div>
                            <div className="font-semibold text-slate-900">
                              {new Date(liq.fecha).toLocaleDateString('es-AR')}
                            </div>
                            <div className="text-xs text-slate-400">
                              {new Date(liq.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900">
                          {liq.chofer?.nombre} {liq.chofer?.apellido}
                        </div>
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold mt-1 ${
                          liq.chofer?.esPropietario 
                            ? 'bg-green-50 text-green-700 border border-green-200' 
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {liq.chofer?.esPropietario ? 'Propietario' : 'Comisionista'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {creadorNombre}
                        </div>
                        <span className="text-xs text-slate-400 font-normal">{liq.coordinador?.email}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-slate-900">
                        ${liq.totalRecaudado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-emerald-700 bg-emerald-50/10">
                        ${liq.comisionAgencia.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-orange-700">
                        ${liq.combustible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-purple-700">
                        ${liq.gananciaPropietario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 max-w-[200px] truncate">
                        {liq.observaciones || <span className="text-slate-300 italic">Sin observaciones</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
