import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseEnabled } from '../../services/supabaseClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Em modo local não há login: o app abre direto, como sempre foi.
  const [isLoading, setIsLoading] = useState(isSupabaseEnabled);

  useEffect(() => {
    if (!isSupabaseEnabled) return undefined;

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({
    user: isSupabaseEnabled ? user : { id: 'local-user' },
    isAuthenticated: isSupabaseEnabled ? Boolean(user) : true,
    isLoading,
    requiresLogin: isSupabaseEnabled,
    login: async (email, password) => {
      if (!isSupabaseEnabled) {
        setUser({ id: 'local-user' });
        return { error: null };
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    },
    logout: async () => {
      if (isSupabaseEnabled) {
        await supabase.auth.signOut();
      }
      setUser(null);
    },
  }), [isLoading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
