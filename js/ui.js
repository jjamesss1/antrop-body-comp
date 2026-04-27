/**
 * ui.js — AntroLab v2
 * Flujo de pantallas, binding DOM ↔ cálculos, historial, onboarding, spotlight.
 */

'use strict';

// ── Estado global ─────────────────────────────────────────────────────────────

const STATE = {
  medicion:      null,
  resultados:    null,
  anterior:      null,
  resultadosAnt: null,
  debounceTimer: null,
  profile:       null,
  autosaveTimer: null,
  // Evolución
  evoMetric:     'grasa',    // grasa | peso | sum6 | muscular
  evoPeriod:     '90d',
  // Historial
  histSelectedId: null,
  histFilter:    '',
};

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  onAuthChange(handleAuthChange);
  initOnboarding();
  initForm();
  initImportExport();
  initHistorialPanel();
  initTabs();
  initSpotlight();
  initEvolucionPanel();
  initHomePanel();
});

// ── TOAST ─────────────────────────────────────────────────────────────────────

let _toastTimer = null;
function showToast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  if (!el) return;
  clearTimeout(_toastTimer);
  el.textContent = msg;
  el.className = type;          // 'ok' | 'error'
  _toastTimer = setTimeout(() => { el.className = 'hidden'; }, 3500);
}

// ── PANTALLAS ─────────────────────────────────────────────────────────────────

function showScreen(name) {
  document.getElementById('screen-login')?.classList.add('hidden');
  document.getElementById('screen-onboarding')?.classList.add('hidden');
  document.getElementById('app-shell')?.classList.add('hidden');

  if (name === 'login')      document.getElementById('screen-login')?.classList.remove('hidden');
  if (name === 'onboarding') document.getElementById('screen-onboarding')?.classList.remove('hidden');
  if (name === 'app')        document.getElementById('app-shell')?.classList.remove('hidden');
}

// ── AUTH CHANGE ───────────────────────────────────────────────────────────────

async function handleAuthChange(user) {
  if (!user) { showScreen('login'); return; }
  const profile = await getProfile(user.id);
  if (!profile) { showScreen('onboarding'); return; }
  STATE.profile = profile;
  enterApp(user, profile);
}

async function enterApp(user, profile) {
  showScreen('app');

  // Sidebar user info
  const nombre = user.user_metadata?.full_name || user.user_metadata?.nombre || user.email || 'Usuario';
  const inicial = nombre.charAt(0).toUpperCase();
  const elName  = document.getElementById('sidebar-user-name');
  const elEmail = document.getElementById('sidebar-user-email');
  const elAv    = document.getElementById('sidebar-avatar');
  if (elName)  elName.textContent  = nombre;
  if (elEmail) elEmail.textContent = user.email || '';
  if (elAv)    elAv.textContent    = inicial;

  // Init medición
  STATE.medicion = emptyMedicion();
  prefillFromProfile(profile, user);

  // Load historial
  await cargarHistorialDeSupabase();

  // Default tab: Inicio si hay historial, Medición si no
  const hist = obtenerHistorial();
  switchTab(hist.length > 0 ? 'tab-inicio' : 'tab-medicion');

  renderHome();
  recalcular();

  if (!profile.spotlight_shown) {
    setTimeout(() => showSpotlight(), 600);
  }
}

function prefillFromProfile(profile, user) {
  const sexoInput   = document.getElementById('hidden-sexo');
  const nombreInput = document.getElementById('hidden-nombre');

  if (sexoInput && profile.sexo) {
    sexoInput.value = profile.sexo;
    STATE.medicion.meta.sexo = profile.sexo;
  }

  const nombre = user?.user_metadata?.full_name || user?.user_metadata?.nombre || '';
  if (nombreInput && nombre) {
    nombreInput.value = nombre;
    STATE.medicion.meta.nombre = nombre;
  }

  if (profile.anio_nacimiento) {
    const hoy = new Date();
    const fechaInput = document.querySelector('[data-field="meta.fecha"]');
    const fechaMed   = fechaInput?.value ? new Date(fechaInput.value) : hoy;
    const edad = +(fechaMed.getFullYear() - profile.anio_nacimiento).toFixed(1);
    const edadInput = document.querySelector('[data-field="meta.edad"]');
    if (edadInput) edadInput.value = edad > 0 ? edad : '';
    STATE.medicion.meta.edad = edad > 0 ? edad : null;
  }
}

// ── TABS ──────────────────────────────────────────────────────────────────────

function initTabs() {
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tabId) {
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('[data-panel]').forEach(panel => {
    panel.classList.toggle('hidden', panel.dataset.panel !== tabId);
  });

  // On-enter hooks
  if (tabId === 'tab-inicio')    renderHome();
  if (tabId === 'tab-evolucion') renderEvolucionPanel();
  if (tabId === 'tab-historial') renderHistorialTable();
  if (tabId === 'tab-medicion')  showForm();
}

// ── ONBOARDING ────────────────────────────────────────────────────────────────

function initOnboarding() {
  document.querySelectorAll('.sex-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.sex-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });
  });

  initYearPicker();

  document.getElementById('btn-onboarding-continue')?.addEventListener('click', async () => {
    const user = authCurrentUser();
    if (!user) return;
    const sexo = document.querySelector('.sex-card.active')?.dataset.value || 'M';
    const anio = getSelectedYear();
    const btn = document.getElementById('btn-onboarding-continue');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
    const ok = await saveProfile(user.id, { sexo, anio_nacimiento: anio });
    if (ok) {
      STATE.profile = { sexo, anio_nacimiento: anio, spotlight_shown: false };
      enterApp(user, STATE.profile);
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Continuar'; }
      showToast('Error al guardar perfil. Intentá de nuevo.', 'error');
    }
  });
}

// ── YEAR PICKER ───────────────────────────────────────────────────────────────

let _selectedYear = new Date().getFullYear() - 30;

function initYearPicker() {
  const list = document.getElementById('year-picker-list');
  if (!list) return;
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 80;
  const endYear   = currentYear - 10;
  _selectedYear   = currentYear - 30;
  list.innerHTML  = '';
  for (let y = startYear; y <= endYear; y++) {
    const item = document.createElement('div');
    item.className = 'year-item' + (y === _selectedYear ? ' selected' : '');
    item.textContent = y;
    item.dataset.year = y;
    list.appendChild(item);
  }
  const sel = list.querySelector('.year-item.selected');
  if (sel) list.scrollTop = sel.offsetTop - list.clientHeight / 2 + 20;

  let scrollTimer;
  list.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => updateSelectedYear(list), 80);
  });
  list.addEventListener('click', (e) => {
    const item = e.target.closest('.year-item');
    if (!item) return;
    _selectedYear = parseInt(item.dataset.year);
    list.querySelectorAll('.year-item').forEach(el => el.classList.remove('selected'));
    item.classList.add('selected');
    item.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
}

function updateSelectedYear(list) {
  const centerY = list.scrollTop + list.clientHeight / 2;
  let closest = null, closestDist = Infinity;
  list.querySelectorAll('.year-item').forEach(item => {
    const dist = Math.abs(item.offsetTop + item.offsetHeight / 2 - centerY);
    if (dist < closestDist) { closestDist = dist; closest = item; }
  });
  if (closest) {
    list.querySelectorAll('.year-item').forEach(el => el.classList.remove('selected'));
    closest.classList.add('selected');
    _selectedYear = parseInt(closest.dataset.year);
  }
}

function getSelectedYear() { return _selectedYear; }

// ── LOGIN / LOGOUT ────────────────────────────────────────────────────────────

document.getElementById('btn-google-login')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-google-login');
  if (btn) { btn.disabled = true; btn.style.opacity = '.6'; }
  try {
    const { error } = await authLoginGoogle();
    if (error) {
      showToast('Error al conectar con Google: ' + error, 'error');
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    }
    // Si no hay error, Supabase redirige a Google — no hay más código que ejecutar
  } catch (e) {
    console.error('authLoginGoogle threw:', e);
    showToast('No se pudo iniciar sesión: ' + (e?.message || 'error desconocido'), 'error');
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }
});

