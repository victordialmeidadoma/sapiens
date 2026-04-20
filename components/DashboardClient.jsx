'use client';
import React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

// ── UTILS ────────────────────────────────────────────────────────────────────
const pd = s => { if (!s) return null; const d = new Date(s + 'T12:00:00'); return isNaN(d) ? null : d; };
const fd = s => { if (!s) return '—'; const d = pd(s); return d ? d.toLocaleDateString('pt-BR') : s; };
const today = () => new Date().toISOString().split('T')[0];
const du = p => { const dl = pd(p.pr) || pd(p.pz); if (!dl) return null; const n = new Date(); n.setHours(0,0,0,0); return Math.round((dl - n) / 86400000); };
const edl = p => pd(p.pr) || pd(p.pz);
const mpct = m => { const s=parseInt(m.inicio||0), e=parseInt(m.fim||0), n=new Date().getFullYear(); if(!s||!e||e<=s) return 50; return Math.max(0,Math.min(100,Math.round((n-s)/(e-s)*100))); };

const ETAPA_MAP = {
  'Aguardando Citacao':'et-ag-cit','Citado — Em Prazo':'et-em-prazo',
  'Em Defesa':'et-em-defesa','Defesa Protocolada':'et-def-prot',
  'Prorrogacao Solicitada':'et-prorr','Prorrogacao Concedida':'et-prorr',
  'Em Embargos':'et-embargos','Embargo Protocolado':'et-emb-prot',
  'Em Minuta':'et-minuta','Minuta Elaborada':'et-minuta',
  'Aguardando Pauta':'et-pauta','Sustentacao Oral':'et-oral',
  'Retirado de Pauta':'et-pauta','Aguardando Publicacao':'et-pauta',
  'Julgado — Regular':'et-julgado-r','Julgado — Irregular':'et-julgado-i','Arquivado':'et-arch','Trânsito em Julgado':'et-transito',
  'Def. Prot.':'et-def-prot','Emb. Prot.':'et-emb-prot','AGUARD. CIT.':'et-ag-cit','AGUARD. PUBLI':'et-pauta','RET. DE PAUTA':'et-pauta',
};
const EtapaBadge = ({ et }) => {
  if (!et) return <span className="badge bgr">—</span>;
  return <span className={`badge ${ETAPA_MAP[et]||'bgr'}`}>{et}</span>;
};
const DaysBadge = ({ days }) => {
  if (days === null) return <span className="badge bgr">—</span>;
  if (days < 0) return <span className="badge bd">Vencido {Math.abs(days)}d</span>;
  if (days <= 7) return <span className="badge bd">{days}d</span>;
  if (days <= 30) return <span className="badge ba">{days}d</span>;
  return <span className="badge bgr">{days}d</span>;
};

const ETAPAS = ['Aguardando Citacao','Citado — Em Prazo','Em Defesa','Defesa Protocolada','Prorrogacao Solicitada','Prorrogacao Concedida','Em Embargos','Embargo Protocolado','Em Minuta','Minuta Elaborada','Aguardando Pauta','Sustentacao Oral','Retirado de Pauta','Aguardando Publicacao','Julgado — Regular','Julgado — Irregular','Arquivado','Trânsito em Julgado'];
const isTransito = p => p.et === 'Trânsito em Julgado';
const NATUREZAS = ['Prestacao de Contas','Representacao','Denuncia','Tomada de Contas Especial','Fiscalizacao','Consulta','Recurso','Outros'];
const ESPECIES = ['Prestacao de Contas Anual de Governo','Prestacao de Contas Anual de Gestores','Tomada de Contas de Gestores','Representacao — Licitacao','Representacao — Contratos','Representacao — Pessoal','Fiscalizacao de Obras','Fiscalizacao de Contratos','Denuncia','Consulta Juridica','Recurso de Revisao','Embargo de Declaracao','Outros'];
const TL_COLORS = {'Prorrogacao de prazo':{dot:'#B45309',cls:'ba',lbl:'PRAZO'},'Defesa protocolada':{dot:'#1B7A4A',cls:'bg',lbl:'DEFESA'},'Embargo protocolado':{dot:'#5B2D8E',cls:'bpu',lbl:'EMBARGO'},'Minuta elaborada':{dot:'#0F766E',cls:'btl',lbl:'MINUTA'},'Movimentacao TCE':{dot:'#1B6EC2',cls:'bb',lbl:'TCE'},'Contato com responsavel':{dot:'#0F766E',cls:'btl',lbl:'CONTATO'},'Reuniao':{dot:'#0F766E',cls:'btl',lbl:'REUNIAO'},'Movimentacao interna':{dot:'#6C757D',cls:'bgr',lbl:'INTERNO'},'Outro':{dot:'#ADB5BD',cls:'bgr',lbl:'OUTRO'}};

function Toast({ msg, type }) {
  if (!msg) return null;
  return <div className={`toast show ${type}`}>{msg}</div>;
}

// ── API HELPER ────────────────────────────────────────────────────────────────
async function getToken() {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || '';
}

async function api(url, opts = {}) {
  const token = await getToken();
  const res = await fetch(url, {
    headers: {
      ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      'Authorization': `Bearer ${token}`,
    },
    ...opts,
    body: opts.body instanceof FormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('401'); }
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || res.statusText); }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : res;
}

// ── STAT BAR ──────────────────────────────────────────────────────────────────
function StatBar({ label, value, max, color }) {
  return (
    <div className="sbr">
      <div className="sbl">{label}</div>
      <div className="sbt"><div className="sbf" style={{ width: `${Math.round((value / max) * 100)}%`, background: color }} /></div>
      <div className="sbcount">{value}</div>
    </div>
  );
}

