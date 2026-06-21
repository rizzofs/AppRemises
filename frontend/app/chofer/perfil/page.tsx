"use client";

import { useAuth } from '@/contexts/AuthContext';

export default function ChoferPerfilPage() {
  const { user } = useAuth();
  
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Mi Perfil</h2>
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 flex items-center space-x-4">
        <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-xl font-bold">
          {user?.chofer?.nombre?.charAt(0) || 'C'}
        </div>
        <div>
          <h3 className="font-semibold text-gray-800">{user?.chofer?.nombre || 'Chofer'} {user?.chofer?.apellido || ''}</h3>
          <p className="text-sm text-gray-500">{user?.email || 'chofer@ejemplo.com'}</p>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 space-y-3">
        <h4 className="font-medium text-gray-700 border-b pb-2">Información del Vehículo</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-gray-500">Patente</div>
          <div className="text-right font-medium text-gray-800">{user?.chofer?.vehiculo?.patente || 'No asignada'}</div>
          <div className="text-gray-500">Marca/Modelo</div>
          <div className="text-right font-medium text-gray-800">
            {user?.chofer?.vehiculo ? `${user.chofer.vehiculo.marca} ${user.chofer.vehiculo.modelo}` : 'No asignado'}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 space-y-3">
        <h4 className="font-medium text-gray-700 border-b pb-2">Estadísticas</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-gray-500">Viajes Totales</div>
          <div className="text-right font-medium text-gray-800">0</div>
          <div className="text-gray-500">Calificación</div>
          <div className="text-right font-medium text-gray-800">5.0 ⭐</div>
        </div>
      </div>
    </div>
  );
}
