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
      if (typeof window === 'undefined') {
        setLoading(false);
        return;
      }

      const savedUser = sessionStorage.getItem('user') || localStorage.getItem('user');
      const accessToken = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
      const refreshToken = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken');

      if (savedUser && accessToken) {
        try {
          const userData = JSON.parse(savedUser);
          if (userData && userData.id && userData.email && userData.rol) {
            const validRoles = ['ADMIN', 'DUENIO', 'COORDINADOR', 'CLIENTE', 'CHOFER'];
            if (validRoles.includes(userData.rol)) {
              setUser(userData);
              // Asegurar que la pestaña actual conserve su propia sesión en sessionStorage
              sessionStorage.setItem('user', savedUser);
              sessionStorage.setItem('accessToken', accessToken);
              if (refreshToken) {
                sessionStorage.setItem('refreshToken', refreshToken);
              }
            } else {
              throw new Error('Invalid user role');
            }
          } else {
            throw new Error('Invalid user data structure');
          }
        } catch (error) {
          console.error('Error parsing saved user:', error);
          sessionStorage.removeItem('user');
          sessionStorage.removeItem('accessToken');
          sessionStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      }

      setLoading(false);
    };

    validateStoredSession();
  }, []);

  const login = (userData: User, accessToken: string, refreshToken: string) => {
    if (!userData || !userData.id || !userData.email || !userData.rol) {
      throw new Error('Invalid user data provided');
    }
    
    setUser(userData);
    const serialized = JSON.stringify(userData);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('user', serialized);
      sessionStorage.setItem('accessToken', accessToken);
      sessionStorage.setItem('refreshToken', refreshToken);
    }
    localStorage.setItem('user', serialized);
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  };

  const logout = () => {
    setUser(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
    }
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  };

  const updateUser = (userData: User) => {
    setUser(userData);
    const serialized = JSON.stringify(userData);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('user', serialized);
    }
    localStorage.setItem('user', serialized);
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
