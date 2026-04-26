/**
 * ui.js
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
  profile:       null,   // { sexo, anio_nacimiento, spotlight_shown }
  autosaveTimer: null,
};

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  onAuthChange(handleAuthChange);
  initOnboarding();
  initForm();
  initImportExport();
  initHistorial();
  initTabs();
  initSpotlight();
});

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
  if (!user) {
    showScreen('login');
    return;
  }

  // Usuario logueado → verificar perfil
  const profile = await getProfile(user.id);

  if (!profile) {
    // Primera vez: mostrar onboarding
    showScreen('onboarding');
    return;
  }

  // Tiene perfil → mostrar app
  STATE.profile = profile;
  enterApp(user, profile);
}

async function enterApp(user, profile) {
  showScreen('app');

  // Llenar datos del sidebar
  const nombre = user.user_metadata?.full_name || user.user_metadata?.nombre || user.email || 'Usuario';
  const inicial = nombre.charAt(0).toUpperCase();
  const el = document.getElementById('sidebar-user-name');
  const av = document.getElementById('sidebar-avatar');
  if (el) el.textContent = nombre;
  if (av) av.textContent = inicial;

  // Inicializar formulario vacío con datos del perfil pre-llenados
  STATE.medicion = emptyMedicion();
  prefillFromProfile(profile, user);
  renderHistorialUI();
  await cargarHistorialDeSupabase();
  renderHistorialUI();
  recalcular();

  // Mostrar spotlight si es primera vez
  if (!profile.spotlight_shown) {
    setTimeout(() => showSpotlight(), 600);
  }
}

/** Pre-llena los campos ocultos del formulario con datos del perfil. */
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

  // Calcular edad a partir del año de nacimiento
  if (profile.anio_nacimiento) {
    const hoy = new Date();
    const fechaInput = document.querySelector('[data-field="meta.fecha"]');
    const fechaMed   = fechaInput?.value ? new Date(fechaInput.value) : hoy;
    const edad = +(fechaMed.getFullYear() - profile.anio_nacimiento +
      (fechaMed.getMonth() > hoy.getMonth() ||
       (fechaMed.getMonth() === hoy.getMonth() && fechaMed.getDate() >= hoy.getDate()) ? 0 : -1)).toFixed(1);
    const edadInput = document.querySelector('[data-field="meta.edad"]');
    if (edadInput) edadInput.value = edad > 0 ? edad : '';
    STATE.medicion.meta.edad = edad > 0 ? edad : null;
  }
}

// ── ONBOARDING ────────────────────────────────────────────────────────────────

function initOnboarding() {
  // Sex cards
  document.querySelectorAll('.sex-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.sex-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });
  });

  // Year picker
  initYearPicker();

  // Continuar
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

  // Render years
  list.innerHTML = '';
  for (let y = startYear; y <= endYear; y++) {
    const item = document.createElement('div');
    item.className = 'year-item' + (y === _selectedYear ? ' selected' : '');
    item.textContent = y;
    item.dataset.year = y;
    list.appendChild(item);
  }

  // Scroll to selected
  const selectedEl = list.querySelector('.year-item.selected');
  if (selectedEl) {
    list.scrollTop = selectedEl.offsetTop - list.clientHeight / 2 + 20;
  }

  // Update selected on scroll (debounced)
  let scrollTimer;
  list.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => updateSelectedYear(list), 80);
  });

  // Click to select
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
    const itemCenter = item.offsetTop + item.offsetHeight / 2;
    const dist = Math.abs(centerY - itemCenter);
    if (dist < closestDist) { closestDist = dist; closest = item; }
  });
  if (closest) {
    list.querySelectorAll('.year-item').forEach(el => el.classList.remove('selected'));
    closest.classList.add('selected');
    _selectedYear = parseInt(closest.dataset.year);
  }
}

function getSelectedYear() { return _selectedYear; }

// ── LOGIN ─────────────────────────────────────────────────────────────────────