document.getElementById('btn-logout')?.addEventListener('click', async () => {
  await authLogout();
  STATE.profile = null;
  showScreen('login');
});

// ── HOME PANEL ────────────────────────────────────────────────────────────────

function initHomePanel() {
  document.getElementById('home-btn-nueva')?.addEventListener('click',   () => switchTab('tab-medicion'));
  document.getElementById('home-btn-nueva-2')?.addEventListener('click', () => switchTab('tab-medicion'));
  document.getElementById('home-btn-primera')?.addEventListener('click', () => switchTab('tab-medicion'));
  document.getElementById('btn-repetir-ultima')?.addEventListener('click', () => {
    const hist = obtenerHistorial();
    if (hist.length === 0) { switchTab('tab-medicion'); return; }
    const last = hist[0];
    STATE.medicion = JSON.parse(JSON.stringify(last.medicion));
    STATE.medicion.meta.id = crypto.randomUUID?.() || Date.now().toString(36);
    STATE.medicion.meta.fecha = new Date().toISOString().slice(0, 10);
    poblarFormulario(document.getElementById('form-medicion'), STATE.medicion);
    recalcular(); updateProgress();
    switchTab('tab-medicion');
    showToast('Plantilla cargada ✓');
  });

  // Home period tabs
  document.getElementById('home-period-tabs')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.period-tab');
    if (!btn) return;
    document.querySelectorAll('#home-period-tabs .period-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderHomeTrendChart(btn.dataset.period);
  });
}

function renderHome() {
  const hist = obtenerHistorial();

  // Greeting
  const user = authCurrentUser();
  const nombre = user?.user_metadata?.full_name?.split(' ')[0] ||
                 user?.user_metadata?.nombre?.split(' ')[0] || 'vos';
  const el = document.getElementById('home-greeting');
  if (el) el.textContent = `Hola, ${nombre}`;

  // Breadcrumb date
  const bc = document.getElementById('home-breadcrumb');
  if (bc) {
    const now = new Date();
    const dia = now.toLocaleDateString('es-AR', { weekday: 'long' });
    const fecha = now.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    bc.textContent = `INICIO · ${dia.toUpperCase()} ${fecha.toUpperCase()}`;
  }

  const empty     = document.getElementById('home-empty');
  const dashboard = document.getElementById('home-dashboard');

  if (hist.length === 0) {
    empty?.classList.remove('hidden');
    dashboard?.classList.add('hidden');
    return;
  }

  empty?.classList.add('hidden');
  dashboard?.classList.remove('hidden');

  const last = hist[0];
  const prev = hist[1] || null;
  const lm   = last.medicion;
  const lr   = last.resultados;

  // Last weight
  const peso = lm?.basicos?.peso_kg;
  const pesoPrev = prev?.medicion?.basicos?.peso_kg;
  document.getElementById('home-ultima-peso').textContent = peso?.toFixed(2) ?? '—';

  const deltaEl = document.getElementById('home-ultima-delta');
  if (deltaEl && peso && pesoPrev) {
    const d = peso - pesoPrev;
    deltaEl.textContent = `${d >= 0 ? '+' : ''}${d.toFixed(2)} kg`;
    deltaEl.className = 'home-last-delta ' + (d > 0 ? 'pos' : d < 0 ? 'neg' : '');
  }

  // Last date
  const fechaStr = lm?.meta?.fecha;
  const fechaEl  = document.getElementById('home-ultima-fecha');
  if (fechaEl && fechaStr) {
    const hoy   = new Date();
    const lDate = new Date(fechaStr + 'T00:00:00');
    const dias  = Math.round((hoy - lDate) / (1000 * 60 * 60 * 24));
    const fmtd  = lDate.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    fechaEl.textContent = `${dias === 0 ? 'hoy' : 'hace ' + dias + ' días'} · ${fmtd}`;
  }

  // Metrics
  const grasa  = lr?.kerr?.componentes?.adiposa?.pct;
  const sum6   = lr?.sumas?.sum6;
  const imc    = lr?.imc?.imc;
  const icc    = lr?.icc?.icc;
  document.getElementById('home-grasa').textContent = grasa != null ? grasa.toFixed(1) + ' %' : '—';
  document.getElementById('home-sum6').innerHTML    = sum6  != null ? sum6.toFixed(0) + ' <span class="home-metric-unit">mm</span>' : '—';
  document.getElementById('home-imc').textContent   = imc   != null ? imc.toFixed(1)  : '—';
  document.getElementById('home-icc').textContent   = icc   != null ? icc.toFixed(3)  : '—';

  // Trend chart
  renderHomeTrendChart('90d');

  // Recent list (last 5)
  renderHomeRecentList(hist.slice(0, 5));

  // Next steps
  renderHomeNextSteps(hist);

  // Destacados (vs 90 days ago)
  renderHomeDestacados(hist);
}

function renderHomeRecentList(entries) {
  const tbody = document.getElementById('home-recent-list');
  if (!tbody) return;

  tbody.innerHTML = entries.map((entry, i) => {
    const med  = entry.medicion;
    const res  = entry.resultados;
    const prev = entries[i + 1];
    const peso = med?.basicos?.peso_kg;
    const gras = res?.kerr?.componentes?.adiposa?.pct;
    const sum6 = res?.sumas?.sum6;
    const pesoPrev = prev?.medicion?.basicos?.peso_kg;
    const delta = (peso && pesoPrev) ? peso - pesoPrev : null;
    const fechaStr = med?.meta?.fecha || '—';
    const lDate = new Date(fechaStr + 'T00:00:00');
    const hoy   = new Date();
    const dias  = Math.round((hoy - lDate) / (1000 * 60 * 60 * 24));
    const notas = med?.meta?.notas;

    const fechaFmt = lDate.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    const esHoy = dias === 0;

    return `<tr data-id="${med?.meta?.id}">
      <td>
        <span class="hist-fecha">${fechaFmt}</span>
        ${esHoy ? '<span class="home-recent-tag">HOY</span>' : `<span class="hist-dias">${dias} d</span>`}
      </td>
      <td class="num">${peso != null ? peso.toFixed(2) : '—'} kg</td>
      <td class="num">${gras != null ? gras.toFixed(1) + ' %' : '—'}</td>
      <td class="num">${sum6 != null ? sum6.toFixed(0) + ' mm' : '—'}</td>
      <td class="num">
        ${delta != null
          ? `<span class="hist-delta ${delta > 0 ? 'pos' : delta < 0 ? 'neg' : ''}">${delta >= 0 ? '+' : ''}${delta.toFixed(2)}</span>`
          : '—'}
      </td>
    </tr>`;
  }).join('');

  // Click to load in historial
  tbody.querySelectorAll('tr[data-id]').forEach(row => {
    row.addEventListener('click', () => {
      switchTab('tab-historial');
      const id = row.dataset.id;
      setTimeout(() => selectHistorialRow(id), 50);
    });
  });
}

