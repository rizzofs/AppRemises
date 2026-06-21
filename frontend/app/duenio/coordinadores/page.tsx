'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { coordinadorService, remiseriaService } from '@/lib/api';
import { Coordinador, CreateCoordinadorData, Remiseria } from '@/types';
import { Users, Plus, Edit, Trash2, Eye, EyeOff, Search, Filter, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CoordinadoresPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [coordinadores, setCoordinadores] = useState<Coordinador[]>([]);
  const [remiserias, setRemiserias] = useState<Remiseria[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCoordinador, setSelectedCoordinador] = useState<Coordinador | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActivo, setFilterActivo] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterRemiseria, setFilterRemiseria] = useState<string>('all');
  const [showPassword, setShowPassword] = useState(false);

  // Formulario de creación/edición
  const [formData, setFormData] = useState<CreateCoordinadorData>({
    nombre: '',
    email: '',
    password: '',
    remiseriaId: ''
  });

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadCoordinadores();
    loadRemiserias();
  }, [user]);

  const loadCoordinadores = async () => {
    try {
      setLoading(true);
      const response = await coordinadorService.getAll();
      if (response.success) {
        setCoordinadores(response.data || []);
      } else {
        toast.error('Error al cargar coordinadores');
      }
    } catch (error) {
      console.error('Error loading coordinadores:', error);
      toast.error('Error al cargar coordinadores');
    } finally {
      setLoading(false);
    }
  };

  const loadRemiserias = async () => {
    try {
      const response = await remiseriaService.getAll();
      if (response.success) {
        setRemiserias(response.data || []);
      } else {
        toast.error('Error al cargar remiserías');
      }
    } catch (error) {
      console.error('Error loading remiserias:', error);
      toast.error('Error al cargar remiserías');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await coordinadorService.create(formData);
      if (response.success) {
        toast.success('Coordinador creado exitosamente');
        setShowCreateModal(false);
        setFormData({ nombre: '', email: '', password: '', remiseriaId: '' });
        loadCoordinadores();
      } else {
        toast.error(response.message || 'Error al crear coordinador');
      }
    } catch (error) {
      console.error('Error creating coordinador:', error);
      toast.error('Error al crear coordinador');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoordinador) return;

    try {
      const updateData = {
        nombre: formData.nombre,
        email: formData.email,
        ...(formData.password && { password: formData.password })
      };

      const response = await coordinadorService.update(selectedCoordinador.id, updateData);
      if (response.success) {
        toast.success('Coordinador actualizado exitosamente');
        setShowEditModal(false);
        setSelectedCoordinador(null);
        setFormData({ nombre: '', email: '', password: '', remiseriaId: '' });
        loadCoordinadores();
      } else {
        toast.error(response.message || 'Error al actualizar coordinador');
      }
    } catch (error) {
      console.error('Error updating coordinador:', error);
      toast.error('Error al actualizar coordinador');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este coordinador?')) return;

    try {
      const response = await coordinadorService.delete(id);
      if (response.success) {
        toast.success('Coordinador eliminado exitosamente');
        loadCoordinadores();
      } else {
        toast.error(response.message || 'Error al eliminar coordinador');
      }
    } catch (error) {
      console.error('Error deleting coordinador:', error);
      toast.error('Error al eliminar coordinador');
    }
  };

  const handleToggleStatus = async (id: string) => {
    try {
      const response = await coordinadorService.toggleStatus(id);
      if (response.success) {
        toast.success(response.data?.activo ? 'Coordinador activado' : 'Coordinador desactivado');
        loadCoordinadores();
      } else {
        toast.error(response.message || 'Error al cambiar estado');
      }
    } catch (error) {
      console.error('Error toggling coordinador status:', error);
      toast.error('Error al cambiar estado');
    }
  };

  const openEditModal = (coordinador: Coordinador) => {
    setSelectedCoordinador(coordinador);
    setFormData({
      nombre: coordinador.nombre,
      email: coordinador.email,
      password: '',
      remiseriaId: coordinador.remiseriaId
    });
    setShowEditModal(true);
  };

  const openCreateModal = () => {
    setFormData({ nombre: '', email: '', password: '', remiseriaId: '' });
    setShowCreateModal(true);
  };

  // Filtrar coordinadores
  const filteredCoordinadores = coordinadores.filter(coordinador => {
    const matchesSearch = coordinador.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         coordinador.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterActivo === 'all' || 
                         (filterActivo === 'active' && coordinador.activo) ||
                         (filterActivo === 'inactive' && !coordinador.activo);

    const matchesRemiseria = filterRemiseria === 'all' || coordinador.remiseriaId === filterRemiseria;
    
    return matchesSearch && matchesFilter && matchesRemiseria;
  });

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Coordinadores</h2>
          <p className="text-sm text-slate-500">Gestioná los coordinadores de tus remiserías.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn btn-primary shadow-md shadow-primary-500/20"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nuevo Coordinador
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              className="input pl-10 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={filterActivo}
            onChange={(e) => setFilterActivo(e.target.value as any)}
            className="input max-w-[200px] bg-white cursor-pointer"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Solo Activos</option>
            <option value="inactive">Solo Inactivos</option>
          </select>
          <select
            value={filterRemiseria}
            onChange={(e) => setFilterRemiseria(e.target.value)}
            className="input max-w-[200px] bg-white cursor-pointer"
          >
            <option value="all">Todas las remiserías</option>
            {remiserias.map(r => (
              <option key={r.id} value={r.id}>{r.nombreFantasia}</option>
            ))}
          </select>
        </div>

        {/* Lista de coordinadores */}
        {loading ? (
          <div className="text-center py-16">
            <div className="loading-spinner border-primary-500 mx-auto"></div>
            <p className="mt-4 text-slate-500">Cargando coordinadores...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {filteredCoordinadores.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm || filterActivo !== 'all' ? 'No se encontraron coordinadores' : 'No hay coordinadores'}
                </h3>
                <p className="text-gray-600">
                  {searchTerm || filterActivo !== 'all' 
                    ? 'Intenta ajustar los filtros de búsqueda' 
                    : 'Comienza creando tu primer coordinador'}
                </p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Coordinador</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Remisería</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Alta</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredCoordinadores.map((coordinador) => (
                    <tr key={coordinador.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                            {coordinador.nombre.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-semibold text-slate-900">{coordinador.nombre}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {coordinador.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {coordinador.remiseria?.nombreFantasia || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full border ${
                          coordinador.activo
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {coordinador.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {new Date(coordinador.createdAt).toLocaleDateString()}
                      </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => handleToggleStatus(coordinador.id)}
                              className="text-blue-600 hover:text-blue-900"
                              title={coordinador.activo ? 'Desactivar' : 'Activar'}
                            >
                              {coordinador.activo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => openEditModal(coordinador)}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(coordinador.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            )}
          </div>
        )}
      </div>

      {/* Modal de Creación */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Crear Nuevo Coordinador</h3>
              <form onSubmit={handleCreate}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre Completo
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contraseña
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Remisería
                    </label>
                    <select
                      required
                      value={formData.remiseriaId}
                      onChange={(e) => setFormData({ ...formData, remiseriaId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Seleccionar remisería</option>
                      {remiserias.map(remiseria => (
                        <option key={remiseria.id} value={remiseria.id}>
                          {remiseria.nombreFantasia}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                                 <div className="flex justify-end space-x-3 mt-6">
                   <button
                     type="button"
                     onClick={() => setShowCreateModal(false)}
                     className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                   >
                     Cancelar
                   </button>
                   <button 
                     type="submit" 
                     className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
                   >
                     Crear Coordinador
                   </button>
                 </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edición */}
      {showEditModal && selectedCoordinador && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Editar Coordinador</h3>
              <form onSubmit={handleEdit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre Completo
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nueva Contraseña (opcional)
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Dejar vacío para mantener la actual"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                                 <div className="flex justify-end space-x-3 mt-6">
                   <button
                     type="button"
                     onClick={() => setShowEditModal(false)}
                     className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                   >
                     Cancelar
                   </button>
                   <button 
                     type="submit" 
                     className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
                   >
                     Actualizar Coordinador
                   </button>
                 </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 