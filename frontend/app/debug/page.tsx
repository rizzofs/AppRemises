'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function DebugPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const [localStorageData, setLocalStorageData] = useState<any>({});

  useEffect(() => {
    // Get localStorage data
    const userData = localStorage.getItem('user');
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');

    setLocalStorageData({
      user: userData ? JSON.parse(userData) : null,
      accessToken: accessToken ? '***' + accessToken.slice(-10) : null,
      refreshToken: refreshToken ? '***' + refreshToken.slice(-10) : null
    });
  }, []);

  const clearSession = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Debug - Estado de Autenticación</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* AuthContext State */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">AuthContext State</h2>
            <div className="space-y-2">
              <div><strong>Loading:</strong> {loading ? 'Sí' : 'No'}</div>
              <div><strong>Is Authenticated:</strong> {isAuthenticated ? 'Sí' : 'No'}</div>
              <div><strong>User:</strong></div>
              <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
                {JSON.stringify(user, null, 2)}
              </pre>
            </div>
          </div>

          {/* LocalStorage Data */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">LocalStorage Data</h2>
            <div className="space-y-2">
              <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
                {JSON.stringify(localStorageData, null, 2)}
              </pre>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Acciones</h2>
          <div className="space-x-4">
            <button
              onClick={clearSession}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Limpiar Sesión
            </button>
            <button
              onClick={() => window.location.href = '/login'}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Ir a Login
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Ir a Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 