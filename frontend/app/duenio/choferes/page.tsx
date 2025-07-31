'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { choferService, remiseriaService, vehiculoService } from '@/lib/api';
import { Chofer, CreateChoferData, Remiseria, Vehiculo } from '@/types';
import { Truck, Plus, Edit, Trash2, Eye, EyeOff, Search, Filter, ArrowLeft, User, Calendar, Phone, Mail, MapPin, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ChoferesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [choferes, setChoferes] = useState<Chofer[]>([]);
  const [remiserias, setRemiserias] = useState<Remiseria[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedChofer, setSelectedChofer] = useState<Chofer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState<'all' | 'ACTIVO' | 'SUSPENDIDO' | 'DADO_DE_BAJA'>('all');

  // Formulario de creación/edición
  const [formData, setFormData] = useState<CreateChoferData>({
    numeroChofer: '',
    nombre: '',
    apellido: '',
    dni: '',
    telefono: '',
    email: '',
    direccion: '',
    categoriaLicencia: '',
    vtoLicencia: '',
    remiseriaId: '',
    vehiculoId: ''
  });

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadChoferes();
    loadRemiserias();
    loadVehiculos();
  }, [user]);

  const loadChoferes = async () => {
    try {
      setLoading(true);
      const response = await choferService.getAll();
      if (response.success) {
        setChoferes(response.data || []);
      } else {
        toast.error('Error al cargar choferes');
      }
    } catch (error) {
      console.error('Error loading choferes:', error);
      toast.error('Error al cargar choferes');
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

  const loadVehiculos = async () => {
    try {
      const response = await vehiculoService.getAll();
      if (response.success) {
        setVehiculos(response.data || []);
      } else {
        toast.error('Error al cargar vehículos');
      }
    } catch (error) {
      console.error('Error loading vehiculos:', error);
      toast.error('Error al cargar vehículos');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await choferService.create(formData);
      if (response.success) {
        toast.success('Chofer creado exitosamente');
        setShowCreateModal(false);
        setFormData({
          numeroChofer: '',
          nombre: '',
          apellido: '',
          dni: '',
          telefono: '',
          email: '',
          direccion: '',
          categoriaLicencia: '',
          vtoLicencia: '',
          remiseriaId: '',
          vehiculoId: ''
        });
        loadChoferes();
      } else {
        toast.error(response.message || 'Error al crear chofer');
      }
    } catch (error) {
      console.error('Error creating chofer:', error);
      toast.error('Error al crear chofer');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChofer) return;

    try {
      const updateData = {
        numeroChofer: formData.numeroChofer,
        nombre: formData.nombre,
        apellido: formData.apellido,
        dni: formData.dni,
        telefono: formData.telefono,
        email: formData.email,
        direccion: formData.direccion,
        categoriaLicencia: formData.categoriaLicencia,
        vtoLicencia: formData.vtoLicencia,
        vehiculoId: formData.vehiculoId
      };

      const response = await choferService.update(selectedChofer.id, updateData);
      if (response.success) {
        toast.success('Chofer actualizado exitosamente');
        setShowEditModal(false);
        setSelectedChofer(null);
        setFormData({
          numeroChofer: '',
          nombre: '',
          apellido: '',
          dni: '',
          telefono: '',
          email: '',
          direccion: '',
          categoriaLicencia: '',
          vtoLicencia: '',
          remiseriaId: '',
          vehiculoId: ''
        });
        loadChoferes();
      } else {
        toast.error(response.message || 'Error al actualizar chofer');
      }
    } catch (error) {
      console.error('Error updating chofer:', error);
      toast.error('Error al actualizar chofer');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este chofer?')) return;

    try {
      const response = await choferService.delete(id);
      if (response.success) {
        toast.success('Chofer eliminado exitosamente');
        loadChoferes();
      } else {
        toast.error(response.message || 'Error al eliminar chofer');
      }
    } catch (error) {
      console.error('Error deleting chofer:', error);
      toast.error('Error al eliminar chofer');
    }
  };

  const handleToggleStatus = async (id: string) => {
    try {
      const response = await choferService.toggleStatus(id);
      if (response.success) {
        toast.success(response.message || 'Estado cambiado exitosamente');
        loadChoferes();
      } else {
        toast.error(response.message || 'Error al cambiar estado');
      }
    } catch (error) {
      console.error('Error toggling chofer status:', error);
      toast.error('Error al cambiar estado');
    }
  };

  const openEditModal = (chofer: Chofer) => {
    setSelectedChofer(chofer);
    setFormData({
      numeroChofer: chofer.numeroChofer,
      nombre: chofer.nombre,
      apellido: chofer.apellido,
      dni: chofer.dni,
      telefono: chofer.telefono,
      email: chofer.email || '',
      direccion: chofer.direccion || '',
      categoriaLicencia: chofer.categoriaLicencia,
      vtoLicencia: chofer.vtoLicencia,
      remiseriaId: chofer.remiseriaId,
      vehiculoId: chofer.vehiculoId || ''
    });
    setShowEditModal(true);
  };

  const openCreateModal = () => {
    setFormData({
      numeroChofer: '',
      nombre: '',
      apellido: '',
      dni: '',
      telefono: '',
      email: '',
      direccion: '',
      categoriaLicencia: '',
      vtoLicencia: '',
      remiseriaId: '',
      vehiculoId: ''
    });
    setShowCreateModal(true);
  };

  // Filtrar choferes
  const filteredChoferes = choferes.filter(chofer => {
    const matchesSearch = 
      chofer.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chofer.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chofer.numeroChofer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chofer.dni.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterEstado === 'all' || chofer.estado === filterEstado;
    
    return matchesSearch && matchesFilter;
  });

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'ACTIVO':
        return 'bg-green-100 text-green-800';
      case 'SUSPENDIDO':
        return 'bg-yellow-100 text-yellow-800';
      case 'DADO_DE_BAJA':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEstadoText = (estado: string) => {
    switch (estado) {
      case 'ACTIVO':
        return 'Activo';
      case 'SUSPENDIDO':
        return 'Suspendido';
      case 'DADO_DE_BAJA':
        return 'Dado de Baja';
      default:
        return estado;
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/duenio/dashboard')}
                className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Volver
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Choferes</h1>
                <p className="mt-2 text-sm text-gray-600">
                  Gestiona los choferes de tus remiserías
                </p>
              </div>
            </div>
            <button
              onClick={openCreateModal}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors duration-200"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Chofer
            </button>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtros y búsqueda */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar choferes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los estados</option>
              <option value="ACTIVO">Activos</option>
              <option value="SUSPENDIDO">Suspendidos</option>
              <option value="DADO_DE_BAJA">Dados de Baja</option>
            </select>
          </div>
        </div>

        {/* Lista de choferes */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando choferes...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {filteredChoferes.length === 0 ? (
              <div className="text-center py-12">
                <Truck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm || filterEstado !== 'all' ? 'No se encontraron choferes' : 'No hay choferes'}
                </h3>
                <p className="text-gray-600">
                  {searchTerm || filterEstado !== 'all' 
                    ? 'Intenta ajustar los filtros de búsqueda' 
                    : 'Comienza creando tu primer chofer'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Chofer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contacto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Licencia
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Vehículo Asignado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredChoferes.map((chofer) => (
                      <tr key={chofer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <User className="h-6 w-6 text-blue-600" />
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {chofer.nombre} {chofer.apellido}
                              </div>
                              <div className="text-sm text-gray-500">
                                #{chofer.numeroChofer} • DNI: {chofer.dni}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            <div className="flex items-center mb-1">
                              <Phone className="w-4 h-4 mr-1 text-gray-400" />
                              {chofer.telefono}
                            </div>
                            {chofer.email && (
                              <div className="flex items-center">
                                <Mail className="w-4 h-4 mr-1 text-gray-400" />
                                {chofer.email}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            <div className="font-medium">{chofer.categoriaLicencia}</div>
                            <div className="text-gray-500 text-xs">
                              Vto: {new Date(chofer.vtoLicencia).toLocaleDateString()}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {chofer.vehiculo ? (
                              <div>
                                <div className="font-medium">{chofer.vehiculo.patente}</div>
                                <div className="text-gray-500 text-xs">
                                  {chofer.vehiculo.marca} {chofer.vehiculo.modelo}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400">Sin asignar</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoColor(chofer.estado)}`}>
                            {getEstadoText(chofer.estado)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => handleToggleStatus(chofer.id)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Cambiar estado"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditModal(chofer)}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(chofer.id)}
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
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Creación */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-6 border w-full max-w-2xl shadow-xl rounded-lg bg-white">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Crear Nuevo Chofer</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-6">
              {/* Información Personal */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Información Personal
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Número de Chofer *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.numeroChofer}
                      onChange={(e) => setFormData({ ...formData, numeroChofer: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                      placeholder="ej. CH001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      DNI *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.dni}
                      onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                      placeholder="12345678"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre *
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Apellido *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.apellido}
                      onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Información de Contacto */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Phone className="w-5 h-5 mr-2" />
                  Información de Contacto
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Teléfono *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                      placeholder="011-1234-5678"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="chofer@email.com"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Dirección
                    </label>
                    <input
                      type="text"
                      value={formData.direccion}
                      onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                      placeholder="Av. San Martín 123, CABA"
                    />
                  </div>
                </div>
              </div>

              {/* Información de Licencia */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Información de Licencia
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Categoría de Licencia *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.categoriaLicencia}
                      onChange={(e) => setFormData({ ...formData, categoriaLicencia: e.target.value })}
                      placeholder="ej. D1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vencimiento de Licencia *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.vtoLicencia}
                      onChange={(e) => setFormData({ ...formData, vtoLicencia: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Asignación */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Truck className="w-5 h-5 mr-2" />
                  Asignación
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Remisería *
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vehículo Asignado (opcional)
                    </label>
                    <select
                      value={formData.vehiculoId}
                      onChange={(e) => setFormData({ ...formData, vehiculoId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Sin asignar</option>
                      {vehiculos.map(vehiculo => (
                        <option key={vehiculo.id} value={vehiculo.id}>
                          {vehiculo.patente} - {vehiculo.marca} {vehiculo.modelo}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Chofer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edición */}
      {showEditModal && selectedChofer && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Editar Chofer</h3>
              <form onSubmit={handleEdit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Número de Chofer
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.numeroChofer}
                      onChange={(e) => setFormData({ ...formData, numeroChofer: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Apellido
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.apellido}
                        onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      DNI
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.dni}
                      onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dirección
                    </label>
                    <input
                      type="text"
                      value={formData.direccion}
                      onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Categoría de Licencia
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.categoriaLicencia}
                      onChange={(e) => setFormData({ ...formData, categoriaLicencia: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vencimiento de Licencia
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.vtoLicencia}
                      onChange={(e) => setFormData({ ...formData, vtoLicencia: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vehículo Asignado
                    </label>
                    <select
                      value={formData.vehiculoId}
                      onChange={(e) => setFormData({ ...formData, vehiculoId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Sin asignar</option>
                      {vehiculos.map(vehiculo => (
                        <option key={vehiculo.id} value={vehiculo.id}>
                          {vehiculo.patente} - {vehiculo.marca} {vehiculo.modelo}
                        </option>
                      ))}
                    </select>
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
                    Actualizar Chofer
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