document.getElementById('btn-google-login')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-google-login');
  if (btn) { btn.disabled = true; btn.style.opacity = '.6'; }
  const { error } = await authLoginGoogle();
  if (error) {
    showToast('Error al conectar con Google: ' + error, 'error');
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }
});

// ── LOGOUT ────────────────────────────────────────────────────────────────────

document.getElementById('btn-logout')?.addEventListener('click', async () => {
  await authLogout();
  STATE.profile = null;
  showScreen('login');
});

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

  // btn-nueva (desktop)
  document.getElementById('btn-nueva')?.addEventListener('click', () => {
    if (confirm('¿Comenzar una medición nueva? Los datos no guardados se perderán.')) {
      resetForm();
    }
  });
  // btn-back-mobile
  document.getElementById('btn-back-mobile')?.addEventListener('click', () => {
    if (confirm('¿Descartar cambios?')) resetForm();
  });
  // btn-guardar (desktop)
  document.getElementById('btn-guardar')?.addEventListener('click', () => guardarMedicion());
  // btn-guardar-mobile
  document.getElementById('btn-guardar-mobile')?.addEventListener('click', () => guardarMedicion());
}

function resetForm() {
  STATE.medicion = emptyMedicion();
  const form = document.getElementById('form-medicion');
  form?.reset();
  const fechaInput = document.querySelector('[data-field="meta.fecha"]');
  if (fechaInput) fechaInput.value = new Date().toISOString().slice(0, 10);
  if (STATE.profile && authCurrentUser()) prefillFromProfile(STATE.profile, authCurrentUser());
  recalcular();
  updateProgress();
}

async function guardarMedicion() {
  if (!STATE.medicion) return;
  if (!authCurrentUser()) { showToast('Iniciá sesión para guardar', 'error'); return; }
  const ok = await guardarEnHistorial(STATE.medicion, STATE.resultados);
  if (ok) {
    showAutosaveIndicator();
    showToast('Guardado ✓');
    renderHistorialUI();
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
    if (ok) { showAutosaveIndicator(); renderHistorialUI(); }
  }, 1500);
}

function showAutosaveIndicator() {
  const el = document.getElementById('autosave-indicator');
  if (!el) return;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 2500);
}

// ── PROGRESO DEL FORMULARIO ───────────────────────────────────────────────────

function updateProgress() {
  if (!STATE.medicion) return;
  const form = document.getElementById('form-medicion');
  if (!form) return;
  const inputs = [...form.querySelectorAll('input[type="number"], input[type="date"]')]
    .filter(i => !i.closest('input[type="hidden"]') && i.type !== 'hidden');
  const filled = inputs.filter(i => i.value.trim() !== '').length;
  const pct = inputs.length ? Math.round(filled / inputs.length * 100) : 0;

  const fill = document.getElementById('form-progress-fill');
  const label = document.getElementById('form-progress-pct');
  if (fill)  fill.style.width = pct + '%';
  if (label) label.textContent = pct + '%';
}

// ── RECALCULAR ────────────────────────────────────────────────────────────────

function recalcular() {
  if (!STATE.medicion) return;
  STATE.resultados = calcAll(STATE.medicion);
  renderResultados(STATE.resultados, STATE.resultadosAnt);
}

// ── RENDER RESULTADOS ─────────────────────────────────────────────────────────

function renderResultados(res, resAnt) {
  if (!res) return;
  renderZTable(res.zscores, resAnt?.zscores);
  renderZCharts(res.zscores);
  renderSomatotipoPanel(res.somato, resAnt?.somato);
  renderKerrPanel(res.kerr, resAnt?.kerr);
  renderHBPanel(res.hb, res.pesoIdeal, resAnt?.hb);
  renderIMCPanel(res.imc, resAnt?.imc);
  renderICCPanel(res.icc, resAnt?.icc);
  renderAreasPanel(res.areas, resAnt?.areas);
  renderSumasPanel(res.sumas, resAnt?.sumas);
  renderIndicesPanel(res.indices, resAnt?.indices);
}

// ── Helpers de render ─────────────────────────────────────────────────────────

