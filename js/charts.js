/**
 * charts.js
 * Visualizaciones con Chart.js (CDN) + Somatocarta en Canvas nativo.
 */

'use strict';

// Instancias de Chart.js (para destruir antes de redibujar)
const _charts = {};

function destroyChart(id) {
  if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
}

// ── Colores por Z ─────────────────────────────────────────────────────────────

function zColor(z) {
  if (z === null) return '#94a3b8';
  const abs = Math.abs(z);
  if (abs > 3)   return z > 0 ? '#ef4444' : '#8b5cf6';
  if (abs > 2)   return z > 0 ? '#f97316' : '#6366f1';
  if (abs > 1)   return z > 0 ? '#f59e0b' : '#3b82f6';
  return '#22c55e';
}

// ── Gráfica Z-scores horizontal ───────────────────────────────────────────────

function renderZChart(canvasId, labels, zValues, title) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const colors = zValues.map(z => zColor(z));

  _charts[canvasId] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: zValues,
        backgroundColor: colors.map(c => c + 'cc'),
        borderColor: colors,
        borderWidth: 1.5,
        borderRadius: 3,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: !!title, text: title, color: '#e2e8f0', font: { size: 13 } },
        tooltip: {
          callbacks: {
            label: ctx => ` Z = ${ctx.raw?.toFixed(2) ?? '-'}`,
          },
        },
      },
      scales: {
        x: {
          min: -4, max: 4,
          grid: { color: '#334155' },
          ticks: { color: '#94a3b8', stepSize: 1 },
          title: { display: true, text: 'Z-score', color: '#94a3b8' },
        },
        y: {
          grid: { color: '#1e293b' },
          ticks: { color: '#cbd5e1', font: { size: 11 } },
        },
      },
    },
  });
}

// ── Torta Kerr ────────────────────────────────────────────────────────────────

function renderKerrPie(canvasId, kerr) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas || !kerr?.componentes) return;

  const labels  = { piel: 'Piel', adiposa: 'Adiposa', muscular: 'Muscular', osea: 'Ósea', residual: 'Residual' };
  const colors  = { piel: '#f59e0b', adiposa: '#f97316', muscular: '#3b82f6', osea: '#8b5cf6', residual: '#22c55e' };
  const keys = Object.keys(labels).filter(k => kerr.componentes[k]);

  _charts[canvasId] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: keys.map(k => labels[k]),
      datasets: [{
        data: keys.map(k => kerr.componentes[k]?.pct ?? 0),
        backgroundColor: keys.map(k => colors[k] + 'dd'),
        borderColor: keys.map(k => colors[k]),
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#cbd5e1', font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.raw?.toFixed(1)}% (${kerr.componentes[keys[ctx.dataIndex]]?.kg?.toFixed(2)} kg)`,
          },
        },
      },
    },
  });
}

// ── Somatocarta ───────────────────────────────────────────────────────────────
// Dibuja la somatocarta triangular en un canvas 2D nativo.

function renderSomatocarta(canvasId, somato, somatoAnterior = null) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Márgenes
  const mx = 40, my = 30;
  const w = W - 2 * mx;
  const h = H - 2 * my;

  // Rango de coordenadas de somatocarta
  const xMin = -9, xMax = 9, yMin = -4, yMax = 16;

  function toCanvas(sx, sy) {
    return [
      mx + (sx - xMin) / (xMax - xMin) * w,
      my + h - (sy - yMin) / (yMax - yMin) * h,
    ];
  }

  // Fondo
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, W, H);

  // Grilla
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  for (let x = xMin; x <= xMax; x++) {
    const [cx0, cy0] = toCanvas(x, yMin);
    const [cx1, cy1] = toCanvas(x, yMax);
    ctx.beginPath(); ctx.moveTo(cx0, cy0); ctx.lineTo(cx1, cy1); ctx.stroke();
  }
  for (let y = yMin; y <= yMax; y += 2) {
    const [cx0, cy0] = toCanvas(xMin, y);
    const [cx1, cy1] = toCanvas(xMax, y);
    ctx.beginPath(); ctx.moveTo(cx0, cy0); ctx.lineTo(cx1, cy1); ctx.stroke();
  }

  // Ejes
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  const [ax0, ay0] = toCanvas(0, yMin); const [ax1, ay1] = toCanvas(0, yMax);
  ctx.beginPath(); ctx.moveTo(ax0, ay0); ctx.lineTo(ax1, ay1); ctx.stroke();
  const [bx0, by0] = toCanvas(xMin, 0); const [bx1, by1] = toCanvas(xMax, 0);
  ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(bx1, by1); ctx.stroke();

  // Etiquetas de ejes
  ctx.fillStyle = '#64748b';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('← Endo', mx + w * 0.15, H - 8);
  ctx.fillText('Ecto →', mx + w * 0.85, H - 8);
  ctx.save();
  ctx.translate(12, H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Mesomorfia', 0, 0);
  ctx.restore();

  // Punto anterior
  if (somatoAnterior?.x !== null && somatoAnterior?.y !== null) {
    const [px, py] = toCanvas(somatoAnterior.x, somatoAnterior.y);
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#475569';
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Línea de trayectoria
    if (somato?.x !== null && somato?.y !== null) {
      const [cx, cy] = toCanvas(somato.x, somato.y);
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(px, py); ctx.lineTo(cx, cy);
      ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Punto actual
  if (somato?.x !== null && somato?.y !== null) {
    const [px, py] = toCanvas(somato.x, somato.y);
    // Halo
    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#3b82f620';
    ctx.fill();
    // Punto
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#3b82f6';
    ctx.fill();
    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Etiqueta
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    const label = `${somato.endo?.toFixed(1) ?? '-'} - ${somato.meso?.toFixed(1) ?? '-'} - ${somato.ecto?.toFixed(1) ?? '-'}`;
    ctx.fillText(label, px + 12, py - 4);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(`(${somato.x?.toFixed(2)}, ${somato.y?.toFixed(2)})`, px + 12, py + 10);
  }
}

// ── Radar de componentes Kerr ─────────────────────────────────────────────────
// Opcional — muestra distribución de % vs referencia

function renderKerrComparacion(canvasId, kerr, kerrAnt = null) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas || !kerr?.componentes) return;

  const labels = ['Piel', 'Adiposa', 'Muscular', 'Ósea', 'Residual'];
  const keys   = ['piel', 'adiposa', 'muscular', 'osea', 'residual'];
  const data   = keys.map(k => kerr.componentes[k]?.pct ?? 0);
  const datasets = [{
    label: 'Actual',
    data,
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderColor: '#3b82f6',
    borderWidth: 2,
    pointBackgroundColor: '#3b82f6',
  }];

  if (kerrAnt?.componentes) {
    datasets.push({
      label: 'Anterior',
      data: keys.map(k => kerrAnt.componentes[k]?.pct ?? 0),
      backgroundColor: 'rgba(100,116,139,0.15)',
      borderColor: '#64748b',
      borderWidth: 1.5,
      borderDash: [5, 5],
      pointBackgroundColor: '#64748b',
    });
  }

  _charts[canvasId] = new Chart(canvas, {
    type: 'radar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 0,
          grid: { color: '#1e293b' },
          angleLines: { color: '#334155' },
          ticks: { color: '#64748b', backdropColor: 'transparent' },
          pointLabels: { color: '#94a3b8', font: { size: 12 } },
        },
      },
      plugins: {
        legend: { labels: { color: '#94a3b8' } },
      },
    },
  });
}
