/* ============================================================
   EduGestão — app.js  (v2 — Supabase integrado de verdade)
   Cada salvar/editar/deletar vai direto ao banco Supabase.
   Usa a biblioteca oficial @supabase/supabase-js via CDN.
   ============================================================ */

// ─── ESTADO GLOBAL ──────────────────────────────────────────
const state = {
  turmaAtiva:     'CK1',
  viewAtiva:      'dashboard',
  alunos:         [],
  notas:          [],
  presencas:      [],
  atividades:     [],
  aulas:          [],
  aulaFiltro:     'todos',
  sbClient:       null,
  connected:      false,
  deleteCallback: null,
};

// ─── SUPABASE CLIENT ────────────────────────────────────────
function initSupabase(url, key) {
  try {
    state.sbClient  = window.supabase.createClient(url, key);
    state.connected = true;
    return true;
  } catch (e) {
    console.error('Erro ao criar cliente Supabase:', e);
    state.connected = false;
    return false;
  }
}

function isConnected() {
  return state.connected && state.sbClient !== null;
}

// ─── DB — CRUD GENÉRICO ─────────────────────────────────────
const DB = {
  async select(table, filters = {}) {
    if (!isConnected()) return null;
    try {
      let q = state.sbClient.from(table).select('*');
      for (const [col, val] of Object.entries(filters)) q = q.eq(col, val);
      const { data, error } = await q.order('id', { ascending: true });
      if (error) { console.error(`SELECT ${table}:`, error.message); return null; }
      return data;
    } catch (e) { console.error(e); return null; }
  },

  async insert(table, row) {
    if (!isConnected()) return null;
    try {
      const { data, error } = await state.sbClient.from(table).insert(row).select().single();
      if (error) { console.error(`INSERT ${table}:`, error.message); return null; }
      return data;
    } catch (e) { console.error(e); return null; }
  },

  async update(table, id, changes) {
    if (!isConnected()) return null;
    try {
      const { data, error } = await state.sbClient.from(table).update(changes).eq('id', id).select().single();
      if (error) { console.error(`UPDATE ${table}:`, error.message); return null; }
      return data;
    } catch (e) { console.error(e); return null; }
  },

  async remove(table, id) {
    if (!isConnected()) return false;
    try {
      const { error } = await state.sbClient.from(table).delete().eq('id', id);
      if (error) { console.error(`DELETE ${table}:`, error.message); return false; }
      return true;
    } catch (e) { console.error(e); return false; }
  },
};

// ─── CARREGAR TODOS OS DADOS ─────────────────────────────────
async function loadAllData() {
  showLoading(true);
  const [alunos, notas, presencas, atividades, aulas] = await Promise.all([
    DB.select('alunos'),
    DB.select('notas'),
    DB.select('presencas'),
    DB.select('atividades'),
    DB.select('aulas'),
  ]);
  if (alunos     !== null) state.alunos     = alunos;
  if (notas      !== null) state.notas      = notas;
  if (presencas  !== null) state.presencas  = presencas;
  if (atividades !== null) state.atividades = atividades;
  if (aulas      !== null) state.aulas      = aulas;
  showLoading(false);
  renderAll();
}

// ─── LOADING ────────────────────────────────────────────────
function showLoading(on) {
  let el = document.getElementById('loading-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading-overlay';
    el.innerHTML = `<div class="ld-box"><div class="ld-spin"></div><p>Salvando...</p></div>`;
    document.body.appendChild(el);
  }
  el.style.display = on ? 'flex' : 'none';
}

