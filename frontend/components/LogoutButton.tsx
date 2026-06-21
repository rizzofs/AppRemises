"use client";

import { useAuth } from '@/contexts/AuthContext';
import { LogOut } from 'lucide-react';

export default function LogoutButton({ className = '' }: { className?: string }) {
  const { logout } = useAuth();

  return (
    <button
      onClick={() => logout()}
      className={`flex items-center justify-center p-2 rounded-full hover:bg-black/10 transition-colors ${className}`}
      title="Cerrar Sesión"
    >
      <LogOut className="w-5 h-5" />
    </button>
  );
}