// ── TIMELINE ─────────────────────────────────────────────────────────────────
function Timeline({ items, emptyMsg }) {
  if (!items.length) return <div style={{ color: 'var(--t3)', fontSize: 13, padding: '12px 0' }}>{emptyMsg}</div>;
  return items.map((h, i) => {
    const c = TL_COLORS[h.tipo] || { dot: '#ADB5BD', cls: 'bgr', lbl: 'OUTRO' };
    const isLast = i === items.length - 1;
    return (
      <div key={h.id} className="tli">
        <div className="tl-left">
          <div className="tl-dot" style={{ background: c.dot, outlineColor: c.dot }} />
          {!isLast && <div className="tl-line" />}
        </div>
        <div className="tl-content" style={isLast ? { paddingBottom: 0 } : {}}>
          <div className="tl-header">
            <span className={`badge ${c.cls}`} style={{ fontSize: 10, padding: '1px 7px', letterSpacing: '.04em' }}>{c.lbl}</span>
            {h.tce && <span className="tl-badge-tce">TCE</span>}
            {h.tipo === 'Prorrogacao de prazo' && <span className="tl-badge-prorr">PRORROGACAO</span>}
            <span className="tl-date">{fd(h.data)}</span>
          </div>
          <div className="tl-desc">{h.descricao || '—'}</div>
        </div>
      </div>
    );
  });
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function DashboardClient({ userNome, userPerfil }) {
  const router = useRouter();
  const isAdmin = userPerfil === 'admin';

  const [processos, setProcessos] = useState([]);
  const [municipios, setMunicipios] = useState([]);
  const [gestores, setGestores] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [conselheiros, setConselheiros] = useState([]);
  const [page, setPage] = useState('dashboard');
  const [consModal, setConsModal] = useState(undefined);
  const [consForm, setConsForm] = useState({ nome: '', tipo: 'Conselheiro' });
  const [atencaoResolve, setAtencaoResolve] = useState(null); // {processo, obs, file}
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: 'ok' });
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Filters
  const [psQ, setPsQ] = useState('');
  const [psEt, setPsEt] = useState('');
  const [psMu, setPsMu] = useState('');
  const [psSt, setPsSt] = useState('');
  const [muQ, setMuQ] = useState('');
  const [geQ, setGeQ] = useState('');
  const [usQ, setUsQ] = useState('');

  // Modals
  const [procModal, setProcModal] = useState(null);  // processo object
  const [procView, setProcView] = useState(null);  // processo view (read-only)
  const [procHist, setProcHist] = useState([]);
  const [procAnex, setProcAnex] = useState([]);
  const [procTab, setProcTab] = useState('dados');
  const [procEditMode, setProcEditMode] = useState(false);

  const [munModal, setMunModal] = useState(null);
  const [munTab, setMunTab] = useState('perfil');

  const [gestorModal, setGestorModal] = useState(null);
  const [userModal, setUserModal] = useState(undefined);

  const [rptModal, setRptModal] = useState(false);
  const [rptType, setRptType] = useState('p');
  const [rptCo, setRptCo] = useState('A');
  const [rptMun, setRptMun] = useState('');
  const [rptPreview, setRptPreview] = useState(null);
  const [calMes, setCalMes] = useState(() => { const d=new Date(); return {y:d.getFullYear(),m:d.getMonth()}; });

  const [novoModal, setNovoModal] = useState(false);
  const [npStep, setNpStep] = useState(1);
  const [npTipo, setNpTipo] = useState('');

  // Forms
  const [pForm, setPForm] = useState({});
  const [mForm, setMForm] = useState({});
  const [gForm, setGForm] = useState({});
  const [uForm, setUForm] = useState({});
  const [npForm, setNpForm] = useState({});

  // Mandatos/contatos/demandas add forms
  const [mandForm, setMandForm] = useState({ gestor:'', ano:'', status:'Ativo' });
  const anoAtual = new Date().getFullYear();
  const [ctForm, setCtForm] = useState({ nome:'', cargo:'', tel:'', email:'' });
  const [dmForm, setDmForm] = useState({ tipo:'Lei', numero:'', descricao:'', url:'' });

  // Historico form
  const [histForm, setHistForm] = useState({ tipo:'Defesa protocolada', data:'', descricao:'' });
  const [tceForm, setTceForm] = useState({ data:'', descricao:'' });

  const showToast = useCallback((msg, type='ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg:'', type:'ok' }), 3000);
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [p, m, g] = await Promise.all([
        api('/api/processos'),
        api('/api/municipios'),
        api('/api/gestores'),
      ]);
      setProcessos(p || []); setMunicipios(m || []); setGestores(g || []);

      // Load optional resources without blocking
      try { const c = await api('/api/conselheiros'); setConselheiros(c || []); } catch {}
      if (isAdmin) { try { const u = await api('/api/usuarios'); setUsuarios(u || []); } catch {} }
    } catch(e) { showToast('Erro ao carregar dados', 'err'); }
    finally { setLoading(false); setDataLoaded(true); }
  }

  useEffect(() => { loadAll(); }, []);

  async function doLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  function navTo(pg) {
    setPage(pg);
    setSidebarOpen(false);
  }

  // ── DASHBOARD STATS ──────────────────────────────────────────────────────
  const urg = processos.filter(p => { const d = du(p); return d !== null && d >= 0 && d <= 7; });
  const m30 = processos.filter(p => { const d = du(p); return d !== null && d >= 0 && d <= 30; });
  const ov  = processos.filter(p => { const d = du(p); return d !== null && d < 0; });
  const prorr = processos.filter(p => p.pr && p.pr !== p.pz);
  const julgados = processos.filter(p => p.et && p.et.startsWith('Julgado'));
  const vencHoje = processos.filter(p => du(p) === 0);
  const aguardPub = processos.filter(p => p.et === 'Aguardando Publicacao' || p.et === 'AGUARD. PUBLI');
  const mns = new Set(processos.map(p => p.mun).filter(Boolean));

  const urgBadgeCount = urg.length;

  // Sort processos by deadline
  const proxVenc = [...processos].filter(p => du(p) !== null).sort((a,b) => du(a)-du(b)).slice(0,12);
  const comAtencao = processos.filter(p => p.atencao);
  const ultimosAtualizados = [...processos].filter(p => p.updated_at).sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0,8);

  // Etapa chart data
  const etapaCnt = {};
  processos.forEach(p => { const e = p.et || 'Sem etapa'; etapaCnt[e] = (etapaCnt[e]||0)+1; });
  const etapaTop = Object.entries(etapaCnt).sort((a,b)=>b[1]-a[1]).slice(0,8);

  // Municipio chart
  const munCnt = {};
  processos.forEach(p => { if(p.mun) munCnt[p.mun] = (munCnt[p.mun]||0)+1; });
  const munTop = Object.entries(munCnt).sort((a,b)=>b[1]-a[1]).slice(0,8);

  // ── PROCESSOS FILTER ──────────────────────────────────────────────────────
  const filteredProc = processos.filter(p => {
    if (psQ && !`${p.proc} ${p.mun} ${p.resp} ${p.ass} ${p.gestor||''}`.toLowerCase().includes(psQ.toLowerCase())) return false;
    if (psEt && p.et !== psEt) return false;
    if (psMu && p.mun !== psMu) return false;
    if (psSt === 'urg') { const x=du(p); return x!==null&&x<=7&&x>=0; }
    if (psSt === 'mes') { const x=du(p); return x!==null&&x<=30&&x>=0; }
    if (psSt === 'sp') return !p.pz && !p.pr;
    if (psSt === 'ag') return !p.cit && !p.pz && !p.pr;
    return true;
  }).sort((a,b) => {
    const ta = isTransito(a), tb = isTransito(b);
    if (ta && !tb) return 1;   // transito goes to bottom
    if (!ta && tb) return -1;
    const aa = a.atencao, ab = b.atencao;
    if (aa && !ab) return -1;  // atencao goes to top
    if (!aa && ab) return 1;
    const da=du(a),db=du(b);
    if(da===null&&db===null)return 0;
    if(da===null)return 1;
    if(db===null)return-1;
    return da-db;
  });

  const etapasUniq = [...new Set(processos.map(p=>p.et).filter(Boolean))].sort();
  const munsUniq = [...new Set(processos.map(p=>p.mun).filter(Boolean))].sort();

  // ── PROCESSO MODAL ────────────────────────────────────────────────────────
  async function openProc(id) {
    const p = processos.find(x => x.id === id);
    if (!p) return;
    setProcModal({ ...p });
    setPForm({ ...p, ri: p.resp_int });
    setProcTab('dados');
    setProcEditMode(false);
    const [hist, anex] = await Promise.all([
      api(`/api/processos/${id}/historico`),
      api(`/api/processos/${id}/anexos`),
    ]);
    setProcHist(hist);
    setProcAnex(anex);
  }

  async function saveProc() {
    const p = procModal;
    const oldPr = p.pr;
    const newPr = pForm.pr;
    try {
      await api(`/api/processos/${p.id}`, { method: 'PUT', body: { ...pForm, tipo_ente: p.tipo_ente } });
      if (newPr && newPr !== oldPr) {
        await api(`/api/processos/${p.id}/historico`, { method: 'POST', body: { tipo: 'Prorrogacao de prazo', data: today(), descricao: `Prazo prorrogado para ${fd(newPr)}` }});
        const hist = await api(`/api/processos/${p.id}/historico`);
        setProcHist(hist);
      }
      const updated = { ...p, ...pForm, resp_int: pForm.ri };
      setProcModal(updated);
      setProcessos(prev => prev.map(x => x.id === p.id ? updated : x));
      showToast('Processo salvo');
    } catch(e) { showToast('Erro ao salvar: ' + e.message, 'err'); }
  }

  async function deleteProc() {
    if (!confirm('Excluir este processo? Esta acao nao pode ser desfeita.')) return;
    try {
      await api(`/api/processos/${procModal.id}`, { method: 'DELETE' });
      setProcessos(prev => prev.filter(x => x.id !== procModal.id));
      setProcModal(null);
      showToast('Processo excluído');
    } catch(e) { showToast('Erro ao excluir', 'err'); }
  }

  async function addHist() {
    if (!histForm.descricao) return;
    try {
      await api(`/api/processos/${procModal.id}/historico`, { method: 'POST', body: { ...histForm, data: histForm.data || today() }});
      const hist = await api(`/api/processos/${procModal.id}/historico`);
      setProcHist(hist);
      setHistForm({ tipo: 'Defesa protocolada', data: '', descricao: '' });
      showToast('Registrado');
    } catch(e) { showToast('Erro', 'err'); }
  }

  async function addTce() {
    if (!tceForm.descricao) return;
    try {
      await api(`/api/processos/${procModal.id}/historico`, { method: 'POST', body: { tipo: 'Movimentacao TCE', data: tceForm.data || today(), descricao: tceForm.descricao, tce: true }});
      const hist = await api(`/api/processos/${procModal.id}/historico`);
      setProcHist(hist);
      setTceForm({ data: '', descricao: '' });
      showToast('Movimentacao TCE registrada');
    } catch(e) { showToast('Erro', 'err'); }
  }

  async function uploadFile(e) {
    const files = e.target.files;
    if (!files.length) return;
    for (const f of files) {
      const fd = new FormData(); fd.append('file', f);
      try { await api(`/api/processos/${procModal.id}/anexos`, { method: 'POST', body: fd }); } catch {}
    }
    const anex = await api(`/api/processos/${procModal.id}/anexos`);
    setProcAnex(anex);
    showToast(`${files.length} arquivo(s) anexado(s)`);
    e.target.value = '';
  }

  async function deleteAnexo(aid) {
    try {
      await api(`/api/processos/${procModal.id}/anexos/${aid}`, { method: 'DELETE' });
      setProcAnex(prev => prev.filter(a => a.id !== aid));
    } catch {}
  }

  // ── MUNICIPIO MODAL ───────────────────────────────────────────────────────
  async function openMun(id) {
    const m = municipios.find(x => x.id === id);
    if (!m) return;
    setMunModal(m);
    setMForm({ nome: m.nome, tipo: m.tipo, estado: m.estado, logo: m.logo, obs: m.obs });
    setMunTab('perfil');
  }

  async function novoMun() {
    try {
      const res = await api('/api/municipios', { method: 'POST', body: { nome: 'Novo municipio', tipo: 'Prefeitura', estado: 'Maranhao' }});
      const muns = await api('/api/municipios');
      setMunicipios(muns);
      openMun(res.id);
    } catch(e) { showToast('Erro', 'err'); }
  }

  async function saveMun() {
    try {
      await api(`/api/municipios/${munModal.id}`, { method: 'PUT', body: mForm });
      const updated = { ...munModal, ...mForm };
      setMunModal(updated);
      setMunicipios(prev => prev.map(x => x.id === munModal.id ? { ...x, ...mForm } : x));
      showToast('Município salvo');
    } catch(e) { showToast('Erro', 'err'); }
  }

  async function deleteMun() {
    if (!confirm('Excluir este municipio?')) return;
    try {
      await api(`/api/municipios/${munModal.id}`, { method: 'DELETE' });
      setMunicipios(prev => prev.filter(x => x.id !== munModal.id));
      setMunModal(null);
      showToast('Município excluído');
    } catch(e) { showToast('Erro', 'err'); }
  }

  async function addMandato() {
    if (!mandForm.gestor || !mandForm.ano) { showToast('Selecione o gestor e o ano', 'err'); return; }
    try {
      await api(`/api/municipios/${munModal.id}/mandatos`, { method: 'POST', body: { gestor: mandForm.gestor, inicio: mandForm.ano, fim: mandForm.ano, status: 'Ativo' } });
      const muns = await api('/api/municipios');
      setMunicipios(muns);
      setMunModal(muns.find(x => x.id === munModal.id));
      setMandForm(f => ({ ...f, ano: '' }));
      showToast('Ano adicionado');
    } catch(e) { showToast('Erro', 'err'); }
  }

  async function deleteMandato(manid) {
    if (!confirm('Excluir este ano?')) return;
    try {
      await api(`/api/municipios/${munModal.id}/mandatos/${manid}`, { method: 'DELETE' });
      const muns = await api('/api/municipios');
      setMunicipios(muns);
      setMunModal(muns.find(x => x.id === munModal.id));
    } catch(e) { showToast('Erro', 'err'); }
  }

  async function addContato() {
    if (!ctForm.nome) return;
    try {
      await api(`/api/municipios/${munModal.id}/contatos`, { method: 'POST', body: ctForm });
      const muns = await api('/api/municipios');
      setMunicipios(muns);
      setMunModal(muns.find(x => x.id === munModal.id));
      setCtForm({ nome:'', cargo:'', tel:'', email:'' });
      showToast('Contato adicionado');
    } catch(e) { showToast('Erro', 'err'); }
  }

  async function rmContato(cid) {
    try {
      await api(`/api/municipios/${munModal.id}/contatos/${cid}`, { method: 'DELETE' });
      const muns = await api('/api/municipios');
      setMunicipios(muns);
      setMunModal(muns.find(x => x.id === munModal.id));
    } catch {}
  }

  async function addDemanda() {
    if (!dmForm.numero && !dmForm.descricao) return;
    try {
      await api(`/api/municipios/${munModal.id}/demandas`, { method: 'POST', body: { tipo: dmForm.tipo, descricao: dmForm.descricao, procvinc: dmForm.numero, status: dmForm.url } });
      const muns = await api('/api/municipios');
      setMunicipios(muns);
      setMunModal(muns.find(x => x.id === munModal.id));
      setDmForm({ tipo:'Lei', numero:'', descricao:'', url:'' });
      showToast('Demanda registrada');
    } catch(e) { showToast('Erro', 'err'); }
  }

  // ── GESTOR MODAL ──────────────────────────────────────────────────────────
  function openGestor(g) {
    setGestorModal(g);
    setGestorAssinaturaUrl(null);
    setGForm(g ? { nome:g.nome, cargo:g.cargo||'', municipio:g.municipio||'', tel:g.tel||'', email:g.email||'', contratoTipo:g.contrato_tipo||'Prefeitura', inicio:g.inicio||'', status:g.status||'Ativo', obs:g.obs||'' } : { nome:'', cargo:'', municipio:'', tel:'', email:'', contratoTipo:'Prefeitura', inicio:'', status:'Ativo', obs:'' });
    // Load signature preview if exists
    if (g?.assinatura) {
      api(`/api/gestores/assinatura/preview?path=${encodeURIComponent(g.assinatura)}`).then(r => setGestorAssinaturaUrl(r.url)).catch(()=>{});
    }
  }

  const [gestorAssinaturaUrl, setGestorAssinaturaUrl] = useState(null);

  async function uploadAssinatura(e, gid) {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('gestor_id', gid);
    try {
      const res = await api('/api/gestores/assinatura', { method: 'POST', body: fd });
      setGestorAssinaturaUrl(res.url);
      showToast('Assinatura salva!');
    } catch(e) { showToast('Erro ao salvar assinatura', 'err'); }
  }

  async function saveGestor() {
    if (!gForm.nome) return;
    try {
      if (gestorModal?.id) await api(`/api/gestores/${gestorModal.id}`, { method: 'PUT', body: gForm });
      else await api('/api/gestores', { method: 'POST', body: gForm });
      const g = await api('/api/gestores');
      setGestores(g);
      setGestorModal(null);
      showToast('Gestor salvo');
    } catch(e) { showToast('Erro', 'err'); }
  }

  async function deleteGestor() {
    if (!confirm('Excluir este gestor?')) return;
    try {
      await api(`/api/gestores/${gestorModal.id}`, { method: 'DELETE' });
      setGestores(prev => prev.filter(x => x.id !== gestorModal.id));
      setGestorModal(null);
      showToast('Gestor excluído');
    } catch(e) { showToast('Erro', 'err'); }
  }

  // ── USUARIO MODAL ─────────────────────────────────────────────────────────
  function openUser(u) {
    setUserModal(u);
    setUForm(u ? { nome:u.nome, email:u.email||'', perfil:u.perfil||'colaborador', ativo:u.ativo!==false, senha:'' } : { nome:'', email:'', perfil:'colaborador', ativo:true, senha:'' });
  }

  async function saveUser() {
    if (!uForm.nome || !uForm.email) { showToast('Nome e e-mail obrigatorios', 'err'); return; }
    if (!userModal && !uForm.senha) { showToast('Senha obrigatoria para novo usuario', 'err'); return; }
    try {
      if (userModal?.id) await api(`/api/usuarios/${userModal.id}`, { method: 'PUT', body: uForm });
      else await api('/api/usuarios', { method: 'POST', body: uForm });
      const u = await api('/api/usuarios');
      setUsuarios(u);
      setUserModal(undefined);
      showToast('Usuário salvo');
    } catch(e) { showToast('Erro: ' + e.message, 'err'); }
  }

  async function deleteUser() {
    if (!confirm('Excluir este usuario?')) return;
    try {
      await api(`/api/usuarios/${userModal.id}`, { method: 'DELETE' });
      setUsuarios(prev => prev.filter(x => x.id !== userModal.id));
      setUserModal(undefined);
      showToast('Usuário excluído');
    } catch(e) { showToast('Erro', 'err'); }
  }

  // ── NOVO PROCESSO ─────────────────────────────────────────────────────────
  function openNovo() {
    setNpStep(1); setNpTipo(''); setNpForm({});
    setNovoModal(true);
  }

  async function salvarNovo() {
    if (!npForm.proc) { showToast('Informe o numero do processo', 'err'); return; }
    if (!npForm.ex) { showToast('Informe o exercicio financeiro', 'err'); return; }
    if (!/^\d{1,6}\/\d{4}$/.test(npForm.proc)) { showToast('Formato invalido. Use: NNNN/AAAA', 'err'); return; }
    try {
      const res = await api('/api/processos', { method: 'POST', body: { ...npForm, tipo_ente: npTipo }});
      const procs = await api('/api/processos');
      setProcessos(procs);
      setNovoModal(false);
      showToast('Processo cadastrado!');
      await openProc(res.id);
    } catch(e) { showToast('Erro: ' + e.message, 'err'); }
  }

  // ── RELATORIO ─────────────────────────────────────────────────────────────
  function genRpt() {
    const isA = rptCo === 'A';
    const pri = isA ? '#1B6EC2' : '#1B7A4A';
    const lt  = isA ? '#EBF3FB' : '#E8F5EE';
    const brd = isA ? '#90C2EE' : '#A7D7BF';
    const nm  = isA ? 'ELOI ASSESSORIA E CONSULTORIA JURIDICA' : 'PR COMPLIANCE';
    const dt  = new Date().toLocaleDateString('pt-BR', { year:'numeric', month:'long', day:'numeric' });
    let rows = [];
    if (rptType==='p') rows = [...processos];
    else if (rptType==='m') rows = processos.filter(p => p.mun === rptMun);
    else if (rptType==='pr') rows = processos.filter(p => { const d=du(p); return d!==null&&d>=0&&d<=30; }).sort((a,b)=>du(a)-du(b));
    else rows = processos.filter(p => { const d=du(p); return d!==null&&d>=0&&d<=7; }).sort((a,b)=>du(a)-du(b));
    const titles = {p:'Relatorio de Processos',m:'Processos por Municipio',pr:'Prazos dos Proximos 30 Dias',u:'Processos Urgentes'};
    const tu = rows.filter(p => { const d=du(p); return d!==null&&d<=7&&d>=0; }).length;
    const tm = rows.filter(p => { const d=du(p); return d!==null&&d<=30&&d>=0; }).length;
    setRptPreview({ pri, lt, brd, nm, dt, rows, title: titles[rptType], tu, tm });
    setRptModal(false);
  }


  function printProc(procParam) {
    const p = procParam || procModal;
    if (!p) return;
    const dt = new Date().toLocaleDateString('pt-BR', {year:'numeric',month:'long',day:'numeric'});
    const fmtDate = s => s ? new Date(s+'T12:00:00').toLocaleDateString('pt-BR') : '—';
    const esc = s => (s||'—').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    const html = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
      '<title>SAPIENS - Processo ' + p.proc + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">' +
      '<style>' +
        '*{box-sizing:border-box;margin:0;padding:0}' +
        'body{font-family:Inter,sans-serif;padding:32px;font-size:13px;line-height:1.6;color:#212529}' +
        '.header{border-bottom:3px solid #1B6EC2;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-start}' +
        'h1{font-size:20px;font-weight:600;margin-bottom:4px}' +
        '.sub{font-size:12px;color:#6C757D;margin-bottom:0}' +
        '.badge{background:#EBF3FB;color:#1B6EC2;padding:2px 10px;border-radius:4px;font-size:11px;font-weight:600}' +
        '.section{margin-bottom:20px}' +
        '.st{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#1B6EC2;border-bottom:1px solid #E0E3E8;padding-bottom:6px;margin-bottom:12px}' +
        '.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}' +
        '.f label{font-size:10px;font-weight:600;color:#6C757D;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:2px}' +
        '.f span{font-size:13px;color:#212529}' +
        '.mono{font-family:"JetBrains Mono",monospace}' +
        '.full{grid-column:1/-1}' +
        '.footer{margin-top:32px;padding-top:12px;border-top:1px solid #E0E3E8;font-size:11px;color:#6C757D;display:flex;justify-content:space-between}' +
        '@media print{@page{margin:18mm;size:A4}}' +
      '</style></head><body>' +
      '<div class="header">' +
        '<div>' +
          '<div style="font-size:11px;font-weight:700;color:#1B6EC2;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px">SAPIENS · TCE-MA</div>' +
          '<h1>Processo ' + esc(p.proc) + '</h1>' +
          '<div class="sub">' + esc(p.tipo_ente) + ' ' + esc(p.mun) + ' &middot; Exercicio ' + esc(p.ex) + '</div>' +
        '</div>' +
        '<div style="text-align:right">' +
          '<div class="badge">' + esc(p.et) + '</div>' +
          '<div style="font-size:11px;color:#6C757D;margin-top:6px">Emitido em ' + dt + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="section"><div class="st">Dados do processo</div><div class="grid">' +
        '<div class="f"><label>Numero</label><span class="mono">' + esc(p.proc) + '</span></div>' +
        '<div class="f"><label>Exercício</label><span>' + esc(p.ex) + '</span></div>' +
        '<div class="f"><label>Município</label><span>' + esc(p.mun) + '</span></div>' +
        '<div class="f"><label>Tipo de ente</label><span>' + esc(p.tipo_ente) + '</span></div>' +
        '<div class="f full"><label>Assunto</label><span>' + esc(p.ass) + '</span></div>' +
        '<div class="f"><label>Natureza</label><span>' + esc(p.natureza) + '</span></div>' +
        '<div class="f"><label>Espécie</label><span>' + esc(p.especie) + '</span></div>' +
        '<div class="f"><label>Relator</label><span>' + esc(p.relator) + '</span></div>' +
        '<div class="f"><label>Gestor</label><span>' + esc(p.gestor) + '</span></div>' +
        '<div class="f"><label>Responsável / Advogado</label><span>' + esc(p.resp) + '</span></div>' +
        '<div class="f"><label>Responsável interno</label><span>' + esc(p.resp_int) + '</span></div>' +
        '<div class="f"><label>Situação</label><span>' + esc(p.sit) + '</span></div>' +
      '</div></div>' +
      '<div class="section"><div class="st">Prazos</div><div class="grid">' +
        '<div class="f"><label>Data de citacao</label><span class="mono">' + fmtDate(p.cit) + '</span></div>' +
        '<div class="f"><label>Prazo inicial</label><span class="mono">' + fmtDate(p.pz) + '</span></div>' +
        '<div class="f"><label>Prazo prorrogado</label><span class="mono">' + fmtDate(p.pr) + '</span></div>' +
        '<div class="f"><label>Prazo Int. Resp.</label><span>' + esc(p.pi) + '</span></div>' +
        '<div class="f"><label>Pedir prorrogacao</label><span>' + esc(p.pp||'Não') + '</span></div>' +
      '</div></div>' +
      (p.mt||p.md ? '<div class="section"><div class="st">Ultima movimentacao TCE</div><div class="grid"><div class="f"><label>Data</label><span class="mono">' + fmtDate(p.mt) + '</span></div><div class="f full"><label>Descrição</label><span>' + esc(p.md) + '</span></div></div></div>' : '') +
      (p.ac ? '<div class="section"><div class="st">Acao / Proximo passo</div><p>' + esc(p.ac) + '</p></div>' : '') +
      (p.obs ? '<div class="section"><div class="st">Observacoes internas</div><p>' + esc(p.obs) + '</p></div>' : '') +
      '<div class="footer"><span>SAPIENS · TCE-MA</span><span>Processo ' + esc(p.proc) + ' &middot; ' + dt + '</span></div>' +
      '<script>window.onload=function(){window.print();}<\/script>' +
      '</body></html>';

    const w = window.open('', '_blank', 'width=900,height=700');
    w.document.write(html);
    w.document.close();
  }

  async function resolveAtencao(proc, obs, file) {
    try {
      // Add historico entry
      await api(`/api/processos/${proc.id}/historico`, {
        method: 'POST',
        body: { tipo: 'Atenção concluída', data: today(), descricao: obs || 'Demanda urgente resolvida.', tce: false }
      });
      // Upload file if provided
      if (file) {
        const fd2 = new FormData(); fd2.append('file', file);
        try { await api(`/api/processos/${proc.id}/anexos`, { method: 'POST', body: fd2 }); } catch {}
      }
      // Clear atencao flag
      await api(`/api/processos/${proc.id}`, {
        method: 'PUT',
        body: { ...proc, ri: proc.resp_int, atencao: false, atencao_obs: '' }
      });
      const procs = await api('/api/processos');
      setProcessos(procs);
      setAtencaoResolve(null);
      showToast('Atenção concluída e registrada no histórico');
    } catch(e) { showToast('Erro: ' + e.message, 'err'); }
  }

  async function gerarProrrogacao() {
    const p = procModal;
    if (!p) return;

    // Find gestor in gestores list to get cargo and assinatura
    const gestorObj = gestores.find(g =>
      g.nome && p.gestor && g.nome.toLowerCase() === p.gestor.toLowerCase()
    );

    const payload = {
      proc: p.proc,
      ex: p.ex,
      especie: p.especie,
      natureza: p.natureza,
      mun: p.mun,
      tipo_ente: p.tipo_ente,
      gestor_nome: p.gestor || gestorObj?.nome || '',
      gestor_cargo: gestorObj?.cargo || '',
      relator: p.relator,
      assinatura_url: gestorObj?.assinatura || null,
    };

    try {
      const token = await getToken();
      const res = await fetch('/api/prorrogacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { showToast('Erro ao gerar documento', 'err'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prorrogacao_${p.proc.replace('/', '_')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Prorrogação gerada!');
    } catch(e) { showToast('Erro: ' + e.message, 'err'); }
  }

  function printRpt() {
    const r = rptPreview;
    const w = window.open('', '_blank', 'width=920,height=700');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>SAPIENS · Relatorio</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Inter,sans-serif;padding:32px;font-size:13px;line-height:1.6;color:#212529}@media print{@page{margin:18mm;size:A4}}</style></head><body>
    <div style="border-bottom:3px solid ${r.pri};padding-bottom:16px;margin-bottom:20px;display:flex;align-items:flex-start;justify-content:space-between">
      <div><div style="font-size:11px;font-weight:700;color:${r.pri};letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px">${r.nm}</div>
      <div style="font-size:20px;font-weight:600">${r.title}</div><div style="font-size:12px;color:#6C757D;margin-top:4px">Emitido em ${r.dt}</div></div>
      <div style="text-align:right"><div style="font-size:36px;font-weight:300;font-family:'JetBrains Mono',monospace;color:${r.pri}">${r.rows.length}</div>
      <div style="font-size:10px;font-weight:700;color:#6C757D;text-transform:uppercase">processos</div></div></div>
    <div style="display:flex;gap:12px;margin-bottom:20px">
      <div style="flex:1;background:${r.lt};border:1px solid ${r.brd};border-radius:6px;padding:12px 16px"><div style="font-size:10px;font-weight:700;color:#6C757D;text-transform:uppercase">Urgentes 7d</div><div style="font-size:22px;font-weight:300;color:#C0392B;font-family:'JetBrains Mono',monospace">${r.tu}</div></div>
      <div style="flex:1;background:${r.lt};border:1px solid ${r.brd};border-radius:6px;padding:12px 16px"><div style="font-size:10px;font-weight:700;color:#6C757D;text-transform:uppercase">Vence 30d</div><div style="font-size:22px;font-weight:300;color:#B45309;font-family:'JetBrains Mono',monospace">${r.tm}</div></div>
      <div style="flex:1;background:${r.lt};border:1px solid ${r.brd};border-radius:6px;padding:12px 16px"><div style="font-size:10px;font-weight:700;color:#6C757D;text-transform:uppercase">Municipios</div><div style="font-size:22px;font-weight:300;color:${r.pri};font-family:'JetBrains Mono',monospace">${new Set(r.rows.map(p=>p.mun).filter(Boolean)).size}</div></div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:${r.lt}">${['Processo','Ex.','Municipio','Assunto','Responsavel','Prazo','Dias','Etapa'].map(h=>`<th style="padding:7px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:${r.pri}">${h}</th>`).join('')}</tr></thead>
      <tbody>${r.rows.map((p,i)=>{const d=du(p);const bg=i%2===0?'#fff':r.lt;const ds=d!==null&&d<=7&&d>=0?'color:#C0392B;font-weight:700':d!==null&&d<=30&&d>=0?'color:#B45309;font-weight:700':'';return`<tr><td style="background:${bg};padding:7px 10px;font-family:'JetBrains Mono',monospace;font-size:11px;border-bottom:1px solid #E0E3E8">${p.proc}</td><td style="background:${bg};padding:7px 10px;border-bottom:1px solid #E0E3E8">${p.ex||'—'}</td><td style="background:${bg};padding:7px 10px;border-bottom:1px solid #E0E3E8">${p.mun||'—'}</td><td style="background:${bg};padding:7px 10px;border-bottom:1px solid #E0E3E8">${(p.ass||'').substring(0,55)}</td><td style="background:${bg};padding:7px 10px;font-size:11px;border-bottom:1px solid #E0E3E8">${p.resp?p.resp.substring(0,25):'—'}</td><td style="background:${bg};padding:7px 10px;font-family:'JetBrains Mono',monospace;font-size:11px;border-bottom:1px solid #E0E3E8">${fd(p.pr||p.pz)}</td><td style="background:${bg};padding:7px 10px;${ds};border-bottom:1px solid #E0E3E8">${d!==null?d+'d':'—'}</td><td style="background:${bg};padding:7px 10px;border-bottom:1px solid #E0E3E8">${p.et||'—'}</td></tr>`;}).join('')}</tbody>
    </table>
    <div style="margin-top:24px;padding-top:12px;border-top:1px solid #E0E3E8;font-size:11px;color:#6C757D;display:flex;justify-content:space-between"><span>${r.nm}</span><span>${r.rows.length} processo(s) · ${r.dt}</span></div>
    <script>window.onload=()=>window.print();<\/script></body></html>`);
    w.document.close();
  }

  async function openProcView(p) {
    if (!p) return;
    setProcView(p);
    // Load hist and anex for view
    const [hist, anex] = await Promise.all([
      api(`/api/processos/${p.id}/historico`).catch(()=>[]),
      api(`/api/processos/${p.id}/anexos`).catch(()=>[]),
    ]);
    setProcHist(hist);
    setProcAnex(anex);
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  if (loading || !dataLoaded) return (
    <div className="loading-overlay show">
      <div className="spinner-lg" />
      <span>Carregando SAPIENS...</span>
    </div>
  );

  const SidebarIcon = ({ path }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {path}
    </svg>
  );

  const procMuns = procModal ? processos.filter(p => p.mun && munModal && p.mun.toLowerCase() === munModal.nome?.toLowerCase()) : [];

  return (
    <>
      <Toast msg={toast.msg} type={toast.type} />
      {loading && <div className="loading-overlay show"><div className="spinner-lg" /></div>}

      <div className="layout">
        {/* ── SIDEBAR ── */}
        <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
          <div className="sb-logo">
            <div className="sb-logo-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <div className="sb-logo-text">SAPIENS</div>
              <div className="sb-logo-sub">TCE-MA · Processos</div>
            </div>
          </div>

          <div className="sbsec">Principal</div>
          {[
            { id:'dashboard', label:'Dashboard', icon:<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></> },
            { id:'processos', label:'Processos', icon:<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>, badge: urgBadgeCount },
            { id:'prazos', label:'Prazos', icon:<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></> },
          ].map(item => (
            <button key={item.id} className={`sbi${page===item.id?' active':''}`} onClick={()=>navTo(item.id)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{item.icon}</svg>
              {item.label}
              {item.badge ? <span className="sb-badge" style={{display:''}}>{item.badge}</span> : null}
            </button>
          ))}

          <div className="sbsec">Clientes</div>
          {[
            { id:'municipios', label:'Municipios', icon:<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></> },
            { id:'gestores', label:'Gestores', icon:<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></> },
          ].map(item => (
            <button key={item.id} className={`sbi${page===item.id?' active':''}`} onClick={()=>navTo(item.id)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{item.icon}</svg>
              {item.label}
            </button>
          ))}

          <div className="sbsec">Ferramentas</div>
          <button className="sbi" onClick={()=>setRptModal(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Relatorios
          </button>
          <button className={`sbi${page==='tce'?' active':''}`} onClick={()=>navTo('tce')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            TCE — Conselheiros
          </button>
          {isAdmin && (
            <button className={`sbi${page==='usuarios'?' active':''}`} onClick={()=>navTo('usuarios')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Usuarios
            </button>
          )}

          <div className="sb-footer">SAPIENS v4.0 · TCE-MA</div>
        </aside>

        {/* ── SIDEBAR OVERLAY (mobile) ── */}
        <div className={`sidebar-overlay${sidebarOpen?' open':''}`} onClick={()=>setSidebarOpen(false)} />

        {/* ── MAIN ── */}
        <div className="main">
          {/* TOPBAR */}
          <div className="topbar">
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <button className="hamburger" onClick={()=>setSidebarOpen(!sidebarOpen)} aria-label="Menu">
                <span/><span/><span/>
              </button>
              <div className="tb-t">
                {{dashboard:'Dashboard',processos:'Processos',prazos:'Prazos',municipios:'Municipios',gestores:'Gestores',usuarios:'Usuarios',tce:'TCE — Conselheiros'}[page]}
              </div>
            </div>
            <div className="tba">
              <button className="btn btn-sm" onClick={()=>setRptModal(true)}>Relatório</button>
              {isAdmin && <button className="btn btn-sm btnp" onClick={openNovo}>+ Novo processo</button>}
              <div className="user-pill" onClick={()=>setUserMenuOpen(v=>!v)}>
                <div className="user-av">{userNome.charAt(0).toUpperCase()}</div>
                <span className="user-name">{userNome}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                <div className={`user-menu${userMenuOpen?' open':''}`}>
                  <div className="um-item" style={{fontSize:11,textTransform:'uppercase',letterSpacing:'.05em',cursor:'default',color:'var(--t3)'}}>
                    {userPerfil === 'admin' ? 'Administrador' : 'Colaborador'}
                  </div>
                  <hr style={{border:'none',borderTop:'1px solid var(--bdr)',margin:'4px 0'}}/>
                  {isAdmin && (
                    <button className="um-item" onClick={()=>{ navTo('usuarios'); setUserMenuOpen(false); }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                      Gerenciar usuarios
                    </button>
                  )}
                  <button className="um-item" onClick={doLogout} style={{color:'var(--red)'}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Sair
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="page">

          {/* ══ DASHBOARD ══════════════════════════════════════════════ */}
          {page === 'dashboard' && (
            <>
              <div className="metrics-grid">
                <div className="mc r"><div className="mc-label">Urgentes (7 dias)</div><div className="mc-val">{urg.length}</div><div className="mc-sub">Acao imediata</div></div>
                <div className="mc a"><div className="mc-label">Vencem em 30 dias</div><div className="mc-val">{m30.length}</div><div className="mc-sub">Monitorar</div></div>
                <div className="mc b"><div className="mc-label">Total de processos</div><div className="mc-val">{processos.length}</div><div className="mc-sub">{mns.size} municipios</div></div>
                <div className="mc g"><div className="mc-label">Municipios ativos</div><div className="mc-val">{municipios.filter(m=>(m.mandatos||[]).some(md=>{const f=parseInt((md.fim||'0').substring(0,4));return f>=2026;})).length}</div><div className="mc-sub">{municipios.length} municipios cadastrados</div></div>
              </div>
              <div className="kpi-row">
                <div className="kpi-mini"><div className="kpi-icon" style={{background:'var(--rl)'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><div><div className="kpi-val" style={{color:'var(--red)'}}>{ov.length}</div><div className="kpi-lbl">Prazos vencidos</div></div></div>
                <div className="kpi-mini"><div className="kpi-icon" style={{background:'var(--al)'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--amb)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><div><div className="kpi-val" style={{color:'var(--amb)'}}>{vencHoje.length}</div><div className="kpi-lbl">Vencem hoje</div></div></div>
                <div className="kpi-mini"><div className="kpi-icon" style={{background:'var(--pl)'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--pur)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div><div className="kpi-val" style={{color:'var(--pur)'}}>{prorr.length}</div><div className="kpi-lbl">Com prorrogacao</div></div></div>
                <div className="kpi-mini"><div className="kpi-icon" style={{background:'var(--gl)'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--grn)" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div><div><div className="kpi-val" style={{color:'var(--grn)'}}>{municipios.length}</div><div className="kpi-lbl">Municipios</div></div></div>
              </div>
              <div style={{marginBottom:14}}>
                {comAtencao.length > 0 && (
                  <div style={{background:'#FFF3CD',border:'2px solid #FFC107',borderRadius:8,padding:'12px 16px',marginBottom:12}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#856404" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      <strong style={{color:'#856404',fontSize:13}}>{comAtencao.length} processo(s) requerem ATENÇÃO</strong>
                    </div>
                    {comAtencao.map(p=>(
                      <div key={p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'5px 0',borderTop:'1px solid rgba(133,100,4,.15)'}}>
                        <span style={{fontFamily:'"JetBrains Mono",monospace',fontSize:12,fontWeight:700,color:'#856404',minWidth:90,cursor:'pointer'}} onClick={()=>openProcView(p)}>{p.proc}</span>
                        <span style={{fontSize:12,color:'#856404',flex:1,cursor:'pointer'}} onClick={()=>openProcView(p)}>{p.mun||''}{p.atencao_obs ? ' — ' + p.atencao_obs : ''}</span>
                        <button className="btn btn-sm" style={{flexShrink:0,background:'var(--gl)',color:'var(--grn)',borderColor:'var(--grn)',fontSize:11}}
                          onClick={()=>setAtencaoResolve({proc:p,obs:'',file:null})}>
                          Concluir
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {ov.length > 0 && <div className="alrt r"><div><strong>{ov.length} processo(s) com prazo vencido</strong>{ov.slice(0,5).map(p=>p.proc).join(' · ')}{ov.length>5?` e mais ${ov.length-5}...`:''}</div></div>}
                {urg.length > 0 && <div className="alrt a"><div><strong>{urg.length} processo(s) vencem em ate 7 dias</strong>{urg.map(p=>`${p.proc} (${p.mun||'—'})`).join(' · ')}</div></div>}
                {aguardPub.length > 0 && <div className="alrt" style={{background:'#F5F3FF',border:'1px solid #A78BFA',color:'#4C1D95'}}><div><strong>{aguardPub.length} processo(s) aguardando publicacao</strong></div></div>}
              </div>
              <div className="gm">
                <div className="card">
                  <div className="card-title">Proximos vencimentos</div>
                  <div className="tw">
                    <table>
                      <thead><tr><th>Processo</th><th>Município</th><th className="hide-xs">Assunto</th><th className="hide-xs">Prazo</th><th>Dias</th><th className="hide-xs">Etapa</th></tr></thead>
                      <tbody>
                        {proxVenc.map(p => { const d=du(p); return (
                          <tr key={p.id} className={`cl${d!==null&&d<=7&&d>=0?' urg':d!==null&&d<=30&&d>=0?' wrn':''}`} onClick={()=>openProcView(processos.find(x=>x.id===p.id))}>
                            <td className="tdm">{p.proc}</td>
                            <td style={{fontSize:12,maxWidth:100,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.mun||'—'}</td>
                            <td className="hide-xs" style={{fontSize:12,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{(p.ass||'').substring(0,38)}</td>
                            <td className="hide-xs" style={{fontFamily:'"JetBrains Mono",monospace',fontSize:12}}>{fd(p.pr||p.pz)}</td>
                            <td><DaysBadge days={d}/></td>
                            <td className="hide-xs"><EtapaBadge et={p.et}/></td>
                          </tr>
                        );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                  <div className="card">
                    <div className="card-title">Por etapa</div>
                    {etapaTop.map(([k,v]) => <StatBar key={k} label={k} value={v} max={etapaTop[0][1]} color="#1B6EC2"/>)}
                  </div>
                  <div className="card">
                    <div className="card-title">Por municipio</div>
                    {munTop.map(([k,v]) => <StatBar key={k} label={k} value={v} max={munTop[0][1]} color="#5B2D8E"/>)}
                  </div>
                </div>
              </div>
              <div className="card" style={{marginTop:16}}>
                <div className="card-title">Últimos processos atualizados</div>
                <div className="tw">
                  <table>
                    <thead><tr><th>Processo</th><th>Município</th><th>Etapa</th><th>Atualizado em</th><th></th></tr></thead>
                    <tbody>
                      {ultimosAtualizados.map(p=>(
                        <tr key={p.id} className="cl" onClick={()=>openProcView(p)}>
                          <td className="tdm">
                            {p.atencao && <span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:'#FFC107',marginRight:6,verticalAlign:'middle'}}/>}
                            {p.proc}
                          </td>
                          <td style={{fontSize:12}}>{p.mun||'—'}</td>
                          <td><EtapaBadge et={p.et}/></td>
                          <td style={{fontFamily:'"JetBrains Mono",monospace',fontSize:11,color:'var(--t3)'}}>{p.updated_at?new Date(p.updated_at).toLocaleDateString('pt-BR'):'—'}</td>
                          <td>{p.atencao&&<span style={{fontSize:10,fontWeight:700,background:'#FFC107',color:'#856404',padding:'1px 8px',borderRadius:3}}>ATENÇÃO</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ══ PROCESSOS ═══════════════════════════════════════════════ */}
          {page === 'processos' && (
            <>
              <div className="fr">
                <input type="text" className="si" placeholder="Buscar processo, municipio, responsavel..." value={psQ} onChange={e=>setPsQ(e.target.value)}/>
                <select value={psEt} onChange={e=>setPsEt(e.target.value)}><option value="">Todas etapas</option>{etapasUniq.map(e=><option key={e}>{e}</option>)}</select>
                <select value={psMu} onChange={e=>setPsMu(e.target.value)}><option value="">Todos municipios</option>{munsUniq.map(m=><option key={m}>{m}</option>)}</select>
                <select value={psSt} onChange={e=>setPsSt(e.target.value)}><option value="">Todos</option><option value="urg">Urgentes 7d</option><option value="mes">30 dias</option><option value="sp">Sem prazo</option><option value="ag">Aguardando</option></select>
                {isAdmin && <button className="btn btn-sm btnp" onClick={openNovo}>+ Processo</button>}
              </div>
              <div className="card" style={{padding:0,overflow:'hidden'}}>
                <div className="tw">
                  <table>
                    <thead><tr><th style={{width:16}}></th><th>Processo</th><th className='hide-xs'>Ex.</th><th>Município</th><th className='hide-xs'>Assunto</th><th className='hide-xs'>Responsável</th><th>Prazo</th><th>Dias</th><th>Etapa</th><th className='hide-xs'>Últ. TCE</th><th className='hide-xs'></th></tr></thead>
                    <tbody>
                      {filteredProc.map(p => {
                        const d = du(p);
                        return (
                          <tr key={p.id} className={`cl${d!==null&&d<=7&&d>=0?' urg':d!==null&&d<=30&&d>=0?' wrn':''}`} onClick={()=>openProcView(processos.find(x=>x.id===p.id))}>
                            <td style={{padding:'0 4px 0 14px',width:16}}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg></td>
                            <td className="tdm">{p.proc}</td>
                            <td style={{fontSize:12}}>{p.ex||'—'}</td>
                            <td style={{fontSize:12,maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.tipo_ente?<span className="badge bgr" style={{fontSize:10,marginRight:4}}>{p.tipo_ente==='Camara Municipal'?'CM':'PF'}</span>:null}{p.mun||'—'}</td>
                            <td className='hide-xs' style={{fontSize:12,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{(p.ass||'').substring(0,48)}</td>
                            <td className='hide-xs' style={{fontSize:12}}>{p.resp?p.resp.split(' ').slice(0,2).join(' '):'—'}</td>
                            <td style={{fontFamily:'"JetBrains Mono",monospace',fontSize:12}}>{fd(p.pr||p.pz)}</td>
                            <td><DaysBadge days={d}/></td>
                            <td><EtapaBadge et={p.et}/></td>
                            <td style={{fontSize:11,color:'var(--t2)'}}>{p.mt ? <><span style={{fontFamily:'"JetBrains Mono",monospace'}}>{fd(p.mt)}</span>{p.md?<><br/><span style={{color:'var(--t3)'}}>{p.md.substring(0,25)}</span></>:null}</> : <span style={{color:'var(--t3)'}}>—</span>}</td>
                            <td>{isAdmin && <button className="btn btn-sm btn-ghost" style={{fontSize:11,color:'var(--blue)'}} onClick={e=>{e.stopPropagation();openProc(p.id).then(()=>setProcEditMode(true));}}>Editar</button>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{padding:'10px 16px',fontSize:12,color:'var(--t3)',borderTop:'1px solid var(--bdr)',background:'var(--s2)'}}>{filteredProc.length} processo(s) de {processos.length}</div>
              </div>
            </>
          )}

          {/* ══ PRAZOS ══════════════════════════════════════════════════ */}
          {page === 'prazos' && (
            <>
              <div className="fr">
                <select value={psMu} onChange={e=>setPsMu(e.target.value)}><option value="">Todos municipios</option>{munsUniq.map(m=><option key={m}>{m}</option>)}</select>
              </div>
              {/* Calendário */}
              {(() => {
                const { y, m } = calMes;
                const mNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
                const firstDay = new Date(y, m, 1).getDay();
                const daysInMonth = new Date(y, m+1, 0).getDate();
                const today2 = new Date(); today2.setHours(0,0,0,0);
                // Map deadlines to days
                const deadlineMap = {};
                processos.filter(p => !psMu || p.mun === psMu).forEach(p => {
                  const dl = edl(p);
                  if (!dl) return;
                  if (dl.getFullYear() === y && dl.getMonth() === m) {
                    const day = dl.getDate();
                    if (!deadlineMap[day]) deadlineMap[day] = [];
                    deadlineMap[day].push(p);
                  }
                });
                const cells = [];
                for (let i = 0; i < firstDay; i++) cells.push(null);
                for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                return (
                  <div className="card" style={{marginBottom:16}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                      <button className="btn btn-sm btn-ghost" onClick={()=>setCalMes(({y,m})=>m===0?{y:y-1,m:11}:{y,m:m-1})}>← Anterior</button>
                      <div style={{fontSize:15,fontWeight:600}}>{mNames[m]} {y}</div>
                      <button className="btn btn-sm btn-ghost" onClick={()=>setCalMes(({y,m})=>m===11?{y:y+1,m:0}:{y,m:m+1})}>Próximo →</button>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4}}>
                      {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=>(
                        <div key={d} style={{textAlign:'center',fontSize:10,fontWeight:700,color:'var(--t3)',textTransform:'uppercase',padding:'4px 0'}}>{d}</div>
                      ))}
                      {cells.map((day, i) => {
                        if (!day) return <div key={i}/>;
                        const procs = deadlineMap[day] || [];
                        const thisDate = new Date(y, m, day); thisDate.setHours(0,0,0,0);
                        const isToday = thisDate.getTime() === today2.getTime();
                        const isUrgent = procs.some(p => { const d = du(p); return d !== null && d >= 0 && d <= 7; });
                        const isWarn = procs.some(p => { const d = du(p); return d !== null && d >= 0 && d <= 30; });
                        const isOverdue = procs.some(p => (du(p)||0) < 0);
                        const bg = isOverdue ? 'rgba(192,57,43,.12)' : isUrgent ? 'rgba(192,57,43,.08)' : isWarn ? 'rgba(245,158,11,.08)' : procs.length ? 'var(--bl)' : 'transparent';
                        const border = isToday ? '2px solid var(--blue)' : procs.length ? '1px solid var(--bm)' : '1px solid transparent';
                        return (
                          <div key={day} style={{minHeight:64,borderRadius:6,padding:'4px 6px',background:bg,border,cursor:procs.length?'pointer':'default',position:'relative'}}
                            onClick={()=>procs.length>0 && setProcView(procs[0])}>
                            <div style={{fontSize:11,fontWeight:isToday?700:400,color:isToday?'var(--blue)':'var(--tx)',marginBottom:2}}>{day}</div>
                            {procs.slice(0,3).map(p=>(
                              <div key={p.id} style={{fontSize:9,fontWeight:600,background:du(p)<0?'var(--red)':du(p)<=7?'var(--red)':du(p)<=30?'#F59E0B':'var(--blue)',color:'#fff',borderRadius:3,padding:'1px 4px',marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}
                                onClick={e=>{e.stopPropagation();openProcView(p);}}>
                                {p.proc}
                              </div>
                            ))}
                            {procs.length > 3 && <div style={{fontSize:9,color:'var(--t3)'}}>+{procs.length-3}</div>}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{display:'flex',gap:16,marginTop:12,fontSize:11,color:'var(--t2)'}}>
                      <span><span style={{display:'inline-block',width:10,height:10,borderRadius:2,background:'var(--red)',marginRight:4}}/>Urgente/Vencido</span>
                      <span><span style={{display:'inline-block',width:10,height:10,borderRadius:2,background:'#F59E0B',marginRight:4}}/>30 dias</span>
                      <span><span style={{display:'inline-block',width:10,height:10,borderRadius:2,background:'var(--blue)',marginRight:4}}/>Com prazo</span>
                    </div>
                  </div>
                );
              })()}
              <div className="card" style={{padding:0,overflow:'hidden'}}>
                <div className="tw">
                  <table>
                    <thead><tr><th>Processo</th><th>Municipio</th><th>Assunto</th><th>Resp.</th><th>Citacao</th><th>Prazo</th><th>Prorrogado</th><th>Dias</th><th>Etapa</th></tr></thead>
                    <tbody>
                      {[...processos].filter(p=>edl(p)&&(!psMu||p.mun===psMu)).sort((a,b)=>edl(a)-edl(b)).map(p=>{
                        const d=du(p);
                        return (
                          <tr key={p.id} className={`cl${d!==null&&d<=7&&d>=0?' urg':d!==null&&d<=30&&d>=0?' wrn':''}`} onClick={()=>openProcView(processos.find(x=>x.id===p.id))}>
                            <td className="tdm">{p.proc}</td>
                            <td style={{fontSize:12}}>{p.mun||'—'}</td>
                            <td style={{fontSize:12,maxWidth:140}}>{(p.ass||'').substring(0,38)}</td>
                            <td style={{fontSize:12}}>{p.resp?p.resp.split(' ')[0]:'—'}</td>
                            <td style={{fontFamily:'"JetBrains Mono",monospace',fontSize:12}}>{fd(p.cit)}</td>
                            <td style={{fontFamily:'"JetBrains Mono",monospace',fontSize:12}}>{fd(p.pz)}</td>
                            <td style={{fontFamily:'"JetBrains Mono",monospace',fontSize:12}}>{fd(p.pr)}</td>
                            <td><DaysBadge days={d}/></td>
                            <td><EtapaBadge et={p.et}/></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ══ MUNICIPIOS ══════════════════════════════════════════════ */}
          {page === 'municipios' && (
            <>
              <div className="fr">
                <input type="text" placeholder="Buscar municipio..." value={muQ} onChange={e=>setMuQ(e.target.value)} style={{maxWidth:280}}/>
                {isAdmin && <button className="btn btn-sm btnp" onClick={novoMun}>+ Município</button>}
              </div>
              {municipios.filter(m=>!muQ||m.nome.toLowerCase().includes(muQ.toLowerCase())).length === 0
                ? <div style={{textAlign:'center',padding:48,color:'var(--t3)',border:'1px dashed var(--bdr)',borderRadius:8}}>Nenhum municipio cadastrado.</div>
                : <div className="mungrid">
                  {municipios.filter(m=>!muQ||m.nome.toLowerCase().includes(muQ.toLowerCase())).map(m=>{
                    const procs=processos.filter(p=>p.mun&&p.mun.toLowerCase()===m.nome.toLowerCase());
                    const urgM=procs.filter(p=>{const d=du(p);return d!==null&&d<=30&&d>=0;}).length;
                    const ini=m.nome.substring(0,2).toUpperCase();
                    const am=(m.mandatos||[]).find(md=>md.status==='Ativo');
                    return (
                      <div key={m.id} className="mcard" onClick={()=>openMun(m.id)}>
                        <div style={{display:'flex',gap:12,alignItems:'flex-start',marginBottom:12}}>
                          <div className="mlogo">{m.logo?<img src={m.logo} alt={ini} onError={e=>e.target.parentElement.textContent=ini}/>:ini}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:14,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.nome}</div>
                            <div style={{fontSize:11,color:'var(--t3)',marginTop:1}}>{m.tipo||'Prefeitura'}</div>
                            {am&&<div style={{fontSize:12,color:'var(--blue)',marginTop:4,fontWeight:500}}>{am.gestor}</div>}
                          </div>
                        </div>
                        {am&&<div className="mandbar"><div className="mandinfo"><span>Contrato</span><span>{am.inicio||'?'} – {am.fim||'?'}</span></div><div className="mandtrack"><div className="mandfill" style={{width:`${mpct(am)}%`}}/></div></div>}
                        <div className="mstats">
                          <div className="mstat"><div className="mstat-l">Processos</div><div className="mstat-v">{procs.length}</div></div>
                          <div className="mstat" style={urgM>0?{background:'var(--al)',borderColor:'#FFD54F'}:{}}><div className="mstat-l">Prox. 30d</div><div className="mstat-v" style={urgM>0?{color:'var(--amb)'}:{}}>{urgM}</div></div>
                          <div className="mstat"><div className="mstat-l">Mandatos</div><div className="mstat-v">{(m.mandatos||[]).length}</div></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              }
            </>
          )}

          {/* ══ GESTORES ════════════════════════════════════════════════ */}
          {page === 'gestores' && (
            <>
              <div className="fr">
                <input type="text" placeholder="Buscar gestor..." value={geQ} onChange={e=>setGeQ(e.target.value)} style={{maxWidth:280}}/>
                {isAdmin && <button className="btn btn-sm btnp" onClick={()=>openGestor({})}>+ Gestor</button>}
              </div>
              {gestores.filter(g=>!geQ||g.nome.toLowerCase().includes(geQ.toLowerCase())).length === 0
                ? <div style={{textAlign:'center',padding:48,color:'var(--t3)',border:'1px dashed var(--bdr)',borderRadius:8}}>Nenhum gestor cadastrado.</div>
                : <div className="g3">
                  {gestores.filter(g=>!geQ||g.nome.toLowerCase().includes(geQ.toLowerCase())).map(g=>{
                    const procs=processos.filter(p=>p.mun&&g.municipio&&p.mun.toLowerCase()===g.municipio.toLowerCase());
                    const sc={'Ativo':'bg','Inativo':'bgr','Monitoramento':'ba'};
                    return (
                      <div key={g.id} className="card" style={{cursor:'pointer'}} onClick={()=>isAdmin&&openGestor(g)}>
                        <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:12}}>
                          <div style={{width:44,height:44,borderRadius:'50%',background:'var(--bl)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:600,color:'var(--blue)',flexShrink:0,border:'1px solid var(--bm)'}}>{(g.nome||'GE').substring(0,2).toUpperCase()}</div>
                          <div>
                            <div style={{fontSize:14,fontWeight:600}}>{g.nome}</div>
                            <div style={{fontSize:12,color:'var(--t3)'}}>{g.cargo||'—'}</div>
                            <span className={`badge ${sc[g.status]||'bgr'}`} style={{marginTop:4}}>{g.status||'Ativo'}</span>
                          </div>
                        </div>
                        <div style={{fontSize:12,color:'var(--t2)',marginBottom:3}}>Municipio: <strong>{g.municipio||'—'}</strong></div>
                        <div style={{fontSize:12,color:'var(--t2)'}}>Contrato: <strong>{g.contrato_tipo||'—'}</strong></div>
                        <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--bdr)',textAlign:'center'}}>
                          <div style={{fontSize:20,fontWeight:300,fontFamily:'"JetBrains Mono",monospace'}}>{procs.length}</div>
                          <div style={{fontSize:10,fontWeight:600,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.04em'}}>processos</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              }
            </>
          )}

          {/* ══ TCE — CONSELHEIROS ════════════════════════════════════ */}
          {page === 'tce' && (
            <>
              <div className="fr">
                <div style={{flex:1}}><h2 style={{fontSize:15,fontWeight:600}}>Conselheiros e Conselheiros-Substitutos</h2><p style={{fontSize:12,color:'var(--t2)',marginTop:4}}>Cadastre os membros do TCE-MA. O nome completo será usado automaticamente no dropdown de Relator nos processos.</p></div>
                {isAdmin && <button className="btn btn-sm btnp" onClick={()=>{setConsModal(null);setConsForm({nome:'',tipo:'Conselheiro'});}}>+ Conselheiro</button>}
              </div>
              <div className="g2">
                <div className="card" style={{padding:0,overflow:'hidden'}}>
                  <div style={{padding:'14px 20px',borderBottom:'1px solid var(--bdr)',fontWeight:600,fontSize:12,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.06em'}}>Conselheiros</div>
                  <table>
                    <thead><tr><th>Nome</th><th>Titulo completo</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                      {conselheiros.filter(c=>c.tipo==='Conselheiro').map(c=>(
                        <tr key={c.id} className="cl">
                          <td style={{fontWeight:500}}>{c.nome}</td>
                          <td style={{fontSize:12,color:'var(--t2)'}}>{c.titulo}</td>
                          <td><span className={`badge ${c.ativo?'bg':'bgr'}`}>{c.ativo?'Ativo':'Inativo'}</span></td>
                          <td>{isAdmin&&<button className="btn btn-sm btn-ghost" onClick={()=>{setConsModal(c);setConsForm({nome:c.nome,tipo:c.tipo});}}>Editar</button>}</td>
                        </tr>
                      ))}
                      {conselheiros.filter(c=>c.tipo==='Conselheiro').length===0&&<tr><td colSpan="4" style={{textAlign:'center',padding:24,color:'var(--t3)'}}>Nenhum conselheiro cadastrado.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="card" style={{padding:0,overflow:'hidden'}}>
                  <div style={{padding:'14px 20px',borderBottom:'1px solid var(--bdr)',fontWeight:600,fontSize:12,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.06em'}}>Conselheiros-Substitutos</div>
                  <table>
                    <thead><tr><th>Nome</th><th>Titulo completo</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                      {conselheiros.filter(c=>c.tipo==='Conselheiro-Substituto').map(c=>(
                        <tr key={c.id} className="cl">
                          <td style={{fontWeight:500}}>{c.nome}</td>
                          <td style={{fontSize:12,color:'var(--t2)'}}>{c.titulo}</td>
                          <td><span className={`badge ${c.ativo?'bg':'bgr'}`}>{c.ativo?'Ativo':'Inativo'}</span></td>
                          <td>{isAdmin&&<button className="btn btn-sm btn-ghost" onClick={()=>{setConsModal(c);setConsForm({nome:c.nome,tipo:c.tipo});}}>Editar</button>}</td>
                        </tr>
                      ))}
                      {conselheiros.filter(c=>c.tipo==='Conselheiro-Substituto').length===0&&<tr><td colSpan="4" style={{textAlign:'center',padding:24,color:'var(--t3)'}}>Nenhum conselheiro-substituto cadastrado.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ══ USUARIOS ════════════════════════════════════════════════ */}
          {page === 'usuarios' && isAdmin && (
            <>
              <div className="fr">
                <input type="text" placeholder="Buscar usuario..." value={usQ} onChange={e=>setUsQ(e.target.value)} style={{maxWidth:280}}/>
                <button className="btn btn-sm btnp" onClick={()=>openUser(null)}>+ Usuário</button>
              </div>
              <div className="card" style={{padding:0,overflow:'hidden'}}>
                <table>
                  <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Cadastrado</th><th></th></tr></thead>
                  <tbody>
                    {usuarios.filter(u=>!usQ||`${u.nome} ${u.email}`.toLowerCase().includes(usQ.toLowerCase())).map(u=>(
                      <tr key={u.id} className="cl" onClick={()=>openUser(u)}>
                        <td style={{fontWeight:500}}>{u.nome}</td>
                        <td style={{fontSize:12,color:'var(--t2)'}}>{u.email}</td>
                        <td><span className={`badge ${u.perfil==='admin'?'bb':'bgr'}`}>{u.perfil==='admin'?'Administrador':'Colaborador'}</span></td>
                        <td><span className={`badge ${u.ativo?'bg':'bd'}`}>{u.ativo?'Ativo':'Inativo'}</span></td>
                        <td style={{fontSize:12,color:'var(--t3)'}}>{u.created_at?u.created_at.substring(0,10):'—'}</td>
                        <td><button className="btn btn-sm btn-ghost" onClick={e=>{e.stopPropagation();openUser(u);}}>Editar</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          </div>
        </div>
      </div>

      {/* ══ MODAL: PROCESSO ══════════════════════════════════════════════ */}
      {procModal && (
        <div className="modal-bg open">
          <div className="modal modal-lg">
            <div className="mhd">
              <div>
                <h2>Processo {procModal.proc}</h2>
                <div className="mhd-sub">{procModal.tipo_ente||''} {procModal.mun||'—'} · Exercicio {procModal.ex||'—'}{procModal.natureza?' · '+procModal.natureza:''}</div>
              </div>
              <button className="xb" onClick={()=>setProcModal(null)}>✕</button>
            </div>
            <div className="mbd">
              <div className="itabs">
                {['dados','prazos','movs','anex'].map(t=>(
                  <button key={t} className={`it${procTab===t?' active':''}`} onClick={()=>setProcTab(t)}>
                    {{dados:'Dados Gerais',prazos:'Prazos',movs:'Movimentações',anex:'Anexos'}[t]}
                  </button>
                ))}
              </div>

              {procTab === 'dados' && (
                <div className="fgrid">
                  <div className="fg"><label>Processo</label><input value={pForm.proc||''} onChange={e=>setPForm(f=>({...f,proc:e.target.value}))} disabled={!isAdmin}/></div>
                  <div className="fg"><label>Exercício</label><input value={pForm.ex||''} onChange={e=>setPForm(f=>({...f,ex:e.target.value}))} disabled={!isAdmin}/></div>
                  <div className="fg full"><label>Assunto</label><input value={pForm.ass||''} onChange={e=>setPForm(f=>({...f,ass:e.target.value}))} disabled={!isAdmin}/></div>
                  <div className="fg"><label>Município</label><input value={pForm.mun||''} onChange={e=>setPForm(f=>({...f,mun:e.target.value}))} disabled={!isAdmin}/></div>
                  <div className="fg"><label>Responsável / Advogado</label><input value={pForm.resp||''} onChange={e=>setPForm(f=>({...f,resp:e.target.value}))} disabled={!isAdmin}/></div>
                  <div className="fg"><label>Responsável interno</label><input value={pForm.ri||''} onChange={e=>setPForm(f=>({...f,ri:e.target.value}))} disabled={!isAdmin}/></div>
                  <div className="fg"><label>Etapa atual</label><select value={pForm.et||''} onChange={e=>setPForm(f=>({...f,et:e.target.value}))} disabled={!isAdmin}><option value="">Selecione</option>{ETAPAS.map(e=><option key={e}>{e}</option>)}</select></div>
                  <div className="fg"><label>Situação</label><input value={pForm.sit||''} onChange={e=>setPForm(f=>({...f,sit:e.target.value}))} disabled={!isAdmin}/></div>
                  <div className="fg"><label>Gestor</label><input value={pForm.gestor||''} onChange={e=>setPForm(f=>({...f,gestor:e.target.value}))} disabled={!isAdmin}/></div>
                  <div className="fg"><label>Relator</label>
                    <select value={pForm.relator||''} onChange={e=>setPForm(f=>({...f,relator:e.target.value}))} disabled={!isAdmin}>
                      <option value="">Selecione...</option>
                      {conselheiros.filter(c=>c.ativo).map(c=><option key={c.id} value={c.titulo}>{c.titulo}</option>)}
                    </select>
                  </div>
                  <div className="fg"><label>Natureza</label><select value={pForm.natureza||''} onChange={e=>setPForm(f=>({...f,natureza:e.target.value}))} disabled={!isAdmin}><option value="">Selecione</option>{NATUREZAS.map(n=><option key={n}>{n}</option>)}</select></div>
                  <div className="fg"><label>Espécie</label><select value={pForm.especie||''} onChange={e=>setPForm(f=>({...f,especie:e.target.value}))} disabled={!isAdmin}><option value="">Selecione</option>{ESPECIES.map(s=><option key={s}>{s}</option>)}</select></div>
                  <div className="fg full"><label>Ação / Próximo passo</label><input value={pForm.ac||''} onChange={e=>setPForm(f=>({...f,ac:e.target.value}))} disabled={!isAdmin}/></div>
                  <div className="fg full"><label>Observações</label><textarea value={pForm.obs||''} onChange={e=>setPForm(f=>({...f,obs:e.target.value}))} disabled={!isAdmin}/></div>
                  {isAdmin && (
                    <div className="full" style={{gridColumn:'1/-1'}}>
                      <div style={{background:pForm.atencao?'#FFF3CD':'var(--s2)',border:pForm.atencao?'2px solid #FFC107':'1px solid var(--bdr)',borderRadius:8,padding:'12px 16px',transition:'all .2s'}}>
                        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:pForm.atencao?10:0}}>
                          <input type="checkbox" id="chk-atencao" checked={pForm.atencao||false} onChange={e=>setPForm(f=>({...f,atencao:e.target.checked}))} style={{width:16,height:16,cursor:'pointer'}}/>
                          <label htmlFor="chk-atencao" style={{cursor:'pointer',fontWeight:600,fontSize:13,color:pForm.atencao?'#856404':'var(--t2)'}}>
                            {pForm.atencao ? 'Processo marcado com ATENÇÃO' : 'Marcar com ATENÇÃO'}
                          </label>
                        </div>
                        {pForm.atencao && (
                          <input value={pForm.atencao_obs||''} onChange={e=>setPForm(f=>({...f,atencao_obs:e.target.value}))}
                            placeholder="Descreva o motivo (ex: prazo crítico, cliente solicitou urgência...)"
                            style={{width:'100%',padding:'8px 10px',border:'1px solid #FFC107',borderRadius:6,fontSize:13,fontFamily:'inherit',background:'#FFFBEE',outline:'none'}}/>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {procTab === 'prazos' && (
                <>
                  <div className="fgrid">
                    <div className="fg"><label>Citação</label><input type="date" value={pForm.cit||''} onChange={e=>setPForm(f=>({...f,cit:e.target.value}))} disabled={!isAdmin}/></div>
                    <div className="fg"><label>Prazo inicial</label><input type="date" value={pForm.pz||''} onChange={e=>setPForm(f=>({...f,pz:e.target.value}))} disabled={!isAdmin}/></div>
                    <div className="fg"><label>Prazo prorrogado</label><input type="date" value={pForm.pr||''} onChange={e=>setPForm(f=>({...f,pr:e.target.value}))} disabled={!isAdmin}/></div>
                    <div className="fg"><label>Prazo Int. Resp.</label><input value={pForm.pi||''} onChange={e=>setPForm(f=>({...f,pi:e.target.value}))} disabled={!isAdmin}/></div>
                    <div className="fg"><label>Pedir prorrogacao?</label><select value={pForm.pp||'Não'} onChange={e=>setPForm(f=>({...f,pp:e.target.value}))} disabled={!isAdmin}><option>Não</option><option>Sim</option></select></div>
                    <div className="fg"><label>Dias restantes</label><div style={{padding:'8px 10px',background:'var(--s2)',borderRadius:6,border:'1px solid var(--bdr)'}}><DaysBadge days={du(pForm)}/></div></div>
                  </div>
                  <div style={{background:'var(--bl)',border:'1px solid var(--bm)',borderRadius:6,padding:'10px 14px',marginTop:12,fontSize:12,color:'var(--blue)'}}>Salvar nova prorrogacao registra automaticamente no historico.</div>
                </>
              )}

              {procTab === 'movs' && (
                <>
                  {isAdmin && (
                    <div style={{background:'var(--s2)',border:'1px solid var(--bdr)',borderRadius:8,padding:16,marginBottom:20}}>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 2fr',gap:12,marginBottom:12}}>
                        <div className="fg">
                          <label>Tipo</label>
                          <select value={histForm.tipo} onChange={e=>setHistForm(f=>({...f,tipo:e.target.value}))}>
                            <option>Movimentação TCE</option>
                            <option>Prorrogação de prazo</option>
                            <option>Defesa protocolada</option>
                            <option>Embargo protocolado</option>
                            <option>Minuta elaborada</option>
                            <option>Contato com responsável</option>
                            <option>Reunião</option>
                            <option>Movimentação interna</option>
                            <option>Outro</option>
                          </select>
                        </div>
                        <div className="fg">
                          <label>Data</label>
                          <input type="date" value={histForm.data} onChange={e=>setHistForm(f=>({...f,data:e.target.value}))}/>
                        </div>
                        <div className="fg">
                          <label>Descrição</label>
                          <input value={histForm.descricao} onChange={e=>setHistForm(f=>({...f,descricao:e.target.value}))} placeholder="Descreva a movimentação..."/>
                        </div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:12}}>
                        <label className="btn btn-sm" style={{cursor:'pointer',background:'var(--surf)'}}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                          Anexar arquivo
                          <input type="file" style={{display:'none'}} onChange={e=>setHistForm(f=>({...f,_file:e.target.files[0]}))}/>
                        </label>
                        {histForm._file && <span style={{fontSize:12,color:'var(--t2)'}}>{histForm._file.name}</span>}
                        <button className="btn btn-sm btnp" style={{marginLeft:'auto'}} onClick={addHist}>+ Registrar</button>
                      </div>
                    </div>
                  )}
                  <Timeline items={procHist} emptyMsg="Nenhuma movimentação registrada ainda."/>
                </>
              )}

              {procTab === 'anex' && (
                <>
                  {isAdmin && (
                    <div style={{marginBottom:14}}>
                      <label className="btn btn-sm" style={{cursor:'pointer'}}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                        Anexar arquivo
                        <input type="file" multiple onChange={uploadFile}/>
                      </label>
                      <span style={{fontSize:12,color:'var(--t3)',marginLeft:10}}>Qualquer tipo de arquivo</span>
                    </div>
                  )}
                  <div className="attlist">
                    {procAnex.map(a=>{
                      const ext=(a.nome||'').split('.').pop().toLowerCase();
                      const icons={pdf:'PDF',doc:'DOC',docx:'DOC',jpg:'IMG',jpeg:'IMG',png:'IMG',xls:'XLS',xlsx:'XLS',zip:'ZIP'};
                      async function downloadAnexo() {
                        try {
                          const token = await getToken();
                          const res = await fetch(`/api/processos/${procModal.id}/anexos/${a.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
                          if (!res.ok) { showToast('Erro ao baixar arquivo', 'err'); return; }
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url; link.download = a.nome; link.click();
                          URL.revokeObjectURL(url);
                        } catch(e) { showToast('Erro: '+e.message, 'err'); }
                      }
                      return (
                        <div key={a.id} className="att" style={{cursor:'pointer'}} onClick={downloadAnexo}>
                          <span style={{fontSize:10,fontWeight:700,color:'var(--blue)',background:'var(--bl)',padding:'2px 5px',borderRadius:3}}>{icons[ext]||'ARQ'}</span>
                          {a.nome}
                          {isAdmin && <button className="att-del" onClick={e=>{e.stopPropagation();deleteAnexo(a.id);}}>✕</button>}
                        </div>
                      );
                    })}
                    {isAdmin && <div className="att att-add" onClick={()=>document.querySelector('#proc-file-input').click()}>+ Adicionar</div>}
                    <input type="file" id="proc-file-input" multiple style={{display:'none'}} onChange={uploadFile}/>
                  </div>
                </>
              )}
            </div>
            <div className="mft">
              <button className="btn btn-sm" onClick={()=>setProcModal(null)}>Fechar</button>
              {isAdmin && <><button className="btn btn-sm btnd" onClick={deleteProc}>Excluir</button><button className="btn btn-sm btnp" onClick={saveProc}>Salvar alterações</button></>}
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: MUNICIPIO ═══════════════════════════════════════════ */}
      {munModal && (
        <div className="modal-bg open">
          <div className="modal modal-lg">
            <div className="mhd">
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                <div className="mlogo" style={{width:44,height:44,fontSize:14}}>{mForm.logo?<img src={mForm.logo} alt="logo" style={{width:'100%',height:'100%',objectFit:'contain'}}/>:munModal.nome.substring(0,2).toUpperCase()}</div>
                <div><h2>{munModal.nome}</h2><div className="mhd-sub">{munModal.tipo||'Prefeitura'}</div></div>
              </div>
              <button className="xb" onClick={()=>setMunModal(null)}>✕</button>
            </div>
            <div className="mbd">
              <div className="itabs">
                {['perfil','mandato','contatos','demandas','procs'].map(t=>(
                  <button key={t} className={`it${munTab===t?' active':''}`} onClick={()=>setMunTab(t)}>
                    {{perfil:'Perfil',mandato:'Contratos',contatos:'Equipe',demandas:'Legislacoes',procs:`Processos`}[t]}
                  </button>
                ))}
              </div>

              {munTab === 'perfil' && (
                <div className="fgrid">
                  <div className="fg full"><label>Nome *</label><input value={mForm.nome||''} onChange={e=>setMForm(f=>({...f,nome:e.target.value}))} disabled={!isAdmin}/></div>
                  <div className="fg"><label>Tipo</label><select value={mForm.tipo||'Prefeitura'} onChange={e=>setMForm(f=>({...f,tipo:e.target.value}))} disabled={!isAdmin}><option>Prefeitura</option><option>Camara Municipal</option><option>Secretaria</option><option>Outro</option></select></div>
                          <div className="fg full"><label>URL da logo</label><input value={mForm.logo||''} onChange={e=>setMForm(f=>({...f,logo:e.target.value}))} placeholder="https://..." disabled={!isAdmin}/></div>
                  <div className="fg full"><label>Observações</label><textarea value={mForm.obs||''} onChange={e=>setMForm(f=>({...f,obs:e.target.value}))} disabled={!isAdmin}/></div>
                  {isAdmin && <div className="full"><button className="btn btn-sm btnp" onClick={saveMun}>Salvar perfil</button></div>}
                </div>
              )}

              {munTab === 'mandato' && (
                <>
                  <div style={{background:'var(--bl)',border:'1px solid var(--bm)',borderRadius:6,padding:'10px 14px',marginBottom:16,fontSize:12,color:'var(--blue)'}}>
                    Adicione um ano de cada vez. Prefeituras: até 4 anos por mandato. Câmaras: até 2 anos. Os processos continuam sendo responsabilidade do escritório mesmo após o contrato.
                  </div>
                  {(() => {
                    const grupos = {};
                    (munModal.mandatos||[]).forEach(md => {
                      const g = md.gestor || 'Sem gestor';
                      if (!grupos[g]) grupos[g] = [];
                      grupos[g].push(md);
                    });
                    return Object.entries(grupos).map(([gestor, anos]) => (
                      <div key={gestor} style={{border:'1px solid var(--bdr)',borderRadius:8,padding:14,marginBottom:10}}>
                        <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>{gestor}</div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                          {[...anos].sort((a,b)=>parseInt(a.inicio)-parseInt(b.inicio)).map(md => (
                            <div key={md.id} style={{display:'flex',alignItems:'center',gap:6,background:'var(--bl)',border:'1px solid var(--bm)',borderRadius:6,padding:'4px 12px'}}>
                              <span style={{fontSize:14,fontWeight:600,color:'var(--blue)',fontFamily:'"JetBrains Mono",monospace'}}>{md.inicio}</span>
                              {isAdmin && <button onClick={()=>deleteMandato(md.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--red)',fontSize:16,lineHeight:1,padding:'0 2px'}} title="Excluir">×</button>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                  {!(munModal.mandatos||[]).length && <div style={{color:'var(--t3)',fontSize:13,marginBottom:16}}>Nenhum ano de exercício cadastrado.</div>}
                  {isAdmin && (
                    <div style={{border:'1px solid var(--bdr)',borderRadius:8,padding:16,background:'var(--s2)',marginTop:8}}>
                      <div style={{fontSize:11,fontWeight:600,color:'var(--t2)',marginBottom:12,textTransform:'uppercase',letterSpacing:'.06em'}}>Adicionar ano de exercício</div>
                      <div className="fgrid">
                        <div className="fg">
                          <label>Gestor / Representante</label>
                          <input value={mandForm.gestor} onChange={e=>setMandForm(f=>({...f,gestor:e.target.value}))} placeholder="Nome do prefeito ou presidente da câmara"/>
                        </div>
                        <div className="fg">
                          <label>Ano</label>
                          <select value={mandForm.ano} onChange={e=>setMandForm(f=>({...f,ano:e.target.value}))}>
                            <option value="">Selecione o ano...</option>
                            {Array.from({length:30},(_,i)=>anoAtual+5-i).map(a=>(
                              <option key={a} value={String(a)}>{a}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button className="btn btn-sm btnp" style={{marginTop:12}} onClick={addMandato}>Adicionar ano</button>
                    </div>
                  )}
                </>
              )}

              {munTab === 'contatos' && (
                <>
                  {(munModal.contatos||[]).map(c=>(
                    <div key={c.id} className="ctitem">
                      <div className="ctav">{c.nome.substring(0,2).toUpperCase()}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:500}}>{c.nome}</div>
                        <div style={{fontSize:11,color:'var(--t3)'}}>{c.cargo||'—'}{c.tel?' · '+c.tel:''}{c.email?' · '+c.email:''}</div>
                      </div>
                      {isAdmin && <button className="btn btn-sm btn-ghost" style={{color:'var(--red)'}} onClick={()=>rmContato(c.id)}>Remover</button>}
                    </div>
                  ))}
                  {!(munModal.contatos||[]).length && <div style={{color:'var(--t3)',fontSize:13,marginBottom:16}}>Nenhum membro da equipe cadastrado.</div>}
                  {isAdmin && (
                    <div style={{border:'1px solid var(--bdr)',borderRadius:8,padding:16,background:'var(--s2)'}}>
                      <div style={{fontSize:11,fontWeight:600,color:'var(--t2)',marginBottom:12,textTransform:'uppercase',letterSpacing:'.06em'}}>Adicionar membro da equipe</div>
                      <div className="fgrid">
                        <div className="fg"><label>Nome *</label><input value={ctForm.nome} onChange={e=>setCtForm(f=>({...f,nome:e.target.value}))} placeholder="Nome completo"/></div>
                        <div className="fg"><label>Cargo *</label><input value={ctForm.cargo} onChange={e=>setCtForm(f=>({...f,cargo:e.target.value}))} placeholder="ex: Prefeito, Contador, Assessor"/></div>
                        <div className="fg"><label>Telefone</label><input value={ctForm.tel} onChange={e=>setCtForm(f=>({...f,tel:e.target.value}))}/></div>
                        <div className="fg"><label>E-mail</label><input value={ctForm.email} onChange={e=>setCtForm(f=>({...f,email:e.target.value}))}/></div>
                      </div>
                      <button className="btn btn-sm btnp" style={{marginTop:12}} onClick={addContato}>Adicionar</button>
                    </div>
                  )}
                </>
              )}

              {munTab === 'demandas' && (
                <>
                  {(munModal.demandas||[]).length === 0 && <div style={{color:'var(--t3)',fontSize:13,marginBottom:16}}>Nenhuma legislacao cadastrada.</div>}
                  {(munModal.demandas||[]).map(d=>(
                    <div key={d.id} style={{display:'flex',gap:12,padding:'10px 0',borderBottom:'1px solid var(--bdr)',alignItems:'flex-start'}}>
                      <div style={{flexShrink:0}}>
                        <span className="badge bb" style={{fontSize:10}}>{d.tipo}</span>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:500}}>{d.procvinc||'—'}</div>
                        <div style={{fontSize:12,color:'var(--t2)'}}>{d.descricao||''}</div>
                        {d.status&&<a href={d.status} target="_blank" rel="noreferrer" style={{fontSize:11,color:'var(--blue)'}}>{d.status}</a>}
                      </div>
                      {isAdmin&&<button className="btn btn-sm btn-ghost" style={{color:'var(--red)',flexShrink:0}} onClick={()=>api(`/api/municipios/${munModal.id}/demandas/${d.id}`,{method:'DELETE'}).then(()=>{const muns=municipios.map(m=>m.id===munModal.id?{...m,demandas:(m.demandas||[]).filter(x=>x.id!==d.id)}:m);setMunicipios(muns);setMunModal(muns.find(x=>x.id===munModal.id));})}>Remover</button>}
                    </div>
                  ))}
                  {isAdmin && (
                    <div style={{border:'1px solid var(--bdr)',borderRadius:8,padding:16,background:'var(--s2)',marginTop:12}}>
                      <div style={{fontSize:11,fontWeight:600,color:'var(--t2)',marginBottom:12,textTransform:'uppercase',letterSpacing:'.06em'}}>Adicionar legislacao</div>
                      <div className="fgrid">
                        <div className="fg"><label>Tipo</label><select value={dmForm.tipo} onChange={e=>setDmForm(f=>({...f,tipo:e.target.value}))}><option>Lei</option><option>Lei Complementar</option><option>Decreto</option><option>Portaria</option><option>Resolucao</option><option>Instrucao Normativa</option><option>Outros</option></select></div>
                        <div className="fg"><label>Numero / Identificacao</label><input value={dmForm.numero||''} onChange={e=>setDmForm(f=>({...f,numero:e.target.value}))} placeholder="ex: Lei 10.520/2002"/></div>
                        <div className="fg full"><label>Descricao / Ementa</label><input value={dmForm.descricao} onChange={e=>setDmForm(f=>({...f,descricao:e.target.value}))} placeholder="ex: Lei de licitacoes e contratos"/></div>
                        <div className="fg full"><label>Link (opcional)</label><input value={dmForm.url||''} onChange={e=>setDmForm(f=>({...f,url:e.target.value}))} placeholder="https://..."/></div>
                      </div>
                      <button className="btn btn-sm btnp" style={{marginTop:12}} onClick={addDemanda}>Adicionar</button>
                    </div>
                  )}
                </>
              )}

              {munTab === 'procs' && (
                <div className="tw">
                  <table>
                    <thead><tr><th>Processo</th><th>Exercicio</th><th>Assunto</th><th>Prazo</th><th>Etapa</th></tr></thead>
                    <tbody>
                      {processos.filter(p=>p.mun&&p.mun.toLowerCase()===munModal.nome.toLowerCase()).map(p=>(
                        <tr key={p.id} className="cl" onClick={()=>{setMunModal(null);openProc(p.id);}}>
                          <td className="tdm">{p.proc}</td>
                          <td>{p.ex||'—'}</td>
                          <td style={{fontSize:12}}>{(p.ass||'').substring(0,50)}</td>
                          <td style={{fontFamily:'"JetBrains Mono",monospace',fontSize:12}}>{fd(p.pr||p.pz)}</td>
                          <td><EtapaBadge et={p.et}/></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="mft">
              {isAdmin && <button className="btn btn-sm btnd" onClick={deleteMun}>Excluir</button>}
              <button className="btn btn-sm" onClick={()=>setMunModal(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: GESTOR ══════════════════════════════════════════════ */}
      {gestorModal != null && (
        <div className="modal-bg open">
          <div className="modal">
            <div className="mhd"><h2>{gestorModal?.id ? gestorModal.nome : 'Novo gestor'}</h2><button className="xb" onClick={()=>setGestorModal(null)}>✕</button></div>
            <div className="mbd">
              <div className="fgrid">
                <div className="fg full"><label>Nome *</label><input value={gForm.nome||''} onChange={e=>setGForm(f=>({...f,nome:e.target.value}))}/></div>
                <div className="fg"><label>Cargo</label><input value={gForm.cargo||''} onChange={e=>setGForm(f=>({...f,cargo:e.target.value}))} placeholder="ex: Prefeito"/></div>
                <div className="fg"><label>Municipio vinculado</label><input value={gForm.municipio||''} onChange={e=>setGForm(f=>({...f,municipio:e.target.value}))}/></div>
                <div className="fg"><label>Telefone / WhatsApp</label><input value={gForm.tel||''} onChange={e=>setGForm(f=>({...f,tel:e.target.value}))}/></div>
                <div className="fg"><label>E-mail</label><input value={gForm.email||''} onChange={e=>setGForm(f=>({...f,email:e.target.value}))}/></div>
                <div className="fg"><label>Tipo de contrato</label><select value={gForm.contratoTipo||'Prefeitura'} onChange={e=>setGForm(f=>({...f,contratoTipo:e.target.value}))}><option>Prefeitura</option><option>Camara Municipal</option><option>Pessoal (direto com gestor)</option></select></div>
                <div className="fg"><label>Inicio do contrato</label><input type="date" value={gForm.inicio||''} onChange={e=>setGForm(f=>({...f,inicio:e.target.value}))}/></div>
                <div className="fg"><label>Status</label><select value={gForm.status||'Ativo'} onChange={e=>setGForm(f=>({...f,status:e.target.value}))}><option>Ativo</option><option>Inativo</option><option>Monitoramento</option></select></div>
                <div className="fg full"><label>Observações</label><textarea value={gForm.obs||''} onChange={e=>setGForm(f=>({...f,obs:e.target.value}))}/></div>
                {gestorModal?.id && (
                  <div className="fg full">
                    <label>Assinatura (PNG) — usada na prorrogação de prazo</label>
                    <div style={{display:'flex',alignItems:'center',gap:14,marginTop:4}}>
                      {gestorAssinaturaUrl
                        ? <img src={gestorAssinaturaUrl} alt="Assinatura" style={{height:56,border:'1px solid var(--bdr)',borderRadius:6,background:'var(--s2)',padding:4}}/>
                        : <div style={{height:56,width:140,border:'1px dashed var(--bdr)',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:'var(--t3)'}}>Sem assinatura</div>
                      }
                      <label className="btn btn-sm" style={{cursor:'pointer'}}>
                        📎 Upload PNG
                        <input type="file" accept="image/png" style={{display:'none'}} onChange={e=>uploadAssinatura(e, gestorModal.id)}/>
                      </label>
                    </div>
                    <div style={{fontSize:11,color:'var(--t3)',marginTop:4}}>Fundo transparente recomendado. Tamanho ideal: 400x130px.</div>
                  </div>
                )}
              </div>
            </div>
            <div className="mft">
              {gestorModal?.id && <button className="btn btn-sm btnd" onClick={deleteGestor}>Excluir</button>}
              <button className="btn btn-sm" onClick={()=>setGestorModal(null)}>Fechar</button>
              <button className="btn btn-sm btnp" onClick={saveGestor}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: USUARIO ═════════════════════════════════════════════ */}
      {userModal !== undefined && (
        <div className="modal-bg open">
          <div className="modal" style={{maxWidth:480}}>
            <div className="mhd"><h2>{userModal?.id ? userModal.nome : 'Novo usuario'}</h2><button className="xb" onClick={()=>setUserModal(undefined)}>✕</button></div>
            <div className="mbd">
              <div className="fgrid">
                <div className="fg full"><label>Nome completo *</label><input value={uForm.nome||''} onChange={e=>setUForm(f=>({...f,nome:e.target.value}))}/></div>
                <div className="fg full"><label>E-mail *</label><input type="email" value={uForm.email||''} onChange={e=>setUForm(f=>({...f,email:e.target.value}))}/></div>
                <div className="fg"><label>Perfil</label><select value={uForm.perfil||'colaborador'} onChange={e=>setUForm(f=>({...f,perfil:e.target.value}))}><option value="colaborador">Colaborador — somente leitura</option><option value="admin">Administrador — acesso total</option></select></div>
                <div className="fg"><label>Status</label><select value={uForm.ativo?'1':'0'} onChange={e=>setUForm(f=>({...f,ativo:e.target.value==='1'}))}><option value="1">Ativo</option><option value="0">Inativo</option></select></div>
                <div className="fg full"><label>Senha <span style={{color:'var(--t3)',fontWeight:400}}>{userModal?.id ? '(deixe vazio para nao alterar)' : '(obrigatoria)'}</span></label><input type="password" value={uForm.senha||''} onChange={e=>setUForm(f=>({...f,senha:e.target.value}))} placeholder="Minimo 6 caracteres"/></div>
              </div>
            </div>
            <div className="mft">
              {userModal?.id && <button className="btn btn-sm btnd" onClick={deleteUser}>Excluir</button>}
              <button className="btn btn-sm" onClick={()=>setUserModal(undefined)}>Fechar</button>
              <button className="btn btn-sm btnp" onClick={saveUser}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: NOVO PROCESSO (3 STEPS) ═════════════════════════════ */}
      {novoModal && (
        <div className="modal-bg open">
          <div className="modal" style={{maxWidth:600}}>
            <div className="mhd">
              <div><h2>Cadastrar processo</h2><div className="mhd-sub">Passo {npStep} de 3 — {{1:'Tipo de ente',2:'Municipio',3:'Dados do processo'}[npStep]}</div></div>
              <button className="xb" onClick={()=>setNovoModal(false)}>✕</button>
            </div>
            <div className="mbd">
              {/* Step indicators */}
              <div style={{display:'flex',alignItems:'flex-start',gap:0,marginBottom:20,overflowX:'auto'}}>
                {[1,2,3].map((s,i)=>(
                  <React.Fragment key={s}>
                    <div style={{flex:1,textAlign:'center'}}>
                      <div className={`step-dot${npStep>s?' done':npStep===s?' active':''}`}>{npStep>s?'✓':s}</div>
                      <div className={`step-label${npStep===s?' active':''}`}>{{1:'Tipo',2:'Entidade',3:'Processo'}[s]}</div>
                    </div>
                    {i<2&&<div style={{flex:1,display:'flex',alignItems:'center',paddingTop:13}}><div className={`step-line${npStep>s+1||npStep===s+1&&npStep>s?' done':''}`}/></div>}
                  </React.Fragment>
                ))}
              </div>

              {/* Step 1: Type */}
              {npStep===1 && (
                <div>
                  <div style={{fontSize:14,color:'var(--t2)',marginBottom:18,textAlign:'center'}}>O processo e de uma camara municipal ou de uma prefeitura / secretaria?</div>
                  <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                    {[{id:'Prefeitura',label:'Prefeitura / Secretaria',sub:'Poder Executivo Municipal'},{id:'Camara Municipal',label:'Camara Municipal',sub:'Poder Legislativo Municipal'}].map(t=>(
                      <div key={t.id} className={`type-card${npTipo===t.id?' selected':''}`} onClick={()=>{setNpTipo(t.id);setNpStep(2);}}>
                        <div style={{marginBottom:10}}><svg width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='var(--blue)' strokeWidth='1.5'><path d='M3 22h18M3 10h18M12 2L2 10h20L12 2z'/><rect x='5' y='10' width='3' height='12'/><rect x='10.5' y='10' width='3' height='12'/><rect x='16' y='10' width='3' height='12'/></svg></div>
                        <div style={{fontSize:14,fontWeight:600,marginBottom:3}}>{t.label}</div>
                        <div style={{fontSize:11,color:'var(--t3)'}}>{t.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Municipality */}
              {npStep===2 && (

                <>
                  <div style={{background:'var(--s2)',border:'1px solid var(--bdr)',borderRadius:6,padding:'8px 14px',marginBottom:16,fontSize:12,color:'var(--t2)',display:'flex',alignItems:'center',gap:8}}>
                    <span>Tipo: <strong>{npTipo}</strong></span>
                    <button className="btn btn-sm btn-ghost" style={{marginLeft:'auto',fontSize:11}} onClick={()=>setNpStep(1)}>Alterar</button>
                  </div>
                  <div className="fgrid">
                    <div className="fg full">
                      <label>Municipio *</label>
                      <select value={npForm.mun||''} onChange={e=>setNpForm(f=>({...f,mun:e.target.value}))}>
                        <option value="">Selecione o municipio...</option>
                        {municipios.map(m=><option key={m.id} value={m.nome}>{m.nome} ({m.tipo})</option>)}
                      </select>
                      <div style={{fontSize:11,color:'var(--t3)',marginTop:4}}>Nao encontrou? <button className="btn btn-sm btn-ghost" style={{fontSize:11,padding:'2px 6px'}} onClick={()=>{setNovoModal(false);navTo('municipios');}}>Cadastre o municipio primeiro</button></div>
                    </div>
                    <div className="fg full">
                      <label>Gestor responsavel</label>
                      <select value={npForm.gestor||''} onChange={e=>setNpForm(f=>({...f,gestor:e.target.value}))}>
                        <option value="">Selecione o gestor...</option>
                        {gestores.filter(g => !npForm.mun || (g.municipio && g.municipio.toLowerCase() === npForm.mun.toLowerCase())).map(g => (
                          <option key={g.id} value={g.nome}>{g.nome} — {g.cargo||g.contrato_tipo||'Gestor'}</option>
                        ))}
                        {gestores.filter(g => !npForm.mun || (g.municipio && g.municipio.toLowerCase() === npForm.mun.toLowerCase())).length === 0 && (
                          <option disabled>Nenhum gestor cadastrado para este municipio</option>
                        )}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Step 3: Process data */}
              {npStep===3 && (
                <>
                  <div style={{background:'var(--s2)',border:'1px solid var(--bdr)',borderRadius:6,padding:'8px 14px',marginBottom:16,fontSize:12,color:'var(--t2)',display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                    <strong>{npTipo} · {npForm.mun}</strong>
                    <button className="btn btn-sm btn-ghost" style={{marginLeft:'auto',fontSize:11}} onClick={()=>setNpStep(1)}>Alterar</button>
                  </div>
                  <div className="fgrid">
                    <div className="fg"><label>Numero do processo * <span style={{fontSize:11,color:'var(--t3)',fontWeight:400}}>Formato: NNNN/AAAA</span></label><input value={npForm.proc||''} onChange={e=>setNpForm(f=>({...f,proc:e.target.value}))} placeholder="ex: 1234/2025"/></div>
                    <div className="fg"><label>Exercicio financeiro *</label><input type="number" value={npForm.ex||''} onChange={e=>setNpForm(f=>({...f,ex:e.target.value}))} placeholder="ex: 2024" min="2000" max="2099"/></div>
                    <div className="fg full"><label>Assunto</label><input value={npForm.ass||''} onChange={e=>setNpForm(f=>({...f,ass:e.target.value}))} placeholder="ex: Prestacao de contas anual de governo"/></div>
                    <div className="fg"><label>Natureza</label><select value={npForm.natureza||''} onChange={e=>setNpForm(f=>({...f,natureza:e.target.value}))}><option value="">Selecione</option>{NATUREZAS.map(n=><option key={n}>{n}</option>)}</select></div>
                    <div className="fg"><label>Espécie</label><select value={npForm.especie||''} onChange={e=>setNpForm(f=>({...f,especie:e.target.value}))}><option value="">Selecione</option>{ESPECIES.map(s=><option key={s}>{s}</option>)}</select></div>
                    <div className="fg"><label>Relator</label>
                      <select value={npForm.relator||''} onChange={e=>setNpForm(f=>({...f,relator:e.target.value}))}>
                        <option value="">Selecione...</option>
                        {conselheiros.filter(c=>c.ativo).map(c=><option key={c.id} value={c.titulo}>{c.titulo}</option>)}
                      </select>
                    </div>
                    <div className="fg"><label>Responsável / Advogado</label><input value={npForm.resp||''} onChange={e=>setNpForm(f=>({...f,resp:e.target.value}))}/></div>
                  </div>
                </>
              )}
            </div>
            <div className="mft">
              <button className="btn btn-sm" onClick={()=>setNovoModal(false)}>Cancelar</button>
              {npStep>1 && <button className="btn btn-sm" onClick={()=>setNpStep(s=>s-1)}>← Voltar</button>}
              {npStep===2 && <button className="btn btn-sm btnp" onClick={()=>{if(!npForm.mun){showToast('Selecione o municipio','err');return;}setNpStep(3);}}>Proximo →</button>}
              {npStep===3 && <button className="btn btn-sm btnp" onClick={salvarNovo}>Cadastrar processo</button>}
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: RELATORIO ═══════════════════════════════════════════ */}
      {rptModal && (
        <div className="modal-bg open">
          <div className="modal modal-lg">
            <div className="mhd"><h2>Gerar relatorio</h2><button className="xb" onClick={()=>setRptModal(false)}>✕</button></div>
            <div className="mbd">
              <div style={{fontSize:11,fontWeight:600,color:'var(--t2)',marginBottom:12,textTransform:'uppercase',letterSpacing:'.07em'}}>1. Tipo de relatorio</div>
              <div className="g2" style={{gap:10,marginBottom:20}}>
                {[{k:'p',title:'Todos os processos',sub:'Lista completa com prazos'},{k:'m',title:'Por municipio',sub:'Processos de um cliente'},{k:'pr',title:'Prazos do mes',sub:'Vencimentos em 30 dias'},{k:'u',title:'Urgentes',sub:'Prazos ate 7 dias'}].map(({k,title,sub})=>(
                  <div key={k} className={`ropt${rptType===k?' sel':''}`} onClick={()=>setRptType(k)}>
                    <div style={{fontSize:11,fontWeight:700,color:rptType===k?'var(--blue)':'var(--t2)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:4}}>{title}</div>
                    <div style={{fontSize:12,color:'var(--t2)'}}>{sub}</div>
                  </div>
                ))}
              </div>
              {rptType==='m' && (
                <div className="fg" style={{marginBottom:16}}>
                  <label>Selecionar municipio</label>
                  <select value={rptMun} onChange={e=>setRptMun(e.target.value)}>
                    <option value="">Selecione...</option>
                    {[...new Set(processos.map(p=>p.mun).filter(Boolean))].sort().map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
              )}
              <div style={{fontSize:11,fontWeight:600,color:'var(--t2)',marginBottom:12,textTransform:'uppercase',letterSpacing:'.07em'}}>2. Identidade visual</div>
              <div className="g2" style={{gap:10}}>
                {[{k:'A',label:'ELOI ASSESSORIA',sub:'Cabecalho azul'},{k:'B',label:'PR COMPLIANCE',sub:'Cabecalho verde-escuro'}].map(({k,label,sub})=>(
                  <div key={k} className={`ropt${rptCo===k?' sel':''}`} onClick={()=>setRptCo(k)}>
                    <div style={{fontSize:11,fontWeight:700,color:rptCo===k?'var(--blue)':'var(--t2)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:4}}>{label}</div>
                    <div style={{fontSize:12,color:'var(--t2)'}}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mft">
              <button className="btn btn-sm" onClick={()=>setRptModal(false)}>Cancelar</button>
              <button className="btn btn-sm btnp" onClick={genRpt}>Gerar PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: RELATORIO PREVIEW ════════════════════════════════════ */}
      {rptPreview && (
        <div className="modal-bg open">
          <div className="modal modal-lg" style={{maxWidth:860}}>
            <div className="mhd"><h2>Pre-visualizacao</h2><button className="xb" onClick={()=>setRptPreview(null)}>✕</button></div>
            <div style={{padding:'22px 24px',fontSize:13,lineHeight:1.6}}>
              <div style={{borderBottom:`3px solid ${rptPreview.pri}`,paddingBottom:16,marginBottom:20,display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:rptPreview.pri,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:4}}>{rptPreview.nm}</div>
                  <div style={{fontSize:20,fontWeight:600}}>{rptPreview.title}</div>
                  <div style={{fontSize:12,color:'var(--t2)',marginTop:4}}>Emitido em {rptPreview.dt}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:36,fontWeight:300,fontFamily:'"JetBrains Mono",monospace',color:rptPreview.pri}}>{rptPreview.rows.length}</div>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--t3)',textTransform:'uppercase'}}>processos</div>
                </div>
              </div>
              <div className="tw">
                <table>
                  <thead style={{background:rptPreview.lt}}>
                    <tr>{['Processo','Ex.','Municipio','Assunto','Responsavel','Prazo','Dias','Etapa'].map(h=><th key={h} style={{color:rptPreview.pri}}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rptPreview.rows.map(p=>{
                      const d=du(p);
                      return (
                        <tr key={p.id}>
                          <td className="tdm">{p.proc}</td>
                          <td>{p.ex||'—'}</td>
                          <td style={{fontSize:12}}>{p.mun||'—'}</td>
                          <td style={{fontSize:12,maxWidth:180}}>{(p.ass||'').substring(0,50)}</td>
                          <td style={{fontSize:12}}>{p.resp?p.resp.substring(0,22):'—'}</td>
                          <td style={{fontFamily:'"JetBrains Mono",monospace',fontSize:12}}>{fd(p.pr||p.pz)}</td>
                          <td style={{color:d!==null&&d<=7&&d>=0?'var(--red)':d!==null&&d<=30&&d>=0?'var(--amb)':undefined,fontWeight:d!==null&&d<=30&&d>=0?600:400}}>{d!==null?d+'d':'—'}</td>
                          <td><EtapaBadge et={p.et}/></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mft">
              <button className="btn btn-sm" onClick={()=>setRptPreview(null)}>Fechar</button>
              <button className="btn btn-sm btnp" onClick={printRpt}>Imprimir / Salvar PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: RESOLVER ATENÇÃO ══════════════════════════════════════ */}
      {atencaoResolve && (
        <div className="modal-bg open">
          <div className="modal" style={{maxWidth:480}}>
            <div className="mhd">
              <div>
                <h2>Concluir ATENÇÃO</h2>
                <div className="mhd-sub">Processo {atencaoResolve.proc.proc} · {atencaoResolve.proc.mun}</div>
              </div>
              <button className="xb" onClick={()=>setAtencaoResolve(null)}>✕</button>
            </div>
            <div className="mbd">
              {atencaoResolve.proc.atencao_obs && (
                <div style={{background:'#FFF3CD',border:'1px solid #FFC107',borderRadius:6,padding:'8px 12px',marginBottom:16,fontSize:12,color:'#856404'}}>
                  <strong>Motivo original:</strong> {atencaoResolve.proc.atencao_obs}
                </div>
              )}
              <div className="fg" style={{marginBottom:14}}>
                <label>O que foi feito? *</label>
                <textarea
                  value={atencaoResolve.obs}
                  onChange={e=>setAtencaoResolve(r=>({...r,obs:e.target.value}))}
                  placeholder="Descreva como a demanda foi resolvida..."
                  style={{minHeight:90}}
                />
              </div>
              <div className="fg">
                <label>Anexar documento (opcional)</label>
                <label className="btn btn-sm" style={{cursor:'pointer',marginTop:4}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  Selecionar arquivo
                  <input type="file" style={{display:'none'}} onChange={e=>setAtencaoResolve(r=>({...r,file:e.target.files[0]}))}/>
                </label>
                {atencaoResolve.file && <span style={{fontSize:12,color:'var(--t2)',marginLeft:10}}>{atencaoResolve.file.name}</span>}
              </div>
            </div>
            <div className="mft">
              <button className="btn btn-sm" onClick={()=>setAtencaoResolve(null)}>Cancelar</button>
              <button className="btn btn-sm btnp" onClick={()=>{
                if(!atencaoResolve.obs){showToast('Descreva o que foi feito','err');return;}
                resolveAtencao(atencaoResolve.proc, atencaoResolve.obs, atencaoResolve.file);
              }}>Confirmar conclusão</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: CONSELHEIRO ═════════════════════════════════════════ */}
      {consModal !== undefined && (
        <div className="modal-bg open">
          <div className="modal" style={{maxWidth:440}}>
            <div className="mhd">
              <h2>{consModal?.id ? 'Editar conselheiro' : 'Novo conselheiro'}</h2>
              <button className="xb" onClick={()=>setConsModal(undefined)}>✕</button>
            </div>
            <div className="mbd">
              <div className="fgrid">
                <div className="fg full">
                  <label>Tipo</label>
                  <select value={consForm.tipo} onChange={e=>{
                    setConsForm(f=>({...f,tipo:e.target.value}));
                  }}>
                    <option value="Conselheiro">Conselheiro</option>
                    <option value="Conselheiro-Substituto">Conselheiro-Substituto</option>
                  </select>
                </div>
                <div className="fg full">
                  <label>Nome completo *</label>
                  <input value={consForm.nome} onChange={e=>setConsForm(f=>({...f,nome:e.target.value}))} placeholder="ex: Antonio Pereira Costa"/>
                  <div style={{fontSize:11,color:'var(--t3)',marginTop:4}}>
                    Título gerado: <strong>{consForm.tipo === 'Conselheiro' ? `Conselheiro ${consForm.nome||'...'}` : `Conselheiro-Substituto ${consForm.nome||'...'}`}</strong>
                  </div>
                </div>
              </div>
            </div>
            <div className="mft">
              {consModal?.id && <button className="btn btn-sm btnd" onClick={async()=>{
                await api(`/api/conselheiros/${consModal.id}`,{method:'DELETE'});
                setConselheiros(prev=>prev.filter(c=>c.id!==consModal.id));
                setConsModal(undefined); showToast('Excluído');
              }}>Excluir</button>}
              <button className="btn btn-sm" onClick={()=>setConsModal(undefined)}>Fechar</button>
              <button className="btn btn-sm btnp" onClick={async()=>{
                if(!consForm.nome){showToast('Informe o nome','err');return;}
                try{
                  if(consModal?.id){
                    await api(`/api/conselheiros/${consModal.id}`,{method:'PUT',body:consForm});
                  } else {
                    await api('/api/conselheiros',{method:'POST',body:consForm});
                  }
                  const c=await api('/api/conselheiros');
                  setConselheiros(c);
                  setConsModal(undefined);
                  showToast('Salvo!');
                }catch(e){showToast('Erro: '+e.message,'err');}
              }}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: PROCESSO VIEW (leitura) ═════════════════════════════ */}
      {procView && (
        <div className="modal-bg open">
          <div className="modal modal-lg">
            <div className="mhd">
              <div>
                <h2>Processo {procView.proc}</h2>
                <div className="mhd-sub">{procView.tipo_ente||''} {procView.mun||'—'} · Exercício {procView.ex||'—'}{procView.natureza?' · '+procView.natureza:''}</div>
                {procView.atencao && (
                  <div style={{marginTop:6,display:'flex',alignItems:'center',gap:8,background:'#FFF3CD',border:'1px solid #FFC107',borderRadius:6,padding:'5px 10px',fontSize:12,color:'#856404',fontWeight:500}}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#856404" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    ATENÇÃO{procView.atencao_obs ? ': ' + procView.atencao_obs : ''}
                  </div>
                )}
              </div>
              <button className="xb" onClick={()=>setProcView(null)}>✕</button>
            </div>
            <div className="mbd">
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:16,marginBottom:16}}>
                {/* Coluna esquerda — dados */}
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--blue)',textTransform:'uppercase',letterSpacing:'.07em',borderBottom:'2px solid var(--bl)',paddingBottom:6,marginBottom:14}}>Dados do processo</div>
                  {[
                    ['Número',procView.proc],['Exercício',procView.ex],['Município',procView.mun],
                    ['Tipo de ente',procView.tipo_ente],['Assunto',procView.ass],
                    ['Natureza',procView.natureza],['Espécie',procView.especie],
                    ['Relator',procView.relator],['Gestor',procView.gestor],
                    ['Responsável',procView.resp],['Resp. interno',procView.resp_int],
                    ['Situação',procView.sit],
                  ].map(([k,v])=>v?(
                    <div key={k} style={{marginBottom:8}}>
                      <div style={{fontSize:10,fontWeight:600,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:1}}>{k}</div>
                      <div style={{fontSize:13}}>{v}</div>
                    </div>
                  ):null)}
                </div>
                {/* Coluna direita — prazos */}
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--blue)',textTransform:'uppercase',letterSpacing:'.07em',borderBottom:'2px solid var(--bl)',paddingBottom:6,marginBottom:14}}>Prazos e situação</div>
                  <div style={{background:'var(--s2)',border:'1px solid var(--bdr)',borderRadius:8,padding:'12px 16px',marginBottom:14,display:'flex',alignItems:'center',gap:12}}>
                    <div style={{flex:1}}><div style={{fontSize:11,color:'var(--t3)',marginBottom:4}}>Dias restantes</div><DaysBadge days={du(procView)}/></div>
                    <EtapaBadge et={procView.et}/>
                  </div>
                  {[
                    ['Citação', procView.cit ? new Date(procView.cit+'T12:00:00').toLocaleDateString('pt-BR') : null],
                    ['Prazo inicial', procView.pz ? new Date(procView.pz+'T12:00:00').toLocaleDateString('pt-BR') : null],
                    ['Prazo prorrogado', procView.pr ? new Date(procView.pr+'T12:00:00').toLocaleDateString('pt-BR') : null],
                    ['Prazo Int. Resp.', procView.pi],
                    ['Pedir prorrogação', procView.pp],
                  ].map(([k,v])=>v?(
                    <div key={k} style={{marginBottom:8}}>
                      <div style={{fontSize:10,fontWeight:600,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:1}}>{k}</div>
                      <div style={{fontSize:13,fontFamily:k.includes('Prazo')||k.includes('Citação')?'"JetBrains Mono",monospace':'inherit'}}>{v}</div>
                    </div>
                  ):null)}
                  {(procView.mt||procView.md) && (
                    <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid var(--bdr)'}}>
                      <div style={{fontSize:10,fontWeight:700,color:'var(--blue)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:10}}>Última mov. TCE</div>
                      {procView.mt && <div style={{marginBottom:6}}><div style={{fontSize:10,fontWeight:600,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:1}}>Data</div><div style={{fontSize:13,fontFamily:'"JetBrains Mono",monospace'}}>{new Date(procView.mt+'T12:00:00').toLocaleDateString('pt-BR')}</div></div>}
                      {procView.md && <div style={{marginBottom:6}}><div style={{fontSize:10,fontWeight:600,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:1}}>Descrição</div><div style={{fontSize:13}}>{procView.md}</div></div>}
                    </div>
                  )}
                  {procView.ac && (
                    <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid var(--bdr)'}}>
                      <div style={{fontSize:10,fontWeight:700,color:'var(--amb)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:8}}>Ação / Próximo passo</div>
                      <div style={{fontSize:13,background:'var(--al)',border:'1px solid #FFD54F',borderRadius:6,padding:'8px 12px'}}>{procView.ac}</div>
                    </div>
                  )}
                  {procView.obs && (
                    <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid var(--bdr)'}}>
                      <div style={{fontSize:10,fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:6}}>Observações</div>
                      <div style={{fontSize:13,color:'var(--t2)'}}>{procView.obs}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Histórico */}
              {procHist.length > 0 && (
                <div style={{marginBottom:20,paddingTop:16,borderTop:'1px solid var(--bdr)'}}>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--blue)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:14}}>Histórico de movimentações</div>
                  <Timeline items={procHist} emptyMsg=""/>
                </div>
              )}

              {/* Anexos */}
              {procAnex.length > 0 && (
                <div style={{paddingTop:16,borderTop:'1px solid var(--bdr)'}}>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--blue)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:12}}>Arquivos anexados</div>
                  <div className="attlist">
                    {procAnex.map(a=>{
                      const ext=(a.nome||'').split('.').pop().toLowerCase();
                      const icons={pdf:'PDF',doc:'DOC',docx:'DOC',jpg:'IMG',jpeg:'IMG',png:'IMG',xls:'XLS',xlsx:'XLS',zip:'ZIP'};
                      async function dl() {
                        const token=await getToken();
                        const res=await fetch(`/api/processos/${procView.id}/anexos/${a.id}`,{headers:{'Authorization':`Bearer ${token}`}});
                        if(!res.ok)return;
                        const blob=await res.blob();
                        const url=URL.createObjectURL(blob);
                        const lk=document.createElement('a');lk.href=url;lk.download=a.nome;lk.click();
                        URL.revokeObjectURL(url);
                      }
                      return (
                        <div key={a.id} className="att" style={{cursor:'pointer'}} onClick={dl}>
                          <span style={{fontSize:10,fontWeight:700,color:'var(--blue)',background:'var(--bl)',padding:'2px 5px',borderRadius:3}}>{icons[ext]||'ARQ'}</span>
                          {a.nome}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="mft">
              <button className="btn btn-sm" onClick={()=>setProcView(null)}>Fechar</button>
              <button className="btn btn-sm" onClick={()=>{ setProcModal(procView); setPForm({...procView, ri: procView.resp_int}); setProcView(null); loadHistorico(procView.id); loadAnexos(procView.id); }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Editar
              </button>
              <button className="btn btn-sm" onClick={()=>printProc(procView)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}


    </>
  );
}