function setText(id, val, decimals = 2) {
  const el = document.getElementById(id);
  if (el) el.textContent = val !== null && val !== undefined
    ? (typeof val === 'number' ? val.toFixed(decimals) : val) : '—';
}

function setDiff(id, current, previous, reverse = false) {
  const el = document.getElementById(id);
  if (!el || current === null || previous === null) { if (el) el.textContent = ''; return; }
  const diff = current - previous;
  const sign = diff >= 0 ? '+' : '';
  el.textContent = `${sign}${diff.toFixed(2)}`;
  el.className = 'diff ' + (diff === 0 ? 'neutral' : (diff > 0) !== reverse ? 'positive' : 'negative');
}

function zBadge(z) {
  if (z === null) return '<span class="badge neutral">—</span>';
  const cls = Math.abs(z) > 2 ? (z > 0 ? 'high' : 'low') : Math.abs(z) > 1 ? 'mid' : 'normal';
  return `<span class="badge ${cls}">${z.toFixed(2)}</span>`;
}

// ── Z Table ───────────────────────────────────────────────────────────────────

const Z_LABELS = {
  peso:'Peso', talla_sentado:'Talla sentado',
  biacromial:'Biacromial', torax_transverso:'Tórax transv.', torax_ap:'Tórax AP',
  bi_iliocrestideo:'Bi-iliocrestídeo', humeral:'Humeral', femoral:'Femoral',
  cabeza:'Cabeza', cuello:'Cuello', brazo_relajado:'Brazo relaj.',
  brazo_flexionado:'Brazo flex.', antebrazo:'Antebrazo', muneca:'Muñeca',
  torax_mesoesternal:'Tórax meso.', cintura_minima:'Cintura mín.',
  caderas_maxima:'Caderas máx.', muslo_superior:'Muslo sup.',
  muslo_medial:'Muslo med.', pantorrilla_maxima:'Pantorrilla', tobillo_minima:'Tobillo mín.',
  triceps:'Tríceps', subescapular:'Subescapular', biceps:'Bíceps',
  cresta_iliaca:'Cresta ilíaca', supraespinal:'Supraespinal',
  abdominal:'Abdominal', muslo_frontal:'Muslo frontal', pantorrilla_pl:'Pantorrilla (pl.)',
};

function renderZTable(zscores, zscoresAnt) {
  const tbody = document.getElementById('z-tbody');
  if (!tbody) return;
  const rows = Object.entries(Z_LABELS).map(([key, label]) => {
    const curr = zscores[key];
    const prev = zscoresAnt?.[key];
    if (!curr) return `<tr><td>${label}</td><td>—</td><td>—</td><td></td><td></td></tr>`;
    const diffAdj = prev ? `<span class="diff ${curr.adjusted > prev.adjusted ? 'positive' : curr.adjusted < prev.adjusted ? 'negative' : 'neutral'}">${(curr.adjusted - prev.adjusted) >= 0 ? '+' : ''}${(curr.adjusted - prev.adjusted).toFixed(2)}</span>` : '';
    const diffZ   = prev ? `<span class="diff ${curr.z > prev.z ? 'positive' : curr.z < prev.z ? 'negative' : 'neutral'}">${(curr.z - prev.z) >= 0 ? '+' : ''}${(curr.z - prev.z).toFixed(2)}</span>` : '';
    return `<tr><td>${label}</td><td class="num">${curr.adjusted.toFixed(2)}</td><td class="num">${zBadge(curr.z)}</td><td class="num faded">${diffAdj}</td><td class="num faded">${diffZ}</td></tr>`;
  });
  tbody.innerHTML = rows.join('');
}

const Z_GROUPS = {
  'z-chart-basicos':    ['peso','talla_sentado'],
  'z-chart-diametros':  ['biacromial','torax_transverso','torax_ap','bi_iliocrestideo','humeral','femoral'],
  'z-chart-perimetros': ['cabeza','cuello','brazo_relajado','brazo_flexionado','antebrazo','muneca','torax_mesoesternal','cintura_minima','caderas_maxima','muslo_superior','muslo_medial','pantorrilla_maxima','tobillo_minima'],
  'z-chart-pliegues':   ['triceps','subescapular','biceps','cresta_iliaca','supraespinal','abdominal','muslo_frontal','pantorrilla_pl'],
};

