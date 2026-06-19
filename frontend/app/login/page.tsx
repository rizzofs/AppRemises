'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { authService } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { LoginCredentials } from '@/types';
import { Eye, EyeOff, Car, User, Lock } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginCredentials>();

  const onSubmit = async (data: LoginCredentials) => {
    setIsLoading(true);
    try {
      // 1. Intentar iniciar sesión real en el Backend (Supabase)
      const response = await authService.login(data);
      
      if (response.success && response.data) {
        const { user, accessToken, refreshToken } = response.data;
        login(user as any, accessToken, refreshToken);
        toast.success('¡Sesión iniciada correctamente!');
        
        // Redirigir según el rol
        if (user.rol === 'ADMIN') {
          router.push('/admin/dashboard');
        } else if (user.rol === 'COORDINADOR') {
          router.push('/coordinador/dashboard');
        } else if (user.rol === 'CLIENTE') {
          router.push('/cliente/app');
        } else if (user.rol === 'CHOFER') {
          router.push('/chofer/app');
        } else {
          router.push('/duenio/dashboard');
        }
        return;
      } else {
        toast.error(response.message || 'Credenciales inválidas');
      }
    } catch (error: any) {
      console.error('Error en login:', error);
      toast.error(error.response?.data?.message || 'Error al conectar con el servidor');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="card p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <Image 
                src="/Isologo.png" 
                alt="RZCore Logo" 
                width={120} 
                height={120}
                className="object-contain drop-shadow-md"
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">App Remises</h1>
            <p className="text-gray-600 mt-2">Inicia sesión en tu cuenta</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('email', {
                    required: 'El email es requerido',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Email inválido',
                    },
                  })}
                  type="email"
                  id="email"
                  className="input pl-10"
                  placeholder="tu@email.com"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('password', {
                    required: 'La contraseña es requerida',
                    minLength: {
                      value: 6,
                      message: 'La contraseña debe tener al menos 6 caracteres',
                    },
                  })}
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  className="input pl-10 pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm text-primary-600 hover:text-primary-700 transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full flex items-center justify-center"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              ¿No tienes cuenta?{' '}
              <Link
                href="/registro"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Regístrate aquí
              </Link>
            </p>
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-800 mb-2">Credenciales Demo (Click para autocompletar):</p>
              <div className="text-xs text-blue-700 space-y-1">
                <button type="button" onClick={() => { setValue('email', 'coord@appremises.com'); setValue('password', 'coord123'); }} className="block w-full text-left hover:bg-blue-100 p-1.5 rounded transition-colors">
                  <strong>Coordinador:</strong> coord@appremises.com / coord123
                </button>
                <button type="button" onClick={() => { setValue('email', 'admin@test.com'); setValue('password', 'admin123'); }} className="block w-full text-left hover:bg-blue-100 p-1.5 rounded transition-colors">
                  <strong>Admin:</strong> admin@test.com / admin123
                </button>
                <button type="button" onClick={() => { setValue('email', 'duenio@appremises.com'); setValue('password', 'duenio123'); }} className="block w-full text-left hover:bg-blue-100 p-1.5 rounded transition-colors">
                  <strong>Dueño:</strong> duenio@appremises.com / duenio123
                </button>
                <button type="button" onClick={() => { setValue('email', 'cliente@test.com'); setValue('password', 'cliente123'); }} className="block w-full text-left hover:bg-blue-100 p-1.5 rounded transition-colors">
                  <strong>Cliente:</strong> cliente@test.com / cliente123
                </button>
                <button type="button" onClick={() => { setValue('email', 'chofer@test.com'); setValue('password', 'chofer123'); }} className="block w-full text-left hover:bg-green-100 p-1.5 rounded transition-colors">
                  <strong>Chofer:</strong> chofer@test.com / chofer123
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 