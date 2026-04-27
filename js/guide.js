/**
 * guide.js — AntroLab
 * Modal de guía de medición: muestra dónde y cómo medir cada sitio ISAK.
 * Usa imágenes PNG en assets/body/{male|female}-{front|back}.png
 */

'use strict';

// ── Sitios de medición ────────────────────────────────────────────────────────
// Coordenadas relativas al viewBox 0 0 120 260 de la figura corporal.

const BODY_SITES = {
  // ── Pliegues cutáneos ──────────────────────────────────────────────────────
  triceps: {
    label: 'Tríceps', category: 'Pliegue cutáneo', view: 'back',
    front: { cx: 28, cy: 100 }, back: { cx: 92, cy: 100 },
    landmark: 'Punto mesoacromial (medio acromion–olécranon)',
    direction: 'Vertical',
    instructions: 'Pliegue vertical en la cara posterior del brazo, sobre el músculo tríceps, en el punto medio entre el acromion y el olécranon. Brazo relajado y extendido al costado del cuerpo.',
  },
  subescapular: {
    label: 'Subescapular', category: 'Pliegue cutáneo', view: 'back',
    front: { cx: 70, cy: 80 }, back: { cx: 73, cy: 84 },
    landmark: 'Bajo el ángulo inferior de la escápula',
    direction: 'Oblicuo (~45°)',
    instructions: 'Pliegue oblicuo, 2 cm por debajo del ángulo inferior de la escápula. La línea sigue el ángulo natural de la piel (~45°). Brazo relajado al costado.',
  },
  biceps: {
    label: 'Bíceps', category: 'Pliegue cutáneo', view: 'front',
    front: { cx: 28, cy: 100 }, back: { cx: 92, cy: 100 },
    landmark: 'Cara anterior del brazo, mismo nivel que tríceps',
    direction: 'Vertical',
    instructions: 'Pliegue vertical en la cara anterior del brazo, sobre el vientre del bíceps, al mismo nivel que el pliegue del tríceps. Brazo relajado y extendido.',
  },
  cresta_iliaca: {
    label: 'Cresta ilíaca', category: 'Pliegue cutáneo', view: 'back',
    front: { cx: 72, cy: 128 }, back: { cx: 74, cy: 127 },
    landmark: 'Cresta ilíaca, línea medioaxilar',
    direction: 'Oblicuo (~45°)',
    instructions: 'Pliegue oblicuo sobre la cresta ilíaca, en la línea medioaxilar. Se toma siguiendo la línea natural de la piel. El brazo del lado a medir cruzado sobre el pecho o en la cadera.',
  },
  supraespinal: {
    label: 'Supraespinal', category: 'Pliegue cutáneo', view: 'front',
    front: { cx: 75, cy: 122 }, back: { cx: 50, cy: 122 },
    landmark: 'Intersección iliocrestal–ileoespinal',
    direction: 'Oblicuo (descendente medial)',
    instructions: 'Pliegue oblicuo en la intersección de la línea ileoespinal y la línea horizontal a nivel del borde superior del ilion, ~5–7 cm por encima de la espina ilíaca anterosuperior.',
  },
  abdominal: {
    label: 'Abdominal', category: 'Pliegue cutáneo', view: 'front',
    front: { cx: 68, cy: 128 }, back: { cx: 50, cy: 128 },
    landmark: '5 cm lateral al ombligo',
    direction: 'Vertical',
    instructions: 'Pliegue vertical, 5 cm a la derecha (lateral) del ombligo y a la misma altura. Sin presionar la pared abdominal. Sujeto en posición normal, no succionando.',
  },
  muslo_frontal: {
    label: 'Muslo frontal', category: 'Pliegue cutáneo', view: 'front',
    front: { cx: 53, cy: 175 }, back: { cx: 67, cy: 175 },
    landmark: 'Punto medio inguinal–rótula (cara anterior)',
    direction: 'Vertical',
    instructions: 'Pliegue vertical en la cara anterior del muslo, en el punto medio entre el pliegue inguinal y el borde proximal de la rótula. Pierna relajada con la rodilla en 90°, pie apoyado.',
  },
  pantorrilla: {
    label: 'Pantorrilla medial', category: 'Pliegue cutáneo', view: 'front',
    front: { cx: 52, cy: 218 }, back: { cx: 68, cy: 218 },
    landmark: 'Máxima circunferencia, cara medial',
    direction: 'Vertical',
    instructions: 'Pliegue vertical en la cara medial de la pantorrilla, al nivel de su máxima circunferencia. Pie apoyado en un banco, rodilla en ~90°.',
  },
  // ── Perímetros clave ───────────────────────────────────────────────────────
  brazo_relajado: {
    label: 'Brazo relajado', category: 'Perímetro', view: 'front',
    front: { cx: 28, cy: 96 }, back: { cx: 92, cy: 96 },
    landmark: 'Punto medio del húmero (acromion–olécranon)',
    direction: 'Horizontal',
    instructions: 'Cinta horizontal alrededor del brazo con el codo extendido y el músculo completamente relajado. Medir en el punto medio del húmero.',
  },
  cintura_minima: {
    label: 'Cintura mínima', category: 'Perímetro', view: 'front',
    front: { cx: 60, cy: 132 }, back: { cx: 60, cy: 132 },
    landmark: 'Menor circunferencia entre la última costilla y la cresta ilíaca',
    direction: 'Horizontal',
    instructions: 'Cinta horizontal en el punto de menor circunferencia del tronco. Medir al final de una espiración normal. Cinta paralela al suelo, sin comprimir los tejidos.',
  },
  caderas_maxima: {
    label: 'Caderas máxima', category: 'Perímetro', view: 'front',
    front: { cx: 60, cy: 153 }, back: { cx: 60, cy: 153 },
    landmark: 'Máxima prominencia glútea (vista lateral)',
    direction: 'Horizontal',
    instructions: 'Cinta horizontal al nivel de mayor prominencia de los glúteos (vista lateral). Sujeto de pie, pies juntos. Cinta paralela al suelo y pegada al cuerpo, sin comprimir.',
  },
  muslo_medial: {
    label: 'Muslo medial', category: 'Perímetro', view: 'front',
    front: { cx: 53, cy: 178 }, back: { cx: 67, cy: 178 },
    landmark: 'Punto medio inguinal–rótula',
    direction: 'Horizontal',
    instructions: 'Cinta horizontal alrededor del muslo en el punto medio entre el pliegue inguinal y el borde proximal de la rótula. Peso distribuido en ambos pies, pierna relajada.',
  },
};

