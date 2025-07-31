'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import { duenioService } from '@/lib/api';
import { UpdateDuenioData } from '@/types';
import { User, ArrowLeft, Save, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function PerfilPage() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UpdateDuenioData>();

  useEffect(() => {
    if (!user || user.rol !== 'DUENIO') {
      router.push('/login');
      return;
    }

    // Prellenar el formulario con los datos actuales
    reset({
      telefono: user.duenio?.telefono || '',
      email: user.email || '',
    });
  }, [user, router, reset]);

  const onSubmit = async (data: UpdateDuenioData) => {
    if (!user?.duenio?.id) {
      toast.error('Error: ID de dueño no encontrado');
      return;
    }

    setIsSaving(true);
    try {
      const response = await duenioService.update(user.duenio.id, data);
      
      if (response.success && response.data) {
        // Actualizar el contexto con los nuevos datos
        updateUser({
          ...user,
          email: data.email || user.email,
          duenio: response.data
        });
        
        toast.success('Perfil actualizado exitosamente');
      } else {
        toast.error(response.message || 'Error al actualizar perfil');
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.response?.data?.message || 'Error al actualizar perfil');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/duenio/dashboard')}
                className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Volver
              </button>
              <User className="w-8 h-8 text-green-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Mi Perfil</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Información Personal
            </h2>
            <p className="text-gray-600">
              Actualiza tu información personal y de contacto
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  id="nombre"
                  className="input bg-gray-100"
                  value={user.duenio?.nombre || ''}
                  disabled
                />
                <p className="mt-1 text-xs text-gray-500">
                  El nombre solo puede ser modificado por el administrador
                </p>
              </div>

              <div>
                <label htmlFor="telefono" className="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono *
                </label>
                <input
                  {...register('telefono', {
                    required: 'El teléfono es requerido',
                    pattern: {
                      value: /^[0-9+\-\s()]+$/,
                      message: 'Formato de teléfono inválido',
                    },
                    minLength: {
                      value: 8,
                      message: 'El teléfono debe tener al menos 8 caracteres',
                    },
                  })}
                  type="tel"
                  id="telefono"
                  className="input"
                  placeholder="+54 9 11 1234-5678"
                />
                {errors.telefono && (
                  <p className="mt-1 text-sm text-red-600">{errors.telefono.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="dni" className="block text-sm font-medium text-gray-700 mb-2">
                  DNI
                </label>
                <input
                  type="text"
                  id="dni"
                  className="input bg-gray-100"
                  value={user.duenio?.dni || ''}
                  disabled
                />
                <p className="mt-1 text-xs text-gray-500">
                  El DNI solo puede ser modificado por el administrador
                </p>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  {...register('email', {
                    required: 'El email es requerido',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Email inválido',
                    },
                  })}
                  type="email"
                  id="email"
                  className="input"
                  placeholder="juan@email.com"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Nueva Contraseña (opcional)
                </label>
                <div className="relative">
                  <input
                    {...register('password', {
                      minLength: {
                        value: 6,
                        message: 'La contraseña debe tener al menos 6 caracteres',
                      },
                    })}
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    className="input pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Deja vacío si no quieres cambiar la contraseña
                </p>
              </div>
            </div>

            {/* Información de solo lectura */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Información del Sistema</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">ID de Usuario</p>
                  <p className="text-sm text-gray-600 font-mono">{user.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Rol</p>
                  <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                    {user.rol}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Estado</p>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      user.duenio?.user?.activo
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {user.duenio?.user?.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Miembro desde</p>
                  <p className="text-sm text-gray-600">
                    {new Date(user.duenio?.createdAt || '').toLocaleDateString('es-AR')}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4 pt-6 border-t">
              <button
                type="button"
                onClick={() => router.push('/duenio/dashboard')}
                className="btn btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="btn btn-primary flex items-center"
              >
                {isSaving ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                ) : (
                  <Save className="w-5 h-5 mr-2" />
                )}
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 