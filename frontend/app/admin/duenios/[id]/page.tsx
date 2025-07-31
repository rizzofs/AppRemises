'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import { duenioService, remiseriaService } from '@/lib/api';
import { Duenio, Remiseria, UpdateDuenioData } from '@/types';
import { Users, ArrowLeft, Save, Building } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Props {
  params: {
    id: string;
  };
}

export default function EditarDuenioPage({ params }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [duenio, setDuenio] = useState<Duenio | null>(null);
  const [remiserias, setRemiserias] = useState<Remiseria[]>([]);
  const [selectedRemiserias, setSelectedRemiserias] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UpdateDuenioData>();

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
      const [duenioResponse, remiseriasResponse] = await Promise.all([
        duenioService.getById(params.id),
        remiseriaService.getAll()
      ]);

      if (duenioResponse.success && duenioResponse.data) {
        setDuenio(duenioResponse.data);
        const currentRemiserias = duenioResponse.data.remiserias?.map(r => r.remiseriaId) || [];
        setSelectedRemiserias(currentRemiserias);
        
        reset({
          nombre: duenioResponse.data.nombre,
          telefono: duenioResponse.data.telefono,
          dni: duenioResponse.data.dni,
          activo: duenioResponse.data.user?.activo
        });
      } else {
        toast.error('Error al cargar dueño');
        router.push('/admin/duenios');
      }

      if (remiseriasResponse.success && remiseriasResponse.data) {
        setRemiserias(remiseriasResponse.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
      router.push('/admin/duenios');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: UpdateDuenioData) => {
    setIsSaving(true);
    try {
      const response = await duenioService.update(params.id, {
        ...data,
        remiseriaIds: selectedRemiserias
      });
      
      if (response.success) {
        toast.success('Dueño actualizado exitosamente');
        router.push('/admin/duenios');
      } else {
        toast.error(response.message || 'Error al actualizar dueño');
      }
    } catch (error) {
      console.error('Error updating duenio:', error);
      toast.error('Error al actualizar dueño');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemiseriaToggle = (remiseriaId: string) => {
    setSelectedRemiserias(prev => 
      prev.includes(remiseriaId)
        ? prev.filter(id => id !== remiseriaId)
        : [...prev, remiseriaId]
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!duenio) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Dueño no encontrado</h3>
          <button
            onClick={() => router.push('/admin/duenios')}
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
                onClick={() => router.push('/admin/duenios')}
                className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Volver
              </button>
              <Users className="w-8 h-8 text-green-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Editar Dueño</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {duenio.nombre}
            </h2>
            <p className="text-gray-600">
              Edita la información del dueño
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre Completo *
                </label>
                <input
                  {...register('nombre', {
                    required: 'El nombre es requerido',
                    minLength: {
                      value: 2,
                      message: 'El nombre debe tener al menos 2 caracteres',
                    },
                  })}
                  type="text"
                  id="nombre"
                  className="input"
                  placeholder="Ej: Juan Pérez"
                />
                {errors.nombre && (
                  <p className="mt-1 text-sm text-red-600">{errors.nombre.message}</p>
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

              <div>
                <label htmlFor="dni" className="block text-sm font-medium text-gray-700 mb-2">
                  DNI *
                </label>
                <input
                  {...register('dni', {
                    required: 'El DNI es requerido',
                    pattern: {
                      value: /^\d{7,8}$/,
                      message: 'El DNI debe tener 7 u 8 dígitos',
                    },
                  })}
                  type="text"
                  id="dni"
                  className="input"
                  placeholder="12345678"
                />
                {errors.dni && (
                  <p className="mt-1 text-sm text-red-600">{errors.dni.message}</p>
                )}
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
                  defaultValue={duenio.user?.email}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <input
                {...register('activo')}
                type="checkbox"
                id="activo"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="activo" className="text-sm font-medium text-gray-700">
                Usuario activo
              </label>
            </div>

            {/* Remiserías asociadas */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Building className="w-5 h-5 mr-2" />
                Remiserías Asociadas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {remiserias.map((remiseria) => (
                  <div key={remiseria.id} className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id={`remiseria-${remiseria.id}`}
                      checked={selectedRemiserias.includes(remiseria.id)}
                      onChange={() => handleRemiseriaToggle(remiseria.id)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor={`remiseria-${remiseria.id}`} className="text-sm text-gray-700">
                      {remiseria.nombreFantasia} ({remiseria.razonSocial})
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-4 pt-6 border-t">
              <button
                type="button"
                onClick={() => router.push('/admin/duenios')}
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