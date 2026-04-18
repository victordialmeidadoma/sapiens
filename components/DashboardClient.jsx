'use client';
import { api } from '@/components/api';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

// ── UTILS ────────────────────────────────────────────────────────────────────
const pd = s => { if (!s) return null; const d = new Date(s + 'T12:00:00'); return isNaN(d) ? null : d; };
const fd = s => { if (!s) return '—'; const d = pd(s); return d ? d.toLocaleDateString('pt-BR') : s; };
const today = () => new Date().toISOString().split('T')[0];
const du = p => { const dl = pd(p.pr) || pd(p.pz); if (!dl) return null; const n = new Date(); n.setHours(0,0,0,0); return Math.round((dl - n) / 86400000); };
const edl = p => pd(p.pr) || pd(p.pz);
const mpct = m => { const s = pd(m.inicio), e = pd(m.fim), n = new Date(); if (!s||!e) return 50; return Math.max(0, Math.min(100, Math.round((n-s)/(e-s)*100))); };

const ETAPA_MAP = {
  'Aguardando Citacao':'et-ag-cit','Citado — Em Prazo':'et-em-prazo',
  'Em Defesa':'et-em-defesa','Defesa Protocolada':'et-def-prot',
  'Prorrogacao Solicitada':'et-prorr','Prorrogacao Concedida':'et-prorr',
  'Em Embargos':'et-embargos','Embargo Protocolado':'et-emb-prot',
  'Em Minuta':'et-minuta','Minuta Elaborada':'et-minuta',
  'Aguardando Pauta':'et-pauta','Sustentacao Oral':'et-oral',
  'Retirado de Pauta':'et-pauta','Aguardando Publicacao':'et-pauta',
  'Julgado — Regular':'et-julgado-r','Julgado — Irregular':'et-julgado-i','Arquivado':'et-arch',
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

const ETAPAS = ['Aguardando Citacao','Citado — Em Prazo','Em Defesa','Defesa Protocolada','Prorrogacao Solicitada','Prorrogacao Concedida','Em Embargos','Embargo Protocolado','Em Minuta','Minuta Elaborada','Aguardando Pauta','Sustentacao Oral','Retirado de Pauta','Aguardando Publicacao','Julgado — Regular','Julgado — Irregular','Arquivado'];
const NATUREZAS = ['Prestacao de Contas','Representacao','Denuncia','Tomada de Contas Especial','Fiscalizacao','Consulta','Recurso','Outros'];
const ESPECIES = ['Prestacao de Contas Anual de Governo','Prestacao de Contas Anual de Gestores','Tomada de Contas de Gestores','Representacao — Licitacao','Representacao — Contratos','Representacao — Pessoal','Fiscalizacao de Obras','Fiscalizacao de Contratos','Denuncia','Consulta Juridica','Recurso de Revisao','Embargo de Declaracao','Outros'];
const TL_COLORS = {'Prorrogacao de prazo':{dot:'#B45309',cls:'ba',lbl:'PRAZO'},'Defesa protocolada':{dot:'#1B7A4A',cls:'bg',lbl:'DEFESA'},'Embargo protocolado':{dot:'#5B2D8E',cls:'bpu',lbl:'EMBARGO'},'Minuta elaborada':{dot:'#0F766E',cls:'btl',lbl:'MINUTA'},'Movimentacao TCE':{dot:'#1B6EC2',cls:'bb',lbl:'TCE'},'Contato com responsavel':{dot:'#0F766E',cls:'btl',lbl:'CONTATO'},'Reuniao':{dot:'#0F766E',cls:'btl',lbl:'REUNIAO'},'Movimentacao interna':{dot:'#6C757D',cls:'bgr',lbl:'INTERNO'},'Outro':{dot:'#ADB5BD',cls:'bgr',lbl:'OUTRO'}};

function Toast({ msg, type }) {
  if (!msg) return null;
  return <div className={`toast show ${type}`}>{msg}</div>;
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
  const [page, setPage] = useState('dashboard');
  const [loading, setLoading] = useState(true);
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
  const [procHist, setProcHist] = useState([]);
  const [procAnex, setProcAnex] = useState([]);
  const [procTab, setProcTab] = useState('dados');

  const [munModal, setMunModal] = useState(null);
  const [munTab, setMunTab] = useState('perfil');

  const [gestorModal, setGestorModal] = useState(null);
  const [userModal, setUserModal] = useState(null);

  const [rptModal, setRptModal] = useState(false);
  const [rptType, setRptType] = useState('p');
  const [rptCo, setRptCo] = useState('A');
  const [rptMun, setRptMun] = useState('');
  const [rptPreview, setRptPreview] = useState(null);

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
  const [mandForm, setMandForm] = useState({ gestor:'', inicio:'', fim:'', escopo:'', contratocom:'Prefeitura', status:'Ativo' });
  const [ctForm, setCtForm] = useState({ nome:'', cargo:'', tel:'', email:'' });
  const [dmForm, setDmForm] = useState({ tipo:'Defesa em processo TCE', data:'', descricao:'', status:'Em andamento', procvinc:'' });

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
      const reqs = [api('/api/processos'), api('/api/municipios'), api('/api/gestores')];
      if (isAdmin) reqs.push(api('/api/usuarios'));
      const [p, m, g, u] = await Promise.all(reqs);
      setProcessos(p); setMunicipios(m); setGestores(g);
      if (u) setUsuarios(u);
    } catch(e) { showToast('Erro ao carregar dados', 'err'); }
    finally { setLoading(false); }
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
  }).sort((a,b) => { const da=du(a),db=du(b); if(da===null&&db===null)return 0; if(da===null)return 1; if(db===null)return-1; return da-db; });

  const etapasUniq = [...new Set(processos.map(p=>p.et).filter(Boolean))].sort();
  const munsUniq = [...new Set(processos.map(p=>p.mun).filter(Boolean))].sort();

  // ── PROCESSO MODAL ────────────────────────────────────────────────────────
  async function openProc(id) {
    const p = processos.find(x => x.id === id);
    if (!p) return;
    setProcModal({ ...p });
    setPForm({ ...p, ri: p.resp_int });
    setProcTab('dados');
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
      showToast('Processo excluido');
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
      showToast('Municipio salvo');
    } catch(e) { showToast('Erro', 'err'); }
  }

  async function deleteMun() {
    if (!confirm('Excluir este municipio?')) return;
    try {
      await api(`/api/municipios/${munModal.id}`, { method: 'DELETE' });
      setMunicipios(prev => prev.filter(x => x.id !== munModal.id));
      setMunModal(null);
      showToast('Municipio excluido');
    } catch(e) { showToast('Erro', 'err'); }
  }

  async function addMandato() {
    if (!mandForm.gestor) return;
    try {
      await api(`/api/municipios/${munModal.id}/mandatos`, { method: 'POST', body: mandForm });
      const muns = await api('/api/municipios');
      setMunicipios(muns);
      const updated = muns.find(x => x.id === munModal.id);
      setMunModal(updated);
      setMandForm({ gestor:'', inicio:'', fim:'', escopo:'', contratocom:'Prefeitura', status:'Ativo' });
      showToast('Mandato adicionado');
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
    if (!dmForm.descricao) return;
    try {
      await api(`/api/municipios/${munModal.id}/demandas`, { method: 'POST', body: dmForm });
      const muns = await api('/api/municipios');
      setMunicipios(muns);
      setMunModal(muns.find(x => x.id === munModal.id));
      setDmForm({ tipo:'Defesa em processo TCE', data:'', descricao:'', status:'Em andamento', procvinc:'' });
      showToast('Demanda registrada');
    } catch(e) { showToast('Erro', 'err'); }
  }

  // ── GESTOR MODAL ──────────────────────────────────────────────────────────
  function openGestor(g) {
    setGestorModal(g);
    setGForm(g ? { nome:g.nome, cargo:g.cargo||'', municipio:g.municipio||'', tel:g.tel||'', email:g.email||'', contratoTipo:g.contrato_tipo||'Prefeitura', inicio:g.inicio||'', status:g.status||'Ativo', obs:g.obs||'' } : { nome:'', cargo:'', municipio:'', tel:'', email:'', contratoTipo:'Prefeitura', inicio:'', status:'Ativo', obs:'' });
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
      showToast('Gestor excluido');
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
      showToast('Usuario salvo');
    } catch(e) { showToast('Erro: ' + e.message, 'err'); }
  }

  async function deleteUser() {
    if (!confirm('Excluir este usuario?')) return;
    try {
      await api(`/api/usuarios/${userModal.id}`, { method: 'DELETE' });
      setUsuarios(prev => prev.filter(x => x.id !== userModal.id));
      setUserModal(undefined);
      showToast('Usuario excluido');
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
    const nm  = isA ? 'Empresa A — Advocacia Publica' : 'Empresa B — Consultoria Tributaria';
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

  // ── RENDER ────────────────────────────────────────────────────────────────
  if (loading) return (
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
                {{dashboard:'Dashboard',processos:'Processos',prazos:'Prazos',municipios:'Municipios',gestores:'Gestores',usuarios:'Usuarios'}[page]}
              </div>
            </div>
            <div className="tba">
              <button className="btn btn-sm" onClick={()=>setRptModal(true)}>Relatorio</button>
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
                <div className="mc g"><div className="mc-label">Municipios</div><div className="mc-val">{municipios.length}</div><div className="mc-sub">{gestores.length} gestores</div></div>
              </div>
              <div className="kpi-row">
                <div className="kpi-mini"><div className="kpi-icon" style={{background:'var(--rl)'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><div><div className="kpi-val" style={{color:'var(--red)'}}>{ov.length}</div><div className="kpi-lbl">Prazos vencidos</div></div></div>
                <div className="kpi-mini"><div className="kpi-icon" style={{background:'var(--al)'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--amb)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><div><div className="kpi-val" style={{color:'var(--amb)'}}>{vencHoje.length}</div><div className="kpi-lbl">Vencem hoje</div></div></div>
                <div className="kpi-mini"><div className="kpi-icon" style={{background:'var(--pl)'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--pur)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div><div className="kpi-val" style={{color:'var(--pur)'}}>{prorr.length}</div><div className="kpi-lbl">Com prorrogacao</div></div></div>
                <div className="kpi-mini"><div className="kpi-icon" style={{background:'var(--gl)'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--grn)" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg></div><div><div className="kpi-val" style={{color:'var(--grn)'}}>{julgados.length}</div><div className="kpi-lbl">Julgados</div></div></div>
              </div>
              <div style={{marginBottom:14}}>
                {ov.length > 0 && <div className="alrt r"><div><strong>{ov.length} processo(s) com prazo vencido</strong>{ov.slice(0,5).map(p=>p.proc).join(' · ')}{ov.length>5?` e mais ${ov.length-5}...`:''}</div></div>}
                {urg.length > 0 && <div className="alrt a"><div><strong>{urg.length} processo(s) vencem em ate 7 dias</strong>{urg.map(p=>`${p.proc} (${p.mun||'—'})`).join(' · ')}</div></div>}
                {aguardPub.length > 0 && <div className="alrt" style={{background:'#F5F3FF',border:'1px solid #A78BFA',color:'#4C1D95'}}><div><strong>{aguardPub.length} processo(s) aguardando publicacao</strong></div></div>}
              </div>
              <div className="gm">
                <div className="card">
                  <div className="card-title">Proximos vencimentos</div>
                  <div className="tw">
                    <table>
                      <thead><tr><th>Processo</th><th>Municipio</th><th>Assunto</th><th>Prazo</th><th>Dias</th><th>Etapa</th></tr></thead>
                      <tbody>
                        {proxVenc.map(p => { const d=du(p); return (
                          <tr key={p.id} className={`cl${d!==null&&d<=7&&d>=0?' urg':d!==null&&d<=30&&d>=0?' wrn':''}`} onClick={()=>openProc(p.id)}>
                            <td className="tdm">{p.proc}</td>
                            <td style={{fontSize:12,maxWidth:100,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.mun||'—'}</td>
                            <td style={{fontSize:12,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{(p.ass||'').substring(0,38)}</td>
                            <td style={{fontFamily:'"JetBrains Mono",monospace',fontSize:12}}>{fd(p.pr||p.pz)}</td>
                            <td><DaysBadge days={d}/></td>
                            <td><EtapaBadge et={p.et}/></td>
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
                    <thead><tr><th></th><th>Processo</th><th>Ex.</th><th>Municipio</th><th>Assunto</th><th>Responsavel</th><th>Prazo final</th><th>Dias</th><th>Etapa</th><th>Ult. TCE</th><th></th></tr></thead>
                    <tbody>
                      {filteredProc.map(p => {
                        const d = du(p);
                        return (
                          <tr key={p.id} className={`cl${d!==null&&d<=7&&d>=0?' urg':d!==null&&d<=30&&d>=0?' wrn':''}`} onClick={()=>openProc(p.id)}>
                            <td style={{padding:'0 4px 0 14px',width:16}}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ADB5BD" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg></td>
                            <td className="tdm">{p.proc}</td>
                            <td style={{fontSize:12}}>{p.ex||'—'}</td>
                            <td style={{fontSize:12,maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.tipo_ente?<span className="badge bgr" style={{fontSize:10,marginRight:4}}>{p.tipo_ente==='Camara Municipal'?'CM':'PF'}</span>:null}{p.mun||'—'}</td>
                            <td style={{fontSize:12,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{(p.ass||'').substring(0,48)}</td>
                            <td style={{fontSize:12}}>{p.resp?p.resp.split(' ').slice(0,2).join(' '):'—'}</td>
                            <td style={{fontFamily:'"JetBrains Mono",monospace',fontSize:12}}>{fd(p.pr||p.pz)}</td>
                            <td><DaysBadge days={d}/></td>
                            <td><EtapaBadge et={p.et}/></td>
                            <td style={{fontSize:11,color:'var(--t2)'}}>{p.mt ? <><span style={{fontFamily:'"JetBrains Mono",monospace'}}>{fd(p.mt)}</span>{p.md?<><br/><span style={{color:'var(--t3)'}}>{p.md.substring(0,25)}</span></>:null}</> : <span style={{color:'var(--t3)'}}>—</span>}</td>
                            <td>{isAdmin && <button className="btn btn-sm btn-ghost" style={{fontSize:11}} onClick={e=>{e.stopPropagation();openProc(p.id);}}>Editar</button>}</td>
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
              <div className="card" style={{padding:0,overflow:'hidden'}}>
                <div className="tw">
                  <table>
                    <thead><tr><th>Processo</th><th>Municipio</th><th>Assunto</th><th>Resp.</th><th>Citacao</th><th>Prazo</th><th>Prorrogado</th><th>Dias</th><th>Etapa</th></tr></thead>
                    <tbody>
                      {[...processos].filter(p=>edl(p)&&(!psMu||p.mun===psMu)).sort((a,b)=>edl(a)-edl(b)).map(p=>{
                        const d=du(p);
                        return (
                          <tr key={p.id} className={`cl${d!==null&&d<=7&&d>=0?' urg':d!==null&&d<=30&&d>=0?' wrn':''}`} onClick={()=>openProc(p.id)}>
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
                {isAdmin && <button className="btn btn-sm btnp" onClick={novoMun}>+ Municipio</button>}
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
                        {am&&<div className="mandbar"><div className="mandinfo"><span>Mandato</span><span>{fd(am.inicio)} – {fd(am.fim)}</span></div><div className="mandtrack"><div className="mandfill" style={{width:`${mpct(am)}%`}}/></div></div>}
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
                {isAdmin && <button className="btn btn-sm btnp" onClick={()=>openGestor(null)}>+ Gestor</button>}
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

          {/* ══ USUARIOS ════════════════════════════════════════════════ */}
          {page === 'usuarios' && isAdmin && (
            <>
              <div className="fr">
                <input type="text" placeholder="Buscar usuario..." value={usQ} onChange={e=>setUsQ(e.target.value)} style={{maxWidth:280}}/>
                <button className="btn btn-sm btnp" onClick={()=>openUser(null)}>+ Usuario</button>
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
                {['dados','prazos','tce','hist','anex'].map(t=>(
                  <button key={t} className={`it${procTab===t?' active':''}`} onClick={()=>setProcTab(t)}>
                    {{dados:'Dados gerais',prazos:'Prazos',tce:'Movim. TCE',hist:'Historico',anex:'Anexos'}[t]}
                  </button>
                ))}
              </div>

              {procTab === 'dados' && (
                <div className="fgrid">
                  <div className="fg"><label>Processo</label><input value={pForm.proc||''} onChange={e=>setPForm(f=>({...f,proc:e.target.value}))} disabled={!isAdmin}/></div>
                  <div className="fg"><label>Exercicio</label><input value={pForm.ex||''} onChange={e=>setPForm(f=>({...f,ex:e.target.value}))} disabled={!isAdmin}/></div>
                  <div className="fg full"><label>Assunto</label><input value={pForm.ass||''} onChange={e=>setPForm(f=>({...f,ass:e.target.value}))} disabled={!isAdmin}/></div>
                  <div className="fg"><label>Municipio</label><input value={pForm.mun||''} onChange={e=>setPForm(f=>({...f,mun:e.target.value}))} disabled={!isAdmin}/></div>
                  <div className="fg"><label>Responsavel / Advogado</label><input value={pForm.resp||''} onChange={e=>setPForm(f=>({...f,resp:e.target.value}))} disabled={!isAdmin}/></div>
                  <div className="fg"><label>Responsavel interno</label><input value={pForm.ri||''} onChange={e=>setPForm(f=>({...f,ri:e.target.value}))} disabled={!isAdmin}/></div>
                  <div className="fg"><label>Etapa atual</label><select value={pForm.et||''} onChange={e=>setPForm(f=>({...f,et:e.target.value}))} disabled={!isAdmin}><option value="">Selecione</option>{ETAPAS.map(e=><option key={e}>{e}</option>)}</select></div>
                  <div className="fg"><label>Situacao</label><input value={pForm.sit||''} onChange={e=>setPForm(f=>({...f,sit:e.target.value}))} disabled={!isAdmin}/></div>
                  <div className="fg"><label>Gestor</label><input value={pForm.gestor||''} onChange={e=>setPForm(f=>({...f,gestor:e.target.value}))} disabled={!isAdmin}/></div>
                  <div className="fg"><label>Relator</label><input value={pForm.relator||''} onChange={e=>setPForm(f=>({...f,relator:e.target.value}))} disabled={!isAdmin}/></div>
                  <div className="fg"><label>Natureza</label><select value={pForm.natureza||''} onChange={e=>setPForm(f=>({...f,natureza:e.target.value}))} disabled={!isAdmin}><option value="">Selecione</option>{NATUREZAS.map(n=><option key={n}>{n}</option>)}</select></div>
                  <div className="fg"><label>Especie</label><select value={pForm.especie||''} onChange={e=>setPForm(f=>({...f,especie:e.target.value}))} disabled={!isAdmin}><option value="">Selecione</option>{ESPECIES.map(s=><option key={s}>{s}</option>)}</select></div>
                  <div className="fg full"><label>Acao / Proximo passo</label><input value={pForm.ac||''} onChange={e=>setPForm(f=>({...f,ac:e.target.value}))} disabled={!isAdmin}/></div>
                  <div className="fg full"><label>Observacoes</label><textarea value={pForm.obs||''} onChange={e=>setPForm(f=>({...f,obs:e.target.value}))} disabled={!isAdmin}/></div>
                </div>
              )}

              {procTab === 'prazos' && (
                <>
                  <div className="fgrid">
                    <div className="fg"><label>Citacao</label><input type="date" value={pForm.cit||''} onChange={e=>setPForm(f=>({...f,cit:e.target.value}))} disabled={!isAdmin}/></div>
                    <div className="fg"><label>Prazo inicial</label><input type="date" value={pForm.pz||''} onChange={e=>setPForm(f=>({...f,pz:e.target.value}))} disabled={!isAdmin}/></div>
                    <div className="fg"><label>Prazo prorrogado</label><input type="date" value={pForm.pr||''} onChange={e=>setPForm(f=>({...f,pr:e.target.value}))} disabled={!isAdmin}/></div>
                    <div className="fg"><label>Prazo Int. Resp.</label><input value={pForm.pi||''} onChange={e=>setPForm(f=>({...f,pi:e.target.value}))} disabled={!isAdmin}/></div>
                    <div className="fg"><label>Pedir prorrogacao?</label><select value={pForm.pp||'Nao'} onChange={e=>setPForm(f=>({...f,pp:e.target.value}))} disabled={!isAdmin}><option>Nao</option><option>Sim</option></select></div>
                    <div className="fg"><label>Dias restantes</label><div style={{padding:'8px 10px',background:'var(--s2)',borderRadius:6,border:'1px solid var(--bdr)'}}><DaysBadge days={du(pForm)}/></div></div>
                  </div>
                  <div style={{background:'var(--bl)',border:'1px solid var(--bm)',borderRadius:6,padding:'10px 14px',marginTop:12,fontSize:12,color:'var(--blue)'}}>Salvar nova prorrogacao registra automaticamente no historico.</div>
                </>
              )}

              {procTab === 'tce' && (
                <>
                  <div className="fgrid">
                    <div className="fg"><label>Ultima movim. TCE</label><input type="date" value={pForm.mt||''} onChange={e=>setPForm(f=>({...f,mt:e.target.value}))} disabled={!isAdmin}/></div>
                    <div className="fg full"><label>Descricao</label><input value={pForm.md||''} onChange={e=>setPForm(f=>({...f,md:e.target.value}))} placeholder="ex: Acordao n 123 publicado..." disabled={!isAdmin}/></div>
                  </div>
                  {isAdmin && (
                    <div style={{marginTop:16,paddingTop:16,borderTop:'1px solid var(--bdr)'}}>
                      <div style={{fontSize:12,fontWeight:600,color:'var(--t2)',marginBottom:12}}>Registrar nova movimentacao TCE</div>
                      <div className="fgrid">
                        <div className="fg"><label>Data</label><input type="date" value={tceForm.data} onChange={e=>setTceForm(f=>({...f,data:e.target.value}))}/></div>
                        <div className="fg full"><label>Descricao</label><input value={tceForm.descricao} onChange={e=>setTceForm(f=>({...f,descricao:e.target.value}))} placeholder="ex: Acordao 456/2025 publicado"/></div>
                      </div>
                      <button className="btn btn-sm" style={{marginTop:8}} onClick={addTce}>Registrar</button>
                    </div>
                  )}
                  <div style={{marginTop:16}}>
                    <Timeline items={procHist.filter(h=>h.tce)} emptyMsg="Nenhuma movimentacao TCE registrada."/>
                  </div>
                </>
              )}

              {procTab === 'hist' && (
                <>
                  {isAdmin && (
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-end',marginBottom:16,paddingBottom:16,borderBottom:'1px solid var(--bdr)'}}>
                      <div className="fg" style={{flex:1,minWidth:150}}><label>Tipo</label><select value={histForm.tipo} onChange={e=>setHistForm(f=>({...f,tipo:e.target.value}))}><option>Prorrogacao de prazo</option><option>Defesa protocolada</option><option>Embargo protocolado</option><option>Minuta elaborada</option><option>Contato com responsavel</option><option>Reuniao</option><option>Movimentacao interna</option><option>Outro</option></select></div>
                      <div className="fg" style={{flex:'0 0 140px'}}><label>Data</label><input type="date" value={histForm.data} onChange={e=>setHistForm(f=>({...f,data:e.target.value}))}/></div>
                      <div className="fg" style={{flex:2,minWidth:200}}><label>Descricao</label><input value={histForm.descricao} onChange={e=>setHistForm(f=>({...f,descricao:e.target.value}))} placeholder="Descreva o acontecimento..."/></div>
                      <button className="btn btn-sm btnp" onClick={addHist}>+ Adicionar</button>
                    </div>
                  )}
                  <Timeline items={procHist} emptyMsg="Nenhum registro no historico ainda."/>
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
                      return (
                        <div key={a.id} className="att">
                          <a href={`/api/processos/${procModal.id}/anexos/${a.id}`} target="_blank" rel="noreferrer">
                            <span style={{fontSize:10,fontWeight:700,color:'var(--blue)',background:'var(--bl)',padding:'2px 5px',borderRadius:3}}>{icons[ext]||'ARQ'}</span>
                            {a.nome}
                          </a>
                          {isAdmin && <button className="att-del" onClick={()=>deleteAnexo(a.id)}>✕</button>}
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
              {isAdmin && <><button className="btn btn-sm btnd" onClick={deleteProc}>Excluir</button><button className="btn btn-sm btnp" onClick={saveProc}>Salvar alteracoes</button></>}
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
                    {{perfil:'Perfil',mandato:'Mandatos',contatos:'Contatos',demandas:'Demandas',procs:`Processos`}[t]}
                  </button>
                ))}
              </div>

              {munTab === 'perfil' && (
                <div className="fgrid">
                  <div className="fg full"><label>Nome *</label><input value={mForm.nome||''} onChange={e=>setMForm(f=>({...f,nome:e.target.value}))} disabled={!isAdmin}/></div>
                  <div className="fg"><label>Tipo</label><select value={mForm.tipo||'Prefeitura'} onChange={e=>setMForm(f=>({...f,tipo:e.target.value}))} disabled={!isAdmin}><option>Prefeitura</option><option>Camara Municipal</option><option>Secretaria</option><option>Outro</option></select></div>
                  <div className="fg"><label>Estado</label><input value={mForm.estado||''} onChange={e=>setMForm(f=>({...f,estado:e.target.value}))} disabled={!isAdmin}/></div>
                  <div className="fg full"><label>URL da logo</label><input value={mForm.logo||''} onChange={e=>setMForm(f=>({...f,logo:e.target.value}))} placeholder="https://..." disabled={!isAdmin}/></div>
                  <div className="fg full"><label>Observacoes</label><textarea value={mForm.obs||''} onChange={e=>setMForm(f=>({...f,obs:e.target.value}))} disabled={!isAdmin}/></div>
                  {isAdmin && <div className="full"><button className="btn btn-sm btnp" onClick={saveMun}>Salvar perfil</button></div>}
                </div>
              )}

              {munTab === 'mandato' && (
                <>
                  <div style={{background:'var(--bl)',border:'1px solid var(--bm)',borderRadius:6,padding:'10px 14px',marginBottom:14,fontSize:12,color:'var(--blue)'}}>Cada mandato representa um periodo de governo (4 anos). Os processos desse periodo continuam sendo responsabilidade do escritorio mesmo apos o contrato.</div>
                  {(munModal.mandatos||[]).map(md=>{
                    const sc={'Ativo':'bg','Encerrado':'bgr','Monitoramento':'ba'};
                    return (
                      <div key={md.id} style={{border:'1px solid var(--bdr)',borderRadius:8,padding:14,marginBottom:10}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                          <div style={{fontSize:14,fontWeight:600}}>{md.gestor}</div>
                          <span className={`badge ${sc[md.status]||'bgr'}`}>{md.status}</span>
                        </div>
                        <div style={{fontSize:12,color:'var(--t2)',marginBottom:3}}>{fd(md.inicio)} → {fd(md.fim)} · {md.contratocom}</div>
                        <div style={{fontSize:12,color:'var(--t3)',marginBottom:8}}>{md.escopo||''}</div>
                        <div className="mandbar"><div className="mandinfo"><span>Progresso</span><span>{mpct(md)}%</span></div><div className="mandtrack"><div className="mandfill" style={{width:`${mpct(md)}%`}}/></div></div>
                      </div>
                    );
                  })}
                  {isAdmin && (
                    <div style={{border:'1px solid var(--bdr)',borderRadius:8,padding:16,background:'var(--s2)'}}>
                      <div style={{fontSize:11,fontWeight:600,color:'var(--t2)',marginBottom:12,textTransform:'uppercase',letterSpacing:'.06em'}}>Adicionar mandato</div>
                      <div className="fgrid" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
                        <div className="fg"><label>Gestor</label><input value={mandForm.gestor} onChange={e=>setMandForm(f=>({...f,gestor:e.target.value}))} placeholder="Nome do prefeito/presidente"/></div>
                        <div className="fg"><label>Inicio</label><input type="date" value={mandForm.inicio} onChange={e=>setMandForm(f=>({...f,inicio:e.target.value}))}/></div>
                        <div className="fg"><label>Fim</label><input type="date" value={mandForm.fim} onChange={e=>setMandForm(f=>({...f,fim:e.target.value}))}/></div>
                        <div className="fg full"><label>Escopo</label><input value={mandForm.escopo} onChange={e=>setMandForm(f=>({...f,escopo:e.target.value}))} placeholder="ex: Acompanhamento processos TCE 2021-2024"/></div>
                        <div className="fg"><label>Contrato com</label><select value={mandForm.contratocom} onChange={e=>setMandForm(f=>({...f,contratocom:e.target.value}))}><option>Prefeitura</option><option>Camara</option><option>Gestor diretamente</option></select></div>
                        <div className="fg"><label>Status</label><select value={mandForm.status} onChange={e=>setMandForm(f=>({...f,status:e.target.value}))}><option>Ativo</option><option>Encerrado</option><option>Monitoramento</option></select></div>
                      </div>
                      <button className="btn btn-sm btnp" style={{marginTop:12}} onClick={addMandato}>Adicionar mandato</button>
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
                  {!(munModal.contatos||[]).length && <div style={{color:'var(--t3)',fontSize:13,marginBottom:16}}>Nenhum contato cadastrado.</div>}
                  {isAdmin && (
                    <div style={{border:'1px solid var(--bdr)',borderRadius:8,padding:16,background:'var(--s2)'}}>
                      <div style={{fontSize:11,fontWeight:600,color:'var(--t2)',marginBottom:12,textTransform:'uppercase',letterSpacing:'.06em'}}>Adicionar contato</div>
                      <div className="fgrid">
                        <div className="fg"><label>Nome</label><input value={ctForm.nome} onChange={e=>setCtForm(f=>({...f,nome:e.target.value}))}/></div>
                        <div className="fg"><label>Cargo</label><input value={ctForm.cargo} onChange={e=>setCtForm(f=>({...f,cargo:e.target.value}))} placeholder="ex: Contador"/></div>
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
                  {(munModal.demandas||[]).map(d=>{
                    const sc={'Em andamento':'bb','Concluido':'bg','Aguardando cliente':'ba'};
                    return (
                      <div key={d.id} style={{display:'flex',gap:10,padding:'10px 0',borderBottom:'1px solid var(--bdr)',alignItems:'flex-start'}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:500}}>{d.tipo}</div>
                          <div style={{fontSize:12,color:'var(--t2)'}}>{d.descricao||'—'}</div>
                          {d.procvinc&&<div style={{fontSize:11,color:'var(--t3)',marginTop:2}}>Processo: {d.procvinc}</div>}
                        </div>
                        <div style={{textAlign:'right',whiteSpace:'nowrap'}}>
                          <span className={`badge ${sc[d.status]||'bgr'}`}>{d.status}</span>
                          <div style={{fontSize:11,color:'var(--t3)',marginTop:4,fontFamily:'"JetBrains Mono",monospace'}}>{fd(d.data)}</div>
                        </div>
                      </div>
                    );
                  })}
                  {!(munModal.demandas||[]).length && <div style={{color:'var(--t3)',fontSize:13,marginBottom:16}}>Nenhuma demanda registrada.</div>}
                  {isAdmin && (
                    <div style={{border:'1px solid var(--bdr)',borderRadius:8,padding:16,background:'var(--s2)',marginTop:12}}>
                      <div style={{fontSize:11,fontWeight:600,color:'var(--t2)',marginBottom:12,textTransform:'uppercase',letterSpacing:'.06em'}}>Registrar demanda</div>
                      <div className="fgrid">
                        <div className="fg"><label>Tipo</label><select value={dmForm.tipo} onChange={e=>setDmForm(f=>({...f,tipo:e.target.value}))}><option>Defesa em processo TCE</option><option>Recurso / Embargo</option><option>Prestacao de contas</option><option>Fiscalizacao</option><option>Consulta juridica</option><option>Representacao</option><option>Outro</option></select></div>
                        <div className="fg"><label>Data</label><input type="date" value={dmForm.data} onChange={e=>setDmForm(f=>({...f,data:e.target.value}))}/></div>
                        <div className="fg full"><label>Descricao</label><input value={dmForm.descricao} onChange={e=>setDmForm(f=>({...f,descricao:e.target.value}))}/></div>
                        <div className="fg"><label>Status</label><select value={dmForm.status} onChange={e=>setDmForm(f=>({...f,status:e.target.value}))}><option>Em andamento</option><option>Concluido</option><option>Aguardando cliente</option></select></div>
                        <div className="fg"><label>Processo vinculado</label><input value={dmForm.procvinc} onChange={e=>setDmForm(f=>({...f,procvinc:e.target.value}))} placeholder="ex: 1234/2025"/></div>
                      </div>
                      <button className="btn btn-sm btnp" style={{marginTop:12}} onClick={addDemanda}>Registrar</button>
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
      {gestorModal !== null && (
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
                <div className="fg full"><label>Observacoes</label><textarea value={gForm.obs||''} onChange={e=>setGForm(f=>({...f,obs:e.target.value}))}/></div>
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
              <div style={{display:'flex',alignItems:'flex-start',gap:0,marginBottom:24}}>
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
                  <div style={{display:'flex',gap:14}}>
                    {[{id:'Prefeitura',label:'Prefeitura / Secretaria',sub:'Poder Executivo Municipal'},{id:'Camara Municipal',label:'Camara Municipal',sub:'Poder Legislativo Municipal'}].map(t=>(
                      <div key={t.id} className={`type-card${npTipo===t.id?' selected':''}`} onClick={()=>{setNpTipo(t.id);setNpStep(2);}}>
                        <div style={{fontSize:28,marginBottom:8}}>🏛</div>
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
                    <div className="fg full"><label>Gestor responsavel</label><input value={npForm.gestor||''} onChange={e=>setNpForm(f=>({...f,gestor:e.target.value}))} placeholder="Nome do prefeito / presidente da camara"/></div>
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
                    <div className="fg"><label>Especie</label><select value={npForm.especie||''} onChange={e=>setNpForm(f=>({...f,especie:e.target.value}))}><option value="">Selecione</option>{ESPECIES.map(s=><option key={s}>{s}</option>)}</select></div>
                    <div className="fg"><label>Relator</label><input value={npForm.relator||''} onChange={e=>setNpForm(f=>({...f,relator:e.target.value}))} placeholder="Conselheiro Relator"/></div>
                    <div className="fg"><label>Responsavel / Advogado</label><input value={npForm.resp||''} onChange={e=>setNpForm(f=>({...f,resp:e.target.value}))}/></div>
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
                {[{k:'A',label:'Empresa A',sub:'Cabecalho azul institucional'},{k:'B',label:'Empresa B',sub:'Cabecalho verde-escuro'}].map(({k,label,sub})=>(
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
    </>
  );
}