function renderHomeNextSteps(hist) {
  const container = document.getElementById('home-next-steps');
  if (!container) return;

  const items = [];

  // Próxima medición (14 días desde la última)
  if (hist.length > 0) {
    const lastFecha = new Date(hist[0].medicion.meta.fecha + 'T00:00:00');
    const nextFecha = new Date(lastFecha.getTime() + 14 * 24 * 60 * 60 * 1000);
    const hoy  = new Date();
    const dias = Math.round((nextFecha - hoy) / (1000 * 60 * 60 * 24));
    const fmtd = nextFecha.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' });
    items.push({
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
      title: 'Próxima medición',
      sub: `${dias > 0 ? 'en ' + dias + ' días' : dias === 0 ? 'hoy' : 'hace ' + Math.abs(dias) + ' días'} · ${fmtd}`,
      action: 'Agendar',
      onClick: () => switchTab('tab-medicion'),
    });
  }

  container.innerHTML = items.map(item => `
    <div class="home-next-step">
      <div class="home-next-icon">${item.icon}</div>
      <div class="home-next-info">
        <div class="home-next-title">${item.title}</div>
        <div class="home-next-sub">${item.sub}</div>
      </div>
      <button class="home-next-action" onclick="switchTab('tab-medicion')">${item.action}</button>
    </div>
  `).join('');
}

function renderHomeDestacados(hist) {
  const container = document.getElementById('home-destacados');
  if (!container) return;

  if (hist.length < 2) {
    container.innerHTML = '<div style="font-size:.8rem;color:var(--text-3)">Necesitás al menos 2 mediciones.</div>';
    return;
  }

  const now  = new Date();
  const cutoff90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const last = hist[0];
  // Find closest to 90 days ago
  const old90 = hist.find(e => {
    const d = new Date(e.medicion.meta.fecha + 'T00:00:00');
    return d <= cutoff90;
  }) || hist[hist.length - 1];

  const comparisons = [
    {
      label: 'Tríceps',
      curr: last.medicion.pliegues?.triceps,
      prev: old90.medicion.pliegues?.triceps,
      unit: 'mm', reverse: true,
    },
    {
      label: 'Abdominal',
      curr: last.medicion.pliegues?.abdominal,
      prev: old90.medicion.pliegues?.abdominal,
      unit: 'mm', reverse: true,
    },
    {
      label: '% grasa',
      curr: last.resultados?.kerr?.componentes?.adiposa?.pct,
      prev: old90.resultados?.kerr?.componentes?.adiposa?.pct,
      unit: '%', reverse: true, decimals: 1,
    },
  ];

  const rows = comparisons.filter(c => c.curr != null && c.prev != null);
  if (rows.length === 0) {
    container.innerHTML = '<div style="font-size:.8rem;color:var(--text-3)">Sin datos suficientes.</div>';
    return;
  }

  container.innerHTML = rows.map(c => {
    const diff    = c.curr - c.prev;
    const pct     = c.prev !== 0 ? ((diff / c.prev) * 100) : 0;
    const pos     = c.reverse ? diff <= 0 : diff >= 0;
    const cls     = diff === 0 ? '' : (pos ? 'pos' : 'neg');
    const sign    = diff >= 0 ? '+' : '';
    const dec     = c.decimals ?? 1;
    const pctStr  = `${sign}${pct.toFixed(0)}%`;
    return `<div class="home-destacado">
      <span class="home-destacado-label">${c.label}</span>
      <span class="home-destacado-vals">
        <span class="home-destacado-curr">${c.curr.toFixed(dec)} ${c.unit}</span>
        <span class="home-destacado-delta ${cls}">${pctStr}</span>
      </span>
    </div>`;
  }).join('');
}

function renderHomeTrendChart(period) {
  const hist = obtenerHistorial();
  const subtitle = document.getElementById('home-trend-subtitle');
  if (hist.length === 0) return;

  const sorted = [...hist].sort((a, b) =>
    new Date(a.medicion.meta.fecha) - new Date(b.medicion.meta.fecha));

  const now = new Date();
  let cutoff = null;
  if (period === '7d')  cutoff = new Date(now - 7  * 864e5);
  if (period === '30d') cutoff = new Date(now - 30 * 864e5);
  if (period === '90d') cutoff = new Date(now - 90 * 864e5);
  if (period === '1y')  cutoff = new Date(now - 365 * 864e5);

  const filtered = cutoff
    ? sorted.filter(e => new Date(e.medicion.meta.fecha + 'T00:00:00') >= cutoff)
    : sorted;

  const labels = filtered.map(e => {
    const d = new Date(e.medicion.meta.fecha + 'T00:00:00');
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  });
  const values = filtered.map(e => e.resultados?.kerr?.componentes?.adiposa?.pct ?? null);

  if (subtitle) {
    const periodos = { '7d':'7 días', '30d':'30 días', '90d':'90 días', '1y':'1 año', 'all':'todo el historial' };
    subtitle.textContent = `% grasa corporal · ${periodos[period] || '—'}`;
  }

  renderEvolucionChart('home-trend-chart', labels, values, {
    color: '#4f46e5',
    fill:  true,
    minimal: true,
  });
}

// ── FORMULARIO ────────────────────────────────────────────────────────────────

function initForm() {
  const form = document.getElementById('form-medicion');
  if (!form) return;

  form.addEventListener('input', () => {
    clearTimeout(STATE.debounceTimer);
    STATE.debounceTimer = setTimeout(() => {
      STATE.medicion = medicionDesdeFormulario(form);
      recalcular();
      updateProgress();
      scheduleAutosave();
    }, 200);
  });

  document.getElementById('btn-nueva')?.addEventListener('click', () => {
    if (confirm('¿Comenzar una medición nueva? Los datos no guardados se perderán.')) resetForm();
  });
  document.getElementById('btn-back-mobile')?.addEventListener('click', () => {
    if (confirm('¿Descartar cambios?')) resetForm();
  });
  document.getElementById('btn-guardar')?.addEventListener('click',        () => guardarMedicion());
  document.getElementById('btn-guardar-mobile')?.addEventListener('click', () => guardarMedicion());
  document.getElementById('btn-ver-resultados')?.addEventListener('click', () => showResultados());

  // Resultados sub-view buttons
  document.getElementById('btn-back-resultados')?.addEventListener('click',        () => showForm());
  document.getElementById('btn-back-resultados-mobile')?.addEventListener('click', () => showForm());
  document.getElementById('btn-ver-evolucion')?.addEventListener('click',          () => switchTab('tab-evolucion'));
  document.getElementById('btn-ver-evolucion-mobile')?.addEventListener('click',   () => switchTab('tab-evolucion'));
  document.getElementById('btn-exportar-json-res')?.addEventListener('click', () => {
    if (STATE.medicion) exportarMedicion(STATE.medicion, STATE.resultados);
  });
}

