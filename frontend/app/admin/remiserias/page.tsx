'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { remiseriaService } from '@/lib/api';
import { Remiseria } from '@/types';
import { Building, ArrowLeft, Plus, Edit, Trash2, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function RemiseriasPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [remiserias, setRemiserias] = useState<Remiseria[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.rol !== 'ADMIN') {
      router.push('/login');
      return;
    }

    loadRemiserias();
  }, [user, router]);

  const loadRemiserias = async () => {
    try {
      setLoading(true);
      const response = await remiseriaService.getAll();
      
      if (response.success && response.data) {
        setRemiserias(response.data);
      } else {
        toast.error('Error al cargar remiserías');
      }
    } catch (error) {
      console.error('Error loading remiserias:', error);
      toast.error('Error al cargar remiserías');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta remisería?')) {
      return;
    }

    try {
      const response = await remiseriaService.delete(id);
      
      if (response.success) {
        toast.success('Remisería eliminada exitosamente');
        loadRemiserias();
      } else {
        toast.error(response.message || 'Error al eliminar remisería');
      }
    } catch (error) {
      console.error('Error deleting remiseria:', error);
      toast.error('Error al eliminar remisería');
    }
  };

  const handleToggleStatus = async (id: string) => {
    try {
      const remiseria = remiserias.find(r => r.id === id);
      if (!remiseria) return;

      const response = await remiseriaService.update(id, {
        estado: !remiseria.estado
      });
      
      if (response.success) {
        toast.success(`Remisería ${remiseria.estado ? 'desactivada' : 'activada'} exitosamente`);
        loadRemiserias();
      } else {
        toast.error(response.message || 'Error al cambiar estado');
      }
    } catch (error) {
      console.error('Error toggling remiseria status:', error);
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
              <Building className="w-8 h-8 text-primary-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Gestionar Remiserías</h1>
            </div>
            <button
              onClick={() => router.push('/admin/remiserias/nueva')}
              className="btn btn-primary flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Remisería
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {remiserias.length === 0 ? (
          <div className="text-center py-12">
            <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay remiserías</h3>
            <p className="text-gray-600 mb-6">Comienza creando tu primera remisería</p>
            <button
              onClick={() => router.push('/admin/remiserias/nueva')}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear Remisería
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {remiserias.map((remiseria) => (
              <div key={remiseria.id} className="card">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {remiseria.nombreFantasia}
                      </h3>
                      <p className="text-sm text-gray-600">{remiseria.razonSocial}</p>
                    </div>
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

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Building className="w-4 h-4 mr-2" />
                      {remiseria.direccion}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Eye className="w-4 h-4 mr-2" />
                      {remiseria.duenios?.length || 0} dueños asociados
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleToggleStatus(remiseria.id)}
                      className={`btn btn-sm ${
                        remiseria.estado ? 'btn-secondary' : 'btn-primary'
                      }`}
                    >
                      {remiseria.estado ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => router.push(`/admin/remiserias/${remiseria.id}`)}
                      className="btn btn-sm btn-secondary"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(remiseria.id)}
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