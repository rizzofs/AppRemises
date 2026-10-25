'use client';

import { useState, useEffect, useCallback } from 'react';
import LogoutButton from '@/components/LogoutButton';
import ChoferBottomNav from '@/components/ChoferBottomNav';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { choferService } from '@/lib/api';
import { 
  Clock, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Car, 
  User, 
  Building2, 
  FileText,
  ShieldAlert
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ChoferLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [choferData, setChoferData] = useState<any>(null);
  const [loadingEstado, setLoadingEstado] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const consultarEstado = useCallback(async (mostrarToast = false) => {
    try {
      if (mostrarToast) setRefreshing(true);
      const res = await choferService.getMiEstado();
      if (res.success && res.data?.chofer) {
        setChoferData(res.data.chofer);
        if (mostrarToast) {
          if (res.data.chofer.estado === 'ACTIVO') {
            toast.success('¡Tu cuenta ha sido aprobada!');
          } else {
            toast('Estado actualizado', { icon: 'ℹ️' });
          }
        }
      }
    } catch (err) {
      console.error('Error al verificar estado del chofer:', err);
    } finally {
      setLoadingEstado(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user?.rol === 'CHOFER') {
      consultarEstado();
    } else {
      setLoadingEstado(false);
    }
  }, [user, consultarEstado]);

  // Determinar el estado actual del chofer (de la API o del context)
  const estadoChofer = choferData?.estado || (user as any)?.chofer?.estado || 'ACTIVO';
  const motivoRechazo = choferData?.motivoRechazo || (user as any)?.chofer?.motivoRechazo;
  const remiseriaNombre = choferData?.remiseria?.nombreFantasia || 'Tu agencia de remises';

  return (
    <ProtectedRoute allowedRoles={['CHOFER']}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-primary-600 text-white p-4 shadow-md sticky top-0 z-10 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Car className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-tight">AppRemises Chofer</h1>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
              {user?.email?.slice(0, 2).toUpperCase() || 'CH'}
            </div>
            <LogoutButton className="text-white hover:text-red-200" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {loadingEstado ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
              <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4" />
              <p className="text-sm text-slate-500">Cargando estado de la cuenta...</p>
            </div>
          ) : estadoChofer === 'PENDIENTE_APROBACION' ? (
            /* Vista de Cuenta Pendiente de Aprobación */
            <div className="max-w-md mx-auto p-6 my-10">
              <div className="bg-white rounded-3xl shadow-xl p-8 border border-amber-200 text-center animate-in fade-in zoom-in-95">
                <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-xs">
                  <Clock className="w-10 h-10 animate-pulse" />
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 mb-3">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  Cuenta en Revisión
                </div>

                <h2 className="text-2xl font-black text-slate-800">Solicitud en Proceso</h2>
                <p className="text-slate-600 text-sm mt-2">
                  Hola <strong>{choferData?.nombre || user?.email}</strong>, tu solicitud de ingreso como chofer está siendo revisada por el dueño de la remisería.
                </p>

                <div className="my-6 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs space-y-2">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span><strong>Remisería:</strong> {remiseriaNombre}</span>
                  </div>
                  {choferData?.numeroChofer && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span><strong>N° Chofer:</strong> {choferData.numeroChofer}</span>
                    </div>
                  )}
                  {choferData?.categoriaLicencia && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <User className="w-4 h-4 text-slate-400" />
                      <span><strong>Licencia:</strong> {choferData.categoriaLicencia}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-200 text-slate-500">
                    Una vez que el dueño apruebe tu registro, se te habilitará la consola de turnos y recepción de viajes de forma inmediata.
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => consultarEstado(true)}
                    disabled={refreshing}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-2xl font-bold text-sm bg-primary-600 hover:bg-primary-700 text-white shadow-md transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Verificando...' : 'Consultar si ya fui aprobado'}
                  </button>

                  <div className="pt-2">
                    <LogoutButton className="text-xs text-slate-500 hover:text-slate-800 underline" />
                  </div>
                </div>
              </div>
            </div>
          ) : estadoChofer === 'RECHAZADO' ? (
            /* Vista de Solicitud Rechazada */
            <div className="max-w-md mx-auto p-6 my-10">
              <div className="bg-white rounded-3xl shadow-xl p-8 border border-rose-200 text-center animate-in fade-in zoom-in-95">
                <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-xs">
                  <XCircle className="w-10 h-10" />
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 mb-3">
                  Solicitud no Aprobada
                </div>

                <h2 className="text-2xl font-black text-slate-800">Solicitud Rechazada</h2>
                <p className="text-slate-600 text-sm mt-2">
                  Lamentablemente, el dueño de <strong>{remiseriaNombre}</strong> ha desestimado tu postulación como chofer.
                </p>

                {motivoRechazo && (
                  <div className="my-6 p-4 bg-rose-50 rounded-2xl border border-rose-200 text-left text-xs text-rose-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-rose-800">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      Motivo especificado:
                    </div>
                    <p className="italic pl-5 font-medium">"{motivoRechazo}"</p>
                  </div>
                )}

                <div className="mt-6 space-y-3">
                  <p className="text-xs text-slate-500">
                    Si considerás que se trata de un error o querés volver a enviar tu documentación, comunicate directamente con la administración de la remisería.
                  </p>
                  <div className="pt-4 border-t border-slate-100">
                    <LogoutButton className="w-full py-3 px-6 rounded-2xl font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all" />
                  </div>
                </div>
              </div>
            </div>
          ) : estadoChofer === 'SUSPENDIDO' ? (
            /* Vista de Chofer Suspendido */
            <div className="max-w-md mx-auto p-6 my-10">
              <div className="bg-white rounded-3xl shadow-xl p-8 border border-amber-200 text-center animate-in fade-in zoom-in-95">
                <div className="w-20 h-20 bg-amber-100 text-amber-700 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-xs">
                  <ShieldAlert className="w-10 h-10" />
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 mb-3">
                  Cuenta Suspendida
                </div>

                <h2 className="text-2xl font-black text-slate-800">Servicio Pausado</h2>
                <p className="text-slate-600 text-sm mt-2">
                  Tu usuario ha sido suspendido temporalmente por la administración de la remisería.
                </p>

                <p className="text-xs text-slate-500 mt-4">
                  Por favor contactá al coordinador o dueño de la agencia para regularizar tu situación.
                </p>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  <LogoutButton className="w-full py-3 px-6 rounded-2xl font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all" />
                </div>
              </div>
            </div>
          ) : (
            /* Chofer Activo: Renderiza la App normal */
            children
          )}
        </main>

        {/* Solo mostrar la barra de navegación inferior si el chofer está activo */}
        {estadoChofer === 'ACTIVO' && <ChoferBottomNav />}
      </div>
    </ProtectedRoute>
  );
}