function showForm() {
  document.getElementById('medicion-view-form')?.classList.remove('hidden');
  document.getElementById('medicion-view-resultados')?.classList.add('hidden');
}

function showResultados() {
  if (!STATE.resultados) { showToast('No hay resultados para mostrar', 'error'); return; }
  document.getElementById('medicion-view-form')?.classList.add('hidden');
  document.getElementById('medicion-view-resultados')?.classList.remove('hidden');
  renderResultadosPanel(STATE.resultados, STATE.medicion, STATE.resultadosAnt, STATE.anterior);
}

function resetForm() {
  STATE.medicion = emptyMedicion();
  const form = document.getElementById('form-medicion');
  form?.reset();
  const fechaInput = document.querySelector('[data-field="meta.fecha"]');
  if (fechaInput) fechaInput.value = new Date().toISOString().slice(0, 10);
  if (STATE.profile && authCurrentUser()) prefillFromProfile(STATE.profile, authCurrentUser());
  showForm();
  recalcular();
  updateProgress();
  // Hide "ver resultados" button
  const btn = document.getElementById('btn-ver-resultados');
  if (btn) btn.style.display = 'none';
}

async function guardarMedicion() {
  if (!STATE.medicion) return;
  if (!authCurrentUser()) { showToast('Iniciá sesión para guardar', 'error'); return; }
  const ok = await guardarEnHistorial(STATE.medicion, STATE.resultados);
  if (ok) {
    showAutosaveIndicator();
    showToast('Guardado ✓');
    // Show "ver resultados" button
    const btn = document.getElementById('btn-ver-resultados');
    if (btn) btn.style.display = '';
    // Switch to resultados sub-view
    showResultados();
    // Refresh home
    renderHome();
    renderHistorialTable();
  } else {
    showToast('Error al guardar', 'error');
  }
}

// ── AUTO-SAVE ─────────────────────────────────────────────────────────────────

function scheduleAutosave() {
  if (!authCurrentUser()) return;
  clearTimeout(STATE.autosaveTimer);
  STATE.autosaveTimer = setTimeout(async () => {
    if (!STATE.medicion) return;
    const ok = await guardarEnHistorial(STATE.medicion, STATE.resultados);
    if (ok) {
      showAutosaveIndicator();
      renderHome();
      renderHistorialTable();
    }
  }, 1500);
}

function showAutosaveIndicator() {
  const el = document.getElementById('autosave-indicator');
  if (!el) return;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 2500);
}

// ── PROGRESS ──────────────────────────────────────────────────────────────────

function updateProgress() {
  if (!STATE.medicion) return;
  const form = document.getElementById('form-medicion');
  if (!form) return;
  const inputs = [...form.querySelectorAll('input[type="number"], input[type="date"]')]
    .filter(i => i.type !== 'hidden');
  const filled = inputs.filter(i => i.value.trim() !== '').length;
  const pct    = inputs.length ? Math.round(filled / inputs.length * 100) : 0;
  const fill   = document.getElementById('form-progress-fill');
  const label  = document.getElementById('form-progress-pct');
  if (fill)  fill.style.width = pct + '%';
  if (label) label.textContent = pct + '%';
}

// ── RECALCULAR ────────────────────────────────────────────────────────────────

function recalcular() {
  if (!STATE.medicion) return;
  STATE.resultados = calcAll(STATE.medicion);
}

// ── PANEL: RESULTADOS ─────────────────────────────────────────────────────────

