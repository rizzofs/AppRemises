'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { Eye, EyeOff, User, Mail, Lock, Phone, MapPin, Calendar, UserCheck, ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react';
import { clienteAuthService } from '@/lib/api';

interface RegisterFormData {
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  email: string;
  password: string;
  confirmPassword: string;
  direccion: string;
  fechaNacimiento: string;
  genero: string;
}

interface DatosVerificados {
  dni: string;
  cuil: string;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  fuente: string;
  verificado: boolean;
  direccion?: string;
}

export default function RegistroPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerificandoDni, setIsVerificandoDni] = useState(false);
  const [datosVerificados, setDatosVerificados] = useState<DatosVerificados | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    setError,
    clearErrors,
    formState: { errors }
  } = useForm<RegisterFormData>();

  const password = watch('password');
  const dniWatched = watch('dni');

  const verificarIdentidadConArca = async (dniManual?: string) => {
    const dniAConsultar = (dniManual || getValues('dni') || '').replace(/\D/g, '').trim();

    if (!dniAConsultar || dniAConsultar.length < 7 || dniAConsultar.length > 8) {
      setError('dni', { type: 'manual', message: 'Ingresá un DNI válido de 7 u 8 dígitos' });
      return;
    }

    clearErrors('dni');
    setIsVerificandoDni(true);

    try {
      const response = await clienteAuthService.verificarDni(dniAConsultar);
      if (response.success && response.data) {
        const info = response.data;
        setDatosVerificados(info);
        if (info.verificado && info.nombre) {
          setValue('nombre', info.nombre, { shouldValidate: true });
          setValue('apellido', info.apellido, { shouldValidate: true });
          if (info.direccion && !getValues('direccion')) {
            setValue('direccion', `${info.direccion}${info.localidad ? ', ' + info.localidad : ''}`);
          }
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
        toast.error(response.message || 'No se pudo obtener información del DNI');
      }
    } catch (err) {
      console.error('Error al verificar DNI:', err);
      toast.error('Error al consultar el servicio');
    } finally {
      setIsVerificandoDni(false);
    }
  };

  const handleDniBlur = () => {
    const cleanDni = (getValues('dni') || '').replace(/\D/g, '');
    if ((cleanDni.length === 7 || cleanDni.length === 8) && (!datosVerificados || datosVerificados.dni !== cleanDni)) {
      verificarIdentidadConArca(cleanDni);
    }
  };

  const onSubmit = async (data: RegisterFormData) => {
    if (data.password !== data.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    if (!data.nombre?.trim() || !data.apellido?.trim()) {
      toast.error('Por favor completá tu nombre y apellido');
      return;
    }

    setIsLoading(true);

    try {
      const response = await clienteAuthService.register({
        nombre: data.nombre,
        apellido: data.apellido,
        dni: data.dni.replace(/\D/g, ''),
        telefono: data.telefono,
        email: data.email,
        password: data.password,
        direccion: data.direccion,
        fechaNacimiento: data.fechaNacimiento,
        genero: data.genero
      });

      if (response.success) {
        toast.success('¡Registro exitoso!');
        router.push('/login');
      } else {
        toast.error(response.message || 'Error en el registro');
      }
    } catch (error) {
      console.error('Error en registro:', error);
      toast.error('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30">
            <UserCheck className="h-6 w-6 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Crear cuenta de Pasajero
          </h2>
          <p className="mt-1 text-base font-semibold text-blue-600">
            Remises Bruno
          </p>
          <p className="mt-1 text-xs text-gray-600">
            Validación de identidad segura mediante padrón oficial ARCA / AFIP
          </p>
        </div>

        <form className="mt-8 space-y-6 bg-white p-6 sm:p-8 rounded-3xl shadow-xl border border-gray-100" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            
            {/* SECCIÓN 1: DNI Y VALIDACIÓN OFICIAL ARCA */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="dni" className="block text-sm font-semibold text-gray-700">
                  DNI (Documento Nacional de Identidad) *
                </label>
                <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  Validación Oficial
                </span>
              </div>
              <div className="mt-1 flex gap-2">
                <div className="relative flex-1">
                  <input
                    {...register('dni', {
                      required: 'El DNI es requerido',
                      pattern: {
                        value: /^\d{7,8}$/,
                        message: 'El DNI debe tener 7 u 8 dígitos sin puntos'
                      },
                      onChange: () => {
                        if (datosVerificados) {
                          setDatosVerificados(null);
                          setValue('nombre', '');
                          setValue('apellido', '');
                        }
                      }
                    })}
                    onBlur={handleDniBlur}
                    type="text"
                    maxLength={8}
                    className="appearance-none relative block w-full px-3 py-2.5 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="Ej: 34123456"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => verificarIdentidadConArca()}
                  disabled={isVerificandoDni}
                  className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                  title="Consultar identidad en ARCA / AFIP"
                >
                  {isVerificandoDni ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Validando...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Validar</span>
                    </>
                  )}
                </button>
              </div>
              {errors.dni && (
                <p className="mt-1 text-xs text-red-600">{errors.dni.message}</p>
              )}
            </div>

            {/* BANNER DE IDENTIDAD VERIFICADA O CUIL CALCULADO */}
            {datosVerificados && (
              <div className={`p-3 border rounded-xl flex items-start gap-2.5 text-xs animate-fadeIn ${
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
                  <div className="font-bold">
                    {datosVerificados.verificado ? 'Titular Verificado ante ARCA / AFIP' : 'CUIL Oficial Verificado'}
                  </div>
                  <div className="mt-0.5 font-mono">
                    CUIL: {datosVerificados.cuil}
                    {datosVerificados.nombreCompleto && ` • ${datosVerificados.nombreCompleto}`}
                  </div>
                  <div className="text-[11px] opacity-80 mt-0.5">
                    {datosVerificados.verificado
                      ? 'Tus nombres y apellidos oficiales han sido importados automáticamente.'
                      : 'Por favor completá tu nombre y apellido para tu registro personal.'}
                  </div>
                </div>
              </div>
            )}

            {/* Nombre y Apellido */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="nombre" className="block text-xs font-semibold text-gray-700 mb-1">
                  Nombre *
                </label>
                <div className="relative">
                  <input
                    {...register('nombre', { required: 'El nombre es requerido' })}
                    type="text"
                    readOnly={!!(datosVerificados?.verificado && datosVerificados?.nombre)}
                    className={`appearance-none block w-full px-3 py-2 border text-gray-900 rounded-xl text-sm outline-none transition-all ${
                      datosVerificados?.verificado && datosVerificados?.nombre
                        ? 'bg-emerald-50/50 border-emerald-300 font-medium text-emerald-950 cursor-not-allowed'
                        : 'bg-white border-gray-300 focus:ring-2 focus:ring-blue-500'
                    }`}
                    placeholder="Tu nombre real"
                  />
                  {datosVerificados?.verificado && datosVerificados?.nombre ? (
                    <ShieldCheck className="absolute right-2.5 top-2.5 h-4 w-4 text-emerald-600" />
                  ) : (
                    <User className="absolute right-2.5 top-2.5 h-4 w-4 text-gray-400" />
                  )}
                </div>
                {errors.nombre && (
                  <p className="mt-1 text-xs text-red-600">{errors.nombre.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="apellido" className="block text-xs font-semibold text-gray-700 mb-1">
                  Apellido *
                </label>
                <div className="relative">
                  <input
                    {...register('apellido', { required: 'El apellido es requerido' })}
                    type="text"
                    readOnly={!!(datosVerificados?.verificado && datosVerificados?.apellido)}
                    className={`appearance-none block w-full px-3 py-2 border text-gray-900 rounded-xl text-sm outline-none transition-all ${
                      datosVerificados?.verificado && datosVerificados?.apellido
                        ? 'bg-emerald-50/50 border-emerald-300 font-medium text-emerald-950 cursor-not-allowed'
                        : 'bg-white border-gray-300 focus:ring-2 focus:ring-blue-500'
                    }`}
                    placeholder="Tu apellido real"
                  />
                  {datosVerificados?.verificado && datosVerificados?.apellido ? (
                    <ShieldCheck className="absolute right-2.5 top-2.5 h-4 w-4 text-emerald-600" />
                  ) : (
                    <User className="absolute right-2.5 top-2.5 h-4 w-4 text-gray-400" />
                  )}
                </div>
                {errors.apellido && (
                  <p className="mt-1 text-xs text-red-600">{errors.apellido.message}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-gray-700 mb-1">
                Email *
              </label>
              <div className="relative">
                <input
                  {...register('email', {
                    required: 'El email es requerido',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Email inválido'
                    }
                  })}
                  type="email"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="tu@email.com"
                />
                <Mail className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>

            {/* Teléfono */}
            <div>
              <label htmlFor="telefono" className="block text-xs font-semibold text-gray-700 mb-1">
                Teléfono / WhatsApp *
              </label>
              <div className="relative">
                <input
                  {...register('telefono', { required: 'El teléfono es requerido' })}
                  type="tel"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="11-1234-5678"
                />
                <Phone className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
              </div>
              {errors.telefono && (
                <p className="mt-1 text-xs text-red-600">{errors.telefono.message}</p>
              )}
            </div>

            {/* Dirección */}
            <div>
              <label htmlFor="direccion" className="block text-xs font-semibold text-gray-700 mb-1">
                Dirección habitual *
              </label>
              <div className="relative">
                <input
                  {...register('direccion', { required: 'La dirección es requerida' })}
                  type="text"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Av. Corrientes 1234, CABA"
                />
                <MapPin className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
              </div>
              {errors.direccion && (
                <p className="mt-1 text-xs text-red-600">{errors.direccion.message}</p>
              )}
            </div>

            {/* Fecha de Nacimiento y Género */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="fechaNacimiento" className="block text-xs font-semibold text-gray-700 mb-1">
                  Fecha de Nacimiento *
                </label>
                <div className="relative">
                  <input
                    {...register('fechaNacimiento', { required: 'La fecha de nacimiento es requerida' })}
                    type="date"
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
                {errors.fechaNacimiento && (
                  <p className="mt-1 text-xs text-red-600">{errors.fechaNacimiento.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="genero" className="block text-xs font-semibold text-gray-700 mb-1">
                  Género
                </label>
                <div className="relative">
                  <select
                    {...register('genero')}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                  >
                    <option value="">Seleccionar</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="O">Otro</option>
                  </select>
                  <User className="absolute right-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-gray-700 mb-1">
                Contraseña *
              </label>
              <div className="relative">
                <input
                  {...register('password', {
                    required: 'La contraseña es requerida',
                    minLength: {
                      value: 6,
                      message: 'La contraseña debe tener al menos 6 caracteres'
                    }
                  })}
                  type={showPassword ? 'text' : 'password'}
                  className="appearance-none block w-full px-3 py-2 pr-10 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            {/* Confirmar Contraseña */}
            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-semibold text-gray-700 mb-1">
                Confirmar Contraseña *
              </label>
              <div className="relative">
                <input
                  {...register('confirmPassword', {
                    required: 'Confirma tu contraseña',
                    validate: value => value === password || 'Las contraseñas no coinciden'
                  })}
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="appearance-none block w-full px-3 py-2 pr-10 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading || isVerificandoDni}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 transition-all"
            >
              {isLoading ? 'Creando cuenta...' : 'Crear cuenta verificada'}
            </button>
          </div>

          <div className="text-center space-y-2 pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-600">
              ¿Ya tienes una cuenta?{' '}
              <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-500">
                Inicia sesión
              </Link>
            </p>
            <p className="text-xs text-gray-600">
              ¿Sos chofer y querés sumarte?{' '}
              <Link href="/registro-chofer" className="font-semibold text-emerald-600 hover:text-emerald-700">
                Postulate aquí
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
