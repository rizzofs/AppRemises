'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { remiseriaService } from '@/lib/api';
import { Remiseria } from '@/types';
import { 
  Building, MapPin, Phone, Car, Users, Truck, 
  Settings, DollarSign, Shield, ArrowRight, CheckCircle2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

export default function MiRemiseriaPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [remiseria, setRemiseria] = useState<Remiseria | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.rol !== 'DUENIO') {
      router.push('/login');
      return;
    }
    loadRemiseria();
  }, [user, router]);

  const loadRemiseria = async () => {
    try {
      setLoading(true);
      const response = await remiseriaService.getAll();
      
      if (response.success && response.data && response.data.length > 0) {
        // Encontrar la remisería asignada a la cuenta de este dueño
        const miRemiseria = response.data.find(r => 
          r.duenios?.some(d => d.duenioId === user?.duenio?.id)
        ) || response.data[0];

        setRemiseria(miRemiseria);
      } else {
        toast.error('No se encontró una remisería asociada a tu cuenta');
      }
    } catch (error) {
      console.error('Error loading remiseria:', error);
      toast.error('Error al cargar la información de la remisería');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="loading-spinner border-primary-500"></div>
      </div>
    );
  }

  if (!remiseria) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-16 text-center max-w-xl mx-auto my-12">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Building className="w-10 h-10 text-slate-400" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">No tienes una remisería asignada</h3>
        <p className="text-slate-500 mb-6 text-sm">
          Cada cuenta de dueño puede tener únicamente una remisería. Contacta con soporte para habilitar tu agencia.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900">{remiseria.nombreFantasia}</h2>
            <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${
              remiseria.estado
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              {remiseria.estado ? 'Activa y Operativa' : 'Inactiva'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {remiseria.razonSocial} • Administrada por {user?.duenio?.nombre}
          </p>
        </div>

        <Link
          href="/duenio/configuracion"
          className="btn btn-primary flex items-center gap-2 shadow-md shadow-primary-500/20"
        >
          <Settings className="w-4 h-4" />
          Editar Datos y Precios
        </Link>
      </div>

      {/* Grid de Datos Generales y Tarifario */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Información Comercial */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building className="w-5 h-5 text-indigo-600" />
            Datos de la Base
          </h3>

          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Shield className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-400">CUIT / CUIL</p>
                <p className="font-semibold text-slate-800">{remiseria.cuit}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-400">Dirección</p>
                <p className="font-semibold text-slate-800">{remiseria.direccion}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-400">Teléfono de Contacto</p>
                <p className="font-semibold text-slate-800">{remiseria.telefono}</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-xl font-bold text-indigo-600">{remiseria.coordinadores?.length || 0}</p>
              <p className="text-xs text-slate-500">Coordinadores</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-xl font-bold text-emerald-600">{remiseria.choferes?.length || 0}</p>
              <p className="text-xs text-slate-500">Choferes</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-xl font-bold text-amber-600">{remiseria.vehiculos?.length || 0}</p>
              <p className="text-xs text-slate-500">Vehículos</p>
            </div>
          </div>
        </div>

        {/* Tarifario Vigente */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Tarifas Vigentes
            </h3>
            <Link href="/duenio/configuracion" className="text-xs text-primary-600 font-semibold hover:underline">
              Ajustar precios
            </Link>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <p className="text-xs text-slate-500">Bajada de Bandera</p>
                <p className="text-xs text-slate-400">Tarifa base inicial</p>
              </div>
              <p className="text-lg font-bold text-slate-900">
                ${(remiseria.bajadaBandera || 3500).toLocaleString('es-AR')}
              </p>
            </div>

            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <p className="text-xs text-slate-500">Valor por Kilómetro</p>
                <p className="text-xs text-slate-400">Por cada km recorrido</p>
              </div>
              <p className="text-lg font-bold text-slate-900">
                ${(remiseria.valorKm || 1200).toLocaleString('es-AR')} / km
              </p>
            </div>

            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <p className="text-xs text-slate-500">Hora de Espera</p>
                <p className="text-xs text-slate-400">Por tiempo de demora</p>
              </div>
              <p className="text-lg font-bold text-slate-900">
                ${(remiseria.valorHoraEspera || 10000).toLocaleString('es-AR')} / h
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 text-center">
                <p className="text-xs text-slate-600">Comisión Agencia</p>
                <p className="text-base font-extrabold text-emerald-700">
                  {remiseria.comisionPorcentaje || 30}%
                </p>
              </div>
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-center">
                <p className="text-xs text-slate-600">Comisión Dueño Auto</p>
                <p className="text-base font-extrabold text-blue-700">
                  {remiseria.comisionDuenioAuto || 20}%
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Regla de negocio y reventa */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-start gap-4">
        <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600 space-y-1">
          <p className="text-sm font-bold text-slate-900">Un dueño, una remisería</p>
          <p>
            Esta cuenta tiene asignada exclusivamente a <strong>{remiseria.nombreFantasia}</strong>. 
            Todos los clientes registrados, los choferes habilitados y los viajes coordinados operan 
            bajo esta misma identidad comercial. Si en el futuro se desea reasignar el sistema a otra agencia, 
            bastará con modificar el nombre y los precios desde la sección de Configuración.
          </p>
        </div>
      </div>
    </div>
  );
}