// ─── UTILITÁRIOS ─────────────────────────────────────────────
function toast(msg, type = 'info') {
  const c  = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: '✔', error: '✖', info: 'ℹ', warn: '⚠' };
  el.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${msg}</span>`;
  c.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

function openModal(id) {
  document.getElementById('modal-overlay').classList.add('active');
  document.getElementById(id).classList.add('active');
}
function closeModal(id) {
  document.getElementById('modal-overlay').classList.remove('active');
  document.getElementById(id).classList.remove('active');
}

function formatDate(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}
function formatTurma(t) { return t.replace(/([A-Z]+)(\d)/, '$1 $2'); }
function getInitials(name) { return name.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase(); }
function scoreLabel(s) { return s >= 8 ? 'A' : s >= 6 ? 'B' : s >= 4 ? 'C' : 'D'; }
function barColor(pct)  { return pct >= 80 ? 'green' : pct >= 60 ? 'blue' : pct >= 40 ? 'yellow' : 'red'; }
function alunosTurma()  { return state.alunos.filter(a => a.turma === state.turmaAtiva); }

// ─── CONFIGURAR SUPABASE ─────────────────────────────────────
async function salvarConfig() {
  const url = document.getElementById('sb-url').value.trim().replace(/\/$/, '');
  const key = document.getElementById('sb-key').value.trim();
  const btn = document.getElementById('btn-salvar-config');

  if (!url || !key) { toast('Preencha URL e chave Anon.', 'error'); return; }
  if (!url.startsWith('https://')) { toast('URL inválida. Deve começar com https://', 'error'); return; }

  btn.textContent = 'Conectando...';
  btn.disabled    = true;

  const ok = initSupabase(url, key);
  if (!ok) {
    toast('Erro ao iniciar cliente. Verifique a URL.', 'error');
    btn.textContent = 'Salvar & Conectar'; btn.disabled = false; return;
  }

  // Teste real de conexão
  const { error } = await state.sbClient.from('alunos').select('id').limit(1);
  if (error) {
    let msg = error.message;
    if (error.message.includes('relation') || error.message.includes('does not exist')) {
      msg = 'Tabela "alunos" não encontrada. Crie as tabelas no Supabase (veja o README).';
    } else if (error.message.includes('Invalid API key') || error.message.includes('JWT')) {
      msg = 'Chave inválida. Use a chave "anon public" do seu projeto.';
    }
    toast(msg, 'error');
    state.connected = false; state.sbClient = null;
    btn.textContent = 'Salvar & Conectar'; btn.disabled = false; return;
  }

  localStorage.setItem('sb_url', url);
  localStorage.setItem('sb_key', key);
  updateSupabaseStatus(true);
  closeModal('modal-supabase');
  btn.textContent = 'Salvar & Conectar'; btn.disabled = false;
  toast('Conectado! Carregando dados do banco...', 'success');
  await loadAllData();
}

function updateSupabaseStatus(connected) {
  const el  = document.getElementById('supabase-status');
  const dot = el.querySelector('.status-dot');
  const txt = el.querySelector('span:last-child');
  dot.className   = `status-dot ${connected ? 'connected' : 'disconnected'}`;
  txt.textContent = connected ? '✓ Supabase conectado' : 'Supabase desconectado';
  state.connected = connected;
}

// ─── DASHBOARD ───────────────────────────────────────────────
function renderDashboard() {
  const alunos = alunosTurma();
  document.getElementById('dash-turma-name').textContent = formatTurma(state.turmaAtiva);
  document.getElementById('stat-alunos').textContent     = alunos.length;
  document.getElementById('stat-atividades').textContent = state.atividades.filter(a => a.turma === state.turmaAtiva).length;

  const aulasT = state.aulas.filter(a => a.turma === state.turmaAtiva);
  document.getElementById('stat-aulas').textContent  = aulasT.length;
  document.getElementById('stat-carga').textContent  = aulasT.reduce((s, a) => s + (a.tipo === 'AE' ? 1 : 2), 0) + 'h';

  const presArr  = state.presencas.filter(p => p.turma === state.turmaAtiva);
  document.getElementById('stat-presenca').textContent = presArr.length
    ? Math.round(presArr.filter(p => p.status === 'P').length / presArr.length * 100) + '%' : '—';

  const ids      = alunos.map(a => a.id);
  const notasArr = state.notas.filter(n => ids.includes(Number(n.aluno_id)));
  document.getElementById('stat-media').textContent = notasArr.length
    ? (notasArr.reduce((s, n) => s + parseFloat(n.nota), 0) / notasArr.length).toFixed(1) : '—';

  // Ranking
  const rkEl = document.getElementById('ranking-list');
  if (!alunos.length) { rkEl.innerHTML = '<p class="empty-state">Nenhum aluno na turma.</p>'; }
  else {
    const scores = alunos.map(a => {
      const nArr  = state.notas.filter(n => Number(n.aluno_id) === a.id);
      const media = nArr.length ? nArr.reduce((s,n) => s + parseFloat(n.nota), 0) / nArr.length : 5;
      const pArr  = state.presencas.filter(p => Number(p.aluno_id) === a.id && p.turma === state.turmaAtiva);
      const freq  = pArr.length ? pArr.filter(p => p.status==='P').length / pArr.length * 100 : 50;
      return { aluno: a, score: (media + freq/10)/2 };
    }).sort((a,b) => b.score - a.score);
    const pos = ['gold','silver','bronze'];
    rkEl.innerHTML = scores.map((s,i) => {
      const sc = s.score.toFixed(1);
      return `<div class="ranking-item">
        <span class="rank-pos ${pos[i]||''}">${i+1}º</span>
        <span class="rank-name">${s.aluno.nome}</span>
        <span class="rank-score ${sc>=8?'high':sc>=6?'mid':'low'}">${sc}</span>
      </div>`;
    }).join('');
  }

  // Alertas
  const alEl   = document.getElementById('alert-list');
  const alerts = [];
  alunos.forEach(a => {
    const pArr = state.presencas.filter(p => Number(p.aluno_id)===a.id && p.turma===state.turmaAtiva);
    if (pArr.length >= 3) {
      const freq = pArr.filter(p=>p.status==='P').length / pArr.length;
      if (freq < 0.75) alerts.push({ type:'danger', icon:'⚠', msg:`${a.nome} — Frequência baixa (${Math.round(freq*100)}%)` });
    }
    const nArr = state.notas.filter(n => Number(n.aluno_id)===a.id);
    if (nArr.length) {
      const media = nArr.reduce((s,n)=>s+parseFloat(n.nota),0)/nArr.length;
      if (media < 5) alerts.push({ type:'danger', icon:'✖', msg:`${a.nome} — Média abaixo de 5 (${media.toFixed(1)})` });
      else if (media < 7) alerts.push({ type:'warn', icon:'⚡', msg:`${a.nome} — Média em risco (${media.toFixed(1)})` });
    }
  });
  alEl.innerHTML = alerts.length
    ? alerts.map(a=>`<div class="alert-item ${a.type}"><span class="alert-icon">${a.icon}</span><span>${a.msg}</span></div>`).join('')
    : '<p class="empty-state">Nenhum alerta. Turma estável ✓</p>';
}

// ─── ALUNOS ──────────────────────────────────────────────────
function renderAlunos(filter = '') {
  const tbody  = document.getElementById('tbody-alunos');
  let alunos   = alunosTurma();
  if (filter) alunos = alunos.filter(a => a.nome.toLowerCase().includes(filter.toLowerCase()));
  if (!alunos.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum aluno encontrado.</td></tr>'; return; }
  tbody.innerHTML = alunos.map((a,i) => `<tr>
    <td>${i+1}</td><td><strong>${a.nome}</strong></td>
    <td>${a.matricula||'—'}</td><td>${formatTurma(a.turma)}</td>
    <td><div class="action-btns">
      <button class="btn-icon edit" onclick="editAluno(${a.id})">✎ Editar</button>
      <button class="btn-icon remove" onclick="confirmDelete('aluno',${a.id})">✕ Remover</button>
    </div></td></tr>`).join('');
}

function editAluno(id) {
  const a = state.alunos.find(x => x.id==id);
  if (!a) return;
  document.getElementById('aluno-id').value        = a.id;
  document.getElementById('aluno-nome').value      = a.nome;
  document.getElementById('aluno-matricula').value = a.matricula||'';
  document.getElementById('aluno-turma').value     = a.turma;
  document.getElementById('modal-aluno-title').textContent = 'Editar Aluno';
  openModal('modal-aluno');
}

async function salvarAluno() {
  const nome  = document.getElementById('aluno-nome').value.trim();
  const matr  = document.getElementById('aluno-matricula').value.trim();
  const turma = document.getElementById('aluno-turma').value;
  const id    = document.getElementById('aluno-id').value;
  if (!nome) { toast('Informe o nome.', 'error'); return; }

  showLoading(true);
  const row = { nome, matricula: matr, turma };

  if (id) {
    if (isConnected()) {
      const r = await DB.update('alunos', id, row);
      if (!r) { toast('Erro ao atualizar no banco.', 'error'); showLoading(false); return; }
      const idx = state.alunos.findIndex(a => a.id==id);
      if (idx>=0) state.alunos[idx] = r;
      toast('Aluno atualizado no banco!', 'success');
    } else {
      const idx = state.alunos.findIndex(a => a.id==id);
      if (idx>=0) state.alunos[idx] = { ...state.alunos[idx], ...row };
      toast('Atualizado localmente (conecte o Supabase).', 'info');
    }
  } else {
    if (isConnected()) {
      const r = await DB.insert('alunos', row);
      if (!r) { toast('Erro ao salvar no banco.', 'error'); showLoading(false); return; }
      state.alunos.push(r);
      toast('Aluno salvo no banco de dados!', 'success');
    } else {
      state.alunos.push({ id: Date.now(), ...row });
      toast('Salvo localmente (conecte o Supabase).', 'info');
    }
  }
  showLoading(false); closeModal('modal-aluno'); renderAll();
}

// ─── PRESENÇA ────────────────────────────────────────────────
function renderPresenca() {
  const alunos  = alunosTurma();
  const tbody   = document.getElementById('tbody-presenca');
  const dateVal = document.getElementById('date-presenca').value;
  if (!alunos.length) { tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Nenhum aluno na turma.</td></tr>'; }
  else {
    tbody.innerHTML = alunos.map(a => {
      const ex     = state.presencas.find(p => Number(p.aluno_id)===a.id && p.data===dateVal && p.turma===state.turmaAtiva);
      const status = ex ? ex.status : 'P';
      return `<tr>
        <td><strong>${a.nome}</strong></td>
        <td><div class="presenca-toggle">
          <button class="toggle-btn ${status==='P'?'present':''}" onclick="setPresenca(${a.id},'P','${dateVal}')">P</button>
          <button class="toggle-btn ${status==='A'?'absent':''}" onclick="setPresenca(${a.id},'A','${dateVal}')">F</button>
          <button class="toggle-btn ${status==='J'?'justified':''}" onclick="setPresenca(${a.id},'J','${dateVal}')">J</button>
        </div></td>
        <td><input type="text" placeholder="Justificativa..." class="input-just" id="just-${a.id}"
          value="${ex && ex.justificativa ? ex.justificativa : ''}" /></td>
      </tr>`;
    }).join('');
  }
  renderHistoricoPresenca();
}

function setPresenca(alunoId, status, data) {
  const idx = state.presencas.findIndex(p => Number(p.aluno_id)===alunoId && p.data===data && p.turma===state.turmaAtiva);
  if (idx>=0) state.presencas[idx].status = status;
  else state.presencas.push({ id: Date.now(), aluno_id: alunoId, data, status, turma: state.turmaAtiva, justificativa:'' });
  renderPresenca();
}

async function salvarPresenca() {
  const alunos  = alunosTurma();
  const dateVal = document.getElementById('date-presenca').value;
  if (!dateVal)      { toast('Selecione uma data.', 'error'); return; }
  if (!alunos.length){ toast('Nenhum aluno na turma.', 'error'); return; }

  showLoading(true);
  let erros = 0;

  for (const a of alunos) {
    const just   = (document.getElementById(`just-${a.id}`)?.value || '').trim();
    const ex     = state.presencas.find(p => Number(p.aluno_id)===a.id && p.data===dateVal && p.turma===state.turmaAtiva);
    const status = ex ? ex.status : 'P';
    const row    = { aluno_id: a.id, data: dateVal, status, turma: state.turmaAtiva, justificativa: just };

    if (isConnected()) {
      // Verifica se já existe no banco
      const { data: exist, error: sErr } = await state.sbClient
        .from('presencas').select('id').eq('aluno_id', a.id).eq('data', dateVal).eq('turma', state.turmaAtiva).maybeSingle();
      if (sErr) { erros++; continue; }

      if (exist) {
        const { error: uErr } = await state.sbClient.from('presencas').update({ status, justificativa: just }).eq('id', exist.id);
        if (uErr) erros++;
        else {
          const idx = state.presencas.findIndex(p => Number(p.aluno_id)===a.id && p.data===dateVal && p.turma===state.turmaAtiva);
          if (idx>=0) { state.presencas[idx].status = status; state.presencas[idx].justificativa = just; state.presencas[idx].id = exist.id; }
        }
      } else {
        const { data: ins, error: iErr } = await state.sbClient.from('presencas').insert(row).select().single();
        if (iErr) erros++;
        else {
          const idx = state.presencas.findIndex(p => Number(p.aluno_id)===a.id && p.data===dateVal && p.turma===state.turmaAtiva);
          if (idx>=0) state.presencas[idx].id = ins.id;
          else state.presencas.push(ins);
        }
      }
    }
  }

  showLoading(false);
  if (!isConnected()) toast('Presença registrada localmente (Supabase não conectado).', 'info');
  else if (erros > 0) toast(`Presença salva com ${erros} erro(s). Veja o console.`, 'warn');
  else toast('Presença salva no banco de dados!', 'success');
  renderPresenca();
}

function renderHistoricoPresenca() {
  const el    = document.getElementById('historico-presenca');
  const datas = [...new Set(state.presencas.filter(p=>p.turma===state.turmaAtiva).map(p=>p.data))].sort((a,b)=>b.localeCompare(a));
  if (!datas.length) { el.innerHTML = '<p class="empty-state">Nenhum registro.</p>'; return; }
  el.innerHTML = datas.slice(0,10).map(d => {
    const arr = state.presencas.filter(p=>p.data===d && p.turma===state.turmaAtiva);
    const P = arr.filter(p=>p.status==='P').length, A = arr.filter(p=>p.status==='A').length, J = arr.filter(p=>p.status==='J').length;
    return `<div class="hist-item"><span class="hist-date">${formatDate(d)}</span><div class="hist-badges">
      <span class="hist-badge p">✓ ${P}</span><span class="hist-badge a">✕ ${A}</span>${J?`<span class="hist-badge j">J ${J}</span>`:''}
    </div></div>`;
  }).join('');
}

// ─── NOTAS ───────────────────────────────────────────────────
function renderNotas() {
  const tbody = document.getElementById('tbody-notas');
  const ids   = alunosTurma().map(a=>a.id);
  const notas = state.notas.filter(n=>ids.includes(Number(n.aluno_id)));
  if (!notas.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhuma nota lançada.</td></tr>'; return; }
  tbody.innerHTML = notas.map(n => {
    const al  = state.alunos.find(a=>a.id===Number(n.aluno_id));
    const v   = parseFloat(n.nota);
    const cls = v>=7?'high':v>=5?'mid':'low';
    return `<tr><td><strong>${al?al.nome:'—'}</strong></td><td>${n.bimestre}º Bim.</td>
      <td>${n.disciplina}</td><td><span class="nota-chip ${cls}">${v.toFixed(1)}</span></td>
      <td><div class="action-btns">
        <button class="btn-icon edit" onclick="editNota(${n.id})">✎ Editar</button>
        <button class="btn-icon remove" onclick="confirmDelete('nota',${n.id})">✕ Remover</button>
      </div></td></tr>`;
  }).join('');
}

function populateNotaAlunos() {
  const sel = document.getElementById('nota-aluno');
  sel.innerHTML = alunosTurma().map(a=>`<option value="${a.id}">${a.nome}</option>`).join('');
}

function editNota(id) {
  const n = state.notas.find(x=>x.id==id); if (!n) return;
  populateNotaAlunos();
  document.getElementById('nota-id').value         = n.id;
  document.getElementById('nota-aluno').value      = n.aluno_id;
  document.getElementById('nota-disciplina').value = n.disciplina;
  document.getElementById('nota-bimestre').value   = n.bimestre;
  document.getElementById('nota-valor').value      = n.nota;
  document.getElementById('modal-nota-title').textContent = 'Editar Nota';
  openModal('modal-nota');
}

async function salvarNota() {
  const alunoId  = document.getElementById('nota-aluno').value;
  const disc     = document.getElementById('nota-disciplina').value.trim();
  const bimestre = document.getElementById('nota-bimestre').value;
  const nota     = parseFloat(document.getElementById('nota-valor').value);
  const id       = document.getElementById('nota-id').value;
  if (!disc)  { toast('Informe a disciplina.', 'error'); return; }
  if (!alunoId){ toast('Selecione um aluno.', 'error'); return; }
  if (isNaN(nota)||nota<0||nota>10){ toast('Nota entre 0 e 10.', 'error'); return; }

  showLoading(true);
  const row = { aluno_id: Number(alunoId), disciplina: disc, bimestre: Number(bimestre), nota, turma: state.turmaAtiva };

  if (id) {
    if (isConnected()) {
      const r = await DB.update('notas', id, row);
      if (!r) { toast('Erro ao atualizar nota.', 'error'); showLoading(false); return; }
      const idx = state.notas.findIndex(n=>n.id==id);
      if (idx>=0) state.notas[idx] = r;
      toast('Nota atualizada no banco!', 'success');
    } else {
      const idx = state.notas.findIndex(n=>n.id==id);
      if (idx>=0) state.notas[idx] = { ...state.notas[idx], ...row };
      toast('Atualizado localmente.', 'info');
    }
  } else {
    if (isConnected()) {
      const r = await DB.insert('notas', row);
      if (!r) { toast('Erro ao salvar nota.', 'error'); showLoading(false); return; }
      state.notas.push(r);
      toast('Nota salva no banco!', 'success');
    } else {
      state.notas.push({ id: Date.now(), ...row });
      toast('Salvo localmente.', 'info');
    }
  }
  showLoading(false); closeModal('modal-nota'); renderAll();
}

// ─── ATIVIDADES ──────────────────────────────────────────────
function renderAtividades() {
  const el    = document.getElementById('atividades-grid');
  const ativs = state.atividades.filter(a=>a.turma===state.turmaAtiva);
  if (!ativs.length) { el.innerHTML = '<p class="empty-state">Nenhuma atividade cadastrada.</p>'; return; }
  el.innerHTML = ativs.map(a=>`<div class="ativ-card">
    <div class="ativ-card-top"><span class="ativ-titulo">${a.titulo}</span><span class="ativ-peso p${a.peso}">Peso ${a.peso}</span></div>
    <div class="ativ-disciplina">📚 ${a.disciplina||'—'}</div>
    <div class="ativ-desc">${a.descricao||'—'}</div>
    <div class="ativ-footer"><span class="ativ-data">📅 ${formatDate(a.data_entrega)}</span>
      <div class="action-btns">
        <button class="btn-icon edit" onclick="editAtividade(${a.id})">✎</button>
        <button class="btn-icon remove" onclick="confirmDelete('atividade',${a.id})">✕</button>
      </div></div></div>`).join('');
}

function editAtividade(id) {
  const a = state.atividades.find(x=>x.id==id); if (!a) return;
  document.getElementById('ativ-id').value         = a.id;
  document.getElementById('ativ-titulo').value     = a.titulo;
  document.getElementById('ativ-desc').value       = a.descricao||'';
  document.getElementById('ativ-disciplina').value = a.disciplina||'';
  document.getElementById('ativ-data').value       = a.data_entrega||'';
  document.getElementById('ativ-peso').value       = a.peso;
  document.getElementById('modal-atividade-title').textContent = 'Editar Atividade';
  openModal('modal-atividade');
}

async function salvarAtividade() {
  const titulo = document.getElementById('ativ-titulo').value.trim();
  const desc   = document.getElementById('ativ-desc').value.trim();
  const disc   = document.getElementById('ativ-disciplina').value.trim();
  const data   = document.getElementById('ativ-data').value;
  const peso   = Number(document.getElementById('ativ-peso').value);
  const id     = document.getElementById('ativ-id').value;
  if (!titulo) { toast('Informe o título.', 'error'); return; }

  showLoading(true);
  const row = { titulo, descricao: desc, disciplina: disc, data_entrega: data||null, peso, turma: state.turmaAtiva };

  if (id) {
    if (isConnected()) {
      const r = await DB.update('atividades', id, row);
      if (!r) { toast('Erro ao atualizar.', 'error'); showLoading(false); return; }
      const idx = state.atividades.findIndex(a=>a.id==id);
      if (idx>=0) state.atividades[idx] = r;
      toast('Atividade atualizada no banco!', 'success');
    } else {
      const idx = state.atividades.findIndex(a=>a.id==id);
      if (idx>=0) state.atividades[idx] = { ...state.atividades[idx], ...row };
      toast('Atualizado localmente.', 'info');
    }
  } else {
    if (isConnected()) {
      const r = await DB.insert('atividades', row);
      if (!r) { toast('Erro ao salvar.', 'error'); showLoading(false); return; }
      state.atividades.push(r);
      toast('Atividade salva no banco!', 'success');
    } else {
      state.atividades.push({ id: Date.now(), ...row });
      toast('Salvo localmente.', 'info');
    }
  }
  showLoading(false); closeModal('modal-atividade'); renderAll();
}

// ─── AULAS ───────────────────────────────────────────────────
function calcFimAula(inicio, tipo) {
  if (!inicio) return '';
  const [h, m] = inicio.split(':').map(Number);
  const dur = tipo==='AE' ? 60 : 120;
  const tot = h*60+m+dur;
  return String(Math.floor(tot/60)%24).padStart(2,'0') + ':' + String(tot%60).padStart(2,'0');
}

function atualizarFimAula() {
  const tipo  = document.getElementById('aula-tipo').value;
  const ini   = document.getElementById('aula-inicio').value;
  const fim   = calcFimAula(ini, tipo);
  document.getElementById('aula-fim').value = fim;
  const label = tipo==='AE' ? '1 hora (AE)' : '2 horas (Regular)';
  document.getElementById('aula-duracao-txt').textContent = ini ? `${ini} → ${fim} · ${label}` : `Duração: ${label}`;
}

function renderAulas() {
  const all   = state.aulas.filter(a=>a.turma===state.turmaAtiva).sort((a,b)=>(a.data+a.inicio).localeCompare(b.data+b.inicio));
  const aulas = state.aulaFiltro==='todos' ? all : all.filter(a=>a.tipo===state.aulaFiltro);
  const reg   = all.filter(a=>a.tipo==='regular').length;
  const ae    = all.filter(a=>a.tipo==='AE').length;

  document.getElementById('res-total-aulas').textContent   = all.length;
  document.getElementById('res-aulas-regular').textContent = reg;
  document.getElementById('res-aulas-ae').textContent      = ae;
  document.getElementById('res-carga-total').textContent   = (reg*2 + ae) + 'h';

  const tbody = document.getElementById('tbody-aulas');
  if (!aulas.length) { tbody.innerHTML = `<tr><td colspan="9" class="empty-state">Nenhuma aula registrada.</td></tr>`; return; }
  tbody.innerHTML = aulas.map((a,i) => `<tr>
    <td>${i+1}</td><td>${formatDate(a.data)}</td>
    <td><span class="aula-tipo-chip ${a.tipo==='AE'?'ae':'regular'}">${a.tipo==='AE'?'AE · 1h':'Regular · 2h'}</span></td>
    <td>${a.disciplina||'—'}</td>
    <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${a.conteudo||''}">${a.conteudo||'—'}</td>
    <td><span class="hora-display">${a.inicio||'—'}</span></td>
    <td><span class="hora-display">${a.fim||'—'}</span></td>
    <td><span class="aula-duracao-chip">${a.tipo==='AE'?'1h00':'2h00'}</span></td>
    <td><div class="action-btns">
      <button class="btn-icon edit" onclick="editAula(${a.id})">✎ Editar</button>
      <button class="btn-icon remove" onclick="confirmDelete('aula',${a.id})">✕ Remover</button>
    </div></td></tr>`).join('');
}

function editAula(id) {
  const a = state.aulas.find(x=>x.id==id); if (!a) return;
  document.getElementById('aula-id').value         = a.id;
  document.getElementById('aula-tipo').value       = a.tipo;
  document.getElementById('aula-disciplina').value = a.disciplina||'';
  document.getElementById('aula-conteudo').value   = a.conteudo||'';
  document.getElementById('aula-data').value       = a.data||'';
  document.getElementById('aula-inicio').value     = a.inicio||'';
  document.getElementById('aula-fim').value        = a.fim||'';
  document.getElementById('modal-aula-title').textContent = 'Editar Aula';
  atualizarFimAula(); openModal('modal-aula');
}

async function salvarAula() {
  const tipo  = document.getElementById('aula-tipo').value;
  const disc  = document.getElementById('aula-disciplina').value.trim();
  const cont  = document.getElementById('aula-conteudo').value.trim();
  const data  = document.getElementById('aula-data').value;
  const ini   = document.getElementById('aula-inicio').value;
  const fim   = calcFimAula(ini, tipo);
  const id    = document.getElementById('aula-id').value;
  if (!data) { toast('Informe a data.', 'error'); return; }
  if (!ini)  { toast('Informe o horário de início.', 'error'); return; }

  showLoading(true);
  const row = { tipo, disciplina: disc, conteudo: cont, data, inicio: ini, fim, turma: state.turmaAtiva };

  if (id) {
    if (isConnected()) {
      const r = await DB.update('aulas', id, row);
      if (!r) { toast('Erro ao atualizar aula.', 'error'); showLoading(false); return; }
      const idx = state.aulas.findIndex(a=>a.id==id);
      if (idx>=0) state.aulas[idx] = r;
      toast('Aula atualizada no banco!', 'success');
    } else {
      const idx = state.aulas.findIndex(a=>a.id==id);
      if (idx>=0) state.aulas[idx] = { ...state.aulas[idx], ...row };
      toast('Atualizado localmente.', 'info');
    }
  } else {
    if (isConnected()) {
      const r = await DB.insert('aulas', row);
      if (!r) { toast('Erro ao salvar aula.', 'error'); showLoading(false); return; }
      state.aulas.push(r);
      toast('Aula salva no banco!', 'success');
    } else {
      state.aulas.push({ id: Date.now(), ...row });
      toast('Salvo localmente.', 'info');
    }
  }
  showLoading(false); closeModal('modal-aula'); renderAll();
}

// ─── DESEMPENHO ──────────────────────────────────────────────
function renderDesempenhoSelect() {
  const sel = document.getElementById('select-aluno-desemp');
  sel.innerHTML = '<option value="">Selecione um aluno...</option>' +
    alunosTurma().map(a=>`<option value="${a.id}">${a.nome}</option>`).join('');
}

function renderDesempenho(alunoId) {
  const el    = document.getElementById('desempenho-content');
  if (!alunoId) { el.innerHTML = '<p class="empty-state">Selecione um aluno para ver o desempenho.</p>'; return; }
  const aluno = state.alunos.find(a=>a.id==alunoId);
  if (!aluno)  { el.innerHTML = '<p class="empty-state">Aluno não encontrado.</p>'; return; }

  const nArr       = state.notas.filter(n=>Number(n.aluno_id)===aluno.id);
  const mediaNotas = nArr.length ? nArr.reduce((s,n)=>s+parseFloat(n.nota),0)/nArr.length : null;
  const pArr       = state.presencas.filter(p=>Number(p.aluno_id)===aluno.id && p.turma===state.turmaAtiva);
  const freq       = pArr.length ? Math.round(pArr.filter(p=>p.status==='P').length/pArr.length*100) : null;
  const ativCount  = state.atividades.filter(a=>a.turma===state.turmaAtiva).length;
  const partes     = [...(mediaNotas!==null?[mediaNotas]:[]), ...(freq!==null?[freq/10]:[])];
  const score      = partes.length ? partes.reduce((s,v)=>s+v,0)/partes.length : 0;
  const grade      = scoreLabel(score);

  const notasHTML  = nArr.length
    ? nArr.map(n=>{ const v=parseFloat(n.nota); return `<div class="nota-row">
        <span class="nota-row-disc">${n.disciplina}</span>
        <span class="nota-row-bim">${n.bimestre}º Bim.</span>
        <span class="nota-chip ${v>=7?'high':v>=5?'mid':'low'}">${v.toFixed(1)}</span>
      </div>`; }).join('')
    : '<p class="empty-state">Sem notas.</p>';

  el.innerHTML = `<div class="desemp-card">
    <div class="desemp-header">
      <div class="desemp-avatar">${getInitials(aluno.nome)}</div>
      <div><div class="desemp-nome">${aluno.nome}</div>
        <div class="desemp-meta">Matrícula: ${aluno.matricula||'—'} · ${formatTurma(aluno.turma)}</div></div>
      <div class="desemp-score-badge"><div class="score-circle ${grade}">${grade}</div><div class="score-label">Conceito</div></div>
    </div>
    <div class="desemp-metrics">
      <div class="metric-item"><div class="metric-label">Média Geral</div>
        <div class="metric-value">${mediaNotas!==null?mediaNotas.toFixed(1):'—'}</div>
        <div class="metric-bar"><div class="metric-bar-fill ${barColor(mediaNotas?mediaNotas*10:0)}" style="width:${mediaNotas?mediaNotas*10:0}%"></div></div></div>
      <div class="metric-item"><div class="metric-label">Frequência</div>
        <div class="metric-value">${freq!==null?freq+'%':'—'}</div>
        <div class="metric-bar"><div class="metric-bar-fill ${barColor(freq||0)}" style="width:${freq||0}%"></div></div></div>
      <div class="metric-item"><div class="metric-label">Presenças</div>
        <div class="metric-value">${pArr.filter(p=>p.status==='P').length}/${pArr.length}</div></div>
      <div class="metric-item"><div class="metric-label">Atividades</div><div class="metric-value">${ativCount}</div></div>
      <div class="metric-item"><div class="metric-label">Score</div>
        <div class="metric-value" style="color:var(--accent)">${score.toFixed(1)}</div>
        <div class="metric-bar"><div class="metric-bar-fill blue" style="width:${score*10}%"></div></div></div>
    </div>
    <div class="card" style="margin-top:0"><h3>Notas por Disciplina</h3><div class="desemp-notas-list">${notasHTML}</div></div>
  </div>`;
}

// ─── DELETE ──────────────────────────────────────────────────
function confirmDelete(tipo, id) {
  const msgs = { aluno:'este aluno e seus dados', nota:'esta nota', atividade:'esta atividade', aula:'esta aula' };
  document.getElementById('confirm-msg').textContent = `Excluir ${msgs[tipo]||'este item'}?`;
  state.deleteCallback = () => executeDelete(tipo, id);
  openModal('modal-confirm');
}

async function executeDelete(tipo, id) {
  showLoading(true);
  const tabela = { aluno:'alunos', nota:'notas', atividade:'atividades', aula:'aulas' }[tipo];
  if (isConnected()) {
    const ok = await DB.remove(tabela, id);
    if (!ok) { toast('Erro ao excluir do banco.', 'error'); showLoading(false); return; }
    if (tipo === 'aluno') {
      await state.sbClient.from('notas').delete().eq('aluno_id', id);
      await state.sbClient.from('presencas').delete().eq('aluno_id', id);
    }
  }
  if (tipo==='aluno')      { state.alunos=state.alunos.filter(a=>a.id!=id); state.notas=state.notas.filter(n=>Number(n.aluno_id)!=id); state.presencas=state.presencas.filter(p=>Number(p.aluno_id)!=id); }
  else if (tipo==='nota')      state.notas      = state.notas.filter(n=>n.id!=id);
  else if (tipo==='atividade') state.atividades = state.atividades.filter(a=>a.id!=id);
  else if (tipo==='aula')      state.aulas      = state.aulas.filter(a=>a.id!=id);
  showLoading(false);
  toast(isConnected() ? 'Excluído do banco.' : 'Excluído localmente.', 'info');
  renderAll();
}

// ─── RENDER ALL ──────────────────────────────────────────────
function renderAll() {
  renderDashboard(); renderAlunos(document.getElementById('search-aluno').value);
  renderPresenca(); renderNotas(); renderAtividades(); renderAulas(); renderDesempenhoSelect();
  const s = document.getElementById('select-aluno-desemp').value;
  if (s) renderDesempenho(s);
}

// ─── NAVEGAÇÃO ───────────────────────────────────────────────
function switchView(view) {
  state.viewAtiva = view;
  document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  document.querySelector(`[data-view="${view}"]`).classList.add('active');
  document.getElementById('breadcrumb-view').textContent = view.charAt(0).toUpperCase()+view.slice(1);
  renderAll();
}

function switchTurma(turma) {
  state.turmaAtiva = turma;
  document.querySelectorAll('.turma-btn').forEach(el=>el.classList.toggle('active', el.dataset.turma===turma));
  document.getElementById('breadcrumb-turma').textContent = formatTurma(turma);
  document.getElementById('turma-badge').textContent      = formatTurma(turma);
  const el = document.getElementById('dash-turma-name'); if (el) el.textContent = formatTurma(turma);
  renderAll();
}

// ─── INIT ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('date-display').textContent = new Date().toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'});
  document.getElementById('date-presenca').value = new Date().toISOString().split('T')[0];

  // Auto-reconecta se houver credenciais salvas
  const sUrl = localStorage.getItem('sb_url');
  const sKey = localStorage.getItem('sb_key');
  if (sUrl && sKey) {
    document.getElementById('sb-url').value = sUrl;
    document.getElementById('sb-key').value = sKey;
    const ok = initSupabase(sUrl, sKey);
    if (ok) {
      const { error } = await state.sbClient.from('alunos').select('id').limit(1);
      if (!error) {
        updateSupabaseStatus(true);
        toast('Reconectado ao Supabase!', 'success');
        await loadAllData();
      } else {
        updateSupabaseStatus(false);
        toast('Credenciais salvas mas falha na conexão. Reconfigure.', 'warn');
        renderAll();
      }
    } else { renderAll(); }
  } else {
    updateSupabaseStatus(false); renderAll();
  }

  // NAV
  document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.view)));
  document.querySelectorAll('.turma-btn').forEach(btn=>btn.addEventListener('click',()=>switchTurma(btn.dataset.turma)));
  document.getElementById('sidebar-toggle').addEventListener('click',()=>{
    const sb=document.getElementById('sidebar'), main=document.querySelector('.main');
    if (window.innerWidth<=768) sb.classList.toggle('mobile-open');
    else { sb.classList.toggle('collapsed'); main.classList.toggle('expanded'); }
  });

  // MODAIS
  document.querySelectorAll('.modal-close,[data-modal]').forEach(btn=>btn.addEventListener('click',()=>closeModal(btn.dataset.modal||btn.closest('.modal').id)));
  document.getElementById('modal-overlay').addEventListener('click',()=>document.querySelectorAll('.modal.active').forEach(m=>closeModal(m.id)));

  document.getElementById('btn-config').addEventListener('click',()=>openModal('modal-supabase'));
  document.getElementById('btn-salvar-config').addEventListener('click',salvarConfig);

  document.getElementById('btn-add-aluno').addEventListener('click',()=>{
    ['aluno-id','aluno-nome','aluno-matricula'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('aluno-turma').value=state.turmaAtiva;
    document.getElementById('modal-aluno-title').textContent='Adicionar Aluno';
    openModal('modal-aluno');
  });
  document.getElementById('btn-salvar-aluno').addEventListener('click',salvarAluno);

  document.getElementById('btn-salvar-presenca').addEventListener('click',salvarPresenca);
  document.getElementById('date-presenca').addEventListener('change',renderPresenca);

  document.getElementById('btn-add-nota').addEventListener('click',()=>{
    ['nota-id','nota-disciplina','nota-valor'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('modal-nota-title').textContent='Lançar Nota';
    populateNotaAlunos(); openModal('modal-nota');
  });
  document.getElementById('btn-salvar-nota').addEventListener('click',salvarNota);

  document.getElementById('btn-add-atividade').addEventListener('click',()=>{
    ['ativ-id','ativ-titulo','ativ-desc','ativ-disciplina','ativ-data'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('ativ-peso').value='1';
    document.getElementById('modal-atividade-title').textContent='Nova Atividade';
    openModal('modal-atividade');
  });
  document.getElementById('btn-salvar-atividade').addEventListener('click',salvarAtividade);

  document.getElementById('btn-add-aula').addEventListener('click',()=>{
    ['aula-id','aula-disciplina','aula-conteudo','aula-inicio','aula-fim'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('aula-tipo').value='regular';
    document.getElementById('aula-data').value=new Date().toISOString().split('T')[0];
    document.getElementById('modal-aula-title').textContent='Registrar Aula';
    atualizarFimAula(); openModal('modal-aula');
  });
  document.getElementById('aula-tipo').addEventListener('change',atualizarFimAula);
  document.getElementById('aula-inicio').addEventListener('input',atualizarFimAula);
  document.getElementById('aula-inicio').addEventListener('change',atualizarFimAula);
  document.getElementById('btn-salvar-aula').addEventListener('click',salvarAula);

  document.querySelectorAll('.filtro-btn').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('.filtro-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); state.aulaFiltro=btn.dataset.filtro; renderAulas();
  }));

  document.getElementById('btn-confirm-delete').addEventListener('click',()=>{
    if (state.deleteCallback) state.deleteCallback();
    state.deleteCallback=null; closeModal('modal-confirm');
  });
  document.getElementById('search-aluno').addEventListener('input',e=>renderAlunos(e.target.value));
  document.getElementById('select-aluno-desemp').addEventListener('change',e=>renderDesempenho(e.target.value));
});