function renderZCharts(zscores) {
  for (const [canvasId, keys] of Object.entries(Z_GROUPS)) {
    const labels = keys.map(k => Z_LABELS[k] || k);
    const values = keys.map(k => zscores[k]?.z ?? null);
    const validPairs = labels.map((l,i) => [l,values[i]]).filter(([,v]) => v !== null);
    if (validPairs.length > 0) renderZChart(canvasId, validPairs.map(p=>p[0]), validPairs.map(p=>p[1]));
  }
}

// ── Somatotipo ────────────────────────────────────────────────────────────────
function renderSomatotipoPanel(somato, somatoAnt) {
  setText('somato-endo', somato?.endo, 1);
  setText('somato-meso', somato?.meso, 1);
  setText('somato-ecto', somato?.ecto, 1);
  setText('somato-x',   somato?.x, 2);
  setText('somato-y',   somato?.y, 2);
  renderSomatocarta('canvas-somatocarta', somato, somatoAnt);
}

// ── Kerr ──────────────────────────────────────────────────────────────────────
function renderKerrPanel(kerr, kerrAnt) {
  if (!kerr?.componentes) return;
  const comp = kerr.componentes;
  for (const k of ['piel','adiposa','muscular','osea','residual']) {
    const c = comp[k]; if (!c) continue;
    setText(`kerr-${k}-kg`,  c.kg,  3);
    setText(`kerr-${k}-pct`, c.pct, 2);
    if (kerrAnt?.componentes?.[k]) {
      const prev = kerrAnt.componentes[k];
      const diffKg = c.kg - prev.kg;
      const el = document.getElementById(`kerr-${k}-diff`);
      if (el) { el.textContent = `${diffKg >= 0 ? '+' : ''}${diffKg.toFixed(2)} kg`; el.className = `diff ${diffKg > 0 ? 'positive' : diffKg < 0 ? 'negative' : 'neutral'}`; }
    }
  }
  setText('kerr-diff-pct', kerr.diferencia_pct, 2);
  renderKerrPie('canvas-kerr-pie', kerr);
  renderKerrComparacion('canvas-kerr-radar', kerr, kerrAnt);
}

// ── HB ────────────────────────────────────────────────────────────────────────
function renderHBPanel(hb, pesoIdeal, hbAnt) {
  setText('hb-bmr',       hb?.bmr_kcal, 0);
  setText('hb-peso-calc', hb?.peso_calculo_kg, 3);
  setText('pi-ideal',     pesoIdeal?.ideal_kg, 2);
  setText('pi-min',       pesoIdeal?.min_kg, 2);
  setText('pi-max',       pesoIdeal?.max_kg, 2);
  if (hb && hbAnt) setDiff('hb-bmr-diff', hb.bmr_kcal, hbAnt.bmr_kcal);
}

// ── IMC ───────────────────────────────────────────────────────────────────────
function renderIMCPanel(imc, imcAnt) {
  setText('imc-valor',     imc?.imc, 2);
  setText('imc-percentil', imc?.percentil, 0);
  const bsa = STATE.resultados?.bsa;
  setText('bsa-m2',  bsa?.bsa_m2, 3);
  setText('bsa-bm',  bsa?.bsa_bm, 3);
  if (imc && imcAnt) setDiff('imc-diff', imc.imc, imcAnt.imc);
}

// ── ICC ───────────────────────────────────────────────────────────────────────
function renderICCPanel(icc, iccAnt) {
  const el    = document.getElementById('icc-valor');
  const badge = document.getElementById('icc-riesgo');
  const bar   = document.getElementById('icc-bar');
  if (el)    el.textContent = icc?.icc?.toFixed(3) ?? '—';
  if (badge && icc) { badge.textContent = icc.riesgo.charAt(0).toUpperCase() + icc.riesgo.slice(1).replace('_',' '); badge.style.background = icc.color; }
  if (bar && icc?.umbrales) { const lo=.6,hi=1.2,pct=Math.min(100,Math.max(0,(icc.icc-lo)/(hi-lo)*100)); bar.style.setProperty('--icc-pct',pct+'%'); bar.style.setProperty('--icc-color',icc.color); }
  if (icc && iccAnt) setDiff('icc-diff', icc.icc, iccAnt.icc, true);
}

