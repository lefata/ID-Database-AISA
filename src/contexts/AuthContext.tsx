import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  isSecurity: boolean;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSecurity, setIsSecurity] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleAuthStateChange = (_event: string, session: Session | null) => {
      if (session && !session.user.email_confirmed_at) {
        // User is signed in but not confirmed. Force sign out.
        supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setIsAdmin(false);
        setIsSecurity(false);
      } else {
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        const userRole = currentUser?.user_metadata?.role;
        setIsAdmin(userRole === 'admin');
        setIsSecurity(userRole === 'security');
      }
      setLoading(false);
    };

    // Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
        handleAuthStateChange('INITIAL_SESSION', session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthStateChange);

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    session,
    user,
    isAdmin,
    isSecurity,
    loading,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};