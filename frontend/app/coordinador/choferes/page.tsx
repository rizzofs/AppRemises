'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTracking } from '@/hooks/useAppTracking';
import { 
  ArrowLeft, 
  Users, 
  Car, 
  Phone, 
  MapPin, 
  Clock, 
  Filter,
  Search,
  Plus,
  Edit,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';

interface Chofer {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  estado: 'disponible' | 'en_viaje' | 'fuera_servicio' | 'descanso';
  vehiculo?: {
    patente: string;
    modelo: string;
  };
  ubicacion?: {
    lat: number;
    lng: number;
    direccion: string;
  };
  ultimaActualizacion: string;
  viajesHoy: number;
  calificacion: number;
}

export default function GestionarChoferes() {
  const { user } = useAuth();
  useAppTracking('COORDINADOR_GESTIONAR_CHOFERES');
  
  const [choferes, setChoferes] = useState<Chofer[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Datos de ejemplo
  const choferesEjemplo: Chofer[] = [
    {
      id: '1',
      nombre: 'Juan Pérez',
      telefono: '11 1234-5678',
      email: 'juan.perez@email.com',
      estado: 'disponible',
      vehiculo: {
        patente: 'ABC123',
        modelo: 'Toyota Corolla'
      },
      ubicacion: {
        lat: -34.6037,
        lng: -58.3816,
        direccion: 'Av. Corrientes 1234, CABA'
      },
      ultimaActualizacion: '2024-01-15T10:30:00Z',
      viajesHoy: 5,
      calificacion: 4.8
    },
    {
      id: '2',
      nombre: 'María González',
      telefono: '11 2345-6789',
      email: 'maria.gonzalez@email.com',
      estado: 'en_viaje',
      vehiculo: {
        patente: 'XYZ789',
        modelo: 'Honda Civic'
      },
      ubicacion: {
        lat: -34.6084,
        lng: -58.3731,
        direccion: 'Palermo, CABA'
      },
      ultimaActualizacion: '2024-01-15T10:25:00Z',
      viajesHoy: 3,
      calificacion: 4.9
    },
    {
      id: '3',
      nombre: 'Carlos López',
      telefono: '11 3456-7890',
      email: 'carlos.lopez@email.com',
      estado: 'descanso',
      vehiculo: {
        patente: 'DEF456',
        modelo: 'Ford Focus'
      },
      ultimaActualizacion: '2024-01-15T09:15:00Z',
      viajesHoy: 0,
      calificacion: 4.7
    }
  ];

  useEffect(() => {
    setTimeout(() => {
      setChoferes(choferesEjemplo);
      setIsLoading(false);
    }, 1000);
  }, []);

  const choferesFiltrados = choferes.filter(chofer => {
    const cumpleFiltroEstado = filtroEstado === 'todos' || chofer.estado === filtroEstado;
    const cumpleBusqueda = chofer.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           chofer.telefono.includes(searchTerm) ||
                           chofer.vehiculo?.patente.toLowerCase().includes(searchTerm.toLowerCase());
    
    return cumpleFiltroEstado && cumpleBusqueda;
  });

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'disponible':
        return 'bg-green-500';
      case 'en_viaje':
        return 'bg-blue-500';
      case 'fuera_servicio':
        return 'bg-red-500';
      case 'descanso':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getEstadoTexto = (estado: string) => {
    switch (estado) {
      case 'disponible':
        return 'Disponible';
      case 'en_viaje':
        return 'En Viaje';
      case 'fuera_servicio':
        return 'Fuera de Servicio';
      case 'descanso':
        return 'Descanso';
      default:
        return 'Desconocido';
    }
  };

  const getCalificacionEstrellas = (calificacion: number) => {
    return '★'.repeat(Math.floor(calificacion)) + '☆'.repeat(5 - Math.floor(calificacion));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center">
              <Link 
                href="/coordinador/dashboard"
                className="mr-4 p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Gestionar Choferes</h1>
                <p className="text-sm text-gray-600">Estado y asignación de choferes</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link
                href="/coordinador/choferes/nuevo"
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                <span>Nuevo Chofer</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Disponibles</p>
                <p className="text-2xl font-bold text-gray-900">
                  {choferes.filter(c => c.estado === 'disponible').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Car className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">En Viaje</p>
                <p className="text-2xl font-bold text-gray-900">
                  {choferes.filter(c => c.estado === 'en_viaje').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Descanso</p>
                <p className="text-2xl font-bold text-gray-900">
                  {choferes.filter(c => c.estado === 'descanso').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Fuera de Servicio</p>
                <p className="text-2xl font-bold text-gray-900">
                  {choferes.filter(c => c.estado === 'fuera_servicio').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros y búsqueda */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, teléfono o patente..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos los estados</option>
                <option value="disponible">Disponible</option>
                <option value="en_viaje">En Viaje</option>
                <option value="descanso">Descanso</option>
                <option value="fuera_servicio">Fuera de Servicio</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lista de choferes */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Choferes ({choferesFiltrados.length})
            </h3>
          </div>
          
          <div className="divide-y divide-gray-200">
            {choferesFiltrados.map((chofer) => (
              <div key={chofer.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${getEstadoColor(chofer.estado)}`}></div>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <div>
                          <h4 className="font-semibold text-gray-900">{chofer.nombre}</h4>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <span className="flex items-center">
                              <Phone className="h-3 w-3 mr-1" />
                              {chofer.telefono}
                            </span>
                            {chofer.vehiculo && (
                              <span className="flex items-center">
                                <Car className="h-3 w-3 mr-1" />
                                {chofer.vehiculo.patente} - {chofer.vehiculo.modelo}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-sm">
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              chofer.estado === 'disponible' ? 'bg-green-100 text-green-800' :
                              chofer.estado === 'en_viaje' ? 'bg-blue-100 text-blue-800' :
                              chofer.estado === 'descanso' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {getEstadoTexto(chofer.estado)}
                            </span>
                            <span className="text-gray-500">
                              {chofer.viajesHoy} viajes hoy
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-yellow-500 text-sm">
                              {getCalificacionEstrellas(chofer.calificacion)}
                            </span>
                            <span className="text-sm text-gray-500">
                              {chofer.calificacion.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {chofer.ubicacion && (
                        <div className="mt-2 text-sm text-gray-600 flex items-center">
                          <MapPin className="h-3 w-3 mr-1" />
                          {chofer.ubicacion.direccion}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                      <MapPin className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            {choferesFiltrados.length === 0 && (
              <div className="p-6 text-center text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No hay choferes que coincidan con los filtros</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 