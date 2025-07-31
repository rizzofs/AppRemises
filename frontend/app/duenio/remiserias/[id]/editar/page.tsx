'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import { remiseriaService } from '@/lib/api';
import { Remiseria, UpdateRemiseriaData } from '@/types';
import { Building, ArrowLeft, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function EditarRemiseriaPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const remiseriaId = params.id as string;
  
  const [remiseria, setRemiseria] = useState<Remiseria | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
  }, [user, router, remiseriaId]);

  const loadRemiseria = async () => {
    try {
      setLoading(true);
      const response = await remiseriaService.getById(remiseriaId);
      
      if (response.success && response.data) {
        // Verificar que el dueño tenga acceso a esta remisería
        const hasAccess = response.data.duenios?.some(
          duenio => duenio.duenioId === user?.duenio?.id
        );
        
        if (!hasAccess) {
          toast.error('No tienes acceso a esta remisería');
          router.push('/duenio/dashboard');
          return;
        }
        
        setRemiseria(response.data);
        // Prellenar el formulario
        reset({
          nombreFantasia: response.data.nombreFantasia,
          razonSocial: response.data.razonSocial,
          direccion: response.data.direccion,
          telefono: response.data.telefono,
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
      setLoading(false);
    }
  };

  const onSubmit = async (data: UpdateRemiseriaData) => {
    setIsSaving(true);
    try {
      const response = await remiseriaService.update(remiseriaId, data);
      
      if (response.success && response.data) {
        toast.success('Remisería actualizada exitosamente');
        router.push(`/duenio/remiserias/${remiseriaId}`);
      } else {
        toast.error(response.message || 'Error al actualizar remisería');
      }
    } catch (error: any) {
      console.error('Error updating remiseria:', error);
      toast.error(error.response?.data?.message || 'Error al actualizar remisería');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
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
            Volver al Dashboard
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
                onClick={() => router.push(`/duenio/remiserias/${remiseriaId}`)}
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
              Edita la información básica de tu remisería
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="nombreFantasia" className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de Fantasía *
                </label>
                <input
                  {...register('nombreFantasia', {
                    required: 'El nombre de fantasía es requerido',
                    minLength: {
                      value: 2,
                      message: 'El nombre debe tener al menos 2 caracteres',
                    },
                  })}
                  type="text"
                  id="nombreFantasia"
                  className="input"
                  placeholder="Ej: Remises del Centro"
                />
                {errors.nombreFantasia && (
                  <p className="mt-1 text-sm text-red-600">{errors.nombreFantasia.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="razonSocial" className="block text-sm font-medium text-gray-700 mb-2">
                  Razón Social *
                </label>
                <input
                  {...register('razonSocial', {
                    required: 'La razón social es requerida',
                    minLength: {
                      value: 2,
                      message: 'La razón social debe tener al menos 2 caracteres',
                    },
                  })}
                  type="text"
                  id="razonSocial"
                  className="input"
                  placeholder="Ej: Remises del Centro S.A."
                />
                {errors.razonSocial && (
                  <p className="mt-1 text-sm text-red-600">{errors.razonSocial.message}</p>
                )}
              </div>

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
                  placeholder="Ej: Av. San Martín 1234"
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
            </div>

            {/* Información de solo lectura */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Información del Sistema</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">Estado</p>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      remiseria.estado
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {remiseria.estado ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">ID de Remisería</p>
                  <p className="text-sm text-gray-600 font-mono">{remiseria.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Fecha de Creación</p>
                  <p className="text-sm text-gray-600">
                    {new Date(remiseria.createdAt).toLocaleDateString('es-AR')}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Dueños Asociados</p>
                  <p className="text-sm text-gray-600">
                    {remiseria.duenios?.length || 0} dueño(s)
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                * Esta información es gestionada por el administrador del sistema
              </p>
            </div>

            <div className="flex justify-end space-x-4 pt-6 border-t">
              <button
                type="button"
                onClick={() => router.push(`/duenio/remiserias/${remiseriaId}`)}
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