/**
 * ui.js
 * Binding DOM ↔ cálculos. Actualización en vivo, historial, comparación.
 */

'use strict';

// ── Estado global de la sesión ────────────────────────────────────────────────

const STATE = {
  medicion: null,         // medición actual (en edición)
  resultados: null,       // resultados calculados
  anterior: null,         // medición anterior (para comparación)
  resultadosAnt: null,    // resultados de la medición anterior
  debounceTimer: null,
};

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  onAuthChange(handleAuthChange);
  initForm();
  initImportExport();
  initHistorial();
  initTabs();
  renderHistorialUI();

  // Estado inicial vacío
  STATE.medicion = emptyMedicion();
  recalcular();
});

// ── Auth UI ───────────────────────────────────────────────────────────────────

async function handleAuthChange(user) {
  const btnLogin    = document.getElementById('btn-login');
  const btnLogout   = document.getElementById('btn-logout');
  const userDisplay = document.getElementById('user-display');
  const authModal   = document.getElementById('modal-auth');

  if (user) {
    btnLogin?.classList.add('hidden');
    btnLogout?.classList.remove('hidden');
    const nombre = user.user_metadata?.nombre || user.user_metadata?.full_name || user.email || 'Usuario';
    if (userDisplay) userDisplay.textContent = nombre;
    authModal?.classList.add('hidden');
    await cargarHistorialDeSupabase();
    renderHistorialUI();
  } else {
    btnLogin?.classList.remove('hidden');
    btnLogout?.classList.add('hidden');
    if (userDisplay) userDisplay.textContent = '';
    renderHistorialUI();
  }
}

function initAuthModal() {
  const modal    = document.getElementById('modal-auth');
  const btnLogin = document.getElementById('btn-login');
  const btnClose = document.getElementById('modal-auth-close');
  const tabLogin = document.getElementById('auth-tab-login');
  const tabReg   = document.getElementById('auth-tab-register');
  const formLogin= document.getElementById('form-login');
  const formReg  = document.getElementById('form-register');

  btnLogin?.addEventListener('click', () => modal?.classList.remove('hidden'));
  btnClose?.addEventListener('click', () => modal?.classList.add('hidden'));

  tabLogin?.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabReg.classList.remove('active');
    formLogin?.classList.remove('hidden');
    formReg?.classList.add('hidden');
  });
  tabReg?.addEventListener('click', () => {
    tabReg.classList.add('active');
    tabLogin.classList.remove('active');
    formReg?.classList.remove('hidden');
    formLogin?.classList.add('hidden');
  });

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await authLogout();
    renderHistorialUI();
  });

  // Google OAuth
  document.getElementById('btn-google')?.addEventListener('click', async () => {
    const msgEl = document.getElementById('auth-msg');
    if (msgEl) { msgEl.textContent = 'Redirigiendo a Google…'; msgEl.className = ''; }
    const { error } = await authLoginGoogle();
    if (error && msgEl) { msgEl.textContent = error; msgEl.className = 'auth-error'; }
  });

  formLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = formLogin.querySelector('[name=email]').value;
    const pass  = formLogin.querySelector('[name=password]').value;
    const msgEl = document.getElementById('auth-msg');
    const { user, error } = await authLogin(email, pass);
    if (error && msgEl) { msgEl.textContent = error; msgEl.className = 'auth-error'; }
    else modal?.classList.add('hidden');
  });

  formReg?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email  = formReg.querySelector('[name=email]').value;
    const pass   = formReg.querySelector('[name=password]').value;
    const nombre = formReg.querySelector('[name=nombre]').value;
    const msgEl  = document.getElementById('auth-msg');
    const { user, error, needsConfirmation } = await authRegister(email, pass, nombre);
    if (error && msgEl) { msgEl.textContent = error; msgEl.className = 'auth-error'; }
    else if (needsConfirmation && msgEl) {
      msgEl.textContent = '¡Cuenta creada! Revisá tu email para confirmar.';
      msgEl.className = 'auth-ok';
    } else {
      modal?.classList.add('hidden');
    }
  });
}