// ── Estado del modal ──────────────────────────────────────────────────────────

let _guideView = 'front';
let _guideSite = null;

// ── API pública ───────────────────────────────────────────────────────────────

function openMeasurementGuide(siteId) {
  const site = BODY_SITES[siteId];
  if (!site) return;

  _guideSite = siteId;
  _guideView = site.view;

  const modal = document.getElementById('guide-modal');
  if (!modal) return;

  document.getElementById('guide-category').textContent    = site.category || 'Medición';
  document.getElementById('guide-name').textContent        = site.label;
  document.getElementById('guide-landmark').textContent    = site.landmark;
  document.getElementById('guide-direction').textContent   = site.direction;
  document.getElementById('guide-instructions').textContent = site.instructions;

  _renderGuideFigure();
  _setViewActive(_guideView);
  modal.classList.remove('hidden');
}

function closeMeasurementGuide() {
  document.getElementById('guide-modal')?.classList.add('hidden');
}

// ── Internos ──────────────────────────────────────────────────────────────────

function _renderGuideFigure() {
  const site = BODY_SITES[_guideSite];
  if (!site) return;

  // Usar el sexo del perfil actual (STATE viene de ui.js)
  const sex    = (typeof STATE !== 'undefined' && STATE?.profile?.sexo) || 'M';
  const sexKey = sex === 'F' ? 'female' : 'male';
  const imgSrc = `assets/body/${sexKey}-${_guideView}.png`;

  const wrap = document.getElementById('guide-figure');
  if (!wrap) return;

  const pos = _guideView === 'front' ? site.front : site.back;
  const W = 118;
  const H = Math.round(W * 2.16); // aspect ratio de las imágenes

  wrap.style.height = H + 'px';
  wrap.innerHTML = `
    <img
      src="${imgSrc}"
      alt="${sexKey} ${_guideView}"
      style="width:100%;height:${H}px;object-fit:contain;display:block;user-select:none"
      draggable="false"
    />
    <svg
      width="${W}" height="${H}"
      viewBox="0 0 120 260"
      fill="none"
      style="position:absolute;top:0;left:0;pointer-events:none"
    >
      <circle cx="${pos.cx}" cy="${pos.cy}" r="13"
        fill="var(--accent)" fill-opacity="0.15"/>
      <circle cx="${pos.cx}" cy="${pos.cy}" r="8"
        fill="none" stroke="var(--accent)" stroke-width="1.5" opacity="0.5"/>
      <circle cx="${pos.cx}" cy="${pos.cy}" r="4.5"
        fill="var(--accent)"/>
    </svg>
  `;
}

function _setViewActive(view) {
  document.getElementById('guide-view-front')?.classList.toggle('active', view === 'front');
  document.getElementById('guide-view-back')?.classList.toggle('active',  view === 'back');
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Cerrar al hacer click en el fondo
  document.getElementById('guide-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'guide-modal') closeMeasurementGuide();
  });

  // Botones de cerrar y confirmar
  document.getElementById('guide-close-btn')?.addEventListener('click',   closeMeasurementGuide);
  document.getElementById('guide-confirm-btn')?.addEventListener('click', closeMeasurementGuide);

  // Toggle frente / espalda
  document.getElementById('guide-view-front')?.addEventListener('click', () => {
    _guideView = 'front';
    _renderGuideFigure();
    _setViewActive('front');
  });
  document.getElementById('guide-view-back')?.addEventListener('click', () => {
    _guideView = 'back';
    _renderGuideFigure();
    _setViewActive('back');
  });

  // Delegar todos los botones de guía del formulario
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-guide-site]');
    if (!btn) return;
    e.preventDefault();
    openMeasurementGuide(btn.dataset.guideSite);
  });
});
