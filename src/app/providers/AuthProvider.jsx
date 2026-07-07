import { createContext, useContext, useMemo, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const value = useMemo(() => ({
    user,
    isAuthenticated,
    isLoading,
    login: async () => {
      setIsLoading(true);
      setIsAuthenticated(true);
      setUser({ id: 'local-user' });
      setIsLoading(false);
    },
    logout: () => {
      setUser(null);
      setIsAuthenticated(false);
    },
  }), [isAuthenticated, isLoading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
