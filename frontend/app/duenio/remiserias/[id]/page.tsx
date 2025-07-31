'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import { remiseriaService } from '@/lib/api';
import { Remiseria, UpdateRemiseriaData } from '@/types';
import { Building, ArrowLeft, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Props {
  params: {
    id: string;
  };
}

export default function EditarRemiseriaDuenioPage({ params }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [remiseria, setRemiseria] = useState<Remiseria | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UpdateRemiseriaData>();

  useEffect(() => {
    if (!user || user.rol !== 'DUENIO') {
      router.push('/login');
      return;
    }

    loadRemiseria();
  }, [user, router, params.id]);

  const loadRemiseria = async () => {
    try {
      setIsLoading(true);
      const response = await remiseriaService.getById(params.id);
      
      if (response.success && response.data) {
        // Verificar que el dueño tiene acceso a esta remisería
        const hasAccess = response.data.duenios?.some(d => d.duenioId === user.duenio?.id);
        
        if (!hasAccess) {
          toast.error('No tienes permisos para editar esta remisería');
          router.push('/duenio/dashboard');
          return;
        }

        setRemiseria(response.data);
        reset({
          direccion: response.data.direccion,
          telefono: response.data.telefono
        });
      } else {
        toast.error('Error al cargar remisería');
        router.push('/duenio/dashboard');
      }
    } catch (error) {
      console.error('Error loading remiseria:', error);
      toast.error('Error al cargar remisería');
      router.push('/duenio/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: UpdateRemiseriaData) => {
    setIsSaving(true);
    try {
      const response = await remiseriaService.update(params.id, data);
      
      if (response.success) {
        toast.success('Remisería actualizada exitosamente');
        router.push('/duenio/dashboard');
      } else {
        toast.error(response.message || 'Error al actualizar remisería');
      }
    } catch (error) {
      console.error('Error updating remiseria:', error);
      toast.error('Error al actualizar remisería');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!remiseria) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Remisería no encontrada</h3>
          <button
            onClick={() => router.push('/duenio/dashboard')}
            className="btn btn-primary"
          >
            Volver
          </button>
        </div>
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
              <Building className="w-8 h-8 text-primary-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Editar Remisería</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {remiseria.nombreFantasia}
            </h2>
            <p className="text-gray-600">
              Edita la información de contacto de la remisería
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Campos de solo lectura */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="nombreFantasia" className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de Fantasía
                </label>
                <input
                  type="text"
                  id="nombreFantasia"
                  className="input bg-gray-100"
                  value={remiseria.nombreFantasia}
                  disabled
                />
                <p className="mt-1 text-xs text-gray-500">
                  Solo el administrador puede modificar este campo
                </p>
              </div>

              <div>
                <label htmlFor="razonSocial" className="block text-sm font-medium text-gray-700 mb-2">
                  Razón Social
                </label>
                <input
                  type="text"
                  id="razonSocial"
                  className="input bg-gray-100"
                  value={remiseria.razonSocial}
                  disabled
                />
                <p className="mt-1 text-xs text-gray-500">
                  Solo el administrador puede modificar este campo
                </p>
              </div>

              <div>
                <label htmlFor="cuit" className="block text-sm font-medium text-gray-700 mb-2">
                  CUIT/CUIL
                </label>
                <input
                  type="text"
                  id="cuit"
                  className="input bg-gray-100"
                  value={remiseria.cuit}
                  disabled
                />
                <p className="mt-1 text-xs text-gray-500">
                  Solo el administrador puede modificar este campo
                </p>
              </div>

              <div>
                <label htmlFor="estado" className="block text-sm font-medium text-gray-700 mb-2">
                  Estado
                </label>
                <span
                  className={`px-3 py-2 text-sm font-medium rounded-md inline-block ${
                    remiseria.estado
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {remiseria.estado ? 'Activa' : 'Inactiva'}
                </span>
                <p className="mt-1 text-xs text-gray-500">
                  Solo el administrador puede modificar este campo
                </p>
              </div>
            </div>

            {/* Campos editables */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="direccion" className="block text-sm font-medium text-gray-700 mb-2">
                  Dirección *
                </label>
                <input
                  {...register('direccion', {
                    required: 'La dirección es requerida',
                    minLength: {
                      value: 5,
                      message: 'La dirección debe tener al menos 5 caracteres',
                    },
                  })}
                  type="text"
                  id="direccion"
                  className="input"
                  placeholder="Av. Corrientes 1234, CABA"
                />
                {errors.direccion && (
                  <p className="mt-1 text-sm text-red-600">{errors.direccion.message}</p>
                )}
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