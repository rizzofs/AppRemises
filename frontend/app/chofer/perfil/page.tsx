"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { choferService } from '@/lib/api';
import Link from 'next/link';
import {
  User,
  Car,
  Gauge,
  Fuel,
  DollarSign,
  TrendingUp,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

export default function ChoferPerfilPage() {
  const { user } = useAuth();
  const [resumen, setResumen] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        setLoading(true);
        const res = await choferService.getResumenFinanciero({ choferId: user?.chofer?.id });
        if (res.success && res.data) {
          setResumen(res.data);
        }
      } catch (err) {
        console.error('Error cargando resumen en perfil:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto pb-24">
      <h2 className="text-xl font-bold text-gray-900">Mi Perfil</h2>

      {/* Tarjeta de Perfil */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center space-x-4">
        <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-600 text-2xl font-bold shadow-xs">
          {user?.chofer?.nombre?.charAt(0) || 'C'}
        </div>
        <div>
          <h3 className="font-bold text-gray-900 text-base">
            {user?.chofer?.nombre || 'Chofer'} {user?.chofer?.apellido || ''}
          </h3>
          <p className="text-xs text-gray-500">{user?.email || 'chofer@ejemplo.com'}</p>
          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full inline-flex">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Licencia: {user?.chofer?.categoriaLicencia || 'Profesional'}</span>
          </div>
        </div>
      </div>

      {/* Información del Vehículo */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5">
          <Car className="w-4 h-4 text-primary-500" />
          <h4 className="font-semibold text-xs text-gray-700 uppercase tracking-wider">
            Vehículo Asignado
          </h4>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-gray-500">Patente</div>
          <div className="text-right font-bold text-gray-800">
            {user?.chofer?.vehiculo?.patente || 'No asignada'}
          </div>
          <div className="text-gray-500">Marca / Modelo</div>
          <div className="text-right font-medium text-gray-800">
            {user?.chofer?.vehiculo
              ? `${user.chofer.vehiculo.marca} ${user.chofer.vehiculo.modelo}`
              : 'No asignado'}
          </div>
          <div className="text-gray-500">Comisión Chofer</div>
          <div className="text-right font-medium text-gray-800">
            {100 - (user?.chofer?.comisionPorcentaje || 30)}%
          </div>
        </div>
      </div>

      {/* Rendimiento y Kilometraje del Mes */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-emerald-500" />
            <h4 className="font-semibold text-xs text-gray-700 uppercase tracking-wider">
              Kilometraje del Mes
            </h4>
          </div>
          <span className="text-[11px] text-gray-400">
            {resumen?.ingresos?.totalViajes || 0} viajes completados
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center pt-1">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2.5">
            <p className="text-[10px] text-emerald-700 uppercase font-semibold">C/ Pasajeros</p>
            <p className="text-base font-black text-emerald-900">
              {resumen?.kilometraje?.kmConPasajero || 0}
            </p>
            <span className="text-[10px] text-emerald-600">km</span>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-2.5">
            <p className="text-[10px] text-amber-700 uppercase font-semibold">S/ Pasajeros</p>
            <p className="text-base font-black text-amber-900">
              {resumen?.kilometraje?.kmSinPasajero || 0}
            </p>
            <span className="text-[10px] text-amber-600">km</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
            <p className="text-[10px] text-slate-600 uppercase font-semibold">Total</p>
            <p className="text-base font-black text-slate-900">
              {resumen?.kilometraje?.kmTotalConectado || 0}
            </p>
            <span className="text-[10px] text-slate-500">km</span>
          </div>
        </div>
      </div>

      {/* Acceso Rápido a Gastos */}
      <Link
        href="/chofer/gastos"
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center justify-between hover:border-primary-300 transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
            <Fuel className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-gray-900 group-hover:text-primary-600 transition-colors">
              Gastos de Combustible y Mecánica
            </h4>
            <p className="text-xs text-gray-400">
              Total: ${Number(resumen?.gastos?.totalGastos || 0).toLocaleString('es-AR')} • Nafta/Gasoil: ${Number(resumen?.gastos?.totalNaftaGasoil || 0).toLocaleString('es-AR')} • GNC: ${Number(resumen?.gastos?.totalGNC || 0).toLocaleString('es-AR')}
            </p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
      </Link>
    </div>
  );
}
