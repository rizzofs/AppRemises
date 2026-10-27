'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import { remiseriaService } from '@/lib/api';
import { Remiseria, UpdateRemiseriaData } from '@/types';
import { 
  Settings, Building, DollarSign, Phone, MapPin, 
  ShieldCheck, Save, Loader2, Calculator, Info,
  CheckCircle2, Sparkles
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ConfiguracionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [remiseria, setRemiseria] = useState<Remiseria | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateRemiseriaData>();

  // Watch tariff values for live trip cost simulator
  const watchedBajada = watch('bajadaBandera', 3500);
  const watchedKm = watch('valorKm', 1200);
  const watchedComision = watch('comisionPorcentaje', 30);

  useEffect(() => {
    if (!user || user.rol !== 'DUENIO') {
      router.push('/login');
      return;
    }
    loadConfig();
  }, [user, router]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await remiseriaService.getAll();
      if (response.success && response.data && response.data.length > 0) {
        // Encontrar la remisería asignada al dueño actual
        const miRemiseria = response.data.find(r => 
          r.duenios?.some(d => d.duenioId === user?.duenio?.id)
        ) || response.data[0];

        setRemiseria(miRemiseria);
        reset({
          nombreFantasia: miRemiseria.nombreFantasia || 'Remises Bruno',
          razonSocial: miRemiseria.razonSocial || 'Remises Bruno S.R.L.',
          cuit: miRemiseria.cuit || '',
          direccion: miRemiseria.direccion || '',
          telefono: miRemiseria.telefono || '',
          bajadaBandera: miRemiseria.bajadaBandera || 3500,
          valorKm: miRemiseria.valorKm || 1200,
          valorHoraEspera: miRemiseria.valorHoraEspera || 10000,
          comisionPorcentaje: miRemiseria.comisionPorcentaje || 30.0,
          comisionDuenioAuto: miRemiseria.comisionDuenioAuto || 20.0,
        });
      } else {
        toast.error('No se encontró una remisería asociada a tu cuenta');
      }
    } catch (error) {
      console.error('Error loading config:', error);
      toast.error('Error al cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: UpdateRemiseriaData) => {
    if (!remiseria) return;

    setSaving(true);
    try {
      const payload: UpdateRemiseriaData = {
        nombreFantasia: data.nombreFantasia?.trim(),
        razonSocial: data.razonSocial?.trim(),
        cuit: data.cuit?.trim(),
        direccion: data.direccion?.trim(),
        telefono: data.telefono?.trim(),
        bajadaBandera: Number(data.bajadaBandera),
        valorKm: Number(data.valorKm),
        valorHoraEspera: Number(data.valorHoraEspera),
        comisionPorcentaje: Number(data.comisionPorcentaje),
        comisionDuenioAuto: Number(data.comisionDuenioAuto),
      };

      const response = await remiseriaService.update(remiseria.id, payload);
      if (response.success && response.data) {
        setRemiseria(response.data);
        reset(payload);
        toast.success('¡Configuración y precios actualizados exitosamente!', {
          icon: '🚀',
          duration: 4000
        });
      } else {
        toast.error(response.message || 'Error al guardar los cambios');
      }
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast.error(error.response?.data?.error || 'Error al comunicarse con el servidor');
    } finally {
      setSaving(false);
    }
  };

  // Cálculo para el simulador de viaje de 5 km
  const bajadaNum = Number(watchedBajada) || 0;
  const kmNum = Number(watchedKm) || 0;
  const comisionPct = Number(watchedComision) || 0;
  // Ejemplo: 5 km (1 km cubierto con bajada + 4 km adicionales)
  const ejemploViaje5km = bajadaNum + Math.max(0, (5 - 1) * kmNum);
  const gananciaAgencia5km = Math.round((ejemploViaje5km * comisionPct) / 100);
  const gananciaChofer5km = ejemploViaje5km - gananciaAgencia5km;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="loading-spinner border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600 shadow-sm">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">
                {remiseria?.nombreFantasia || 'Remises Bruno'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                1 Remisería por Cuenta
              </span>
            </div>
            <p className="text-sm text-slate-500">
              Personalizá el nombre de la remisería, datos comerciales y el esquema de tarifas y comisiones.
            </p>
          </div>
        </div>
      </div>

      {/* Banner de sistema adaptable / White-label */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-indigo-100/80 p-5 rounded-2xl flex items-start gap-3.5 shadow-sm">
        <Sparkles className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-700 space-y-1">
          <p className="font-bold text-slate-900 text-sm">
            Sistema Modular y Reconfigurable
          </p>
          <p>
            Al modificar el nombre y los precios en este panel, todos los cálculos de tarifas para clientes, 
            pantallas de coordinadores, postulaciones de choferes y balances de liquidación se adaptarán 
            inmediatamente a los nuevos valores configurados.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulario Principal (2 columnas) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* SECCIÓN 1: Identidad y Contacto */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building className="w-5 h-5 text-indigo-600" />
                Identidad de la Remisería
              </h3>
              <p className="text-xs text-slate-500">
                El nombre comercial que verán los clientes y choferes en la aplicación.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre de Fantasía (Nombre de la Remisería) *
                </label>
                <input
                  type="text"
                  {...register('nombreFantasia', { required: 'El nombre de fantasía es requerido' })}
                  placeholder="Ej: Remises Bruno"
                  className="input text-sm"
                />
                {errors.nombreFantasia && (
                  <p className="mt-1 text-xs text-red-600">{errors.nombreFantasia.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Razón Social *
                </label>
                <input
                  type="text"
                  {...register('razonSocial', { required: 'La razón social es requerida' })}
                  placeholder="Ej: Remises Bruno S.R.L."
                  className="input text-sm"
                />
                {errors.razonSocial && (
                  <p className="mt-1 text-xs text-red-600">{errors.razonSocial.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  CUIT / CUIL de la Remisería *
                </label>
                <input
                  type="text"
                  {...register('cuit', { required: 'El CUIT es requerido' })}
                  placeholder="Ej: 20-11111111-9"
                  className="input text-sm"
                />
                {errors.cuit && (
                  <p className="mt-1 text-xs text-red-600">{errors.cuit.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Teléfono / WhatsApp de la Base *
                </label>
                <input
                  type="text"
                  {...register('telefono', { required: 'El teléfono es requerido' })}
                  placeholder="Ej: 011-1234-5678"
                  className="input text-sm"
                />
                {errors.telefono && (
                  <p className="mt-1 text-xs text-red-600">{errors.telefono.message}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dirección de la Base Central *
                </label>
                <input
                  type="text"
                  {...register('direccion', { required: 'La dirección es requerida' })}
                  placeholder="Ej: Av. San Martín 123, Buenos Aires"
                  className="input text-sm"
                />
                {errors.direccion && (
                  <p className="mt-1 text-xs text-red-600">{errors.direccion.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: Tarifario y Precios */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                Tarifas de Viaje y Precios Oficiales
              </h3>
              <p className="text-xs text-slate-500">
                Valores con los que se cotizan automáticamente los viajes para los pasajeros.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bajada de Bandera ($) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-bold">$</span>
                  <input
                    type="number"
                    step="50"
                    {...register('bajadaBandera', { 
                      required: 'Requerido',
                      min: { value: 0, message: 'Debe ser mayor o igual a 0' } 
                    })}
                    className="input pl-8 text-sm font-semibold"
                    placeholder="3500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Precio inicial del viaje</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Valor por Kilómetro ($/km) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-bold">$</span>
                  <input
                    type="number"
                    step="50"
                    {...register('valorKm', { 
                      required: 'Requerido',
                      min: { value: 0, message: 'Debe ser mayor o igual a 0' } 
                    })}
                    className="input pl-8 text-sm font-semibold"
                    placeholder="1200"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Costo por km recorrido</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hora de Espera ($/h) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-bold">$</span>
                  <input
                    type="number"
                    step="100"
                    {...register('valorHoraEspera', { 
                      required: 'Requerido',
                      min: { value: 0, message: 'Debe ser mayor o igual a 0' } 
                    })}
                    className="input pl-8 text-sm font-semibold"
                    placeholder="10000"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Por demora del pasajero</p>
              </div>
            </div>

            {/* Comisiones */}
            <div className="border-t border-slate-100 pt-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Esquema de Comisiones y Liquidación
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Comisión de la Agencia (%) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      {...register('comisionPorcentaje', { 
                        required: 'Requerido',
                        min: { value: 0, message: 'Mínimo 0%' },
                        max: { value: 100, message: 'Máximo 100%' }
                      })}
                      className="input pr-8 text-sm font-semibold"
                      placeholder="30"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-400 text-sm font-bold">%</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Porcentaje retenido por viaje</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Comisión por Dueño de Auto (%) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      {...register('comisionDuenioAuto', { 
                        required: 'Requerido',
                        min: { value: 0, message: 'Mínimo 0%' },
                        max: { value: 100, message: 'Máximo 100%' }
                      })}
                      className="input pr-8 text-sm font-semibold"
                      placeholder="20"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-400 text-sm font-bold">%</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Si el chofer no es propietario</p>
                </div>
              </div>
            </div>
          </div>

          {/* Botón Guardar */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary px-8 py-3 text-base shadow-lg shadow-primary-500/25 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Guardando cambios...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Guardar Configuración y Tarifas
                </>
              )}
            </button>
          </div>
        </div>

        {/* Panel Lateral: Simulador en tiempo real */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="w-5 h-5 text-primary-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                Simulador de Tarifas en Vivo
              </h3>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Así se calculará un viaje promedio de <strong>5 kilómetros</strong> según tus valores actuales:
            </p>

            <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Bajada de bandera (primer km):</span>
                <span className="font-bold text-slate-900">${bajadaNum.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>4 km adicionales (× ${kmNum.toLocaleString('es-AR')}):</span>
                <span className="font-bold text-slate-900">${(4 * kmNum).toLocaleString('es-AR')}</span>
              </div>
              <div className="border-t border-slate-200 pt-2.5 flex justify-between items-baseline">
                <span className="font-bold text-slate-900 text-sm">Total Pasajero:</span>
                <span className="font-extrabold text-primary-700 text-xl">
                  ${ejemploViaje5km.toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Comisión Remisería ({comisionPct}%):</span>
                <span className="font-bold text-emerald-600">+${gananciaAgencia5km.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Ingreso Chofer:</span>
                <span className="font-bold text-slate-700">${gananciaChofer5km.toLocaleString('es-AR')}</span>
              </div>
            </div>
          </div>

          {/* Tarjeta Informativa de Cuenta Única */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              Política de Remisería Única
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Cada cuenta de dueño administra exclusivamente una única remisería. Todos los choferes, 
              vehículos, viajes y clientes registrados en esta plataforma corresponden a 
              <strong> {remiseria?.nombreFantasia || 'Remises Bruno'}</strong>.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
