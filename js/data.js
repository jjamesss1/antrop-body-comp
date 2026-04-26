/**
 * data.js
 * Schema de medición, import/export JSON, persistencia en Supabase.
 *
 * El historial se mantiene en un cache local (_historialCache) para que
 * la UI pueda leerlo de forma sincrónica. Supabase se sincroniza en background.
 */

'use strict';

// ── Schema vacío de una medición ──────────────────────────────────────────────

function emptyMedicion() {
  return {
    meta: {
      id: crypto.randomUUID?.() || Date.now().toString(36),
      fecha: new Date().toISOString().slice(0, 10),
      nombre: '',
      edad: null,
      sexo: 'M',
      notas: '',
    },
    basicos: {
      peso_kg: null,
      talla_cm: null,
      talla_sentado_cm: null,
      envergadura_cm: null,
    },
    longitudes: {
      acromial_radial_cm: null,
      radial_estiloidea_cm: null,
      medial_estiloidea_dactilar_cm: null,
      ilioespinal_cm: null,
      trocanterea_cm: null,
      trocanterea_tibial_lateral_cm: null,
      tibial_lateral_cm: null,
      tibial_medial_maleolar_medial_cm: null,
      pie_cm: null,
    },
    diametros: {
      biacromial: null,
      torax_transverso: null,
      torax_anteroposterior: null,
      bi_iliocrestideo: null,
      humeral_biepicondilar: null,
      femoral_biepicondilar: null,
      muneca_biestiloideo: null,
      tobillo_bimaleolar: null,
      mano: null,
    },
    perimetros: {
      cabeza: null,
      cuello: null,
      brazo_relajado: null,
      brazo_flexionado_tension: null,
      antebrazo: null,
      muneca: null,
      torax_mesoesternal: null,
      cintura_minima: null,
      caderas_maxima: null,
      abdominal_maxima: null,
      muslo_superior: null,
      muslo_medial: null,
      pantorrilla_maxima: null,
      tobillo_minima: null,
    },
    pliegues: {
      triceps: null,
      subescapular: null,
      biceps: null,
      cresta_iliaca: null,
      supraespinal: null,
      abdominal: null,
      muslo_frontal: null,
      pantorrilla: null,
      antebrazo: null,
    },
  };
}

// ── Export / Import JSON (se mantiene igual) ──────────────────────────────────

