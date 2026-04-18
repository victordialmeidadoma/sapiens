'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import DashboardClient from '@/components/DashboardClient';

export default function Home() {
  const [state, setState] = useState({ loading: true, user: null, perfil: null, nome: null });

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/login'; return; }
      const { data: p } = await supabase.from('perfis').select('nome, perfil').eq('id', user.id).single();
      setState({ loading: false, user, perfil: p?.perfil || 'colaborador', nome: p?.nome || user.email });
    }
    init();
  }, []);

  if (state.loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:12,fontFamily:'Inter,sans-serif',color:'#6C757D'}}>
      <div style={{width:32,height:32,border:'3px solid #E0E3E8',borderTopColor:'#1B6EC2',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
      <span>Carregando SAPIENS...</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return <DashboardClient userNome={state.nome} userPerfil={state.perfil} />;
}