// ── Áreas ─────────────────────────────────────────────────────────────────────
function renderAreasPanel(areas) {
  for (const k of ['brazo','muslo','pantorrilla']) {
    const a = areas?.[k]; if (!a) continue;
    setText(`area-${k}-musc`, a.muscular, 2);
    setText(`area-${k}-adip`, a.adiposa,  2);
  }
}

// ── Sumatorias ────────────────────────────────────────────────────────────────
function renderSumasPanel(sumas, sumasAnt) {
  setText('sum3p',           sumas?.sum3, 0);
  setText('sum3p-percentil', sumas?.percentil3, 1);
  setText('sum6p',           sumas?.sum6, 0);
  setText('sum8p',           sumas?.sum8, 0);
  if (sumas && sumasAnt) { setDiff('sum3p-diff', sumas.sum3, sumasAnt.sum3, true); setDiff('sum8p-diff', sumas.sum8, sumasAnt.sum8, true); }
}

// ── Índices ───────────────────────────────────────────────────────────────────
function renderIndicesPanel(idx) {
  setText('idx-ts-pct',     idx?.talla_sentado_pct, 2);
  setText('idx-biacr',      idx?.biacr_biili,       3);
  setText('idx-musc-oseo',  idx?.musculo_oseo,      3);
  setText('idx-adip-musc',  idx?.adiposo_muscular,  3);
  setText('idx-muscularidad', idx?.muscularidad_sum4p, 3);
}

// ── IMPORT / EXPORT ───────────────────────────────────────────────────────────

function initImportExport() {
  document.getElementById('btn-cargar-anterior')?.addEventListener('click', () => document.getElementById('input-anterior')?.click());
  document.getElementById('input-anterior')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const med = await importarMedicion(file);
      STATE.anterior = med; STATE.resultadosAnt = calcAll(med);
      showToast('Medición anterior cargada ✓');
      renderResultados(STATE.resultados, STATE.resultadosAnt);
      renderComparacionBanner(med);
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    e.target.value = '';
  });

  document.getElementById('btn-cargar-medicion')?.addEventListener('click', () => document.getElementById('input-medicion')?.click());
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
    if (!STATE.medicion) return;
    exportarMedicion(STATE.medicion, STATE.resultados);
  });
}

// ── HISTORIAL ─────────────────────────────────────────────────────────────────

function initHistorial() {
  document.getElementById('panel-historial')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]'); if (!btn) return;
    const id = btn.dataset.id, action = btn.dataset.action;

    if (action === 'cargar') {
      const entry = obtenerHistorial().find(h => h.medicion?.meta?.id === id);
      if (entry) {
        STATE.medicion = entry.medicion;
        STATE.resultados = entry.resultados || calcAll(entry.medicion);
        poblarFormulario(document.getElementById('form-medicion'), entry.medicion);
        recalcular(); updateProgress();
        switchTab('tab-medicion');
        showToast('Medición cargada ✓');
      }
    } else if (action === 'comparar') {
      const entry = obtenerHistorial().find(h => h.medicion?.meta?.id === id);
      if (entry) {
        STATE.anterior = entry.medicion;
        STATE.resultadosAnt = entry.resultados || calcAll(entry.medicion);
        renderResultados(STATE.resultados, STATE.resultadosAnt);
        renderComparacionBanner(entry.medicion);
        showToast('Cargada como anterior ✓');
      }
    } else if (action === 'eliminar') {
      if (confirm('¿Eliminar esta medición?')) {
        await eliminarDeHistorial(id);
        renderHistorialUI();
      }
    } else if (action === 'exportar') {
      const entry = obtenerHistorial().find(h => h.medicion?.meta?.id === id);
      if (entry) exportarMedicion(entry.medicion, entry.resultados);
    }
  });
}

