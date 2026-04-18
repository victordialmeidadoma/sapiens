'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (err) {
      setError('Email ou senha incorretos.');
      setLoading(false);
      return;
    }

    // Aguarda um momento para o cookie ser salvo e redireciona hard
    setTimeout(() => {
      window.location.replace('/');
    }, 500);
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <div className="sb-logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span style={{fontSize:22,fontWeight:600,letterSpacing:"-.5px"}}>SAPIENS</span>
        </div>
        <p className="login-sub">Sistema de Acompanhamento de Processos · TCE-MA</p>
        <h2 style={{fontSize:18,fontWeight:600,marginBottom:6}}>Bem-vindo</h2>
        <p style={{fontSize:13,color:"var(--t2)",marginBottom:24}}>
          Entre com suas credenciais para acessar o sistema.
        </p>
        {error && (
          <div style={{background:"var(--rl)",border:"1px solid #F5C6C2",color:"#7B241C",borderRadius:6,padding:"10px 14px",fontSize:13,marginBottom:14}}>
            {error}
          </div>
        )}
        <form o