'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { remiseriaService, duenioService } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { CreateRemiseriaData, Duenio } from '@/types';
import { Car, Building, ArrowLeft, Save, Users } from 'lucide-react';
import { useAppTracking } from '@/hooks/useAppTracking';

export default function NuevaRemiseriaPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [duenios, setDuenios] = useState<Duenio[]>([]);
  const [selectedDuenios, setSelectedDuenios] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateRemiseriaData>();

  useEffect(() => {
    if (!user || user.rol !== 'ADMIN') {
      router.push('/login');
      return;
    }

    loadDuenios();
  }, [user, router]);

  // Track page access
  useAppTracking('PAGE_ACCESS', { page: 'nueva-remiseria' });

  const loadDuenios = async () => {
    try {
      const response = await duenioService.getAll();
      if (response.success && response.data) {
        setDuenios(response.data);
      } else {
        toast.error('Error al cargar dueños');
      }
    } catch (error) {
      console.error('Error loading duenios:', error);
      toast.error('Error al cargar dueños');
    }
  };

  const onSubmit = async (data: CreateRemiseriaData) => {
    setIsLoading(true);
    try {
      const remiseriaData = {
        ...data,
        duenioIds: selectedDuenios
      };

      const response = await remiseriaService.create(remiseriaData);
      
      if (response.success && response.data) {
        toast.success('Remisería creada exitosamente');
        router.push('/admin/remiserias');
      } else {
        toast.error(response.message || 'Error al crear remisería');
      }
    } catch (error: any) {
      console.error('Error creating remiseria:', error);
      toast.error(error.response?.data?.message || 'Error al crear remisería');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDuenioToggle = (duenioId: string) => {
    setSelectedDuenios(prev => 
      prev.includes(duenioId)
        ? prev.filter(id => id !== duenioId)
        : [...prev, duenioId]
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/admin/dashboard')}
                className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Volver
              </button>
              <Building className="w-8 h-8 text-primary-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Nueva Remisería</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card p-8">
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
                <label htmlFor="cuit" className="block text-sm font-medium text-gray-700 mb-2">
                  CUIT/CUIL *
                </label>
                <input
                  {...register('cuit', {
                    required: 'El CUIT/CUIL es requerido',
                    pattern: {
                      value: /^[0-9]{2}-[0-9]{8}-[0-9]$/,
                      message: 'Formato de CUIT/CUIL inválido (XX-XXXXXXXX-X)',
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Dueños Asociados
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {duenios.map((duenio) => (
                  <div
                    key={duenio.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedDuenios.includes(duenio.id)
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleDuenioToggle(duenio.id)}
                  >
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedDuenios.includes(duenio.id)}
                        onChange={() => handleDuenioToggle(duenio.id)}
                        className="mr-3"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{duenio.nombre}</p>
                        <p className="text-sm text-gray-600">{duenio.telefono}</p>
                        <p className="text-xs text-gray-500">{duenio.user?.email}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {duenios.length === 0 && (
                <p className="text-gray-500 text-center py-4">
                  No hay dueños disponibles. 
                  <button
                    type="button"
                    onClick={() => router.push('/admin/duenios/nuevo')}
                    className="text-primary-600 hover:text-primary-700 ml-1"
                  >
                    Crear uno nuevo
                  </button>
                </p>
              )}
            </div>

            <div className="flex justify-end space-x-4 pt-6 border-t">
              <button
                type="button"
                onClick={() => router.push('/admin/dashboard')}
                className="btn btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary flex items-center"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                ) : (
                  <Save className="w-5 h-5 mr-2" />
                )}
                Crear Remisería
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 