// ── Formulario principal ──────────────────────────────────────────────────────

function initForm() {
  const form = document.getElementById('form-medicion');
  if (!form) return;

  form.addEventListener('input', () => {
    clearTimeout(STATE.debounceTimer);
    STATE.debounceTimer = setTimeout(() => {
      STATE.medicion = medicionDesdeFormulario(form);
      recalcular();
    }, 200);
  });

  initAuthModal();
}

// ── Recalcular y renderizar ───────────────────────────────────────────────────

function recalcular() {
  if (!STATE.medicion) return;
  STATE.resultados = calcAll(STATE.medicion);
  renderResultados(STATE.resultados, STATE.resultadosAnt);
}

// ── Renderizado de resultados ─────────────────────────────────────────────────

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
  if (el) el.textContent = val !== null && val !== undefined ? (typeof val === 'number' ? val.toFixed(decimals) : val) : '—';
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

// ── Tabla Z-scores ────────────────────────────────────────────────────────────

const Z_LABELS = {
  peso: 'Peso', talla_sentado: 'Talla sentado',
  biacromial: 'Biacromial', torax_transverso: 'Tórax transv.', torax_ap: 'Tórax AP',
  bi_iliocrestideo: 'Bi-iliocrestídeo', humeral: 'Humeral', femoral: 'Femoral',
  cabeza: 'Cabeza', cuello: 'Cuello', brazo_relajado: 'Brazo relaj.',
  brazo_flexionado: 'Brazo flex.', antebrazo: 'Antebrazo', muneca: 'Muñeca',
  torax_mesoesternal: 'Tórax meso.', cintura_minima: 'Cintura mín.',
  caderas_maxima: 'Caderas máx.', muslo_superior: 'Muslo sup.',
  muslo_medial: 'Muslo med.', pantorrilla_maxima: 'Pantorrilla', tobillo_minima: 'Tobillo mín.',
  triceps: 'Tríceps', subescapular: 'Subescapular', biceps: 'Bíceps',
  cresta_iliaca: 'Cresta ilíaca', supraespinal: 'Supraespinal',
  abdominal: 'Abdominal', muslo_frontal: 'Muslo frontal', pantorrilla_pl: 'Pantorrilla (pl.)',
};

function renderZTable(zscores, zscoresAnt) {
  const tbody = document.getElementById('z-tbody');
  if (!tbody) return;
  const rows = Object.entries(Z_LABELS).map(([key, label]) => {
    const curr = zscores[key];
    const prev = zscoresAnt?.[key];
    if (!curr) return `<tr><td>${label}</td><td>—</td><td>—</td><td></td><td></td></tr>`;
    const diffAdj  = prev ? `<span class="diff ${curr.adjusted > prev.adjusted ? 'positive' : curr.adjusted < prev.adjusted ? 'negative' : 'neutral'}">${(curr.adjusted - prev.adjusted) >= 0 ? '+' : ''}${(curr.adjusted - prev.adjusted).toFixed(2)}</span>` : '';
    const diffZ    = prev ? `<span class="diff ${curr.z > prev.z ? 'positive' : curr.z < prev.z ? 'negative' : 'neutral'}">${(curr.z - prev.z) >= 0 ? '+' : ''}${(curr.z - prev.z).toFixed(2)}</span>` : '';
    return `<tr>
      <td>${label}</td>
      <td class="num">${curr.adjusted.toFixed(2)}</td>
      <td class="num">${zBadge(curr.z)}</td>
      <td class="num faded">${diffAdj}</td>
      <td class="num faded">${diffZ}</td>
    </tr>`;
  });
  tbody.innerHTML = rows.join('');
}

// ── Gráficas Z por grupo ──────────────────────────────────────────────────────

