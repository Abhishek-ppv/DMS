import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

export interface Permission {
  resource: string;
  action: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  partnerId: string | null;
  status: string;
  roleDetails?: {
    id: string;
    name: string;
    description: string | null;
  };
  partnerDetails?: {
    id: string;
    name: string;
    type: string;
    territory: string | null;
  } | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  permissions: Permission[];
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProfile = async (accessToken: string) => {
    try {
      api.setAccessToken(accessToken);
      const profileData = await api.get<any>('/auth/me');
      
      const mappedUser: User = {
        id: profileData.id,
        email: profileData.email,
        name: profileData.name,
        role: profileData.role.name,
        partnerId: profileData.partner ? profileData.partner.id : null,
        status: profileData.status,
        roleDetails: {
          id: profileData.role.id,
          name: profileData.role.name,
          description: profileData.role.description,
        },
        partnerDetails: profileData.partner ? {
          id: profileData.partner.id,
          name: profileData.partner.name,
          type: profileData.partner.type,
          territory: profileData.partner.territory,
        } : null,
      };

      setUser(mappedUser);
      setPermissions(profileData.role.permissions || []);
    } catch (err) {
      logout();
      throw err;
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await api.post<{
        accessToken: string;
        refreshToken: string;
        user: any;
      }>('/auth/login', { email, password });

      api.setAccessToken(response.accessToken);
      api.setRefreshToken(response.refreshToken);

      await fetchProfile(response.accessToken);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    api.clearTokens();
    setUser(null);
    setPermissions([]);
    setIsLoading(false);
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const token = api.getAccessToken();
      const hasRefreshToken = api.getRefreshToken();
      if (token && hasRefreshToken) {
        try {
          await fetchProfile(token);
        } catch (err) {
          // If profile fails, clear everything and redirect to login
          logout();
        } finally {
          setIsLoading(false);
        }
      } else {
        logout();
      }
    };

    initializeAuth();

    const handleGlobalLogout = () => {
      logout();
    };

    window.addEventListener('auth-logout', handleGlobalLogout);
    return () => {
      window.removeEventListener('auth-logout', handleGlobalLogout);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!user,
        user,
        permissions,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
