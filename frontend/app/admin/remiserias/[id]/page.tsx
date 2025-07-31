'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import { remiseriaService, duenioService } from '@/lib/api';
import { Remiseria, Duenio, UpdateRemiseriaData } from '@/types';
import { Building, ArrowLeft, Save, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Props {
  params: {
    id: string;
  };
}

export default function EditarRemiseriaPage({ params }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [remiseria, setRemiseria] = useState<Remiseria | null>(null);
  const [duenios, setDuenios] = useState<Duenio[]>([]);
  const [selectedDuenios, setSelectedDuenios] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UpdateRemiseriaData>();

  useEffect(() => {
    if (!user || user.rol !== 'ADMIN') {
      router.push('/login');
      return;
    }

    loadData();
  }, [user, router, params.id]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [remiseriaResponse, dueniosResponse] = await Promise.all([
        remiseriaService.getById(params.id),
        duenioService.getAll()
      ]);

      if (remiseriaResponse.success && remiseriaResponse.data) {
        setRemiseria(remiseriaResponse.data);
        const currentDuenios = remiseriaResponse.data.duenios?.map(d => d.duenioId) || [];
        setSelectedDuenios(currentDuenios);
        
        reset({
          nombreFantasia: remiseriaResponse.data.nombreFantasia,
          razonSocial: remiseriaResponse.data.razonSocial,
          cuit: remiseriaResponse.data.cuit,
          direccion: remiseriaResponse.data.direccion,
          telefono: remiseriaResponse.data.telefono,
          estado: remiseriaResponse.data.estado
        });
      } else {
        toast.error('Error al cargar remisería');
        router.push('/admin/remiserias');
      }

      if (dueniosResponse.success && dueniosResponse.data) {
        setDuenios(dueniosResponse.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
      router.push('/admin/remiserias');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: UpdateRemiseriaData) => {
    setIsSaving(true);
    try {
      const response = await remiseriaService.update(params.id, {
        ...data,
        duenioIds: selectedDuenios
      });
      
      if (response.success) {
        toast.success('Remisería actualizada exitosamente');
        router.push('/admin/remiserias');
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

  const handleDuenioToggle = (duenioId: string) => {
    setSelectedDuenios(prev => 
      prev.includes(duenioId)
        ? prev.filter(id => id !== duenioId)
        : [...prev, duenioId]
    );
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
            onClick={() => router.push('/admin/remiserias')}
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
                onClick={() => router.push('/admin/remiserias')}
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
              Edita la información de la remisería
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
                  placeholder="Ej: Remises Express"
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
                  placeholder="Ej: Remises Express S.A."
                />
                {errors.razonSocial && (
                  <p className="mt-1 text-sm text-red-600">{errors.razonSocial.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="cuit" className="block text-sm font-medium text-gray-700 mb-2">
                  CUIT/CUIL *
                </label>
                <input
                  {...register('cuit', {
                    required: 'El CUIT/CUIL es requerido',
                    pattern: {
                      value: /^\d{2}-\d{8}-\d{1}$/,
                      message: 'Formato inválido (XX-XXXXXXXX-X)',
                    },
                  })}
                  type="text"
                  id="cuit"
                  className="input"
                  placeholder="20-12345678-9"
                />
                {errors.cuit && (
                  <p className="mt-1 text-sm text-red-600">{errors.cuit.message}</p>
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

              <div className="md:col-span-2">
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
            </div>

            <div className="flex items-center space-x-3">
              <input
                {...register('estado')}
                type="checkbox"
                id="estado"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="estado" className="text-sm font-medium text-gray-700">
                Remisería activa
              </label>
            </div>

            {/* Dueños asociados */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Dueños Asociados
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {duenios.map((duenio) => (
                  <div key={duenio.id} className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id={`duenio-${duenio.id}`}
                      checked={selectedDuenios.includes(duenio.id)}
                      onChange={() => handleDuenioToggle(duenio.id)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor={`duenio-${duenio.id}`} className="text-sm text-gray-700">
                      {duenio.nombre} ({duenio.user?.email})
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-4 pt-6 border-t">
              <button
                type="button"
                onClick={() => router.push('/admin/remiserias')}
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