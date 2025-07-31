'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { duenioService } from '@/lib/api';
import { Duenio } from '@/types';
import { Users, ArrowLeft, Plus, Edit, Trash2, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function DueniosPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [duenios, setDuenios] = useState<Duenio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.rol !== 'ADMIN') {
      router.push('/login');
      return;
    }

    loadDuenios();
  }, [user, router]);

  const loadDuenios = async () => {
    try {
      setLoading(true);
      const response = await duenioService.getAll();
      
      if (response.success && response.data) {
        setDuenios(response.data);
      } else {
        toast.error('Error al cargar dueños');
      }
    } catch (error) {
      console.error('Error loading duenios:', error);
      toast.error('Error al cargar dueños');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este dueño?')) {
      return;
    }

    try {
      const response = await duenioService.delete(id);
      
      if (response.success) {
        toast.success('Dueño eliminado exitosamente');
        loadDuenios();
      } else {
        toast.error(response.message || 'Error al eliminar dueño');
      }
    } catch (error) {
      console.error('Error deleting duenio:', error);
      toast.error('Error al eliminar dueño');
    }
  };

  const handleToggleStatus = async (id: string) => {
    try {
      const response = await duenioService.toggleStatus(id);
      
      if (response.success) {
        toast.success('Estado del dueño actualizado exitosamente');
        loadDuenios();
      } else {
        toast.error(response.message || 'Error al cambiar estado');
      }
    } catch (error) {
      console.error('Error toggling duenio status:', error);
      toast.error('Error al cambiar estado');
    }
  };

  if (loading) {
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
                onClick={() => router.push('/admin/dashboard')}
                className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Volver
              </button>
              <Users className="w-8 h-8 text-green-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Gestionar Dueños</h1>
            </div>
            <button
              onClick={() => router.push('/admin/duenios/nuevo')}
              className="btn btn-primary flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Dueño
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {duenios.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay dueños</h3>
            <p className="text-gray-600 mb-6">Comienza creando tu primer dueño</p>
            <button
              onClick={() => router.push('/admin/duenios/nuevo')}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear Dueño
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {duenios.map((duenio) => (
              <div key={duenio.id} className="card">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {duenio.nombre}
                      </h3>
                      <p className="text-sm text-gray-600">{duenio.user?.email}</p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        duenio.user?.activo
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {duenio.user?.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Users className="w-4 h-4 mr-2" />
                      {duenio.telefono}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Eye className="w-4 h-4 mr-2" />
                      {duenio.remiserias?.length || 0} remiserías asociadas
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleToggleStatus(duenio.id)}
                      className={`btn btn-sm ${
                        duenio.user?.activo ? 'btn-secondary' : 'btn-primary'
                      }`}
                    >
                      {duenio.user?.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => router.push(`/admin/duenios/${duenio.id}`)}
                      className="btn btn-sm btn-secondary"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(duenio.id)}
                      className="btn btn-sm btn-danger"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 