const Z_GROUPS = {
  'z-chart-basicos':    ['peso', 'talla_sentado'],
  'z-chart-diametros':  ['biacromial','torax_transverso','torax_ap','bi_iliocrestideo','humeral','femoral'],
  'z-chart-perimetros': ['cabeza','cuello','brazo_relajado','brazo_flexionado','antebrazo','muneca','torax_mesoesternal','cintura_minima','caderas_maxima','muslo_superior','muslo_medial','pantorrilla_maxima','tobillo_minima'],
  'z-chart-pliegues':   ['triceps','subescapular','biceps','cresta_iliaca','supraespinal','abdominal','muslo_frontal','pantorrilla_pl'],
};

function renderZCharts(zscores) {
  for (const [canvasId, keys] of Object.entries(Z_GROUPS)) {
    const labels = keys.map(k => Z_LABELS[k] || k);
    const values = keys.map(k => zscores[k]?.z ?? null);
    const validPairs = labels.map((l, i) => [l, values[i]]).filter(([, v]) => v !== null);
    if (validPairs.length > 0) {
      renderZChart(canvasId, validPairs.map(p => p[0]), validPairs.map(p => p[1]));
    }
  }
}

// ── Somatotipo ────────────────────────────────────────────────────────────────

function renderSomatotipoPanel(somato, somatoAnt) {
  setText('somato-endo', somato?.endo, 1);
  setText('somato-meso', somato?.meso, 1);
  setText('somato-ecto', somato?.ecto, 1);
  setText('somato-x', somato?.x, 2);
  setText('somato-y', somato?.y, 2);
  renderSomatocarta('canvas-somatocarta', somato, somatoAnt);
}

// ── Kerr ──────────────────────────────────────────────────────────────────────

function renderKerrPanel(kerr, kerrAnt) {
  if (!kerr?.componentes) return;
  const comp = kerr.componentes;
  const keys = ['piel', 'adiposa', 'muscular', 'osea', 'residual'];
  const labels = { piel: 'Piel', adiposa: 'Adiposa', muscular: 'Muscular', osea: 'Ósea', residual: 'Residual' };
  for (const k of keys) {
    const c = comp[k];
    if (!c) continue;
    setText(`kerr-${k}-kg`,  c.kg,  3);
    setText(`kerr-${k}-pct`, c.pct, 2);
    if (kerrAnt?.componentes?.[k]) {
      const prev = kerrAnt.componentes[k];
      const diffKg = c.kg - prev.kg;
      const el = document.getElementById(`kerr-${k}-diff`);
      if (el) {
        el.textContent = `${diffKg >= 0 ? '+' : ''}${diffKg.toFixed(2)} kg`;
        el.className = `diff ${diffKg > 0 ? 'positive' : diffKg < 0 ? 'negative' : 'neutral'}`;
      }
    }
  }
  setText('kerr-diff-pct', kerr.diferencia_pct, 2);
  renderKerrPie('canvas-kerr-pie', kerr);
  renderKerrComparacion('canvas-kerr-radar', kerr, kerrAnt);
}

// ── Harris-Benedict ───────────────────────────────────────────────────────────

function renderHBPanel(hb, pesoIdeal, hbAnt) {
  setText('hb-bmr',        hb?.bmr_kcal, 0);
  setText('hb-peso-calc',  hb?.peso_calculo_kg, 3);
  setText('pi-ideal',      pesoIdeal?.ideal_kg, 2);
  setText('pi-min',        pesoIdeal?.min_kg, 2);
  setText('pi-max',        pesoIdeal?.max_kg, 2);
  if (hb && hbAnt) setDiff('hb-bmr-diff', hb.bmr_kcal, hbAnt.bmr_kcal);
}

// ── IMC ───────────────────────────────────────────────────────────────────────

function renderIMCPanel(imc, imcAnt) {
  setText('imc-valor',      imc?.imc, 2);
  setText('imc-percentil',  imc?.percentil, 0);
  const bsa = STATE.resultados?.bsa;
  setText('bsa-m2',   bsa?.bsa_m2,  3);
  setText('bsa-bm',   bsa?.bsa_bm,  3);
  if (imc && imcAnt) setDiff('imc-diff', imc.imc, imcAnt.imc);
}

