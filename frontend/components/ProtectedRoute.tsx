"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (allowedRoles && !allowedRoles.includes(user.rol)) {
        // Redirigir según el rol si no tiene permiso para esta ruta
        switch (user.rol) {
          case 'ADMIN': router.push('/admin/dashboard'); break;
          case 'COORDINADOR': router.push('/coordinador/dashboard'); break;
          case 'DUENIO': router.push('/duenio/dashboard'); break;
          case 'CHOFER': router.push('/chofer/app'); break;
          case 'CLIENTE': router.push('/cliente/app'); break;
          default: router.push('/login');
        }
      }
    }
  }, [user, loading, router, allowedRoles]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user || (allowedRoles && !allowedRoles.includes(user.rol))) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}
