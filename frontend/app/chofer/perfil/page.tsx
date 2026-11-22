"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { choferService } from '@/lib/api';
import ThemeToggle from '@/components/ThemeToggle';
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
  Moon,
  Camera,
  RefreshCw,
  X,
  Check,
  Upload,
  AlertCircle,
  ShieldAlert,
  Edit3,
  Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Vehiculo } from '@/types';
import { evaluarDocumentacionClient, getDocumentoBadgeClasses } from '@/lib/documentacionUtils';

export default function ChoferPerfilPage() {
  const { user, updateUser } = useAuth();
  const [resumen, setResumen] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Modal para Cambiar Vehículo
  const [modalVehiculo, setModalVehiculo] = useState(false);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [loadingVehiculos, setLoadingVehiculos] = useState(false);
  const [selectedVehiculoId, setSelectedVehiculoId] = useState<string>('');
  const [guardandoVehiculo, setGuardandoVehiculo] = useState(false);

  // Modal para Foto de Perfil
  const [modalFoto, setModalFoto] = useState(false);
  const [fotoPreview, setFotoPreview] = useState<string>('');
  const [fotoUrlInput, setFotoUrlInput] = useState<string>('');
  const [guardandoFoto, setGuardandoFoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal para Cargar / Actualizar Vencimientos de Documentación
  const [modalDocumentacion, setModalDocumentacion] = useState(false);
  const [docForm, setDocForm] = useState({
    vtoLicencia: '',
    vtoSeguro: '',
    vtoVtv: '',
    vtoMatafuego: '',
  });
  const [guardandoDoc, setGuardandoDoc] = useState(false);

  const toInputDate = (dateVal?: string | Date | null) => {
    if (!dateVal) return '';
    if (typeof dateVal === 'string') {
      const m = dateVal.match(/^(\d{4}-\d{2}-\d{2})/);
      if (m) return m[1];
    }
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  };

  const abrirModalDocumentacion = () => {
    setDocForm({
      vtoLicencia: toInputDate(user?.chofer?.vtoLicencia),
      vtoSeguro: toInputDate(user?.chofer?.vehiculo?.vtoSeguro),
      vtoVtv: toInputDate(user?.chofer?.vehiculo?.vtoVtv),
      vtoMatafuego: toInputDate(user?.chofer?.vehiculo?.vtoMatafuego),
    });
    setModalDocumentacion(true);
  };

  const handleGuardarDocumentacion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setGuardandoDoc(true);
      const res = await choferService.updateMiPerfil({
        vtoLicencia: docForm.vtoLicencia || null,
        vtoSeguro: docForm.vtoSeguro || null,
        vtoVtv: docForm.vtoVtv || null,
        vtoMatafuego: docForm.vtoMatafuego || null,
      });

      if (res.success && res.data) {
        if (user && user.chofer) {
          updateUser({
            ...user,
            chofer: {
              ...user.chofer,
              ...res.data,
              vehiculo: res.data.vehiculo || user.chofer.vehiculo,
            },
          });
        }
        setModalDocumentacion(false);
        toast.success('¡Fechas de documentación actualizadas con éxito!');
      } else {
        toast.error(res.message || 'Error al actualizar documentación');
      }
    } catch (err) {
      console.error('Error al guardar documentación:', err);
      toast.error('Error al actualizar documentación');
    } finally {
      setGuardandoDoc(false);
    }
  };

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

  // Cargar lista de vehículos disponibles de la agencia
  const abrirModalVehiculo = async () => {
    setSelectedVehiculoId(user?.chofer?.vehiculoId || '');
    setModalVehiculo(true);
    try {
      setLoadingVehiculos(true);
      const res = await choferService.getVehiculosDisponibles();
      if (res.success && res.data) {
        setVehiculos(res.data);
      } else {
        toast.error('Error al cargar la flota de vehículos');
      }
    } catch (err) {
      console.error('Error cargando vehículos:', err);
      toast.error('Error al cargar vehículos');
    } finally {
      setLoadingVehiculos(false);
    }
  };

  const handleGuardarVehiculo = async () => {
    try {
      setGuardandoVehiculo(true);
      const res = await choferService.updateMiPerfil({
        vehiculoId: selectedVehiculoId || null,
      });

      if (res.success && res.data) {
        // Actualizar el estado global del usuario autenticado
        if (user && user.chofer) {
          const vehiculoActualizado =
            vehiculos.find((v) => v.id === selectedVehiculoId) || res.data.vehiculo || null;

          updateUser({
            ...user,
            chofer: {
              ...user.chofer,
              vehiculoId: selectedVehiculoId || undefined,
              vehiculo: vehiculoActualizado || undefined,
            },
          });
        }

        setModalVehiculo(false);
        const auto = vehiculos.find((v) => v.id === selectedVehiculoId);
        toast.success(
          auto
            ? `¡Unidad actualizada! Ahora manejas: ${auto.marca} ${auto.modelo} (${auto.patente})`
            : 'Unidad desvinculada exitosamente.'
        );
      } else {
        toast.error(res.message || 'No se pudo cambiar el vehículo');
      }
    } catch (err) {
      console.error('Error al guardar vehículo:', err);
      toast.error('Error de servidor al guardar vehículo');
    } finally {
      setGuardandoVehiculo(false);
    }
  };

  // Manejo de archivo de imagen local
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar los 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFotoPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGuardarFoto = async () => {
    const finalFoto = fotoPreview || fotoUrlInput.trim();
    if (!finalFoto) {
      toast.error('Por favor selecciona una foto o introduce un enlace.');
      return;
    }

    try {
      setGuardandoFoto(true);
      const res = await choferService.updateMiPerfil({ fotoUrl: finalFoto });

      if (res.success) {
        if (user && user.chofer) {
          updateUser({
            ...user,
            chofer: {
              ...user.chofer,
              fotoUrl: finalFoto,
            },
          });
        }
        setModalFoto(false);
        toast.success('¡Foto de perfil actualizada exitosamente!');
      } else {
        toast.error(res.message || 'Error al actualizar la foto');
      }
    } catch (err) {
      console.error('Error al guardar foto:', err);
      toast.error('Error al actualizar la foto');
    } finally {
      setGuardandoFoto(false);
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto pb-24">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Mi Perfil</h2>

      {/* Tarjeta de Perfil con Foto */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 flex items-center space-x-4 transition-colors">
        <div className="relative group shrink-0">
          {user?.chofer?.fotoUrl ? (
            <img
              src={user.chofer.fotoUrl}
              alt={user.chofer.nombre || 'Chofer'}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-primary-500 shadow-sm"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-slate-800 flex items-center justify-center text-primary-600 dark:text-primary-400 text-2xl font-bold shadow-xs">
              {user?.chofer?.nombre?.charAt(0) || 'C'}
            </div>
          )}
          <button
            onClick={() => {
              setFotoPreview(user?.chofer?.fotoUrl || '');
              setFotoUrlInput('');
              setModalFoto(true);
            }}
            className="absolute -bottom-1 -right-1 bg-primary-600 hover:bg-primary-700 text-white p-1.5 rounded-full shadow-md transition-transform hover:scale-110"
            title="Cambiar foto de perfil"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 dark:text-white text-base truncate">
              {user?.chofer?.nombre || 'Chofer'} {user?.chofer?.apellido || ''}
            </h3>
            <button
              onClick={() => {
                setFotoPreview(user?.chofer?.fotoUrl || '');
                setFotoUrlInput('');
                setModalFoto(true);
              }}
              className="text-xs text-primary-600 dark:text-primary-400 font-semibold hover:underline"
            >
              Editar foto
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
            {user?.email || 'chofer@ejemplo.com'}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full inline-flex border border-transparent dark:border-emerald-800">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Licencia: {user?.chofer?.categoriaLicencia || 'Profesional'}</span>
          </div>
        </div>
      </div>

      {/* Preferencia de Modo Oscuro / Sistema */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 space-y-3 transition-colors">
        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-2.5">
          <Moon className="w-4 h-4 text-primary-500 dark:text-primary-400" />
          <h4 className="font-semibold text-xs text-gray-700 dark:text-slate-300 uppercase tracking-wider">
            Apariencia y Modo Oscuro
          </h4>
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Podés usar la app en modo oscuro para descansar la vista en viajes nocturnos, o adaptarla a la configuración de tu teléfono.
        </p>
        <ThemeToggle variant="inline" />
      </div>

      {/* Información del Vehículo y Botón de Cambio de Unidad */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 space-y-3 transition-colors">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-primary-500 dark:text-primary-400" />
            <h4 className="font-semibold text-xs text-gray-700 dark:text-slate-300 uppercase tracking-wider">
              Vehículo Asignado
            </h4>
          </div>
          <button
            onClick={abrirModalVehiculo}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 bg-primary-50 dark:bg-primary-950/60 px-2.5 py-1.5 rounded-xl border border-primary-200 dark:border-primary-800 transition-colors shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Cambiar Unidad
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-gray-500 dark:text-slate-400">Patente</div>
          <div className="text-right font-bold text-gray-800 dark:text-slate-200">
            {user?.chofer?.vehiculo?.patente ? (
              <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono text-xs">
                {user.chofer.vehiculo.patente}
              </span>
            ) : (
              'No asignada'
            )}
          </div>
          <div className="text-gray-500 dark:text-slate-400">Marca / Modelo</div>
          <div className="text-right font-medium text-gray-800 dark:text-slate-200">
            {user?.chofer?.vehiculo
              ? `${user.chofer.vehiculo.marca} ${user.chofer.vehiculo.modelo}`
              : 'No asignado'}
          </div>
          {user?.chofer?.vehiculo?.color && (
            <>
              <div className="text-gray-500 dark:text-slate-400">Color</div>
              <div className="text-right font-medium text-gray-800 dark:text-slate-200">
                {user.chofer.vehiculo.color}
              </div>
            </>
          )}
          <div className="text-gray-500 dark:text-slate-400">Comisión Chofer</div>
          <div className="text-right font-medium text-gray-800 dark:text-slate-200">
            {100 - (user?.chofer?.comisionPorcentaje || 30)}%
          </div>
        </div>

        <div className="pt-2 border-t border-gray-100 dark:border-slate-800 text-[11px] text-gray-400 dark:text-slate-500 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span>
            Si cambias de vehículo hoy, el cliente y el coordinador verán automáticamente la patente y el modelo de la nueva unidad.
          </span>
        </div>
      </div>

      {/* Documentación y Estado de Vencimientos */}
      {(() => {
        const evaluacion = evaluarDocumentacionClient(user?.chofer, user?.chofer?.vehiculo);

        return (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 space-y-3 transition-colors">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <ShieldAlert
                  className={`w-4 h-4 ${
                    evaluacion.tieneAlertas
                      ? evaluacion.tieneCriticas
                        ? 'text-red-500'
                        : 'text-amber-500'
                      : 'text-emerald-500'
                  }`}
                />
                <h4 className="font-semibold text-xs text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                  Documentación y Vencimientos
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={abrirModalDocumentacion}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 bg-primary-50 dark:bg-primary-950/60 px-2.5 py-1.5 rounded-xl border border-primary-200 dark:border-primary-800 transition-colors shadow-xs"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Cargar / Actualizar Fechas
                </button>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    evaluacion.tieneAlertas
                      ? evaluacion.tieneCriticas
                        ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                        : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  }`}
                >
                  {evaluacion.tieneAlertas ? `${evaluacion.cantidadAlertas} por regularizar` : 'Todo al día'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {/* Licencia de Conducir */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between ${
                  getDocumentoBadgeClasses(evaluacion.items.licencia.estado).bgLight
                } ${getDocumentoBadgeClasses(evaluacion.items.licencia.estado).border}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xl shrink-0">🪪</span>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white truncate">Licencia de Conducir</p>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400">
                      {evaluacion.items.licencia.fecha
                        ? `Vto: ${evaluacion.items.licencia.fecha}`
                        : 'Sin fecha registrada'}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    getDocumentoBadgeClasses(evaluacion.items.licencia.estado).badge
                  }`}
                >
                  {evaluacion.items.licencia.label || (evaluacion.items.licencia.estado === 'VENCIDO'
                    ? `Vencida (-${Math.abs(evaluacion.items.licencia.diasRestantes || 0)}d)`
                    : evaluacion.items.licencia.estado === 'VENCE_HOY'
                    ? 'Vence hoy'
                    : evaluacion.items.licencia.estado === 'PROXIMO_A_VENCER'
                    ? `En ${evaluacion.items.licencia.diasRestantes}d`
                    : evaluacion.items.licencia.estado === 'AL_DIA'
                    ? 'Al día'
                    : 'Sin cargar')}
                </span>
              </div>

              {/* Seguro Automotor */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between ${
                  getDocumentoBadgeClasses(evaluacion.items.seguro.estado).bgLight
                } ${getDocumentoBadgeClasses(evaluacion.items.seguro.estado).border}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xl shrink-0">🛡️</span>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white truncate">Seguro Automotor</p>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400">
                      {evaluacion.items.seguro.fecha
                        ? `Vto: ${evaluacion.items.seguro.fecha}`
                        : 'Sin fecha registrada'}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    getDocumentoBadgeClasses(evaluacion.items.seguro.estado).badge
                  }`}
                >
                  {evaluacion.items.seguro.label || (evaluacion.items.seguro.estado === 'VENCIDO'
                    ? `Vencido (-${Math.abs(evaluacion.items.seguro.diasRestantes || 0)}d)`
                    : evaluacion.items.seguro.estado === 'VENCE_HOY'
                    ? 'Vence hoy'
                    : evaluacion.items.seguro.estado === 'PROXIMO_A_VENCER'
                    ? `En ${evaluacion.items.seguro.diasRestantes}d`
                    : evaluacion.items.seguro.estado === 'AL_DIA'
                    ? 'Al día'
                    : 'Sin cargar')}
                </span>
              </div>

              {/* VTV */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between ${
                  getDocumentoBadgeClasses(evaluacion.items.vtv.estado).bgLight
                } ${getDocumentoBadgeClasses(evaluacion.items.vtv.estado).border}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xl shrink-0">📋</span>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white truncate">VTV / RTO</p>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400">
                      {evaluacion.items.vtv.fecha ? `Vto: ${evaluacion.items.vtv.fecha}` : 'Sin fecha registrada'}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    getDocumentoBadgeClasses(evaluacion.items.vtv.estado).badge
                  }`}
                >
                  {evaluacion.items.vtv.label || (evaluacion.items.vtv.estado === 'VENCIDO'
                    ? `Vencida (-${Math.abs(evaluacion.items.vtv.diasRestantes || 0)}d)`
                    : evaluacion.items.vtv.estado === 'VENCE_HOY'
                    ? 'Vence hoy'
                    : evaluacion.items.vtv.estado === 'PROXIMO_A_VENCER'
                    ? `En ${evaluacion.items.vtv.diasRestantes}d`
                    : evaluacion.items.vtv.estado === 'AL_DIA'
                    ? 'Al día'
                    : 'Sin cargar')}
                </span>
              </div>

              {/* Matafuego */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between ${
                  getDocumentoBadgeClasses(evaluacion.items.matafuego.estado).bgLight
                } ${getDocumentoBadgeClasses(evaluacion.items.matafuego.estado).border}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xl shrink-0">🧯</span>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white truncate">Carga de Matafuego</p>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400">
                      {evaluacion.items.matafuego.fecha
                        ? `Vto: ${evaluacion.items.matafuego.fecha}`
                        : 'Sin fecha registrada'}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    getDocumentoBadgeClasses(evaluacion.items.matafuego.estado).badge
                  }`}
                >
                  {evaluacion.items.matafuego.label || (evaluacion.items.matafuego.estado === 'VENCIDO'
                    ? `Vencido (-${Math.abs(evaluacion.items.matafuego.diasRestantes || 0)}d)`
                    : evaluacion.items.matafuego.estado === 'VENCE_HOY'
                    ? 'Vence hoy'
                    : evaluacion.items.matafuego.estado === 'PROXIMO_A_VENCER'
                    ? `En ${evaluacion.items.matafuego.diasRestantes}d`
                    : evaluacion.items.matafuego.estado === 'AL_DIA'
                    ? 'Al día'
                    : 'Sin cargar')}
                </span>
              </div>
            </div>

            {evaluacion.tieneAlertas && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/40">
                ⚠️ Para mantener tu móvil habilitado y operar con normalidad, presentá la documentación renovada en la agencia antes del vencimiento.
              </p>
            )}
          </div>
        );
      })()}

      {/* Rendimiento y Kilometraje del Mes */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 space-y-3 transition-colors">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            <h4 className="font-semibold text-xs text-gray-700 dark:text-slate-300 uppercase tracking-wider">
              Kilometraje del Mes
            </h4>
          </div>
          <span className="text-[11px] text-gray-400 dark:text-slate-400">
            {resumen?.ingresos?.totalViajes || 0} viajes completados
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center pt-1">
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/40 rounded-xl p-2.5">
            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-semibold">C/ Pasajeros</p>
            <p className="text-base font-black text-emerald-900 dark:text-emerald-200">
              {resumen?.kilometraje?.kmConPasajero || 0}
            </p>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400">km</span>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800/40 rounded-xl p-2.5">
            <p className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-semibold">S/ Pasajeros</p>
            <p className="text-base font-black text-amber-900 dark:text-amber-200">
              {resumen?.kilometraje?.kmSinPasajero || 0}
            </p>
            <span className="text-[10px] text-amber-600 dark:text-amber-400">km</span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5">
            <p className="text-[10px] text-slate-600 dark:text-slate-400 uppercase font-semibold">Total</p>
            <p className="text-base font-black text-slate-900 dark:text-white">
              {resumen?.kilometraje?.kmTotalConectado || 0}
            </p>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">km</span>
          </div>
        </div>
      </div>

      {/* Acceso Rápido a Gastos */}
      <Link
        href="/chofer/gastos"
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 flex items-center justify-between hover:border-primary-300 dark:hover:border-primary-700 transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/40 flex items-center justify-center">
            <Fuel className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
              Gastos de Combustible y Mecánica
            </h4>
            <p className="text-xs text-gray-400 dark:text-slate-400">
              Total: ${Number(resumen?.gastos?.totalGastos || 0).toLocaleString('es-AR')} • Nafta/Gasoil: ${Number(resumen?.gastos?.totalNaftaGasoil || 0).toLocaleString('es-AR')} • GNC: ${Number(resumen?.gastos?.totalGNC || 0).toLocaleString('es-AR')}
            </p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
      </Link>

      {/* ==================================================== */}
      {/* MODAL: CAMBIAR VEHÍCULO / UNIDAD                     */}
      {/* ==================================================== */}
      {modalVehiculo && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-slate-800 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900 dark:text-white">Cambiar de Unidad</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Seleccioná tu vehículo para hoy</p>
                </div>
              </div>
              <button
                onClick={() => setModalVehiculo(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600 dark:text-slate-300">
              Si cambiaste de unidad o realizas un relevo, elegí el vehículo correspondiente. El cliente sabrá con certeza qué auto va a buscarlo.
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 py-1">
              {loadingVehiculos ? (
                <div className="text-center py-8">
                  <div className="loading-spinner border-primary-500 mx-auto"></div>
                  <p className="mt-2 text-xs text-gray-400">Cargando flota de la remisería...</p>
                </div>
              ) : vehiculos.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  No hay vehículos activos registrados en tu remisería.
                </div>
              ) : (
                vehiculos.map((v) => {
                  const isSelected = selectedVehiculoId === v.id;
                  return (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVehiculoId(v.id)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50/70 dark:bg-primary-950/40 text-primary-900 dark:text-primary-100 ring-2 ring-primary-500/20'
                          : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-xs ${
                            isSelected
                              ? 'bg-primary-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <Car className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-gray-900 dark:text-white">
                              {v.marca} {v.modelo}
                            </span>
                            <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                              {v.patente}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-slate-400">
                            Color: {v.color || 'N/A'} • Año: {v.anio || 'N/A'}
                          </p>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setModalVehiculo(false)}
                className="flex-1 py-3 text-xs font-semibold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardarVehiculo}
                disabled={guardandoVehiculo}
                className="flex-2 py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl shadow-md shadow-primary-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
              >
                {guardandoVehiculo ? 'Guardando...' : 'Confirmar Unidad'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: SUBIR / ACTUALIZAR FOTO DE PERFIL             */}
      {/* ==================================================== */}
      {modalFoto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900 dark:text-white">Foto de Perfil</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Para que tus pasajeros te reconozcan</p>
                </div>
              </div>
              <button
                onClick={() => setModalFoto(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Vista Previa de la Foto */}
            <div className="flex flex-col items-center justify-center py-2">
              {fotoPreview || fotoUrlInput ? (
                <div className="relative">
                  <img
                    src={fotoPreview || fotoUrlInput}
                    alt="Preview"
                    className="w-24 h-24 rounded-3xl object-cover border-4 border-primary-500 shadow-md"
                  />
                  <button
                    onClick={() => {
                      setFotoPreview('');
                      setFotoUrlInput('');
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600"
                    title="Eliminar selección"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-3xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-gray-300 dark:border-slate-700 flex flex-col items-center justify-center text-gray-400">
                  <Camera className="w-8 h-8 mb-1" />
                  <span className="text-[10px]">Sin foto</span>
                </div>
              )}
            </div>

            {/* Botón para seleccionar archivo */}
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors border border-gray-200 dark:border-slate-700"
              >
                <Upload className="w-4 h-4 text-primary-500" />
                Subir foto desde este dispositivo
              </button>

              <div className="relative flex items-center justify-center">
                <span className="border-t border-gray-200 dark:border-slate-800 w-full"></span>
                <span className="bg-white dark:bg-slate-900 px-2 text-[11px] text-gray-400 uppercase tracking-wider absolute">
                  O por enlace
                </span>
              </div>

              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">
                  Enlace directo a imagen (URL):
                </label>
                <input
                  type="url"
                  placeholder="https://ejemplo.com/mifoto.jpg"
                  value={fotoUrlInput}
                  onChange={(e) => setFotoUrlInput(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setModalFoto(false)}
                className="flex-1 py-3 text-xs font-semibold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardarFoto}
                disabled={guardandoFoto || (!fotoPreview && !fotoUrlInput.trim())}
                className="flex-2 py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl shadow-md shadow-primary-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
              >
                {guardandoFoto ? 'Guardando...' : 'Guardar Foto de Perfil'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: CARGAR / ACTUALIZAR DOCUMENTACIÓN             */}
      {/* ==================================================== */}
      {modalDocumentacion && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900 dark:text-white">Actualizar Documentación</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Registrá tus nuevos vencimientos</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalDocumentacion(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarDocumentacion} className="space-y-4">
              {!user?.chofer?.vehiculoId && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Actualmente no tenés un vehículo asignado. Podés actualizar tu carnet de conducir; los datos del móvil se habilitarán al asignarte una unidad.</span>
                </div>
              )}

              <div className="space-y-3">
                {/* Licencia de Conducir */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🪪</span>
                    <label className="text-xs font-bold text-gray-800 dark:text-slate-200">
                      Licencia de Conducir (Carnet)
                    </label>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">
                    Documento personal del chofer.
                  </p>
                  <input
                    type="date"
                    value={docForm.vtoLicencia}
                    onChange={(e) => setDocForm({ ...docForm, vtoLicencia: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Seguro Automotor */}
                <div className={`p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 space-y-1.5 ${!user?.chofer?.vehiculoId ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🛡️</span>
                    <label className="text-xs font-bold text-gray-800 dark:text-slate-200">
                      Póliza de Seguro Automotor
                    </label>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">
                    {user?.chofer?.vehiculo ? `Asociado al móvil ${user.chofer.vehiculo.patente}` : 'Requiere vehículo asignado'}
                  </p>
                  <input
                    type="date"
                    disabled={!user?.chofer?.vehiculoId}
                    value={docForm.vtoSeguro}
                    onChange={(e) => setDocForm({ ...docForm, vtoSeguro: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                  />
                </div>

                {/* VTV / RTO */}
                <div className={`p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 space-y-1.5 ${!user?.chofer?.vehiculoId ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📋</span>
                    <label className="text-xs font-bold text-gray-800 dark:text-slate-200">
                      VTV / RTO (Revisión Técnica)
                    </label>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">
                    {user?.chofer?.vehiculo ? `Asociado al móvil ${user.chofer.vehiculo.patente}` : 'Requiere vehículo asignado'}
                  </p>
                  <input
                    type="date"
                    disabled={!user?.chofer?.vehiculoId}
                    value={docForm.vtoVtv}
                    onChange={(e) => setDocForm({ ...docForm, vtoVtv: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                  />
                </div>

                {/* Matafuego */}
                <div className={`p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 space-y-1.5 ${!user?.chofer?.vehiculoId ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🧯</span>
                    <label className="text-xs font-bold text-gray-800 dark:text-slate-200">
                      Carga de Matafuego
                    </label>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">
                    {user?.chofer?.vehiculo ? `Asociado al móvil ${user.chofer.vehiculo.patente}` : 'Requiere vehículo asignado'}
                  </p>
                  <input
                    type="date"
                    disabled={!user?.chofer?.vehiculoId}
                    value={docForm.vtoMatafuego}
                    onChange={(e) => setDocForm({ ...docForm, vtoMatafuego: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalDocumentacion(false)}
                  className="flex-1 py-3 text-xs font-semibold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoDoc}
                  className="flex-2 py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl shadow-md shadow-primary-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                >
                  {guardandoDoc ? 'Guardando...' : 'Guardar Vencimientos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