// ── ICC ───────────────────────────────────────────────────────────────────────

function renderICCPanel(icc, iccAnt) {
  const el = document.getElementById('icc-valor');
  const badge = document.getElementById('icc-riesgo');
  const bar   = document.getElementById('icc-bar');
  if (el)    el.textContent = icc?.icc?.toFixed(3) ?? '—';
  if (badge && icc) {
    badge.textContent = icc.riesgo.charAt(0).toUpperCase() + icc.riesgo.slice(1).replace('_', ' ');
    badge.style.background = icc.color;
  }
  if (bar && icc?.umbrales) {
    // Barra visual: posicionar el indicador
    const lo = 0.6, hi = 1.2;
    const pct = Math.min(100, Math.max(0, (icc.icc - lo) / (hi - lo) * 100));
    bar.style.setProperty('--icc-pct', pct + '%');
    bar.style.setProperty('--icc-color', icc.color);
  }
  if (icc && iccAnt) setDiff('icc-diff', icc.icc, iccAnt.icc, true);
}

// ── Áreas cross-seccionales ───────────────────────────────────────────────────

function renderAreasPanel(areas, areasAnt) {
  const sites = [['brazo', 'Brazo'], ['muslo', 'Muslo med.'], ['pantorrilla', 'Pantorrilla']];
  for (const [k] of sites) {
    const a = areas?.[k];
    if (!a) continue;
    setText(`area-${k}-musc`, a.muscular, 2);
    setText(`area-${k}-adip`, a.adiposa,  2);
  }
}

// ── Sumatorias ────────────────────────────────────────────────────────────────

function renderSumasPanel(sumas, sumasAnt) {
  setText('sum3p',           sumas?.sum3,     0);
  setText('sum3p-percentil', sumas?.percentil3, 1);
  setText('sum6p',           sumas?.sum6,     0);
  setText('sum8p',           sumas?.sum8,     0);
  if (sumas && sumasAnt) {
    setDiff('sum3p-diff', sumas.sum3, sumasAnt.sum3, true);
    setDiff('sum8p-diff', sumas.sum8, sumasAnt.sum8, true);
  }
}

// ── Índices derivados ─────────────────────────────────────────────────────────

function renderIndicesPanel(idx, idxAnt) {
  setText('idx-ts-pct',    idx?.talla_sentado_pct,    2);
  setText('idx-biacr',     idx?.biacr_biili,          3);
  setText('idx-musc-oseo', idx?.musculo_oseo,         3);
  setText('idx-adip-musc', idx?.adiposo_muscular,     3);
  setText('idx-muscularidad', idx?.muscularidad_sum4p, 3);
}

// ── Import / Export ───────────────────────────────────────────────────────────

function initImportExport() {
  // Cargar medición anterior (para comparación)
  document.getElementById('btn-cargar-anterior')?.addEventListener('click', () => {
    document.getElementById('input-anterior')?.click();
  });
  document.getElementById('input-anterior')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const med = await importarMedicion(file);
      STATE.anterior = med;
      STATE.resultadosAnt = calcAll(med);
      showToast('Medición anterior cargada ✓');
      renderResultados(STATE.resultados, STATE.resultadosAnt);
      renderComparacionBanner(med);
    } catch (err) {
      showToast('Error al cargar archivo: ' + err.message, 'error');
    }
    e.target.value = '';
  });

  // Cargar medición existente para editar
  document.getElementById('btn-cargar-medicion')?.addEventListener('click', () => {
    document.getElementById('input-medicion')?.click();
  });
  document.getElementById('input-medicion')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const med = await importarMedicion(file);
      STATE.medicion = med;
      poblarFormulario(document.getElementById('form-medicion'), med);
      recalcular();
      showToast('Medición cargada ✓');
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
    e.target.value = '';
  });

  // Descargar medición actual
  document.getElementById('btn-descargar')?.addEventListener('click', () => {
    if (!STATE.medicion) return;
    exportarMedicion(STATE.medicion, STATE.resultados);
  });

  // Guardar en historial
  document.getElementById('btn-guardar')?.addEventListener('click', async () => {
    if (!STATE.medicion) return;
    if (!authCurrentUser()) { showToast('Iniciá sesión para guardar', 'error'); return; }
    const ok = await guardarEnHistorial(STATE.medicion, STATE.resultados);
    if (ok) { showToast('Guardado en historial ✓'); renderHistorialUI(); }
    else showToast('Error al guardar', 'error');
  });

  // Nueva medición
  document.getElementById('btn-nueva')?.addEventListener('click', () => {
    if (confirm('¿Comenzar una medición nueva? Los datos no guardados se perderán.')) {
      STATE.medicion = emptyMedicion();
      document.getElementById('form-medicion')?.reset();
      recalcular();
    }
  });
}