function renderResultadosPanel(res, med, resAnt, medAnt) {
  if (!res) return;

  const fechaStr = med?.meta?.fecha;
  const bc       = document.getElementById('resultados-breadcrumb');
  const title    = document.getElementById('resultados-title');
  if (bc && fechaStr) {
    bc.textContent = fechaStr.toUpperCase();
  }
  if (title && fechaStr) {
    const d = new Date(fechaStr + 'T00:00:00');
    title.textContent = 'Medición · ' + d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  const peso = med?.basicos?.peso_kg;
  const pesoPrev = medAnt?.basicos?.peso_kg;
  _setResCard('res-peso', peso?.toFixed(2) ?? '—', 'res-peso-delta', peso, pesoPrev, false);

  const imc    = res.imc?.imc;
  const imcEl  = document.getElementById('res-imc');
  const badgeEl = document.getElementById('res-imc-badge');
  if (imcEl) imcEl.textContent = imc?.toFixed(1) ?? '—';
  if (badgeEl) {
    const cl = imcClasificacion(imc);
    badgeEl.textContent  = cl.label;
    badgeEl.className    = `res-top-badge imc-badge ${cl.cls}`;
  }

  const grasa     = res.kerr?.componentes?.adiposa?.pct;
  const grasaPrev = resAnt?.kerr?.componentes?.adiposa?.pct;
  _setResCard('res-grasa', grasa?.toFixed(1) ?? '—', 'res-grasa-delta', grasa, grasaPrev, true);

  const sum6    = res.sumas?.sum6;
  const sum6Prev = resAnt?.sumas?.sum6;
  _setResCard('res-sum6', sum6?.toFixed(0) ?? '—', 'res-sum6-delta', sum6, sum6Prev, true);

  // Composición corporal
  renderResComposicion(res.kerr);

  // Somatotipo
  renderResSomatotipo(res.somato, resAnt?.somato);

  // Índices
  renderResIndices(res, med);

  // Pliegues
  renderResPliegues(med, medAnt);

  // Kerr tabla
  renderResKerrTabla(res.kerr, resAnt?.kerr);

  // Sumatorias
  const sum3 = res.sumas?.sum3;
  const sum8 = res.sumas?.sum8;
  const p3   = res.sumas?.percentil3;
  setText2('res-sum3', sum3?.toFixed(0));
  setText2('res-sum3-pct', p3?.toFixed(1));
  setText2('res-sum6b', sum6?.toFixed(0));
  setText2('res-sum8', sum8?.toFixed(0));
  setText2('res-idx-musc-oseo', res.indices?.musculo_oseo?.toFixed(3));
  setText2('res-idx-adip-musc', res.indices?.adiposo_muscular?.toFixed(3));
  setText2('res-hb', res.hb?.bmr_kcal?.toFixed(0));

  // Comparación banner
  if (medAnt) renderComparacionBanner(medAnt);
}

function _setResCard(valId, valStr, deltaId, curr, prev, reverseGood) {
  const el = document.getElementById(valId);
  if (el) el.textContent = valStr;
  const dEl = document.getElementById(deltaId);
  if (!dEl) return;
  if (curr != null && prev != null) {
    const d    = curr - prev;
    const sign = d >= 0 ? '+' : '';
    dEl.textContent = `${sign}${d.toFixed(2)} vs anterior`;
    const pos  = reverseGood ? d <= 0 : d >= 0;
    dEl.className = 'res-top-delta ' + (d === 0 ? '' : pos ? 'pos' : 'neg');
  } else {
    dEl.textContent = '';
    dEl.className = 'res-top-delta';
  }
}

function renderResComposicion(kerr) {
  const bar    = document.getElementById('res-comp-bar');
  const legend = document.getElementById('res-comp-legend');
  if (!bar || !legend || !kerr?.componentes) return;

  const comps = [
    { key: 'adiposa',  label: 'Grasa',    color: '#f97316' },
    { key: 'muscular', label: 'Muscular', color: '#4f46e5' },
    { key: 'osea',     label: 'Ósea',     color: '#8b5cf6' },
    { key: 'residual', label: 'Residual', color: '#94a3b8' },
    { key: 'piel',     label: 'Piel',     color: '#f59e0b' },
  ];

  bar.innerHTML = comps
    .filter(c => kerr.componentes[c.key])
    .map(c => {
      const pct = kerr.componentes[c.key].pct;
      return `<div class="res-comp-seg" style="width:${pct}%;background:${c.color}" title="${c.label}: ${pct.toFixed(1)}%"></div>`;
    }).join('');

  legend.innerHTML = comps
    .filter(c => kerr.componentes[c.key])
    .map(c => {
      const comp = kerr.componentes[c.key];
      return `<div class="res-comp-item">
        <div class="res-comp-dot" style="background:${c.color}"></div>
        <span class="res-comp-name">${c.label}</span>
        <span class="res-comp-pct">${comp.pct.toFixed(1)}%</span>
      </div>`;
    }).join('');
}

function renderResSomatotipo(somato, somatoAnt) {
  setText2('res-endo', somato?.endo?.toFixed(1));
  setText2('res-meso', somato?.meso?.toFixed(1));
  setText2('res-ecto', somato?.ecto?.toFixed(1));
  const clasifEl = document.getElementById('res-somato-clasif');
  if (clasifEl && somato) {
    clasifEl.textContent = somatotipoClasificacion(somato.endo, somato.meso, somato.ecto);
  }
  renderSomatocarta('res-somatocarta', somato, somatoAnt, true);
}

function renderResIndices(res, med) {
  const tbody = document.getElementById('res-indices-tbody');
  if (!tbody) return;

  const imc   = res.imc?.imc;
  const icc   = res.icc?.icc;
  const talla = med?.basicos?.talla_cm;
  const cint  = med?.perimetros?.cintura_minima;
  const ica   = (talla && cint) ? cint / talla : null;
  const grasa = res.kerr?.componentes?.adiposa?.pct;
  const sex   = med?.meta?.sexo || 'M';

  const rows = [
    {
      label: 'IMC',
      unit:  'Normal (18.5–24.9)',
      val:   imc?.toFixed(1),
      badge: imc ? imcClasificacion(imc) : null,
    },
    {
      label: 'ICC (cintura/cadera)',
      unit:  icc ? `Umbral <0.90` : '',
      val:   icc?.toFixed(3),
      badge: res.icc ? { label: riesgoLabel(res.icc.riesgo), cls: riesgoCls(res.icc.riesgo) } : null,
    },
    {
      label: 'ICA (cintura/altura)',
      unit:  'Saludable (<0.50)',
      val:   ica?.toFixed(3),
      badge: ica ? icaClasificacion(ica) : null,
    },
    {
      label: '% Grasa (Kerr)',
      unit:  sex === 'M' ? 'Atlético 6–13%' : 'Atlética 14–20%',
      val:   grasa?.toFixed(1),
      badge: grasa ? grasaClasificacion(grasa, sex) : null,
    },
  ];

  tbody.innerHTML = rows.map(r => {
    const badgeHtml = r.badge
      ? `<span class="idx-badge ${r.badge.cls}">${r.badge.label}</span>`
      : '';
    return `<tr>
      <td>${r.label}<br><small style="color:var(--text-3);font-size:.7rem">${r.unit}</small></td>
      <td>${r.val ?? '—'}</td>
      <td>${badgeHtml}</td>
    </tr>`;
  }).join('');
}

function renderResPliegues(med, medAnt) {
  const container = document.getElementById('res-pliegues-list');
  const vsEl      = document.getElementById('res-pliegues-vs');
  if (!container || !med) return;

  if (vsEl) vsEl.textContent = medAnt ? `vs ${medAnt.meta?.fecha}` : '';

  const PLIEGUES = [
    { key: 'triceps',      label: 'Tríceps' },
    { key: 'subescapular', label: 'Subescapular' },
    { key: 'biceps',       label: 'Bíceps' },
    { key: 'cresta_iliaca',label: 'Cresta ilíaca' },
    { key: 'supraespinal', label: 'Supraespinal' },
    { key: 'abdominal',    label: 'Abdominal' },
    { key: 'muslo_frontal',label: 'Muslo frontal' },
    { key: 'pantorrilla',  label: 'Pantorrilla' },
  ];

  const maxVal = Math.max(
    ...PLIEGUES.map(p => med.pliegues?.[p.key] ?? 0),
    1
  );

  container.innerHTML = PLIEGUES.map(p => {
    const curr = med.pliegues?.[p.key];
    const prev = medAnt?.pliegues?.[p.key];
    if (curr == null) return '';
    const pct   = Math.min(100, (curr / maxVal) * 100);
    const delta = (prev != null) ? (curr - prev) : null;
    const dStr  = delta != null
      ? `<span style="font-size:.7rem;color:${delta > 0 ? 'var(--red)' : delta < 0 ? 'var(--green)' : 'var(--text-3)'}">
          ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}
         </span>` : '';
    const prevStr = prev != null ? `<span class="res-pliegue-prev">últ. ${prev.toFixed(1)}</span>` : '';
    return `<div class="res-pliegue">
      <div class="res-pliegue-header">
        <span class="res-pliegue-name">${p.label}</span>
        <span class="res-pliegue-vals">
          <span class="res-pliegue-curr">${curr.toFixed(1)} mm</span>
          ${prevStr}${dStr}
        </span>
      </div>
      <div class="res-pliegue-bar-wrap">
        <div class="res-pliegue-bar-fill" style="width:${pct}%"></div>
      </div>
    </div>`;
  }).join('');
}

function renderResKerrTabla(kerr, kerrAnt) {
  if (!kerr?.componentes) return;
  const comps = ['piel', 'adiposa', 'muscular', 'osea', 'residual'];
  for (const k of comps) {
    const c = kerr.componentes[k];
    if (!c) continue;
    setText2(`res-kerr-${k}-kg`,  c.kg?.toFixed(3));
    setText2(`res-kerr-${k}-pct`, c.pct?.toFixed(2));
    const diffEl = document.getElementById(`res-kerr-${k}-diff`);
    if (diffEl && kerrAnt?.componentes?.[k]) {
      const d = c.kg - kerrAnt.componentes[k].kg;
      diffEl.textContent = `${d >= 0 ? '+' : ''}${d.toFixed(2)} kg`;
      diffEl.className = `diff ${d > 0 ? 'positive' : d < 0 ? 'negative' : 'neutral'}`;
    }
  }
  setText2('res-kerr-cierre', kerr.diferencia_pct?.toFixed(2));
}

// ── HELPERS CLASIFICACIÓN ─────────────────────────────────────────────────────

function imcClasificacion(imc) {
  if (!imc) return { label: '—', cls: 'neutral' };
  if (imc < 18.5) return { label: 'Bajo peso',   cls: 'low' };
  if (imc < 25)   return { label: 'Normal',       cls: 'ok' };
  if (imc < 30)   return { label: 'Sobrepeso',    cls: 'warn' };
  return              { label: 'Obesidad',        cls: 'bad' };
}

function icaClasificacion(ica) {
  if (ica < 0.43) return { label: 'Bajo',        cls: 'warn' };
  if (ica < 0.50) return { label: 'Saludable',   cls: 'ok' };
  if (ica < 0.60) return { label: 'Elevado',     cls: 'warn' };
  return              { label: 'Muy elevado',    cls: 'bad' };
}

function grasaClasificacion(pct, sexo) {
  if (sexo === 'M') {
    if (pct < 6)  return { label: 'Esencial',  cls: 'warn' };
    if (pct < 14) return { label: 'Atlético',  cls: 'ok' };
    if (pct < 18) return { label: 'Fitness',   cls: 'ok' };
    if (pct < 25) return { label: 'Promedio',  cls: 'warn' };
    return            { label: 'Elevado',     cls: 'bad' };
  } else {
    if (pct < 14) return { label: 'Esencial',  cls: 'warn' };
    if (pct < 21) return { label: 'Atlética',  cls: 'ok' };
    if (pct < 25) return { label: 'Fitness',   cls: 'ok' };
    if (pct < 32) return { label: 'Promedio',  cls: 'warn' };
    return            { label: 'Elevado',     cls: 'bad' };
  }
}

function riesgoLabel(r) {
  return { bajo: 'Bajo riesgo', moderado: 'Moderado', alto: 'Alto', muy_alto: 'Muy alto' }[r] || r;
}
function riesgoCls(r) {
  return { bajo: 'ok', moderado: 'warn', alto: 'bad', muy_alto: 'bad' }[r] || 'warn';
}

function somatotipoClasificacion(endo, meso, ecto) {
  if (endo == null || meso == null || ecto == null) return '—';
  const m = Math.max(endo, meso, ecto);
  if (m - Math.min(endo, meso, ecto) <= 1) return 'Central';
  if (meso === m) {
    if (endo > ecto) return 'Endo-mesomorfo';
    if (ecto > endo) return 'Ecto-mesomorfo';
    return 'Mesomorfo equilibrado';
  }
  if (endo === m) {
    if (meso > ecto) return 'Meso-endomorfo';
    return 'Endomorfo equilibrado';
  }
  if (ecto === m) {
    if (meso > endo) return 'Meso-ectomorfo';
    return 'Ectomorfo equilibrado';
  }
  return '—';
}

// ── PANEL: EVOLUCIÓN ──────────────────────────────────────────────────────────

function initEvolucionPanel() {
  // Metric cards
  document.querySelectorAll('.evolucion-metric-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.evolucion-metric-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      STATE.evoMetric = card.dataset.metric;
      renderEvolucionChart_main();
    });
  });

  // Period tabs
  document.getElementById('evolucion-period-tabs')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.period-tab-sm');
    if (!btn) return;
    document.querySelectorAll('#evolucion-period-tabs .period-tab-sm').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    STATE.evoPeriod = btn.dataset.period;
    renderEvolucionChart_main();
  });
}

