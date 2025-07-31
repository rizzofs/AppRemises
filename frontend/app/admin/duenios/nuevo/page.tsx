'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { duenioService, remiseriaService } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { CreateDuenioData, Remiseria } from '@/types';
import { Users, ArrowLeft, Save, Building, Eye, EyeOff } from 'lucide-react';
import { useAppTracking } from '@/hooks/useAppTracking';

export default function NuevoDuenioPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [remiserias, setRemiserias] = useState<Remiseria[]>([]);
  const [selectedRemiserias, setSelectedRemiserias] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateDuenioData>();

  useEffect(() => {
    if (!user || user.rol !== 'ADMIN') {
      router.push('/login');
      return;
    }

    loadRemiserias();
  }, [user, router]);

  // Track page access
  useAppTracking('PAGE_ACCESS', { page: 'nuevo-duenio' });

  const loadRemiserias = async () => {
    try {
      const response = await remiseriaService.getAll();
      if (response.success && response.data) {
        setRemiserias(response.data);
      } else {
        toast.error('Error al cargar remiserías');
      }
    } catch (error) {
      console.error('Error loading remiserias:', error);
      toast.error('Error al cargar remiserías');
    }
  };

  const onSubmit = async (data: CreateDuenioData) => {
    setIsLoading(true);
    try {
      const duenioData = {
        ...data,
        remiseriaIds: selectedRemiserias
      };

      const response = await duenioService.create(duenioData);
      
      if (response.success && response.data) {
        toast.success('Dueño creado exitosamente');
        router.push('/admin/duenios');
      } else {
        toast.error(response.message || 'Error al crear dueño');
      }
    } catch (error: any) {
      console.error('Error creating duenio:', error);
      toast.error(error.response?.data?.message || 'Error al crear dueño');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemiseriaToggle = (remiseriaId: string) => {
    setSelectedRemiserias(prev => 
      prev.includes(remiseriaId)
        ? prev.filter(id => id !== remiseriaId)
        : [...prev, remiseriaId]
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
              <Users className="w-8 h-8 text-green-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Nuevo Dueño</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card p-8">
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
                <label htmlFor="dni" className="block text-sm font-medium text-gray-700 mb-2">
                  DNI *
                </label>
                <input
                  {...register('dni', {
                    required: 'El DNI es requerido',
                    pattern: {
                      value: /^[0-9]{7,8}$/,
                      message: 'DNI debe tener 7 u 8 dígitos',
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
                  Contraseña *
                </label>
                <div className="relative">
                  <input
                    {...register('password', {
                      required: 'La contraseña es requerida',
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
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Remiserías Asociadas
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {remiserias.map((remiseria) => (
                  <div
                    key={remiseria.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedRemiserias.includes(remiseria.id)
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleRemiseriaToggle(remiseria.id)}
                  >
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedRemiserias.includes(remiseria.id)}
                        onChange={() => handleRemiseriaToggle(remiseria.id)}
                        className="mr-3"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{remiseria.nombreFantasia}</p>
                        <p className="text-sm text-gray-600">{remiseria.razonSocial}</p>
                        <p className="text-xs text-gray-500">{remiseria.direccion}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {remiserias.length === 0 && (
                <p className="text-gray-500 text-center py-4">
                  No hay remiserías disponibles. 
                  <button
                    type="button"
                    onClick={() => router.push('/admin/remiserias/nueva')}
                    className="text-primary-600 hover:text-primary-700 ml-1"
                  >
                    Crear una nueva
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
                Crear Dueño
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 