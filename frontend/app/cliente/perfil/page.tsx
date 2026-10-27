'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTracking } from '@/hooks/useAppTracking';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import ThemeToggle from '@/components/ThemeToggle';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Edit, 
  Save, 
  X,
  ArrowLeft,
  Moon
} from 'lucide-react';
import Link from 'next/link';

interface ProfileFormData {
  nombre: string;
  apellido: string;
  telefono: string;
  direccion: string;
  genero: string;
}

export default function ClientePerfilPage() {
  const { user } = useAuth();
  useAppTracking('CLIENTE_PROFILE_ACCESS');
  
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<ProfileFormData>();

  useEffect(() => {
    if (user?.cliente) {
      reset({
        nombre: user.cliente.nombre,
        apellido: user.cliente.apellido,
        telefono: user.cliente.telefono,
        direccion: user.cliente.direccion,
        genero: user.cliente.genero || ''
      });
    }
  }, [user, reset]);

  const onSubmit = async (data: ProfileFormData) => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/cliente/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Perfil actualizado exitosamente');
        setIsEditing(false);
      } else {
        toast.error(result.error || 'Error al actualizar el perfil');
      }
    } catch (error) {
      console.error('Error actualizando perfil:', error);
      toast.error('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    reset();
    setIsEditing(false);
  };

  const getGeneroText = (genero?: string) => {
    switch (genero) {
      case 'M':
        return 'Masculino';
      case 'F':
        return 'Femenino';
      case 'O':
        return 'Otro';
      default:
        return 'No especificado';
    }
  };

  if (!user?.cliente) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-slate-400">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 transition-colors">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 shadow-sm border-b border-gray-200 dark:border-slate-800 transition-colors">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-3">
              <Link 
                href="/cliente/app"
                className="p-2 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Mi Perfil</h1>
                <p className="text-sm text-gray-600 dark:text-slate-400">Gestiona tu información personal</p>
              </div>
            </div>
            
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 dark:bg-primary-600 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-primary-700 transition-colors"
              >
                <Edit className="h-4 w-4" />
                <span>Editar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Tarjeta de Preferencias de Tema / Modo Oscuro */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 p-6 transition-colors">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="p-2 rounded-xl bg-primary-50 dark:bg-slate-800 text-primary-600 dark:text-primary-400">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Apariencia y Modo Oscuro</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Selecciona cómo deseas ver la aplicación
              </p>
            </div>
          </div>
          <ThemeToggle variant="inline" />
        </div>

        {/* Información personal */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 transition-colors">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Información Personal</h2>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
            {/* Información básica */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Nombre
                </label>
                <div className="relative">
                  <input
                    {...register('nombre', { required: 'El nombre es requerido' })}
                    type="text"
                    disabled={!isEditing}
                    className={`w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      !isEditing 
                        ? 'bg-gray-50 dark:bg-slate-800/60 text-gray-500 dark:text-slate-400' 
                        : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white'
                    }`}
                  />
                  <User className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 dark:text-slate-500" />
                </div>
                {errors.nombre && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.nombre.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Apellido
                </label>
                <div className="relative">
                  <input
                    {...register('apellido', { required: 'El apellido es requerido' })}
                    type="text"
                    disabled={!isEditing}
                    className={`w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      !isEditing 
                        ? 'bg-gray-50 dark:bg-slate-800/60 text-gray-500 dark:text-slate-400' 
                        : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white'
                    }`}
                  />
                  <User className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 dark:text-slate-500" />
                </div>
                {errors.apellido && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.apellido.message}</p>
                )}
              </div>
            </div>

            {/* Información de contacto */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={user.cliente.email}
                    disabled
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800/60 text-gray-500 dark:text-slate-400"
                  />
                  <Mail className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 dark:text-slate-500" />
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">El email no se puede modificar</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Teléfono
                </label>
                <div className="relative">
                  <input
                    {...register('telefono', { required: 'El teléfono es requerido' })}
                    type="tel"
                    disabled={!isEditing}
                    className={`w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      !isEditing 
                        ? 'bg-gray-50 dark:bg-slate-800/60 text-gray-500 dark:text-slate-400' 
                        : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white'
                    }`}
                  />
                  <Phone className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 dark:text-slate-500" />
                </div>
                {errors.telefono && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.telefono.message}</p>
                )}
              </div>
            </div>

            {/* Dirección */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Dirección
              </label>
              <div className="relative">
                <input
                  {...register('direccion', { required: 'La dirección es requerida' })}
                  type="text"
                  disabled={!isEditing}
                  className={`w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    !isEditing 
                      ? 'bg-gray-50 dark:bg-slate-800/60 text-gray-500 dark:text-slate-400' 
                      : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white'
                  }`}
                />
                <MapPin className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 dark:text-slate-500" />
              </div>
              {errors.direccion && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.direccion.message}</p>
              )}
            </div>

            {/* Información adicional */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  DNI
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={user.cliente.dni}
                    disabled
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800/60 text-gray-500 dark:text-slate-400"
                  />
                  <User className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 dark:text-slate-500" />
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">El DNI no se puede modificar</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Fecha de Nacimiento
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={new Date(user.cliente.fechaNacimiento).toLocaleDateString()}
                    disabled
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800/60 text-gray-500 dark:text-slate-400"
                  />
                  <Calendar className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 dark:text-slate-500" />
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">La fecha de nacimiento no se puede modificar</p>
              </div>
            </div>

            {/* Género */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Género
              </label>
              {isEditing ? (
                <select
                  {...register('genero')}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                >
                  <option value="">Seleccionar</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="O">Otro</option>
                </select>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={getGeneroText(user.cliente.genero)}
                    disabled
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800/60 text-gray-500 dark:text-slate-400"
                  />
                  <User className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 dark:text-slate-500" />
                </div>
              )}
            </div>

            {/* Botones de acción */}
            {isEditing && (
              <div className="flex space-x-4 pt-6 border-t border-gray-200 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-blue-600 dark:bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <Save className="h-4 w-4" />
                  <span>{isLoading ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 bg-gray-600 dark:bg-slate-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 dark:hover:bg-slate-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <X className="h-4 w-4" />
                  <span>Cancelar</span>
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Información adicional */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 p-4 transition-colors">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-blue-100 dark:bg-blue-950/60 rounded-full flex items-center justify-center">
                <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Miembro desde</h3>
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  {new Date(user.cliente.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 p-4 transition-colors">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-green-100 dark:bg-green-950/60 rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Estado</h3>
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  {user.cliente.activo ? 'Activo' : 'Inactivo'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 p-4 transition-colors">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-purple-100 dark:bg-purple-950/60 rounded-full flex items-center justify-center">
                <Mail className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Email verificado</h3>
                <p className="text-sm text-gray-600 dark:text-slate-400">Sí</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
