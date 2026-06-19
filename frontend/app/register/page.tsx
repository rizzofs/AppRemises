'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { authService } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { RegisterData } from '@/types';
import { Eye, EyeOff, Car, User, Lock, Phone, Mail, MapPin, Calendar, Camera } from 'lucide-react';

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tipoUsuario, setTipoUsuario] = useState<'CLIENTE' | 'DUENIO'>('CLIENTE');
  
  const router = useRouter();
  const { login } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<any>();

  const password = watch('password');

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      const { confirmPassword, ...registerData } = data;
      
      let response;
      if (tipoUsuario === 'CLIENTE') {
        // Enviar al nuevo endpoint de cliente
        response = await authService.registerCliente(registerData);
      } else {
        // Enviar al endpoint de dueño original
        response = await authService.register(registerData);
      }
      
      if (response.success && response.data) {
        const { user, accessToken, refreshToken } = response.data;
        login(user, accessToken, refreshToken);
        toast.success('¡Registro exitoso! Bienvenido a App Remises');
        
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
    reset(); // Limpiar el formulario
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full my-8">
        <div className="bg-white rounded-3xl shadow-xl p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
              <Car className="w-8 h-8 text-primary-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">App Remises</h1>
            <p className="text-gray-600 mt-2">Crea tu cuenta</p>
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
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* CAMPOS COMUNES */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tipoUsuario === 'CLIENTE' ? 'Nombres' : 'Nombre Completo'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('nombre', { required: 'Requerido' })}
                  type="text"
                  className="input pl-10 bg-gray-50 border-gray-200"
                  placeholder="Ej: Juan"
                />
              </div>
              {errors.nombre && <p className="mt-1 text-xs text-red-500">{errors.nombre.message as string}</p>}
            </div>

            {/* CAMPOS EXCLUSIVOS CLIENTE */}
            {tipoUsuario === 'CLIENTE' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      {...register('apellido', { required: 'Requerido' })}
                      type="text"
                      className="input pl-10 bg-gray-50 border-gray-200"
                      placeholder="Ej: Pérez"
                    />
                  </div>
                  {errors.apellido && <p className="mt-1 text-xs text-red-500">{errors.apellido.message as string}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DNI</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      {...register('dni', { required: 'Requerido' })}
                      type="text"
                      className="input pl-10 bg-gray-50 border-gray-200"
                      placeholder="Sin puntos"
                    />
                  </div>
                  {errors.dni && <p className="mt-1 text-xs text-red-500">{errors.dni.message as string}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Domicilio</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MapPin className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      {...register('direccion', { required: 'Requerido' })}
                      type="text"
                      className="input pl-10 bg-gray-50 border-gray-200"
                      placeholder="Ej: Av. Rivadavia 1234"
                    />
                  </div>
                  {errors.direccion && <p className="mt-1 text-xs text-red-500">{errors.direccion.message as string}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Nacimiento</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      {...register('fechaNacimiento', { required: 'Requerido' })}
                      type="date"
                      className="input pl-10 bg-gray-50 border-gray-200"
                    />
                  </div>
                  {errors.fechaNacimiento && <p className="mt-1 text-xs text-red-500">{errors.fechaNacimiento.message as string}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL de Foto (Opcional)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Camera className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      {...register('fotoUrl')}
                      type="url"
                      className="input pl-10 bg-gray-50 border-gray-200"
                      placeholder="https://ejemplo.com/mifoto.jpg"
                    />
                  </div>
                </div>
              </>
            )}

            {/* COMUNES SIGUIENTES */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('telefono', { required: 'Requerido' })}
                  type="tel"
                  className="input pl-10 bg-gray-50 border-gray-200"
                  placeholder="+54 9 11 1234-5678"
                />
              </div>
              {errors.telefono && <p className="mt-1 text-xs text-red-500">{errors.telefono.message as string}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('email', { required: 'Requerido', pattern: /^\S+@\S+$/i })}
                  type="email"
                  className="input pl-10 bg-gray-50 border-gray-200"
                  placeholder="tu@email.com"
                />
              </div>
              {errors.email && <p className="mt-1 text-xs text-red-500">Email inválido</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('password', { required: 'Requerido', minLength: 6 })}
                  type={showPassword ? 'text' : 'password'}
                  className="input pl-10 pr-10 bg-gray-50 border-gray-200"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-500">Mínimo 6 caracteres</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('confirmPassword', {
                    required: 'Requerido',
                    validate: (val) => val === password || 'Las contraseñas no coinciden',
                  })}
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="input pl-10 pr-10 bg-gray-50 border-gray-200"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message as string}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 rounded-xl shadow-lg transition-colors flex items-center justify-center mt-4"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                'Crear Cuenta'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
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