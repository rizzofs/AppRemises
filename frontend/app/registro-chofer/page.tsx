'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { 
  Car, 
  User, 
  Mail, 
  Lock, 
  Phone, 
  MapPin, 
  Calendar, 
  FileCheck, 
  Building2, 
  CheckCircle2, 
  AlertCircle,
  Eye, 
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Clock,
  Loader2
} from 'lucide-react';
import { choferService } from '@/lib/api';

interface RemiseriaOption {
  id: string;
  nombreFantasia: string;
  direccion?: string;
  telefono?: string;
  ciudad?: string;
}

export default function RegistroChoferPage() {
  const router = useRouter();
  const [remiserias, setRemiserias] = useState<RemiseriaOption[]>([]);
  const [loadingRemiserias, setLoadingRemiserias] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [registroExitoso, setRegistroExitoso] = useState<any>(null);
  const [isVerificandoDni, setIsVerificandoDni] = useState(false);
  const [datosVerificados, setDatosVerificados] = useState<{
    dni: string;
    cuil: string;
    nombre: string;
    apellido: string;
    nombreCompleto: string;
    fuente: string;
    verificado: boolean;
    direccion?: string;
  } | null>(null);

  // Contraseña visible
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Formulario
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    telefono: '',
    email: '',
    password: '',
    confirmPassword: '',
    direccion: '',
    categoriaLicencia: 'B1',
    vtoLicencia: '',
    remiseriaId: '',
    esPropietario: false,
    observaciones: '',
  });

  const verificarIdentidadConArca = async (dniManual?: string) => {
    const dniAConsultar = (dniManual || formData.dni || '').replace(/\D/g, '').trim();

    if (!dniAConsultar || dniAConsultar.length < 7 || dniAConsultar.length > 8) {
      toast.error('Ingresá un DNI válido de 7 u 8 dígitos para consultar');
      return;
    }

    setIsVerificandoDni(true);
    try {
      const response = await choferService.verificarDni(dniAConsultar);
      if (response.success && response.data) {
        const info = response.data;
        setDatosVerificados(info);
        if (info.verificado && info.nombre) {
          setFormData(prev => ({
            ...prev,
            nombre: info.nombre,
            apellido: info.apellido,
            direccion: prev.direccion || info.direccion || '',
          }));
          toast.success(`Identidad verificada ante ARCA: ${info.nombreCompleto}`, {
            icon: '🛡️',
            duration: 4000
          });
        } else {
          toast(info.mensaje || `CUIL calculado: ${info.cuil}. Completá tus datos personales.`, {
            icon: 'ℹ️',
            duration: 5000
          });
        }
      } else {
        setDatosVerificados(null);
        toast.error(response.message || 'No se pudo verificar el DNI en ARCA/AFIP');
      }
    } catch (err) {
      console.error('Error al verificar DNI:', err);
      toast.error('Error al consultar el padrón oficial');
    } finally {
      setIsVerificandoDni(false);
    }
  };

  const handleDniBlur = () => {
    const cleanDni = formData.dni.replace(/\D/g, '');
    if ((cleanDni.length === 7 || cleanDni.length === 8) && (!datosVerificados || datosVerificados.dni !== cleanDni)) {
      verificarIdentidadConArca(cleanDni);
    }
  };

  useEffect(() => {
    cargarRemiserias();
  }, []);

  const cargarRemiserias = async () => {
    try {
      setLoadingRemiserias(true);
      const res = await choferService.getRemiseriasDisponibles();
      if (res.success && res.data) {
        const lista = res.data;
        setRemiserias(lista);
        if (lista.length > 0) {
          setFormData(prev => ({ ...prev, remiseriaId: lista[0].id }));
        }
      }
    } catch (err) {
      console.error('Error al cargar remiserías disponibles:', err);
      toast.error('No se pudieron cargar las agencias disponibles');
    } finally {
      setLoadingRemiserias(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const target = e.target as HTMLInputElement;
      setFormData(prev => ({ ...prev, [name]: target.checked }));
    } else {
      if (name === 'dni' && datosVerificados) {
        setDatosVerificados(null);
      }
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones
    const cleanDni = formData.dni.replace(/\D/g, '').trim();
    if (!cleanDni) {
      toast.error('Por favor ingresá tu número de DNI');
      return;
    }

    if (!formData.nombre.trim() || !formData.apellido.trim()) {
      toast.error('Por favor completá tu nombre y apellido');
      return;
    }
    if (!formData.telefono.trim()) {
      toast.error('Por favor ingresá un número de teléfono de contacto');
      return;
    }
    if (!formData.email.trim()) {
      toast.error('Por favor ingresá un correo electrónico');
      return;
    }
    if (formData.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    if (!formData.vtoLicencia) {
      toast.error('Por favor ingresá la fecha de vencimiento de tu licencia');
      return;
    }
    if (!formData.remiseriaId) {
      toast.error('Por favor seleccioná una remisería a la que postularte');
      return;
    }

    setSubmitting(true);
    try {
      const res = await choferService.registroPublico({
        nombre: formData.nombre.trim(),
        apellido: formData.apellido.trim(),
        dni: formData.dni.trim(),
        telefono: formData.telefono.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        direccion: formData.direccion.trim() || undefined,
        categoriaLicencia: formData.categoriaLicencia,
        vtoLicencia: formData.vtoLicencia,
        remiseriaId: formData.remiseriaId,
        esPropietario: formData.esPropietario,
        observaciones: formData.observaciones.trim() || undefined,
      });

      if (res.success && res.data) {
        setRegistroExitoso(res.data);
        toast.success('¡Solicitud enviada correctamente!');
      } else {
        toast.error(res.message || 'Error al enviar la solicitud');
      }
    } catch (error: any) {
      console.error('Error en registro chofer:', error);
      const msg = error.response?.data?.message || error.message || 'Error al registrar chofer';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const remiseriaElegida = remiserias.find(r => r.id === formData.remiseriaId);

  // Pantalla de Confirmación de Solicitud Exitosa
  if (registroExitoso) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-950 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl p-8 border border-slate-100 text-center animate-in fade-in zoom-in-95">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-sm">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h2 className="text-2xl font-black text-slate-800">¡Solicitud Enviada con Éxito!</h2>
          <p className="text-slate-600 text-sm mt-2">
            Tu postulación para unirte como chofer ha sido registrada correctamente.
          </p>

          <div className="my-6 p-4 bg-amber-50 rounded-2xl border border-amber-200 text-left space-y-2">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
              <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
              Estado: Pendiente de Aprobación
            </div>
            <p className="text-xs text-amber-900">
              El dueño de <strong>{registroExitoso.remiseriaNombre || remiseriaElegida?.nombreFantasia || 'la remisería'}</strong> revisará tus datos y habilitará tu cuenta.
            </p>
            <div className="pt-2 border-t border-amber-200/60 text-xs text-slate-600 space-y-1">
              <div><span className="font-semibold text-slate-700">Chofer:</span> {formData.nombre} {formData.apellido}</div>
              <div><span className="font-semibold text-slate-700">DNI:</span> {formData.dni}</div>
              <div><span className="font-semibold text-slate-700">Email:</span> {formData.email}</div>
              <div><span className="font-semibold text-slate-700">Modalidad:</span> {formData.esPropietario ? 'Propietario de auto propio' : 'Chofer de flota (Asignado)'}</div>
            </div>
          </div>

          <div className="space-y-3">
            <Link
              href="/login"
              className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl font-bold text-sm bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-500/25 transition-all"
            >
              Ir a Iniciar Sesión
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-xs text-slate-400">
              Podrás acceder a la app una vez que la agencia apruebe tu solicitud.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-950 to-slate-900 py-10 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        {/* Cabecera */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500/20 text-primary-400 rounded-3xl mb-4 border border-primary-500/30 backdrop-blur-sm">
            <Car className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Postulación de Chofer</h1>
          <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto">
            Completá tus datos para solicitar el alta en {remiserias[0]?.nombreFantasia || 'Remises Bruno'}. El dueño de la agencia validará tu documentación para habilitarte.
          </p>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-10 border border-slate-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Sección: Datos Personales */}
            <div>
              <div className="flex items-center justify-between pb-2 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2 text-primary-700 font-bold text-sm">
                  <User className="w-4 h-4" />
                  <span>1. Datos Personales y Validación de Identidad</span>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Padrón ARCA / AFIP
                </span>
              </div>

              {/* DNI PRIMERO CON BOTÓN DE VALIDACIÓN OFICIAL */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  DNI (Documento Nacional de Identidad) *
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      name="dni"
                      required
                      maxLength={8}
                      value={formData.dni}
                      onChange={handleChange}
                      onBlur={handleDniBlur}
                      placeholder="Ej: 34123456 (sin puntos)"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => verificarIdentidadConArca()}
                    disabled={isVerificandoDni}
                    className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm flex-shrink-0"
                  >
                    {isVerificandoDni ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Consultando...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Validar en ARCA</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Al ingresar tu DNI se verificará tu identidad automáticamente contra el padrón oficial.
                </p>
              </div>

              {/* BANNER DE IDENTIDAD VERIFICADA O CUIL CALCULADO */}
              {datosVerificados && (
                <div className={`mb-4 p-3 border rounded-2xl flex items-start gap-2.5 text-xs animate-fadeIn ${
                  datosVerificados.verificado
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
                }`}>
                  {datosVerificados.verificado ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <span>{datosVerificados.verificado ? 'Titular Chofer Verificado ante ARCA' : 'CUIL Oficial Verificado'}</span>
                      <span className="text-[10px] bg-white/70 px-1.5 py-0.2 rounded font-mono border border-current">
                        {datosVerificados.verificado ? 'OFICIAL' : 'MÓDULO 11'}
                      </span>
                    </div>
                    <div className="mt-0.5 text-slate-700">
                      CUIL: <span className="font-mono font-semibold">{datosVerificados.cuil}</span>
                      {datosVerificados.nombreCompleto && ` • ${datosVerificados.nombreCompleto}`}
                    </div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      {datosVerificados.verificado
                        ? 'Nombre y apellido importados desde ARCA. Se han bloqueado para garantizar tu identidad.'
                        : 'Por favor completá tu nombre y apellido para tu postulación.'}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nombre (según DNI) *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="nombre"
                      required
                      readOnly={!!(datosVerificados?.verificado && datosVerificados?.nombre)}
                      value={formData.nombre}
                      onChange={handleChange}
                      placeholder="Tu nombre real"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                        datosVerificados?.verificado && datosVerificados?.nombre
                          ? 'bg-emerald-50/50 border-emerald-300 font-semibold text-emerald-950 cursor-not-allowed'
                          : 'border-slate-200 focus:ring-2 focus:ring-primary-500'
                      }`}
                    />
                    {datosVerificados?.verificado && datosVerificados?.nombre && (
                      <ShieldCheck className="w-4 h-4 text-emerald-600 absolute right-3 top-3 pointer-events-none" />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Apellido (según DNI) *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="apellido"
                      required
                      readOnly={!!(datosVerificados?.verificado && datosVerificados?.apellido)}
                      value={formData.apellido}
                      onChange={handleChange}
                      placeholder="Tu apellido real"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                        datosVerificados?.verificado && datosVerificados?.apellido
                          ? 'bg-emerald-50/50 border-emerald-300 font-semibold text-emerald-950 cursor-not-allowed'
                          : 'border-slate-200 focus:ring-2 focus:ring-primary-500'
                      }`}
                    />
                    {datosVerificados?.verificado && datosVerificados?.apellido && (
                      <ShieldCheck className="w-4 h-4 text-emerald-600 absolute right-3 top-3 pointer-events-none" />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono / WhatsApp *</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      type="tel"
                      name="telefono"
                      required
                      value={formData.telefono}
                      onChange={handleChange}
                      placeholder="Ej: 11 5555 4444"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección / Localidad</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      name="direccion"
                      value={formData.direccion}
                      onChange={handleChange}
                      placeholder="Ej: Av. San Martín 1234, San Isidro"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sección: Licencia de Conducir */}
            <div>
              <div className="flex items-center gap-2 pb-2 mb-4 border-b border-slate-100 text-primary-700 font-bold text-sm">
                <FileCheck className="w-4 h-4" />
                <span>2. Licencia de Conducir</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Categoría de Licencia *</label>
                  <select
                    name="categoriaLicencia"
                    value={formData.categoriaLicencia}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                  >
                    <option value="B1">B1 - Autos particulares / utilitarios</option>
                    <option value="B2">B2 - Autos con remolque</option>
                    <option value="D1">D1 - Transporte de pasajeros (hasta 8 plazas)</option>
                    <option value="D2">D2 - Transporte de pasajeros (más de 8 plazas)</option>
                    <option value="PROFESIONAL">Profesional Habilitante</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Vencimiento de Licencia *</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <input
                      type="date"
                      name="vtoLicencia"
                      required
                      value={formData.vtoLicencia}
                      onChange={handleChange}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sección: Remisería y Modalidad */}
            <div>
              <div className="flex items-center gap-2 pb-2 mb-4 border-b border-slate-100 text-primary-700 font-bold text-sm">
                <Building2 className="w-4 h-4" />
                <span>3. Remisería de Destino y Modalidad</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Remisería a la que te postulás *
                  </label>
                  {loadingRemiserias ? (
                    <div className="p-3 text-xs text-slate-400 bg-slate-50 rounded-xl animate-pulse">
                      Cargando información de la remisería...
                    </div>
                  ) : remiserias.length === 0 ? (
                    <div className="p-3 text-xs text-amber-700 bg-amber-50 rounded-xl border border-amber-200">
                      No hay remiserías disponibles en este momento.
                    </div>
                  ) : remiserias.length === 1 ? (
                    <div className="p-3.5 bg-primary-50 rounded-xl border border-primary-200 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Building2 className="w-5 h-5 text-primary-600" />
                        <div>
                          <p className="text-sm text-primary-950 font-bold">{remiserias[0].nombreFantasia}</p>
                          <p className="text-xs text-primary-700">Remisería Oficial • Postulación Directa</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 bg-primary-200/70 text-primary-900 rounded-lg">
                        Asignada
                      </span>
                    </div>
                  ) : (
                    <select
                      name="remiseriaId"
                      required
                      value={formData.remiseriaId}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                    >
                      {remiserias.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.nombreFantasia} {r.ciudad ? `(${r.ciudad})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Modalidad: Auto propio vs chofer de flota */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="esPropietario"
                      checked={formData.esPropietario}
                      onChange={handleChange}
                      className="w-5 h-5 mt-0.5 rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                    />
                    <div>
                      <span className="text-sm font-bold text-slate-800">
                        Dispongo de vehículo propio habilitado (Propietario)
                      </span>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Marcá esta opción si vas a trabajar con tu propio auto. De lo contrario, se considerará que manejarás un vehículo asignado por la remisería.
                      </p>
                    </div>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Observaciones o Experiencia Previa (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    name="observaciones"
                    value={formData.observaciones}
                    onChange={handleChange}
                    placeholder="Ej: 5 años de experiencia en remises, auto modelo 2021..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Sección: Credenciales de Acceso */}
            <div>
              <div className="flex items-center gap-2 pb-2 mb-4 border-b border-slate-100 text-primary-700 font-bold text-sm">
                <ShieldCheck className="w-4 h-4" />
                <span>4. Credenciales de la App</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Electrónico (será tu usuario) *</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="chofer@ejemplo.com"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contraseña *</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Confirmar Contraseña *</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Repetir contraseña"
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Aviso informativo */}
            <div className="p-4 bg-blue-50/80 rounded-2xl border border-blue-200 text-xs text-blue-800 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>Aviso de Validación:</strong> Al enviar tu registro, la cuenta quedará en estado de <em>Revisión</em>. El dueño de la agencia revisará tu documentación y te activará para que puedas iniciar sesión y comenzar a recibir viajes.
              </div>
            </div>

            {/* Botón de Envío */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 px-6 rounded-2xl font-bold text-white bg-primary-600 hover:bg-primary-700 shadow-xl shadow-primary-500/25 transition-all flex items-center justify-center gap-2 text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Enviando postulación...</span>
                </>
              ) : (
                <>
                  <Car className="w-5 h-5" />
                  <span>Enviar Postulación como Chofer</span>
                </>
              )}
            </button>
          </form>

          {/* Links de pie */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              ¿Ya tenés cuenta aprobada?{' '}
              <Link href="/login" className="text-primary-600 font-bold hover:underline">
                Iniciá sesión aquí
              </Link>
            </div>
            <div>
              ¿Sos pasajero?{' '}
              <Link href="/registro" className="text-primary-600 font-bold hover:underline">
                Registrate como cliente
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