function exportarMedicion(medicion, resultados) {
  const blob = new Blob(
    [JSON.stringify({ medicion, resultados }, null, 2)],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const fecha  = medicion.meta?.fecha   || 'sin-fecha';
  const nombre = (medicion.meta?.nombre || 'sujeto').replace(/\s+/g, '_');
  a.href = url;
  a.download = `medicion_${nombre}_${fecha}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importarMedicion(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const med = parsed.medicion || parsed;
        resolve(med);
      } catch (err) {
        reject(new Error('Archivo JSON inválido'));
      }
    };
    reader.onerror = () => reject(new Error('Error leyendo archivo'));
    reader.readAsText(file);
  });
}

// ── Conversión medicion ↔ fila de DB ─────────────────────────────────────────

function medicionToRow(medicion, resultados) {
  const { meta, basicos, longitudes, diametros, perimetros, pliegues } = medicion;
  return {
    id:             meta.id,
    fecha:          meta.fecha,
    nombre_sujeto:  meta.nombre  || null,
    edad:           meta.edad,
    sexo:           meta.sexo,
    notas:          meta.notas   || null,

    // Básicos
    peso_kg:          basicos?.peso_kg,
    talla_cm:         basicos?.talla_cm,
    talla_sentado_cm: basicos?.talla_sentado_cm,
    envergadura_cm:   basicos?.envergadura_cm,

    // Longitudes
    acromial_radial_cm:               longitudes?.acromial_radial_cm,
    radial_estiloidea_cm:             longitudes?.radial_estiloidea_cm,
    medial_estiloidea_dactilar_cm:    longitudes?.medial_estiloidea_dactilar_cm,
    ilioespinal_cm:                   longitudes?.ilioespinal_cm,
    trocanterea_cm:                   longitudes?.trocanterea_cm,
    trocanterea_tibial_lateral_cm:    longitudes?.trocanterea_tibial_lateral_cm,
    tibial_lateral_cm:                longitudes?.tibial_lateral_cm,
    tibial_medial_maleolar_medial_cm: longitudes?.tibial_medial_maleolar_medial_cm,
    pie_cm:                           longitudes?.pie_cm,

    // Diámetros
    diametro_biacromial:             diametros?.biacromial,
    diametro_torax_transverso:       diametros?.torax_transverso,
    diametro_torax_anteroposterior:  diametros?.torax_anteroposterior,
    diametro_bi_iliocrestideo:       diametros?.bi_iliocrestideo,
    diametro_humeral_biepicondilar:  diametros?.humeral_biepicondilar,
    diametro_femoral_biepicondilar:  diametros?.femoral_biepicondilar,
    diametro_muneca_biestiloideo:    diametros?.muneca_biestiloideo,
    diametro_tobillo_bimaleolar:     diametros?.tobillo_bimaleolar,
    diametro_mano:                   diametros?.mano,

    // Perímetros
    perimetro_cabeza:             perimetros?.cabeza,
    perimetro_cuello:             perimetros?.cuello,
    perimetro_brazo_relajado:     perimetros?.brazo_relajado,
    perimetro_brazo_flex_tension: perimetros?.brazo_flexionado_tension,
    perimetro_antebrazo:          perimetros?.antebrazo,
    perimetro_muneca:             perimetros?.muneca,
    perimetro_torax_mesoesternal: perimetros?.torax_mesoesternal,
    perimetro_cintura_minima:     perimetros?.cintura_minima,
    perimetro_caderas_maxima:     perimetros?.caderas_maxima,
    perimetro_abdominal_maxima:   perimetros?.abdominal_maxima,
    perimetro_muslo_superior:     perimetros?.muslo_superior,
    perimetro_muslo_medial:       perimetros?.muslo_medial,
    perimetro_pantorrilla_maxima: perimetros?.pantorrilla_maxima,
    perimetro_tobillo_minima:     perimetros?.tobillo_minima,

    // Pliegues
    pliegue_triceps:       pliegues?.triceps,
    pliegue_subescapular:  pliegues?.subescapular,
    pliegue_biceps:        pliegues?.biceps,
    pliegue_cresta_iliaca: pliegues?.cresta_iliaca,
    pliegue_supraespinal:  pliegues?.supraespinal,
    pliegue_abdominal:     pliegues?.abdominal,
    pliegue_muslo_frontal: pliegues?.muslo_frontal,
    pliegue_pantorrilla:   pliegues?.pantorrilla,
    pliegue_antebrazo:     pliegues?.antebrazo,

    // Resultados calculados (JSONB)
    resultados: resultados || null,
  };
}

function rowToMedicion(row) {
  return {
    meta: {
      id:     row.id,
      fecha:  row.fecha,
      nombre: row.nombre_sujeto || '',
      edad:   row.edad,
      sexo:   row.sexo || 'M',
      notas:  row.notas || '',
    },
    basicos: {
      peso_kg:          row.peso_kg,
      talla_cm:         row.talla_cm,
      talla_sentado_cm: row.talla_sentado_cm,
      envergadura_cm:   row.envergadura_cm,
    },
    longitudes: {
      acromial_radial_cm:               row.acromial_radial_cm,
      radial_estiloidea_cm:             row.radial_estiloidea_cm,
      medial_estiloidea_dactilar_cm:    row.medial_estiloidea_dactilar_cm,
      ilioespinal_cm:                   row.ilioespinal_cm,
      trocanterea_cm:                   row.trocanterea_cm,
      trocanterea_tibial_lateral_cm:    row.trocanterea_tibial_lateral_cm,
      tibial_lateral_cm:                row.tibial_lateral_cm,
      tibial_medial_maleolar_medial_cm: row.tibial_medial_maleolar_medial_cm,
      pie_cm:                           row.pie_cm,
    },
    diametros: {
      biacromial:            row.diametro_biacromial,
      torax_transverso:      row.diametro_torax_transverso,
      torax_anteroposterior: row.diametro_torax_anteroposterior,
      bi_iliocrestideo:      row.diametro_bi_iliocrestideo,
      humeral_biepicondilar: row.diametro_humeral_biepicondilar,
      femoral_biepicondilar: row.diametro_femoral_biepicondilar,
      muneca_biestiloideo:   row.diametro_muneca_biestiloideo,
      tobillo_bimaleolar:    row.diametro_tobillo_bimaleolar,
      mano:                  row.diametro_mano,
    },
    perimetros: {
      cabeza:                  row.perimetro_cabeza,
      cuello:                  row.perimetro_cuello,
      brazo_relajado:          row.perimetro_brazo_relajado,
      brazo_flexionado_tension: row.perimetro_brazo_flex_tension,
      antebrazo:               row.perimetro_antebrazo,
      muneca:                  row.perimetro_muneca,
      torax_mesoesternal:      row.perimetro_torax_mesoesternal,
      cintura_minima:          row.perimetro_cintura_minima,
      caderas_maxima:          row.perimetro_caderas_maxima,
      abdominal_maxima:        row.perimetro_abdominal_maxima,
      muslo_superior:          row.perimetro_muslo_superior,
      muslo_medial:            row.perimetro_muslo_medial,
      pantorrilla_maxima:      row.perimetro_pantorrilla_maxima,
      tobillo_minima:          row.perimetro_tobillo_minima,
    },
    pliegues: {
      triceps:       row.pliegue_triceps,
      subescapular:  row.pliegue_subescapular,
      biceps:        row.pliegue_biceps,
      cresta_iliaca: row.pliegue_cresta_iliaca,
      supraespinal:  row.pliegue_supraespinal,
      abdominal:     row.pliegue_abdominal,
      muslo_frontal: row.pliegue_muslo_frontal,
      pantorrilla:   row.pliegue_pantorrilla,
      antebrazo:     row.pliegue_antebrazo,
    },
  };
}

// ── Cache local del historial ─────────────────────────────────────────────────
// Permite que la UI lea el historial de forma sincrónica.

let _historialCache = [];

/** Carga el historial del usuario desde Supabase y actualiza el cache. */
async function cargarHistorialDeSupabase() {
  const user = authCurrentUser();
  if (!user) { _historialCache = []; return; }

  const { data, error } = await getSupabaseClient()
    .from('mediciones')
    .select('*')
    .order('fecha', { ascending: false });

  if (error) { console.error('Error cargando historial:', error.message); return; }

  _historialCache = (data || []).map(row => ({
    medicion:  rowToMedicion(row),
    resultados: row.resultados,
    guardado:  row.created_at,
  }));
}

/** Devuelve el historial actual desde el cache (sincrónico). */
function obtenerHistorial() {
  return _historialCache;
}

/** Guarda o actualiza una medición en Supabase + cache. */
async function guardarEnHistorial(medicion, resultados) {
  const user = authCurrentUser();
  if (!user) {
    console.warn('No hay usuario logueado. Guardado cancelado.');
    return false;
  }

  const row = { ...medicionToRow(medicion, resultados), user_id: user.id };

  const { error } = await getSupabaseClient()
    .from('mediciones')
    .upsert(row, { onConflict: 'id' });

  if (error) { console.error('Error guardando:', error.message); return false; }

  // Actualizar cache
  const idx = _historialCache.findIndex(h => h.medicion?.meta?.id === medicion.meta.id);
  const entry = { medicion, resultados, guardado: new Date().toISOString() };
  if (idx >= 0) _historialCache[idx] = entry;
  else _historialCache.unshift(entry);

  return true;
}

/** Elimina una medición de Supabase + cache. */
async function eliminarDeHistorial(id) {
  const { error } = await getSupabaseClient()
    .from('mediciones')
    .delete()
    .eq('id', id);

  if (error) { console.error('Error eliminando:', error.message); return false; }

  _historialCache = _historialCache.filter(h => h.medicion?.meta?.id !== id);
  return true;
}

// ── Llenado de formulario desde objeto ───────────────────────────────────────

function medicionDesdeFormulario(formEl) {
  const med = emptyMedicion();
  const inputs = formEl.querySelectorAll('[data-field]');
  inputs.forEach(input => {
    const path = input.dataset.field.split('.');
    let obj = med;
    for (let i = 0; i < path.length - 1; i++) {
      obj = obj[path[i]];
      if (!obj) return;
    }
    const key = path[path.length - 1];
    const val = input.value.trim();
    if (input.type === 'number') {
      obj[key] = val !== '' ? parseFloat(val) : null;
    } else {
      obj[key] = val || null;
    }
  });
  return med;
}

function poblarFormulario(formEl, med) {
  if (!med) return;
  const inputs = formEl.querySelectorAll('[data-field]');
  inputs.forEach(input => {
    const path = input.dataset.field.split('.');
    let obj = med;
    for (const key of path) {
      if (obj == null) return;
      obj = obj[key];
    }
    if (obj !== null && obj !== undefined) {
      input.value = obj;
    } else {
      input.value = '';
    }
  });
}
