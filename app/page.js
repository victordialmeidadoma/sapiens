'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import DashboardClient from '@/components/DashboardClient';

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        window.location.href = '/login';
      } else {
        setUser(user);
        setLoading(false);
      }
    });
  }, []);

  if (loading) return (
    <div className="loading-overlay show">
      <div className="spinner-lg"/>
      <span>Carregando SAPIENS...</span>
    </div>
  );

  return (
    <DashboardClient
      userNome={user?.user_metadata?.nome || user?.email || 'Usuario'}
      userPerfil={user?.user_metadata?.perfil || 'colaborador'}
    />
  );
}
