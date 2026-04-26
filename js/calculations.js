/**
 * calculations.js
 * Motor de cálculo puro (sin DOM). Todas las funciones son puras.
 * Referencias:
 *   Ross & Wilson (1974) — PHANTOM proportionality
 *   Heath & Carter (1990) — Somatotipo
 *   Kerr (1988) — Fraccionamiento 5 componentes
 *   Martin et al. (1990) — Masa muscular
 *   Drinkwater & Ross (1980) — Masa ósea
 *   Harris & Benedict (1919) — Metabolismo basal
 *   DuBois & DuBois (1916) — Superficie corporal
 *   Heymsfield et al. (1982) — Áreas cross-seccionales
 */

'use strict';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Devuelve null si el valor no es un número finito > 0 */
function valid(v) {
  return (v !== null && v !== undefined && v !== '' && isFinite(Number(v)) && Number(v) > 0)
    ? Number(v) : null;
}

/** Interpola linealmente en una tabla [[x, y], ...] */
function interpolateTable(table, x) {
  if (x <= table[0][0]) return table[0][1];
  if (x >= table[table.length - 1][0]) return table[table.length - 1][1];
  for (let i = 0; i < table.length - 1; i++) {
    const [x0, y0] = table[i];
    const [x1, y1] = table[i + 1];
    if (x >= x0 && x <= x1) {
      return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
  }
  return null;
}

/** Redondea a n decimales */
function round(v, n = 2) {
  if (v === null || !isFinite(v)) return null;
  return Math.round(v * Math.pow(10, n)) / Math.pow(10, n);
}

// ── Z-Score PHANTOM ───────────────────────────────────────────────────────────

/**
 * Calcula el valor ajustado a 170.18 cm y el Z-score PHANTOM.
 * @param {number} value - Medida original
 * @param {number} height - Talla del sujeto (cm)
 * @param {object} phantom - { P, s, d } de constants.js
 * @returns {{ adjusted: number, z: number } | null}
 */
function calcPhantomZ(value, height, phantom) {
  const v = valid(value);
  const h = valid(height);
  if (v === null || h === null) return null;
  const ratio = PHANTOM_REF_HEIGHT / h;
  const adjusted = v * Math.pow(ratio, phantom.d);
  const z = (adjusted - phantom.P) / phantom.s;
  return { adjusted: round(adjusted, 2), z: round(z, 2) };
}

/**
 * Calcula todos los Z-scores PHANTOM para una medición completa.
 * @param {object} m - Objeto de medición (ver schema en data.js)
 * @returns {object} - { campo: { adjusted, z }, ... }
 */
function calcAllZScores(m) {
  const h = valid(m.basicos?.talla_cm);
  if (!h) return {};

  const campos = [
    // [clave_resultado, valor, clave_phantom]
    ['peso',               m.basicos?.peso_kg,                   'peso'],
    ['talla_sentado',      m.basicos?.talla_sentado_cm,          'talla_sentado'],
    // Diámetros
    ['biacromial',         m.diametros?.biacromial,              'biacromial'],
    ['torax_transverso',   m.diametros?.torax_transverso,        'torax_transverso'],
    ['torax_ap',           m.diametros?.torax_anteroposterior,   'torax_ap'],
    ['bi_iliocrestideo',   m.diametros?.bi_iliocrestideo,        'bi_iliocrestideo'],
    ['humeral',            m.diametros?.humeral_biepicondilar,   'humeral'],
    ['femoral',            m.diametros?.femoral_biepicondilar,   'femoral'],
    // Perímetros
    ['cabeza',             m.perimetros?.cabeza,                 'cabeza'],
    ['cuello',             m.perimetros?.cuello,                 'cuello'],
    ['brazo_relajado',     m.perimetros?.brazo_relajado,         'brazo_relajado'],
    ['brazo_flexionado',   m.perimetros?.brazo_flexionado_tension,'brazo_flexionado'],
    ['antebrazo',          m.perimetros?.antebrazo,              'antebrazo'],
    ['muneca',             m.perimetros?.muneca,                 'muneca'],
    ['torax_mesoesternal', m.perimetros?.torax_mesoesternal,     'torax_mesoesternal'],
    ['cintura_minima',     m.perimetros?.cintura_minima,         'cintura_minima'],
    ['caderas_maxima',     m.perimetros?.caderas_maxima,         'caderas_maxima'],
    ['muslo_superior',     m.perimetros?.muslo_superior,         'muslo_superior'],
    ['muslo_medial',       m.perimetros?.muslo_medial,           'muslo_medial'],
    ['pantorrilla_maxima', m.perimetros?.pantorrilla_maxima,     'pantorrilla_maxima'],
    ['tobillo_minima',     m.perimetros?.tobillo_minima,         'tobillo_minima'],
    // Pliegues
    ['triceps',            m.pliegues?.triceps,                  'triceps'],
    ['subescapular',       m.pliegues?.subescapular,             'subescapular'],
    ['biceps',             m.pliegues?.biceps,                   'biceps'],
    ['cresta_iliaca',      m.pliegues?.cresta_iliaca,            'cresta_iliaca'],
    ['supraespinal',       m.pliegues?.supraespinal,             'supraespinal'],
    ['abdominal',          m.pliegues?.abdominal,                'abdominal'],
    ['muslo_frontal',      m.pliegues?.muslo_frontal,            'muslo_frontal'],
    ['pantorrilla_pl',     m.pliegues?.pantorrilla,              'pantorrilla_pl'],
  ];

  const result = {};
  for (const [key, val, phKey] of campos) {
    if (PHANTOM[phKey]) {
      const r = calcPhantomZ(val, h, PHANTOM[phKey]);
      if (r) result[key] = r;
    }
  }
  return result;
}

// ── Somatotipo Heath-Carter (1990) ────────────────────────────────────────────

function calcSomatotype(m) {
  const h = valid(m.basicos?.talla_cm);
  const w = valid(m.basicos?.peso_kg);
  const tri  = valid(m.pliegues?.triceps);
  const sub  = valid(m.pliegues?.subescapular);
  const supra= valid(m.pliegues?.supraespinal);
  const hu   = valid(m.diametros?.humeral_biepicondilar);
  const fe   = valid(m.diametros?.femoral_biepicondilar);
  const bflex= valid(m.perimetros?.brazo_flexionado_tension);
  const pant = valid(m.perimetros?.pantorrilla_maxima);
  const pantPl= valid(m.pliegues?.pantorrilla);

  const result = { endo: null, meso: null, ecto: null, x: null, y: null };

  // Endomorfia
  if (h && tri !== null && sub !== null && supra !== null) {
    const sum = (tri + sub + supra) * (PHANTOM_REF_HEIGHT / h);
    result.endo = round(
      -0.7182 + 0.1451 * sum - 0.00068 * sum * sum + 0.0000014 * Math.pow(sum, 3),
      1
    );
  }

  // Mesomorfia
  if (h && hu !== null && fe !== null && bflex !== null && tri !== null && pant !== null && pantPl !== null) {
    result.meso = round(
      0.858 * hu +
      0.601 * fe +
      0.188 * (bflex - tri / 10) +
      0.161 * (pant - pantPl / 10) -
      0.131 * h +
      4.5,
      1
    );
  }

  // Ectomorfia
  if (h && w) {
    const hwr = h / Math.pow(w, 1 / 3);
    if (hwr >= 40.75) {
      result.ecto = round(0.732 * hwr - 28.58, 1);
    } else if (hwr > 38.25) {
      result.ecto = round(0.463 * hwr - 17.63, 1);
    } else {
      result.ecto = 0.1;
    }
  }

  // Coordenadas somatocarta
  if (result.endo !== null && result.meso !== null && result.ecto !== null) {
    result.x = round(result.ecto - result.endo, 2);
    result.y = round(2 * result.meso - (result.endo + result.ecto), 2);
  }

  return result;
}

// ── Fraccionamiento Kerr 5 componentes (1988) ─────────────────────────────────
// Fórmulas empíricamente validadas contra el informe de referencia (22/5/2024).
// Nota: el "peso estructurado" es la SUMA de los 5 componentes crudos antes
// de normalizar. La diferencia (%) indica el cierre del modelo respecto al peso bruto.

function calcKerr5(m) {
  const h  = valid(m.basicos?.talla_cm);
  const w  = valid(m.basicos?.peso_kg);
  const hu = valid(m.diametros?.humeral_biepicondilar);
  const fe = valid(m.diametros?.femoral_biepicondilar);
  const musloMed  = valid(m.perimetros?.muslo_medial);
  const antebrazo = valid(m.perimetros?.antebrazo);
  const pantMax   = valid(m.perimetros?.pantorrilla_maxima);
  const triPl     = valid(m.pliegues?.triceps);
  const bicPl     = valid(m.pliegues?.biceps);
  const subPl     = valid(m.pliegues?.subescapular);
  const cresPl    = valid(m.pliegues?.cresta_iliaca);
  const supraPl   = valid(m.pliegues?.supraespinal);
  const abdPl     = valid(m.pliegues?.abdominal);
  const musloFrPl = valid(m.pliegues?.muslo_frontal);
  const pantPl    = valid(m.pliegues?.pantorrilla);
  const antePl    = valid(m.pliegues?.antebrazo);  // opcional

  if (!h || !w) return null;

  const hm = h / 100;  // talla en metros
  const adj = PHANTOM_REF_HEIGHT / h;  // factor de ajuste

  // Suma 8 pliegues ajustados (mm)
  const sf8 = [triPl, subPl, bicPl, cresPl, supraPl, abdPl, musloFrPl, pantPl]
    .filter(v => v !== null);
  const sum8SFadj = sf8.reduce((a, v) => a + v * adj, 0);
  const nSF = sf8.length;

  // ── PIEL (Kerr, 1988) ──────────────────────────────────────────────────────
  // BSA DuBois (cm²) × espesor cutáneo ajustado (cm) × densidad piel (g/cm³)
  const bsa_cm2 = 0.007184 * Math.pow(w, 0.425) * Math.pow(h, 0.725) * 10000;
  const minSFadj_mm = nSF > 0 ? Math.min(...sf8) * adj : 2.0 * adj;
  const raw_piel = bsa_cm2 * (minSFadj_mm / 10) * 1.105 / 1000;

  // ── ADIPOSA ───────────────────────────────────────────────────────────────
  // M_adip (kg) = 0.001448 × H(cm) × Σ8SF_adj(mm)
  const raw_adiposa = nSF > 0 ? 0.001448 * h * sum8SFadj : null;

  // ── MUSCULAR (Martin et al., 1990) ────────────────────────────────────────
  // M_mus (g) = H(cm) × [0.0553×CTG² + 0.0987×FG² + 0.0331×CCG²] − 2445
  let raw_muscular = null;
  if (musloMed !== null && pantMax !== null && pantPl !== null) {
    const CTG = musloMed - Math.PI * (musloFrPl !== null ? musloFrPl / 10 : 0);
    const FG  = antebrazo !== null ? antebrazo - Math.PI * ((antePl || 0) / 10) : 0;
    const CCG = pantMax - Math.PI * (pantPl / 10);
    const muscG = h * (0.0553 * CTG * CTG + 0.0987 * FG * FG + 0.0331 * CCG * CCG) - 2445;
    raw_muscular = muscG / 1000;
  }

  // ── ÓSEA (Drinkwater & Ross, 1980 — adaptado) ────────────────────────────
  // M_ósea (kg) = 0.302 × (H_m × HW_cm × FW_cm)^0.712
  let raw_osea = null;
  if (hu !== null && fe !== null) {
    raw_osea = 0.302 * Math.pow(hm * hu * fe, 0.712);
  }

  // ── RESIDUAL ──────────────────────────────────────────────────────────────
  // M_res (kg) = 0.111 × W_kg × (H_cm / 170.18)
  const raw_residual = 0.111 * w * (h / PHANTOM_REF_HEIGHT);

  // ── NORMALIZACIÓN ─────────────────────────────────────────────────────────
  const components = { piel: raw_piel, adiposa: raw_adiposa, muscular: raw_muscular, osea: raw_osea, residual: raw_residual };
  const available = Object.entries(components).filter(([, v]) => v !== null);
  const rawSum = available.reduce((a, [, v]) => a + v, 0);
  const scale = rawSum > 0 ? w / rawSum : 1;
  const diffPct = round(Math.abs(rawSum - w) / w * 100, 2);

  const norm = {};
  for (const [key, val] of available) {
    norm[key] = { kg: round(val * scale, 3), pct: round(val * scale / w * 100, 2), raw_kg: round(val, 3) };
  }

  return {
    componentes: norm,
    raw_sum_kg: round(rawSum, 3),
    peso_bruto_kg: w,
    diferencia_pct: diffPct,
  };
}

// ── Harris-Benedict (1919) ────────────────────────────────────────────────────

function calcHarrisBenedict(m) {
  const h   = valid(m.basicos?.talla_cm);
  const w   = valid(m.basicos?.peso_kg);
  const age = valid(m.meta?.edad);
  const sex = m.meta?.sexo;
  if (!h || !w || !age || !sex) return null;

  // Peso ideal y ajustado
  const imcRef = IMC_OMS[sex] || IMC_OMS['M'];
  const pesoIdeal = round(imcRef.central * Math.pow(h / 100, 2), 2);
  const exceso = Math.max(0, w - pesoIdeal);
  const pesoCalculo = exceso > 0 ? round(pesoIdeal + 0.25 * exceso, 3) : w;

  let bmr;
  if (sex === 'M') {
    bmr = 66.473 + 13.7516 * pesoCalculo + 5.0033 * h - 6.755 * age;
  } else {
    bmr = 655.096 + 9.5634 * pesoCalculo + 1.8496 * h - 4.6756 * age;
  }

  return {
    bmr_kcal: round(bmr, 2),
    peso_calculo_kg: pesoCalculo,
    peso_ideal_kg: pesoIdeal,
  };
}

// ── Peso ideal OMS 1985 ───────────────────────────────────────────────────────

function calcPesoIdealOMS(m) {
  const h   = valid(m.basicos?.talla_cm);
  const sex = m.meta?.sexo;
  if (!h || !sex) return null;

  const ref = IMC_OMS[sex] || IMC_OMS['M'];
  const hm2 = Math.pow(h / 100, 2);
  return {
    ideal_kg:   round(ref.central * hm2, 2),
    min_kg:     round(ref.min * hm2, 2),
    max_kg:     round(ref.max * hm2, 2),
    imc_target: ref.central,
  };
}

// ── IMC y BSA ─────────────────────────────────────────────────────────────────

function calcIMC(m) {
  const h = valid(m.basicos?.talla_cm);
  const w = valid(m.basicos?.peso_kg);
  const sex = m.meta?.sexo || 'M';
  if (!h || !w) return null;

  const imc = w / Math.pow(h / 100, 2);
  const table = sex === 'F' ? IMC_PERCENTILES_F : IMC_PERCENTILES_M;
  const percentil = round(interpolateTable(table, imc), 0);

  return { imc: round(imc, 2), percentil };
}

function calcBSA(m) {
  const h = valid(m.basicos?.talla_cm);
  const w = valid(m.basicos?.peso_kg);
  if (!h || !w) return null;

  const bsa = 0.007184 * Math.pow(w, 0.425) * Math.pow(h, 0.725);
  return {
    bsa_m2: round(bsa, 3),
    bsa_bm: round((bsa * 10000) / w, 3),  // BSA/BM (cm²/kg)
  };
}

// ── ICC — Índice Cintura/Cadera ───────────────────────────────────────────────

function calcICC(m) {
  const cin  = valid(m.perimetros?.cintura_minima);
  const cad  = valid(m.perimetros?.caderas_maxima);
  const age  = valid(m.meta?.edad);
  const sex  = m.meta?.sexo || 'M';
  if (!cin || !cad || !age) return null;

  const icc = round(cin / cad, 3);

  // Grupo etario
  let grupo;
  if (age < 30)      grupo = '20-29';
  else if (age < 40) grupo = '30-39';
  else if (age < 50) grupo = '40-49';
  else if (age < 60) grupo = '50-59';
  else               grupo = '60+';

  const umbrales = ICC_TABLE[sex]?.[grupo];
  let riesgo = 'muy_alto';
  if (umbrales) {
    if (icc < umbrales.low)       riesgo = 'bajo';
    else if (icc < umbrales.mod)  riesgo = 'moderado';
    else if (icc <= umbrales.high) riesgo = 'alto';
  }

  return { icc, grupo, riesgo, color: ICC_COLORS[riesgo], umbrales };
}

// ── Áreas cross-seccionales (Heymsfield et al., 1982) ────────────────────────
// Para brazo: corrección con promedio (tríceps + bíceps) / 2
// Para muslo medial: corrección con pliegue muslo frontal
// Para pantorrilla: corrección con pliegue pantorrilla

function calcAreasCross(m) {
  const result = {};

  // Brazo
  const C_braz = valid(m.perimetros?.brazo_relajado);
  const tri    = valid(m.pliegues?.triceps);
  const bic    = valid(m.pliegues?.biceps);
  if (C_braz && tri !== null && bic !== null) {
    const SF_mean_cm = ((tri + bic) / 2) / 10;
    const AMC  = C_braz - Math.PI * SF_mean_cm;
    const total = Math.pow(C_braz, 2) / (4 * Math.PI);
    const musc  = Math.pow(AMC, 2) / (4 * Math.PI);
    result.brazo = {
      total: round(total, 2),
      muscular: round(musc, 2),
      adiposa: round(total - musc, 2),
    };
  }

  // Muslo medial
  const C_muslo = valid(m.perimetros?.muslo_medial);
  const musloFr = valid(m.pliegues?.muslo_frontal);
  if (C_muslo && musloFr !== null) {
    const AMC  = C_muslo - Math.PI * (musloFr / 10);
    const total = Math.pow(C_muslo, 2) / (4 * Math.PI);
    const musc  = Math.pow(AMC, 2) / (4 * Math.PI);
    result.muslo = {
      total: round(total, 2),
      muscular: round(musc, 2),
      adiposa: round(total - musc, 2),
    };
  }

  // Pantorrilla
  const C_pant = valid(m.perimetros?.pantorrilla_maxima);
  const pantPl = valid(m.pliegues?.pantorrilla);
  if (C_pant && pantPl !== null) {
    const AMC  = C_pant - Math.PI * (pantPl / 10);
    const total = Math.pow(C_pant, 2) / (4 * Math.PI);
    const musc  = Math.pow(AMC, 2) / (4 * Math.PI);
    result.pantorrilla = {
      total: round(total, 2),
      muscular: round(musc, 2),
      adiposa: round(total - musc, 2),
    };
  }

  return result;
}

// ── Sumatorias de pliegues ────────────────────────────────────────────────────

function calcSumatorias(m, sex = 'M') {
  const tri   = valid(m.pliegues?.triceps);
  const sub   = valid(m.pliegues?.subescapular);
  const bic   = valid(m.pliegues?.biceps);
  const cres  = valid(m.pliegues?.cresta_iliaca);
  const supra = valid(m.pliegues?.supraespinal);
  const abd   = valid(m.pliegues?.abdominal);
  const muslo = valid(m.pliegues?.muslo_frontal);
  const pant  = valid(m.pliegues?.pantorrilla);

  // sum3 = subscapular + supraespinal + abdominal
  const sum3 = (sub !== null && supra !== null && abd !== null) ? sub + supra + abd : null;
  // sum6 = ISAK 6 sitios: triceps + subscapular + supraespinal + abdominal + muslo frontal + pantorrilla
  const sum6 = [tri, sub, supra, abd, muslo, pant].every(v => v !== null)
    ? tri + sub + supra + abd + muslo + pant : null;
  // sum8 = todos
  const sum8vals = [tri, sub, bic, cres, supra, abd, muslo, pant];
  const sum8 = sum8vals.every(v => v !== null) ? sum8vals.reduce((a, b) => a + b, 0) : null;

  const table3 = sex === 'F' ? SUM3_PERCENTILES_F : SUM3_PERCENTILES_M;
  const percentil3 = sum3 !== null ? round(interpolateTable(table3, sum3), 1) : null;

  return { sum3, sum6, sum8, percentil3 };
}

// ── Índices derivados ─────────────────────────────────────────────────────────

function calcIndices(m) {
  const h = valid(m.basicos?.talla_cm);
  const ts = valid(m.basicos?.talla_sentado_cm);
  const biacr = valid(m.diametros?.biacromial);
  const biili = valid(m.diametros?.bi_iliocrestideo);

  const result = {};

  // Índice talla sentado / talla
  if (h && ts) result.talla_sentado_pct = round((ts / h) * 100, 2);

  // Índice biacromial / bi-iliocrestídeo
  if (biacr && biili) result.biacr_biili = round(biacr / biili, 3);

  // Índice músculo / óseo (de Kerr)  → se calcula afuera con Kerr
  // Índice adiposo / muscular         → ídem

  return result;
}

// ── Función principal: calcula todo ──────────────────────────────────────────

function calcAll(medicion) {
  const sex = medicion.meta?.sexo || 'M';
  const zscores = calcAllZScores(medicion);
  const somato  = calcSomatotype(medicion);
  const kerr    = calcKerr5(medicion);
  const hb      = calcHarrisBenedict(medicion);
  const pesoIdeal = calcPesoIdealOMS(medicion);
  const imc     = calcIMC(medicion);
  const bsa     = calcBSA(medicion);
  const icc     = calcICC(medicion);
  const areas   = calcAreasCross(medicion);
  const sumas   = calcSumatorias(medicion, sex);
  const indices = calcIndices(medicion);

  // Índices músculo/óseo y adiposo/muscular desde Kerr
  if (kerr?.componentes) {
    const musc = kerr.componentes.muscular?.kg;
    const osea = kerr.componentes.osea?.kg;
    const adip = kerr.componentes.adiposa?.kg;
    if (musc && osea) indices.musculo_oseo = round(musc / osea, 3);
    if (adip && musc) indices.adiposo_muscular = round(adip / musc, 3);
    // Índice de muscularidad (Holway sum4p)
    // TODO: verificar fórmula exacta con Holway (2009). Valor esperado ref: 166.487
    // La fórmula puede involucrar AMA brazo/muslo/pant dividido por Σ4pliegues ajustados.
    indices.muscularidad_sum4p = null;
  }

  return { zscores, somato, kerr, hb, pesoIdeal, imc, bsa, icc, areas, sumas, indices };
}