function renderHistorialUI() {
  const container = document.getElementById('panel-historial');
  if (!container) return;
  const historial = obtenerHistorial();

  if (historial.length === 0) {
    container.innerHTML = '<p class="empty-msg">No hay mediciones guardadas aún.</p>';
    return;
  }

  container.innerHTML = historial.map(entry => {
    const med  = entry.medicion;
    const res  = entry.resultados;
    const id   = med?.meta?.id;
    const fecha  = med?.meta?.fecha   || '—';
    const nombre = med?.meta?.nombre  || '—';
    const peso   = med?.basicos?.peso_kg ? `${med.basicos.peso_kg} kg` : '—';
    const imc    = res?.imc?.imc    ? `IMC ${res.imc.imc.toFixed(1)}` : '';
    const musc   = res?.kerr?.componentes?.muscular?.pct ? `Musc. ${res.kerr.componentes.muscular.pct.toFixed(1)}%` : '';
    return `
    <div class="historial-card">
      <div class="historial-info">
        <span class="historial-fecha">${fecha}</span>
        <span class="historial-nombre">${nombre}</span>
        <span class="historial-tags">${peso}${imc ? ' · '+imc : ''}${musc ? ' · '+musc : ''}</span>
      </div>
      <div class="historial-actions">
        <button data-action="cargar"   data-id="${id}" class="btn-sm">Cargar</button>
        <button data-action="comparar" data-id="${id}" class="btn-sm">Comparar</button>
        <button data-action="exportar" data-id="${id}" class="btn-sm">↓ JSON</button>
        <button data-action="eliminar" data-id="${id}" class="btn-sm danger">✕</button>
      </div>
    </div>`;
  }).join('');
}

// ── BANNER COMPARACIÓN ────────────────────────────────────────────────────────

function renderComparacionBanner(medAnt) {
  const banner = document.getElementById('banner-anterior');
  if (!banner) return;
  banner.innerHTML = `<span>Comparando con: <strong>${medAnt?.meta?.nombre || '—'}</strong> — ${medAnt?.meta?.fecha || '—'}</span><button id="btn-quitar-anterior">✕ Quitar</button>`;
  banner.classList.remove('hidden');
  document.getElementById('btn-quitar-anterior')?.addEventListener('click', () => {
    STATE.anterior = null; STATE.resultadosAnt = null;
    banner.classList.add('hidden');
    renderResultados(STATE.resultados, null);
  });
}

// ── TABS ──────────────────────────────────────────────────────────────────────

function initTabs() {
  // Sidebar nav + bottom nav items use data-tab
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tabId) {
  // Nav items
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  // Panels
  document.querySelectorAll('[data-panel]').forEach(panel => {
    panel.classList.toggle('hidden', panel.dataset.panel !== tabId);
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

  // Target: btn-nueva en desktop, tab-medicion en mobile
  const isMobile = window.innerWidth <= 768;
  const targetEl = isMobile
    ? document.querySelector('.bottom-nav-item[data-tab="tab-medicion"]')
    : document.getElementById('btn-nueva');

  if (!targetEl) { spotlight.classList.remove('hidden'); return; }

  const rect    = targetEl.getBoundingClientRect();
  const cutout  = document.getElementById('spotlight-cutout');
  const tooltip = document.getElementById('spotlight-tooltip');
  const pad     = 6;

  if (cutout) {
    cutout.style.left   = (rect.left - pad) + 'px';
    cutout.style.top    = (rect.top  - pad) + 'px';
    cutout.style.width  = (rect.width  + pad * 2) + 'px';
    cutout.style.height = (rect.height + pad * 2) + 'px';
  }

  if (tooltip) {
    const tipLeft = Math.min(rect.left, window.innerWidth - 230);
    const tipTop  = rect.top > 200 ? rect.top - 130 : rect.bottom + 16;
    tooltip.style.left = Math.max(10, tipLeft) + 'px';
    tooltip.style.top  = tipTop + 'px';
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