function renderEvolucionPanel() {
  const hist = obtenerHistorial();
  const sorted = [...hist].sort((a, b) =>
    new Date(a.medicion.meta.fecha) - new Date(b.medicion.meta.fecha));

  // Count label
  const countEl = document.getElementById('evolucion-count');
  if (countEl) countEl.textContent = `${hist.length} MEDICIÓN${hist.length !== 1 ? 'ES' : ''}`;

  if (hist.length === 0) return;

  const last = hist[0];
  const prev = hist[1] || null;

  // Metric cards: current value + delta + sparkline
  const METRICS = {
    grasa: {
      valId:   'evo-grasa-val',
      deltaId: 'evo-grasa-delta',
      sparkId: 'evo-spark-grasa',
      getVal:  e => e.resultados?.kerr?.componentes?.adiposa?.pct,
      fmt:     v => v?.toFixed(1) + ' %',
    },
    peso: {
      valId:   'evo-peso-val',
      deltaId: 'evo-peso-delta',
      sparkId: 'evo-spark-peso',
      getVal:  e => e.medicion?.basicos?.peso_kg,
      fmt:     v => v?.toFixed(2) + ' kg',
    },
    sum6: {
      valId:   'evo-sum6-val',
      deltaId: 'evo-sum6-delta',
      sparkId: 'evo-spark-sum6',
      getVal:  e => e.resultados?.sumas?.sum6,
      fmt:     v => v?.toFixed(0) + ' mm',
    },
    muscular: {
      valId:   'evo-musc-val',
      deltaId: 'evo-musc-delta',
      sparkId: 'evo-spark-musc',
      getVal:  e => e.resultados?.kerr?.componentes?.muscular?.kg,
      fmt:     v => v?.toFixed(1) + ' kg',
    },
  };

  for (const [key, m] of Object.entries(METRICS)) {
    const currVal = m.getVal(last);
    const prevVal = prev ? m.getVal(prev) : null;
    setText2(m.valId, currVal != null ? m.fmt(currVal) : '—');

    const dEl = document.getElementById(m.deltaId);
    if (dEl && currVal != null && prevVal != null) {
      const d = currVal - prevVal;
      dEl.textContent = `${d >= 0 ? '↑' : '↓'} ${Math.abs(d).toFixed(key === 'peso' || key === 'muscular' ? 2 : 1)} vs anterior`;
      dEl.className = `evolucion-metric-delta ${d > 0 ? 'pos' : d < 0 ? 'neg' : ''}`;
    }

    // Sparkline
    const sparkData = sorted.map(e => m.getVal(e)).filter(v => v != null);
    if (sparkData.length > 1) {
      renderSparkline(m.sparkId, sparkData);
    }
  }

  renderEvolucionChart_main();
}

