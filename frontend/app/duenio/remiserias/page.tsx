'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { remiseriaService } from '@/lib/api';
import { Remiseria } from '@/types';
import { 
  Building, Search, MapPin, Phone, Car, Users, Plus, 
  Settings, Eye, MoreVertical, Shield
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

export default function RemiseriasPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [remiserias, setRemiserias] = useState<Remiseria[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user || user.rol !== 'DUENIO') {
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
        const userRemiserias = response.data.filter(remiseria => 
          remiseria.duenios?.some(duenio => duenio.duenioId === user?.duenio?.id)
        );
        setRemiserias(userRemiserias);
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

  const filteredRemiserias = remiserias.filter(r => 
    r.nombreFantasia.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.razonSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.cuit.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="loading-spinner border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Gestión de Remiserías</h2>
          <p className="text-sm text-slate-500">Administrá las sucursales y agencias a tu cargo.</p>
        </div>
        <button 
          onClick={() => toast('Función de agregar disponible pronto', { icon: '🚧' })}
          className="btn btn-primary shadow-md shadow-primary-500/20"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nueva Remisería
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o CUIT..."
              className="input pl-10 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {filteredRemiserias.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">No se encontraron resultados</h3>
            <p className="text-slate-500">
              {searchTerm ? 'No hay remiserías que coincidan con tu búsqueda.' : 'No tienes remiserías asignadas.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6">
            {filteredRemiserias.map((remiseria) => (
              <div key={remiseria.id} className="group bg-white rounded-xl border border-slate-200 hover:border-primary-200 hover:shadow-lg hover:shadow-primary-500/5 transition-all overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-100 bg-slate-50/30">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                        <Building className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 line-clamp-1">{remiseria.nombreFantasia}</h3>
                        <p className="text-xs text-slate-500 line-clamp-1">{remiseria.razonSocial}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                        remiseria.estado
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}
                    >
                      {remiseria.estado ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                </div>

                <div className="p-5 flex-1 space-y-4">
                  <div className="space-y-2.5 text-sm text-slate-600">
                    <div className="flex items-center gap-3">
                      <Shield className="w-4 h-4 text-slate-400" />
                      <span>CUIT: <span className="font-medium text-slate-700">{remiseria.cuit}</span></span>
                    </div>
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span className="truncate">{remiseria.direccion}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span>{remiseria.telefono}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 border-t border-slate-100 bg-slate-50/50">
                  <div className="p-3 text-center border-r border-slate-100">
                    <p className="text-lg font-bold text-slate-700">{remiseria.coordinadores?.length || 0}</p>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Coord.</p>
                  </div>
                  <div className="p-3 text-center border-r border-slate-100">
                    <p className="text-lg font-bold text-slate-700">{remiseria.choferes?.length || 0}</p>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Choferes</p>
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-lg font-bold text-slate-700">{remiseria.vehiculos?.length || 0}</p>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Vehículos</p>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-white flex gap-2">
                  <Link 
                    href={`/duenio/remiserias/${remiseria.id}`}
                    className="flex-1 btn btn-sm bg-slate-100 text-slate-700 hover:bg-slate-200 border-transparent"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Ver Detalle
                  </Link>
                  <Link 
                    href={`/duenio/remiserias/${remiseria.id}/editar`}
                    className="flex-none btn btn-sm bg-slate-100 text-slate-600 hover:bg-slate-200 border-transparent px-3"
                    title="Configuración"
                  >
                    <Settings className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
