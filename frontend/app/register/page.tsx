'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { authService } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { RegisterData } from '@/types';
import { Eye, EyeOff, Car, User, Lock, Phone, Mail, MapPin, Calendar, Camera, ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react';

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerificandoDni, setIsVerificandoDni] = useState(false);
  const [tipoUsuario, setTipoUsuario] = useState<'CLIENTE' | 'DUENIO'>('CLIENTE');
  const [datosVerificados, setDatosVerificados] = useState<{
    dni: string;
    cuil: string;
    nombre: string;
    apellido: string;
    nombreCompleto: string;
    fuente: string;
    verificado: boolean;
    direccion?: string;
    localidad?: string;
  } | null>(null);
  
  const router = useRouter();
  const { login } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    getValues,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<any>();

  const password = watch('password');

  const verificarIdentidadConArca = async (dniManual?: string) => {
    const dniAConsultar = (dniManual || getValues('dni') || '').replace(/\D/g, '').trim();

    if (!dniAConsultar || dniAConsultar.length < 7 || dniAConsultar.length > 8) {
      setError('dni', { type: 'manual', message: 'Ingresá un DNI válido de 7 u 8 dígitos' });
      return;
    }

    clearErrors('dni');
    setIsVerificandoDni(true);

    try {
      const response = await authService.verificarDni(dniAConsultar);
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
        toast.error(response.message || 'No se pudo verificar el DNI');
      }
    } catch (err) {
      console.error('Error al verificar DNI:', err);
      toast.error('Error al consultar el padrón oficial');
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

  const onSubmit = async (data: any) => {
    // Si es cliente, requerir validación con ARCA
    if (tipoUsuario === 'CLIENTE') {
      const cleanDni = (data.dni || '').replace(/\D/g, '');
      if (!datosVerificados || datosVerificados.dni !== cleanDni) {
        toast.error('Por favor verificá tu DNI con ARCA / AFIP antes de continuar');
        await verificarIdentidadConArca(data.dni);
        return;
      }
    }

    setIsLoading(true);
    try {
      const { confirmPassword, ...registerData } = data;
      
      let response;
      if (tipoUsuario === 'CLIENTE') {
        response = await authService.registerCliente({
          ...registerData,
          dni: registerData.dni?.replace(/\D/g, '')
        });
      } else {
        response = await authService.register(registerData);
      }
      
      if (response.success && response.data) {
        const { user, accessToken, refreshToken } = response.data;
        login(user, accessToken, refreshToken);
        toast.success('¡Registro exitoso! Bienvenido a Remises Bruno');
        
        if (user.rol === 'CLIENTE') {
          router.push('/cliente');
        } else {
          router.push('/duenio/dashboard');
        }
      } else {
        toast.error(response.message || 'Error en el registro');
      }
    } catch (error: any) {
      console.error('Error en registro:', error);
      toast.error(error.response?.data?.message || 'Error en el registro');
    } finally {
      setIsLoading(false);
    }
  };

  const changeTipoUsuario = (tipo: 'CLIENTE' | 'DUENIO') => {
    setTipoUsuario(tipo);
    setDatosVerificados(null);
    reset();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full my-8">
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4 shadow-md shadow-primary-500/20">
              <Car className="w-8 h-8 text-primary-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Remises Bruno</h1>
            <p className="text-gray-600 mt-2 text-sm">Crea tu cuenta verificada</p>
          </div>

          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            <button
              type="button"
              onClick={() => changeTipoUsuario('CLIENTE')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                tipoUsuario === 'CLIENTE' ? 'bg-white shadow text-primary-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Pasajero
            </button>
            <button
              type="button"
              onClick={() => changeTipoUsuario('DUENIO')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                tipoUsuario === 'DUENIO' ? 'bg-white shadow text-primary-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Remisería
            </button>
            <button
              type="button"
              onClick={() => router.push('/registro-chofer')}
              className="flex-1 py-2 text-sm font-semibold rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors"
            >
              Chofer
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            
            {/* SECCIÓN DNI EN CLIENTE CON VALIDACIÓN ARCA */}
            {tipoUsuario === 'CLIENTE' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700">
                    DNI (Documento Nacional de Identidad) *
                  </label>
                  <span className="text-[11px] font-semibold text-primary-700 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary-600" />
                    Padrón ARCA
                  </span>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      {...register('dni', { 
                        required: 'El DNI es requerido',
                        pattern: {
                          value: /^\d{7,8}$/,
                          message: 'El DNI debe tener 7 u 8 dígitos'
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
                      className="input bg-gray-50 border-gray-200 text-sm font-mono"
                      placeholder="Sin puntos (Ej: 34123456)"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => verificarIdentidadConArca()}
                    disabled={isVerificandoDni}
                    className="px-3.5 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm flex-shrink-0"
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
                {errors.dni && <p className="mt-1 text-xs text-red-500">{errors.dni.message as string}</p>}

                {/* BADGE DE VERIFICACIÓN O CUIL CALCULADO */}
                {datosVerificados && (
                  <div className={`mt-3 p-3 border rounded-xl flex items-start gap-2.5 text-xs animate-fadeIn ${
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
                        {datosVerificados.verificado ? 'Identidad Verificada ante ARCA' : 'CUIL Oficial Verificado'}
                      </div>
                      <div className="mt-0.5 font-mono">
                        CUIL: {datosVerificados.cuil}
                        {datosVerificados.nombreCompleto && ` • ${datosVerificados.nombreCompleto}`}
                      </div>
                      <div className="text-[11px] opacity-80 mt-0.5">
                        {datosVerificados.verificado
                          ? 'Tus datos oficiales se han completado automáticamente.'
                          : 'Por favor completá tu nombre y apellido para tu cuenta.'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* NOMBRE */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                {tipoUsuario === 'CLIENTE' ? 'Nombres *' : 'Nombre Completo del Responsable *'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  {...register('nombre', { required: 'Requerido' })}
                  type="text"
                  readOnly={tipoUsuario === 'CLIENTE' && !!(datosVerificados?.verificado && datosVerificados?.nombre)}
                  className={`input pl-9 text-sm ${
                    tipoUsuario === 'CLIENTE' && datosVerificados?.verificado && datosVerificados?.nombre
                      ? 'bg-emerald-50/50 border-emerald-300 font-medium text-emerald-950 cursor-not-allowed'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                  placeholder={tipoUsuario === 'CLIENTE' ? 'Tu nombre real' : 'Ej: Juan Pérez'}
                />
                {tipoUsuario === 'CLIENTE' && datosVerificados?.verificado && datosVerificados?.nombre && (
                  <ShieldCheck className="h-4 w-4 text-emerald-600 absolute right-3 top-3 pointer-events-none" />
                )}
              </div>
              {errors.nombre && <p className="mt-1 text-xs text-red-500">{errors.nombre.message as string}</p>}
            </div>

            {/* APELLIDO (CLIENTE) */}
            {tipoUsuario === 'CLIENTE' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Apellidos *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    {...register('apellido', { required: 'Requerido' })}
                    type="text"
                    readOnly={!!(datosVerificados?.verificado && datosVerificados?.apellido)}
                    className={`input pl-9 text-sm ${
                      datosVerificados?.verificado && datosVerificados?.apellido
                        ? 'bg-emerald-50/50 border-emerald-300 font-medium text-emerald-950 cursor-not-allowed'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                    placeholder="Tu apellido real"
                  />
                  {datosVerificados?.verificado && datosVerificados?.apellido && (
                    <ShieldCheck className="h-4 w-4 text-emerald-600 absolute right-3 top-3 pointer-events-none" />
                  )}
                </div>
                {errors.apellido && <p className="mt-1 text-xs text-red-500">{errors.apellido.message as string}</p>}
              </div>
            )}

            {/* DOMICILIO (CLIENTE) */}
            {tipoUsuario === 'CLIENTE' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Domicilio habitual</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    {...register('direccion', { required: 'Requerido' })}
                    type="text"
                    className="input pl-9 bg-gray-50 border-gray-200 text-sm"
                    placeholder="Ej: Av. Rivadavia 1234"
                  />
                </div>
                {errors.direccion && <p className="mt-1 text-xs text-red-500">{errors.direccion.message as string}</p>}
              </div>
            )}

            {/* FECHA DE NACIMIENTO (CLIENTE) */}
            {tipoUsuario === 'CLIENTE' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Fecha de Nacimiento</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    {...register('fechaNacimiento', { required: 'Requerido' })}
                    type="date"
                    className="input pl-9 bg-gray-50 border-gray-200 text-sm"
                  />
                </div>
                {errors.fechaNacimiento && <p className="mt-1 text-xs text-red-500">{errors.fechaNacimiento.message as string}</p>}
              </div>
            )}

            {/* TELÉFONO */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Teléfono / WhatsApp *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  {...register('telefono', { required: 'Requerido' })}
                  type="tel"
                  className="input pl-9 bg-gray-50 border-gray-200 text-sm"
                  placeholder="+54 9 11 1234-5678"
                />
              </div>
              {errors.telefono && <p className="mt-1 text-xs text-red-500">{errors.telefono.message as string}</p>}
            </div>

            {/* EMAIL */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Email *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  {...register('email', { required: 'Requerido', pattern: /^\S+@\S+$/i })}
                  type="email"
                  className="input pl-9 bg-gray-50 border-gray-200 text-sm"
                  placeholder="tu@email.com"
                />
              </div>
              {errors.email && <p className="mt-1 text-xs text-red-500">Email inválido</p>}
            </div>

            {/* CONTRASEÑA */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Contraseña *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  {...register('password', { required: 'Requerido', minLength: 6 })}
                  type={showPassword ? 'text' : 'password'}
                  className="input pl-9 pr-10 bg-gray-50 border-gray-200 text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-500">Mínimo 6 caracteres</p>}
            </div>

            {/* CONFIRMAR CONTRASEÑA */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Confirmar Contraseña *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  {...register('confirmPassword', {
                    required: 'Requerido',
                    validate: (val) => val === password || 'Las contraseñas no coinciden',
                  })}
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="input pl-9 pr-10 bg-gray-50 border-gray-200 text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message as string}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading || isVerificandoDni}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white font-bold py-3 rounded-xl shadow-lg shadow-primary-500/20 transition-all flex items-center justify-center mt-2 text-sm"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                'Crear Cuenta Verificada'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-600">
              ¿Ya tienes cuenta?{' '}
              <button
                onClick={() => router.push('/login')}
                className="text-primary-600 hover:text-primary-700 font-bold"
              >
                Inicia sesión aquí
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
