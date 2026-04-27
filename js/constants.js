/**
 * constants.js
 * Constantes PHANTOM (Ross & Wilson, 1974) y tablas de referencia.
 * Formato PHANTOM: { P, s, d }
 *   P = valor de referencia del PHANTOM
 *   s = desvío estándar del PHANTOM
 *   d = exponente dimensional (3 para masas, 1 para longitudes/diámetros/perímetros/pliegues)
 * Fórmula Z: Z = (V × (170.18/H)^d − P) / s
 */

const PHANTOM_REF_HEIGHT = 170.18; // cm

const PHANTOM = {
  // ── Masas (d = 3) ──────────────────────────────────────────────────────────
  peso:               { P: 64.58,  s: 8.60,  d: 3 },

  // ── Longitudes (d = 1) ─────────────────────────────────────────────────────
  talla_sentado:      { P: 89.92,  s: 4.50,  d: 1 },

  // ── Diámetros (d = 1) ──────────────────────────────────────────────────────
  biacromial:         { P: 38.37,  s: 1.42,  d: 1 },
  torax_transverso:   { P: 27.92,  s: 1.74,  d: 1 },
  torax_ap:           { P: 17.50,  s: 1.38,  d: 1 },
  bi_iliocrestideo:   { P: 28.84,  s: 1.75,  d: 1 },
  humeral:            { P: 6.48,   s: 0.35,  d: 1 },
  femoral:            { P: 9.52,   s: 0.48,  d: 1 },

  // ── Perímetros (d = 1) ─────────────────────────────────────────────────────
  cabeza:             { P: 56.00,  s: 1.44,  d: 1 },
  cuello:             { P: 35.25,  s: 1.44,  d: 1 },
  brazo_relajado:     { P: 26.89,  s: 2.33,  d: 1 },
  brazo_flexionado:   { P: 30.57,  s: 2.00,  d: 1 },
  antebrazo:          { P: 24.06,  s: 1.95,  d: 1 },
  muneca:             { P: 16.38,  s: 0.61,  d: 1 },
  torax_mesoesternal: { P: 87.86,  s: 5.18,  d: 1 },
  cintura_minima:     { P: 70.38,  s: 5.50,  d: 1 },
  caderas_maxima:     { P: 94.66,  s: 5.22,  d: 1 },
  muslo_superior:     { P: 55.22,  s: 4.93,  d: 1 },
  muslo_medial:       { P: 50.04,  s: 4.64,  d: 1 },
  pantorrilla_maxima: { P: 35.25,  s: 2.25,  d: 1 },
  tobillo_minima:     { P: 22.08,  s: 2.13,  d: 1 },

  // ── Pliegues cutáneos (d = 1) ──────────────────────────────────────────────
  triceps:            { P: 15.40,  s: 4.47,  d: 1 },
  subescapular:       { P: 17.20,  s: 5.07,  d: 1 },
  biceps:             { P: 7.90,   s: 1.97,  d: 1 },
  cresta_iliaca:      { P: 22.00,  s: 6.52,  d: 1 },
  supraespinal:       { P: 15.40,  s: 4.47,  d: 1 },
  abdominal:          { P: 25.40,  s: 7.78,  d: 1 },
  muslo_frontal:      { P: 27.40,  s: 8.56,  d: 1 },
  pantorrilla_pl:     { P: 15.80,  s: 4.55,  d: 1 },
};

// ── Tabla ICC — Índice Cintura/Cadera ─────────────────────────────────────────
// Fuente: Bray & Gray (1988) / WHO adaptado
// Formato: { low: umbral_bajo, mod: umbral_moderado, high: umbral_alto }
// Riesgo: < low → "Bajo" | low–mod → "Moderado" | mod–high → "Alto" | > high → "Muy alto"
const ICC_TABLE = {
  M: {
    '20-29': { low: 0.83, mod: 0.88, high: 0.94 },
    '30-39': { low: 0.84, mod: 0.91, high: 0.96 },
    '40-49': { low: 0.88, mod: 0.95, high: 1.00 },
    '50-59': { low: 0.90, mod: 0.96, high: 1.02 },
    '60+':   { low: 0.91, mod: 0.98, high: 1.03 },
  },
  F: {
    '20-29': { low: 0.71, mod: 0.77, high: 0.82 },
    '30-39': { low: 0.72, mod: 0.78, high: 0.84 },
    '40-49': { low: 0.73, mod: 0.79, high: 0.87 },
    '50-59': { low: 0.74, mod: 0.81, high: 0.88 },
    '60+':   { low: 0.76, mod: 0.83, high: 0.90 },
  },
};

// ── Rangos IMC OMS 1985 ───────────────────────────────────────────────────────
// Peso ideal: IMC central según sexo
const IMC_OMS = {
  M: { min: 20.7, central: 23.0, max: 25.3 },
  F: { min: 19.1, central: 21.5, max: 25.8 },
};

// ── Percentiles IMC (NHANES aproximado, adultos) ──────────────────────────────
// Pares [imc, percentil] — interpolación lineal
const IMC_PERCENTILES_M = [
  [16.0, 2], [17.5, 5], [19.0, 10], [20.5, 20], [21.4, 30],
  [22.7, 40], [24.0, 50], [25.5, 60], [27.3, 70], [29.8, 80],
  [33.5, 90], [37.0, 95], [42.0, 98],
];
const IMC_PERCENTILES_F = [
  [16.5, 2], [18.0, 5], [19.5, 10], [21.0, 20], [22.3, 30],
  [23.6, 40], [25.1, 50], [27.0, 60], [29.0, 70], [31.8, 80],
  [36.0, 90], [40.0, 95], [45.0, 98],
];

// ── Percentiles Σ3 pliegues (sub + supra + abd) — referencia masculina ────────
// Aproximación basada en poblaciones de referencia ISAK/Holway
const SUM3_PERCENTILES_M = [
  [15, 2], [19, 5], [23, 10], [28, 20], [34, 30],
  [42, 40], [52, 50], [64, 60], [78, 70], [95, 80],
  [120, 90], [150, 95], [190, 98],
];
const SUM3_PERCENTILES_F = [
  [22, 2], [27, 5], [33, 10], [40, 20], [50, 30],
  [62, 40], [76, 50], [92, 60], [110, 70], [132, 80],
  [162, 90], [195, 95], [235, 98],
];

// Colores semáforo ICC
const ICC_COLORS = {
  bajo:      '#22c55e',
  moderado:  '#f59e0b',
  alto:      '#f97316',
  muy_alto:  '#ef4444',
};

// Etiquetas de somatotipo para la somatocarta
const SOMATOTYPE_LABELS = {
  balanced_endo:     'Endomorfo equilibrado',
  meso_endo:         'Meso-endomorfo',
  endo_meso:         'Endo-mesomorfo',
  balanced_meso:     'Mesomorfo equilibrado',
  ecto_meso:         'Ecto-mesomorfo',
  meso_ecto:         'Meso-ectomorfo',
  balanced_ecto:     'Ectomorfo equilibrado',
  endo_ecto:         'Endo-ectomorfo',
  central:           'Central',
};
