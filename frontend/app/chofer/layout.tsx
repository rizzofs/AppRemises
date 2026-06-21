import LogoutButton from '@/components/LogoutButton';
import ChoferBottomNav from '@/components/ChoferBottomNav';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function ChoferLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute allowedRoles={['CHOFER']}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-primary-600 text-white p-4 shadow-md sticky top-0 z-10 flex justify-between items-center">
          <h1 className="text-xl font-bold">AppRemises Chofer</h1>
          <div className="flex items-center space-x-2">
            {/* Aquí irá info básica del perfil o botón menú */}
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-sm font-medium">CH</span>
            </div>
            <LogoutButton className="text-white hover:text-red-200" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        <ChoferBottomNav />
      </div>
    </ProtectedRoute>
  );
}
