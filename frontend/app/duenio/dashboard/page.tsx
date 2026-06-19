'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { remiseriaService } from '@/lib/api';
import { Remiseria } from '@/types';
import { 
  Car, Building, Plus, Eye, Users, Truck, BarChart3, 
  Settings, DollarSign, Calendar, Activity, ArrowRight,
  TrendingUp, MapPin
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

export default function DuenioDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [remiserias, setRemiserias] = useState<Remiseria[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.rol !== 'DUENIO') {
      router.push('/login');
      return;
    }
    loadRemiserias();
  }, [user, router]);

  const loadRemiserias = async () => {
    try {
      setLoading(true);
      const response = await remiseriaService.getAll();
      
      if (response.success && response.data) {
        // Filtrar solo las remiserías del dueño actual
        const userRemiserias = response.data.filter(remiseria => 
          remiseria.duenios?.some(duenio => duenio.duenioId === user?.duenio?.id)
        );
        setRemiserias(userRemiserias);
      } else {
        toast.error('Error al cargar remiserías');
      }
    } catch (error) {
      console.error('Error loading remiserias:', error);
      toast.error('Error al cargar remiserías');
    } finally {
      setLoading(false);
    }
  };

  const activeRemiserias = remiserias.filter(r => r.estado).length;
  const totalRemiserias = remiserias.length;
  
  const totalCoordinadores = remiserias.reduce((total, remiseria) => 
    total + (remiseria.coordinadores?.filter(c => c.activo).length || 0), 0
  );
  
  const totalChoferes = remiserias.reduce((total, remiseria) => 
    total + (remiseria.choferes?.filter(c => c.estado === 'ACTIVO').length || 0), 0
  );
  
  const totalVehiculos = remiserias.reduce((total, remiseria) => 
    total + (remiseria.vehiculos?.filter(v => v.estado === 'ACTIVO').length || 0), 0
  );

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="loading-spinner border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-primary-600 to-indigo-700 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold mb-2">¡Hola de nuevo, {user?.duenio?.nombre?.split(' ')[0]}! 👋</h2>
          <p className="text-primary-100 text-lg max-w-2xl">
            Aquí tienes un resumen de la actividad de tus remiserías. Tienes {activeRemiserias} remiserías activas y operando al día de hoy.
          </p>
        </div>
        {/* Abstract shapes for design */}
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 opacity-10">
          <Building className="w-64 h-64" />
        </div>
        <div className="absolute bottom-0 right-32 translate-y-1/2 opacity-10">
          <Car className="w-48 h-48" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-5 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Building className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Remiserías Activas</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-bold text-slate-900">{activeRemiserias}</h3>
              <span className="text-xs font-medium text-slate-400">/ {totalRemiserias}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-5 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Coordinadores</p>
            <h3 className="text-3xl font-bold text-slate-900">{totalCoordinadores}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-5 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Truck className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Choferes Activos</p>
            <h3 className="text-3xl font-bold text-slate-900">{totalChoferes}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-5 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Car className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Vehículos Operativos</p>
            <h3 className="text-3xl font-bold text-slate-900">{totalVehiculos}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area (Left 2/3) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary-500" />
              Tus Remiserías
            </h3>
            <Link 
              href="/duenio/remiserias"
              className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1 transition-colors"
            >
              Ver todas <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {remiserias.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Aún no tienes remiserías</h3>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">
                No hay remiserías asignadas a tu cuenta. Contacta al administrador para comenzar a operar.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {remiserias.slice(0, 4).map((remiseria) => (
                <div key={remiseria.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-slate-900 text-lg group-hover:text-primary-600 transition-colors">
                        {remiseria.nombreFantasia}
                      </h4>
                      <p className="text-sm text-slate-500 line-clamp-1">{remiseria.razonSocial}</p>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                        remiseria.estado
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}
                    >
                      {remiseria.estado ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>

                  <div className="space-y-2.5 mb-5">
                    <div className="flex items-center text-sm text-slate-600 gap-2.5">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span className="truncate">{remiseria.direccion}</span>
                    </div>
                  </div>

                  {/* Micro-stats */}
                  <div className="grid grid-cols-3 gap-2 py-3 border-t border-slate-100">
                    <div className="text-center">
                      <p className="text-lg font-bold text-slate-700">{remiseria.coordinadores?.length || 0}</p>
                      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Coord.</p>
                    </div>
                    <div className="text-center border-l border-r border-slate-100">
                      <p className="text-lg font-bold text-slate-700">{remiseria.choferes?.length || 0}</p>
                      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Choferes</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-slate-700">{remiseria.vehiculos?.length || 0}</p>
                      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Vehículos</p>
                    </div>
                  </div>

                  {/* Absolute link overlaid */}
                  <Link href={`/duenio/remiserias/${remiseria.id}`} className="absolute inset-0 z-10">
                    <span className="sr-only">Ver {remiseria.nombreFantasia}</span>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar / Quick Actions Area (Right 1/3) */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Informes Rápidos</h3>
            <div className="space-y-3">
              <Link href="/duenio/informes/diario" className="flex items-center p-3 rounded-xl hover:bg-slate-50 transition-colors group border border-transparent hover:border-slate-200">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mr-3 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">Cierre Diario</p>
                  <p className="text-xs text-slate-500">Recaudación de hoy</p>
                </div>
              </Link>

              <Link href="/duenio/informes/semanal" className="flex items-center p-3 rounded-xl hover:bg-slate-50 transition-colors group border border-transparent hover:border-slate-200">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mr-3 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">Resumen Semanal</p>
                  <p className="text-xs text-slate-500">Tendencias y gráficos</p>
                </div>
              </Link>

              <Link href="/duenio/informes/mensual" className="flex items-center p-3 rounded-xl hover:bg-slate-50 transition-colors group border border-transparent hover:border-slate-200">
                <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mr-3 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">Balance Mensual</p>
                  <p className="text-xs text-slate-500">Facturación total</p>
                </div>
              </Link>
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="font-bold text-lg mb-2">Administrar Flota</h3>
              <p className="text-slate-400 text-sm mb-5">
                Gestioná rápidamente tus vehículos, altas, bajas y mantenimientos.
              </p>
              <Link 
                href="/duenio/vehiculos" 
                className="inline-flex items-center justify-center px-4 py-2 bg-white text-slate-900 font-semibold rounded-lg text-sm hover:bg-slate-100 transition-colors w-full"
              >
                Ver Flota
              </Link>
            </div>
            <Car className="absolute -bottom-4 -right-4 w-32 h-32 text-white/5" />
          </div>
        </div>
      </div>
    </div>
  );
}