// ── Historial ─────────────────────────────────────────────────────────────────

function initHistorial() {
  document.getElementById('panel-historial')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'cargar') {
      const entry = obtenerHistorial().find(h => h.medicion?.meta?.id === id);
      if (entry) {
        STATE.medicion = entry.medicion;
        STATE.resultados = entry.resultados || calcAll(entry.medicion);
        poblarFormulario(document.getElementById('form-medicion'), entry.medicion);
        recalcular();
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
        showToast('Cargada como medición anterior ✓');
      }
    } else if (action === 'eliminar') {
      if (confirm('¿Eliminar esta medición del historial?')) {
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
    container.innerHTML = '<p class="empty-msg">No hay mediciones guardadas.</p>';
    return;
  }

  container.innerHTML = historial.map(entry => {
    const med  = entry.medicion;
    const res  = entry.resultados;
    const id   = med?.meta?.id;
    const fecha = med?.meta?.fecha || '—';
    const nombre = med?.meta?.nombre || '—';
    const peso = med?.basicos?.peso_kg ? `${med.basicos.peso_kg} kg` : '—';
    const imc  = res?.imc?.imc ? `IMC ${res.imc.imc}` : '';
    const kerr = res?.kerr?.componentes?.muscular?.pct ? `Musc. ${res.kerr.componentes.muscular.pct.toFixed(1)}%` : '';

    return `
    <div class="historial-card">
      <div class="historial-info">
        <span class="historial-fecha">${fecha}</span>
        <span class="historial-nombre">${nombre}</span>
        <span class="historial-tags">
          ${peso} ${imc ? '· ' + imc : ''} ${kerr ? '· ' + kerr : ''}
        </span>
      </div>
      <div class="historial-actions">
        <button data-action="cargar"   data-id="${id}" class="btn-sm">Cargar</button>
        <button data-action="comparar" data-id="${id}" class="btn-sm secondary">Comparar</button>
        <button data-action="exportar" data-id="${id}" class="btn-sm secondary">↓ JSON</button>
        <button data-action="eliminar" data-id="${id}" class="btn-sm danger">✕</button>
      </div>
    </div>`;
  }).join('');
}

// ── Comparación banner ────────────────────────────────────────────────────────

function renderComparacionBanner(medAnt) {
  const banner = document.getElementById('banner-anterior');
  if (!banner) return;
  const fecha = medAnt?.meta?.fecha || '—';
  const nombre = medAnt?.meta?.nombre || '—';
  banner.innerHTML = `
    <span>Comparando con: <strong>${nombre}</strong> — ${fecha}</span>
    <button id="btn-quitar-anterior">✕ Quitar</button>`;
  banner.classList.remove('hidden');
  document.getElementById('btn-quitar-anterior')?.addEventListener('click', () => {
    STATE.anterior = null;
    STATE.resultadosAnt = null;
    banner.classList.add('hidden');
    renderResultados(STATE.resultados, null);
  });
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

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
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function showToast(msg, type = 'ok') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}
