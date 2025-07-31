'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@/types';
import { authService } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  updateUser: (userData: User) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validateStoredSession = async () => {
      // Verificar si hay un usuario guardado en localStorage
      const savedUser = localStorage.getItem('user');
      const accessToken = localStorage.getItem('accessToken');

      if (savedUser && accessToken) {
        try {
          const userData = JSON.parse(savedUser);
          // Validar que el usuario tenga la estructura correcta
          if (userData && userData.id && userData.email && userData.rol) {
            // Validar que el rol sea válido
            const validRoles = ['ADMIN', 'DUENIO', 'COORDINADOR', 'CLIENTE'];
            if (validRoles.includes(userData.rol)) {
              // Validar el token con el backend
              const validationResponse = await authService.validateToken();
              if (validationResponse.success && validationResponse.data?.valid) {
                setUser(userData);
                console.log('Usuario cargado desde localStorage:', userData.email, userData.rol);
              } else {
                console.log('Token inválido, limpiando sesión');
                localStorage.removeItem('user');
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
              }
            } else {
              throw new Error('Invalid user role');
            }
          } else {
            throw new Error('Invalid user data structure');
          }
        } catch (error) {
          console.error('Error parsing saved user:', error);
          // Limpiar datos corruptos
          localStorage.removeItem('user');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      } else {
        console.log('No hay sesión guardada en localStorage');
      }

      setLoading(false);
    };

    validateStoredSession();
  }, []);

  const login = (userData: User, accessToken: string, refreshToken: string) => {
    // Validar datos antes de guardar
    if (!userData || !userData.id || !userData.email || !userData.rol) {
      throw new Error('Invalid user data provided');
    }
    
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  };

  const updateUser = (userData: User) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    updateUser,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 