function renderEvolucionChart_main() {
  const hist = obtenerHistorial();
  if (hist.length === 0) return;

  const sorted = [...hist].sort((a, b) =>
    new Date(a.medicion.meta.fecha) - new Date(b.medicion.meta.fecha));

  const now = new Date();
  let cutoff = null;
  const period = STATE.evoPeriod;
  if (period === '7d')  cutoff = new Date(now - 7   * 864e5);
  if (period === '30d') cutoff = new Date(now - 30  * 864e5);
  if (period === '90d') cutoff = new Date(now - 90  * 864e5);
  if (period === '1y')  cutoff = new Date(now - 365 * 864e5);

  const filtered = cutoff
    ? sorted.filter(e => new Date(e.medicion.meta.fecha + 'T00:00:00') >= cutoff)
    : sorted;

  const METRICS = {
    grasa:    { getVal: e => e.resultados?.kerr?.componentes?.adiposa?.pct,  label: '% grasa',      unit: '%',  color: '#4f46e5' },
    peso:     { getVal: e => e.medicion?.basicos?.peso_kg,                   label: 'Peso',          unit: 'kg', color: '#10b981' },
    sum6:     { getVal: e => e.resultados?.sumas?.sum6,                      label: 'Σ 6 pliegues',  unit: 'mm', color: '#f97316' },
    muscular: { getVal: e => e.resultados?.kerr?.componentes?.muscular?.kg,  label: 'Masa muscular', unit: 'kg', color: '#8b5cf6' },
  };

  const m = METRICS[STATE.evoMetric] || METRICS.grasa;
  const labels = filtered.map(e => {
    const d = new Date(e.medicion.meta.fecha + 'T00:00:00');
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  });
  const values = filtered.map(e => m.getVal(e) ?? null);
  const valid  = values.filter(v => v != null);

  // Update chart title
  setText2('evo-chart-title', m.label);
  const countEl = document.getElementById('evo-chart-sub');
  const pLabel  = { '7d':'7 días','30d':'30 días','90d':'90 días','1y':'1 año','all':'todo el historial' }[period] || '';
  if (countEl) countEl.textContent = `${filtered.length} mediciones · ${pLabel}`;

  // Current val
  const lastVal = values.filter(v => v != null).pop();
  const prevVal = values.slice(0, -1).filter(v => v != null).pop();
  setText2('evo-current-val', lastVal != null ? lastVal.toFixed(1) + ' ' + m.unit : '—');
  const dEl = document.getElementById('evo-current-delta');
  if (dEl && lastVal != null && prevVal != null) {
    const d = lastVal - prevVal;
    dEl.textContent = `${d >= 0 ? '+' : ''}${d.toFixed(1)} ${m.unit}`;
    dEl.className = `evolucion-chart-current-delta ${d > 0 ? 'pos' : d < 0 ? 'neg' : ''}`;
  }

  // Stats
  if (valid.length > 0) {
    const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const variance = max - min;
    setText2('evo-stat-avg', avg.toFixed(1) + ' ' + m.unit);
    setText2('evo-stat-min', min.toFixed(1) + ' ' + m.unit);
    setText2('evo-stat-max', max.toFixed(1) + ' ' + m.unit);
    setText2('evo-stat-var', variance.toFixed(1) + ' ' + m.unit);
  }

  renderEvolucionChart('evo-main-chart', labels, values, {
    color: m.color,
    fill: true,
    unit: m.unit,
  });
}

// ── HISTORIAL ─────────────────────────────────────────────────────────────────

function initHistorialPanel() {
  document.getElementById('historial-btn-nueva')?.addEventListener('click', () => switchTab('tab-medicion'));

  document.getElementById('historial-search')?.addEventListener('input', (e) => {
    STATE.histFilter = e.target.value.toLowerCase();
    renderHistorialTable();
  });
}

function renderHistorialTable() {
  const hist = obtenerHistorial();
  const tbody  = document.getElementById('historial-tbody');
  const empty  = document.getElementById('historial-table-empty');
  const countEl = document.getElementById('historial-count');
  if (!tbody) return;

  const filter  = STATE.histFilter;
  const filtered = filter
    ? hist.filter(e => {
        const fecha = e.medicion?.meta?.fecha || '';
        const notas = e.medicion?.meta?.notas?.toLowerCase() || '';
        return fecha.includes(filter) || notas.includes(filter);
      })
    : hist;

  if (countEl) countEl.textContent = `${hist.length} MEDICIÓN${hist.length !== 1 ? 'ES' : ''}`;

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  tbody.innerHTML = filtered.map((entry, i) => {
    const med  = entry.medicion;
    const res  = entry.resultados;
    const next = filtered[i + 1];
    const id   = med?.meta?.id;
    const fechaStr = med?.meta?.fecha || '—';
    const notas    = med?.meta?.notas || '';
    const peso     = med?.basicos?.peso_kg;
    const grasa    = res?.kerr?.componentes?.adiposa?.pct;
    const sum6     = res?.sumas?.sum6;
    const pesoPrev = next?.medicion?.basicos?.peso_kg;
    const delta    = (peso && pesoPrev) ? peso - pesoPrev : null;

    const lDate = new Date(fechaStr + 'T00:00:00');
    const hoy   = new Date();
    const dias  = Math.round((hoy - lDate) / (1000 * 60 * 60 * 24));
    const fmtd  = lDate.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    const isSelected = id === STATE.histSelectedId;

    const notaHtml = notas
      ? `<span class="hist-nota-tag">${notas}</span>`
      : '<span style="color:var(--text-3)">—</span>';

    return `<tr data-id="${id}" class="${isSelected ? 'selected' : ''}">
      <td>
        <span class="hist-fecha">${fmtd}</span>
        <span class="hist-dias">${dias === 0 ? 'hoy' : dias + ' d'}</span>
      </td>
      <td>${notaHtml}</td>
      <td class="num">${peso?.toFixed(2) ?? '—'}</td>
      <td class="num">${grasa?.toFixed(1) != null ? grasa.toFixed(1) + ' %' : '—'}</td>
      <td class="num">${sum6?.toFixed(0) ?? '—'}</td>
      <td class="num">
        ${delta != null
          ? `<span class="hist-delta ${delta > 0 ? 'pos' : 'neg'}">${delta >= 0 ? '+' : ''}${delta.toFixed(2)}</span>`
          : '—'}
      </td>
    </tr>`;
  }).join('');

  // Row click
  tbody.querySelectorAll('tr[data-id]').forEach(row => {
    row.addEventListener('click', () => selectHistorialRow(row.dataset.id));
  });
}

function selectHistorialRow(id) {
  STATE.histSelectedId = id;
  document.querySelectorAll('#historial-tbody tr').forEach(r => {
    r.classList.toggle('selected', r.dataset.id === id);
  });
  const entry = obtenerHistorial().find(e => e.medicion?.meta?.id === id);
  if (entry) renderHistorialDetail(entry);
}

function renderHistorialDetail(entry) {
  const empty   = document.getElementById('historial-detail-empty');
  const content = document.getElementById('historial-detail-content');
  if (!content) return;

  empty?.classList.add('hidden');
  content.classList.remove('hidden');

  const med = entry.medicion;
  const res = entry.resultados;
  const id  = med?.meta?.id;

  const fechaStr = med?.meta?.fecha;
  const lDate    = fechaStr ? new Date(fechaStr + 'T00:00:00') : null;
  const fmtd     = lDate?.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  const notas    = med?.meta?.notas || '';
  const peso     = med?.basicos?.peso_kg;
  const grasa    = res?.kerr?.componentes?.adiposa?.pct;
  const sum6     = res?.sumas?.sum6;

  const hist = obtenerHistorial();
  const idx  = hist.findIndex(e => e.medicion?.meta?.id === id);
  const prev = hist[idx + 1] || null;
  const pesoPrev = prev?.medicion?.basicos?.peso_kg;
  const delta    = (peso && pesoPrev) ? peso - pesoPrev : null;

  content.innerHTML = `
    <div>
      <div class="hist-detail-date">${fmtd || '—'}</div>
      ${notas ? `<div class="hist-detail-nota">${notas}</div>` : ''}
    </div>

    <div class="hist-detail-metrics">
      <div class="hist-detail-metric">
        <div class="hist-detail-metric-label">PESO</div>
        <div class="hist-detail-metric-val">${peso?.toFixed(2) ?? '—'} kg</div>
        ${delta != null
          ? `<div class="hist-detail-metric-sub" style="color:${delta > 0 ? 'var(--red)' : 'var(--green)'}">
              ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} kg
             </div>`
          : ''}
      </div>
      <div class="hist-detail-metric">
        <div class="hist-detail-metric-label">% GRASA</div>
        <div class="hist-detail-metric-val">${grasa?.toFixed(1) ?? '—'} %</div>
      </div>
      <div class="hist-detail-metric">
        <div class="hist-detail-metric-label">Σ 6 PLIEGUES</div>
        <div class="hist-detail-metric-val">${sum6?.toFixed(0) ?? '—'} mm</div>
      </div>
      <div class="hist-detail-metric">
        <div class="hist-detail-metric-label">IMC</div>
        <div class="hist-detail-metric-val">${res?.imc?.imc?.toFixed(1) ?? '—'}</div>
      </div>
    </div>

    <div class="hist-detail-actions">
      <button class="hist-detail-btn primary"   data-action="ver"      data-id="${id}">Ver resultados completos</button>
      <button class="hist-detail-btn secondary" data-action="comparar" data-id="${id}">Comparar con otra medición</button>
      <button class="hist-detail-btn secondary" data-action="cargar"   data-id="${id}">Cargar en formulario</button>
      <button class="hist-detail-btn secondary" data-action="exportar" data-id="${id}">↓ Exportar JSON</button>
      <button class="hist-detail-btn danger"    data-action="eliminar" data-id="${id}">Eliminar</button>
    </div>
  `;

  // Button events
  content.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleHistDetailAction(btn.dataset.action, btn.dataset.id));
  });
}

async function handleHistDetailAction(action, id) {
  const entry = obtenerHistorial().find(e => e.medicion?.meta?.id === id);
  if (!entry) return;

  if (action === 'ver') {
    STATE.medicion     = entry.medicion;
    STATE.resultados   = entry.resultados || calcAll(entry.medicion);
    switchTab('tab-medicion');
    showResultados();
  } else if (action === 'cargar') {
    STATE.medicion = entry.medicion;
    poblarFormulario(document.getElementById('form-medicion'), entry.medicion);
    recalcular(); updateProgress();
    switchTab('tab-medicion');
    showToast('Medición cargada ✓');
  } else if (action === 'comparar') {
    STATE.anterior      = entry.medicion;
    STATE.resultadosAnt = entry.resultados || calcAll(entry.medicion);
    renderComparacionBanner(entry.medicion);
    showToast('Cargada como referencia ✓');
  } else if (action === 'exportar') {
    exportarMedicion(entry.medicion, entry.resultados);
  } else if (action === 'eliminar') {
    if (confirm('¿Eliminar esta medición del historial?')) {
      await eliminarDeHistorial(id);
      STATE.histSelectedId = null;
      document.getElementById('historial-detail-empty')?.classList.remove('hidden');
      document.getElementById('historial-detail-content')?.classList.add('hidden');
      renderHistorialTable();
      renderHome();
      showToast('Medición eliminada');
    }
  }
}

// ── IMPORT / EXPORT ───────────────────────────────────────────────────────────

function initImportExport() {
  document.getElementById('btn-cargar-anterior')?.addEventListener('click', () =>
    document.getElementById('input-anterior')?.click());
  document.getElementById('input-anterior')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const med = await importarMedicion(file);
      STATE.anterior      = med;
      STATE.resultadosAnt = calcAll(med);
      showToast('Medición anterior cargada ✓');
      renderComparacionBanner(med);
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    e.target.value = '';
  });

  document.getElementById('btn-cargar-medicion')?.addEventListener('click', () =>
    document.getElementById('input-medicion')?.click());
  document.getElementById('input-medicion')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const med = await importarMedicion(file);
      STATE.medicion = med;
      poblarFormulario(document.getElementById('form-medicion'), med);
      recalcular(); updateProgress();
      showToast('Medición cargada ✓');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    e.target.value = '';
  });

  document.getElementById('btn-descargar')?.addEventListener('click', () => {
    if (STATE.medicion) exportarMedicion(STATE.medicion, STATE.resultados);
  });
}

// ── BANNER COMPARACIÓN ────────────────────────────────────────────────────────

function renderComparacionBanner(medAnt) {
  const banner = document.getElementById('banner-anterior');
  if (!banner) return;
  banner.innerHTML = `
    <span>Comparando con: <strong>${medAnt?.meta?.nombre || '—'}</strong> — ${medAnt?.meta?.fecha || '—'}</span>
    <button id="btn-quitar-anterior">✕ Quitar</button>
  `;
  banner.classList.remove('hidden');
  document.getElementById('btn-quitar-anterior')?.addEventListener('click', () => {
    STATE.anterior = null; STATE.resultadosAnt = null;
    banner.classList.add('hidden');
  });
}

// ── SPOTLIGHT ─────────────────────────────────────────────────────────────────

function initSpotlight() {
  document.getElementById('btn-spotlight-ok')?.addEventListener('click', async () => {
    document.getElementById('spotlight')?.classList.add('hidden');
    const user = authCurrentUser();
    if (user) await markSpotlightShown(user.id);
    if (STATE.profile) STATE.profile.spotlight_shown = true;
  });
}

function showSpotlight() {
  const spotlight = document.getElementById('spotlight');
  if (!spotlight) return;
  const isMobile = window.innerWidth <= 768;
  const targetEl = isMobile
    ? document.querySelector('.bottom-nav-item[data-tab="tab-medicion"]')
    : document.querySelector('.sidebar-nav-item[data-tab="tab-medicion"]');
  if (!targetEl) { spotlight.classList.remove('hidden'); return; }
  const rect   = targetEl.getBoundingClientRect();
  const cutout = document.getElementById('spotlight-cutout');
  const tooltip= document.getElementById('spotlight-tooltip');
  const pad    = 6;
  if (cutout) {
    cutout.style.cssText = `left:${rect.left-pad}px;top:${rect.top-pad}px;width:${rect.width+pad*2}px;height:${rect.height+pad*2}px`;
  }
  if (tooltip) {
    const tipLeft = Math.min(rect.left, window.innerWidth - 230);
    const tipTop  = rect.top > 200 ? rect.top - 130 : rect.bottom + 16;
    tooltip.style.cssText = `left:${Math.max(10, tipLeft)}px;top:${tipTop}px`;
  }
  spotlight.classList.remove('hidden');
}

// ── TOAST ─────────────────────────────────────────────────────────────────────

function showToast(msg, type = 'ok') {
  let toast = document.getElementById('toast');
  if (!toast) { toast = document.createElement('div'); toast.id = 'toast'; document.body.appendChild(toast); }
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ── UTILS ─────────────────────────────────────────────────────────────────────

function setText2(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}
