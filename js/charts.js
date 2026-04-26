/**
 * charts.js — AntroLab v2
 * Visualizaciones con Chart.js (CDN) + Somatocarta en Canvas nativo.
 */

'use strict';

// Instancias de Chart.js
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
        title: { display: !!title, text: title, color: '#111827', font: { size: 13 } },
        tooltip: { callbacks: { label: ctx => ` Z = ${ctx.raw?.toFixed(2) ?? '-'}` } },
      },
      scales: {
        x: {
          min: -4, max: 4,
          grid: { color: '#f3f4f6' },
          ticks: { color: '#6b7280', stepSize: 1 },
          title: { display: true, text: 'Z-score', color: '#9ca3af' },
        },
        y: {
          grid: { color: '#f9fafb' },
          ticks: { color: '#374151', font: { size: 11 } },
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
  const labels = { piel: 'Piel', adiposa: 'Adiposa', muscular: 'Muscular', osea: 'Ósea', residual: 'Residual' };
  const colors = { piel: '#f59e0b', adiposa: '#f97316', muscular: '#4f46e5', osea: '#8b5cf6', residual: '#10b981' };
  const keys   = Object.keys(labels).filter(k => kerr.componentes[k]);
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
        legend: { position: 'right', labels: { color: '#374151', font: { size: 12 } } },
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

function renderSomatocarta(canvasId, somato, somatoAnterior = null, lightMode = false) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const mx = 32, my = 24;
  const w = W - 2 * mx;
  const h = H - 2 * my;
  const xMin = -9, xMax = 9, yMin = -4, yMax = 16;

  function toCanvas(sx, sy) {
    return [
      mx + (sx - xMin) / (xMax - xMin) * w,
      my + h - (sy - yMin) / (yMax - yMin) * h,
    ];
  }

  // Fondo
  ctx.fillStyle = lightMode ? '#f9fafb' : '#0f172a';
  ctx.fillRect(0, 0, W, H);

  const gridColor = lightMode ? '#e5e7eb' : '#1e293b';
  const axisColor = lightMode ? '#d1d5db' : '#334155';
  const labelColor = lightMode ? '#9ca3af' : '#64748b';

  // Grilla
  ctx.strokeStyle = gridColor;
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
  ctx.strokeStyle = axisColor;
  ctx.lineWidth = 1.5;
  const [ax0, ay0] = toCanvas(0, yMin); const [ax1, ay1] = toCanvas(0, yMax);
  ctx.beginPath(); ctx.moveTo(ax0, ay0); ctx.lineTo(ax1, ay1); ctx.stroke();
  const [bx0, by0] = toCanvas(xMin, 0); const [bx1, by1] = toCanvas(xMax, 0);
  ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(bx1, by1); ctx.stroke();

  // Etiquetas
  ctx.fillStyle = labelColor;
  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('← Endo', mx + w * 0.15, H - 6);
  ctx.fillText('Ecto →',  mx + w * 0.85, H - 6);
  ctx.save();
  ctx.translate(11, H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Meso', 0, 0);
  ctx.restore();

  // Punto anterior
  if (somatoAnterior?.x !== null && somatoAnterior?.y !== null) {
    const [px, py] = toCanvas(somatoAnterior.x, somatoAnterior.y);
    ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fillStyle = lightMode ? '#d1d5db' : '#475569';
    ctx.fill();
    ctx.strokeStyle = lightMode ? '#9ca3af' : '#64748b';
    ctx.lineWidth = 1.5; ctx.stroke();
    if (somato?.x !== null && somato?.y !== null) {
      const [cx, cy] = toCanvas(somato.x, somato.y);
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(px, py); ctx.lineTo(cx, cy);
      ctx.strokeStyle = lightMode ? '#9ca3af' : '#475569';
      ctx.lineWidth = 1.5; ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Punto actual
  if (somato?.x !== null && somato?.y !== null) {
    const [px, py] = toCanvas(somato.x, somato.y);
    ctx.beginPath(); ctx.arc(px, py, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#4f46e520'; ctx.fill();
    ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#4f46e5'; ctx.fill();
    ctx.strokeStyle = '#818cf8'; ctx.lineWidth = 2; ctx.stroke();
    const textColor = lightMode ? '#111827' : '#e2e8f0';
    ctx.fillStyle = textColor;
    ctx.font = 'bold 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    const label = `${somato.endo?.toFixed(1) ?? '-'} - ${somato.meso?.toFixed(1) ?? '-'} - ${somato.ecto?.toFixed(1) ?? '-'}`;
    ctx.fillText(label, px + 10, py - 4);
    ctx.fillStyle = labelColor;
    ctx.font = '9px Inter, system-ui, sans-serif';
    ctx.fillText(`(${somato.x?.toFixed(1)}, ${somato.y?.toFixed(1)})`, px + 10, py + 8);
  }
}

// ── Radar Kerr ────────────────────────────────────────────────────────────────

function renderKerrComparacion(canvasId, kerr, kerrAnt = null) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas || !kerr?.componentes) return;
  const labels   = ['Piel', 'Adiposa', 'Muscular', 'Ósea', 'Residual'];
  const keys     = ['piel', 'adiposa', 'muscular', 'osea', 'residual'];
  const datasets = [{
    label: 'Actual',
    data: keys.map(k => kerr.componentes[k]?.pct ?? 0),
    backgroundColor: 'rgba(79,70,229,0.15)',
    borderColor: '#4f46e5',
    borderWidth: 2,
    pointBackgroundColor: '#4f46e5',
  }];
  if (kerrAnt?.componentes) {
    datasets.push({
      label: 'Anterior',
      data: keys.map(k => kerrAnt.componentes[k]?.pct ?? 0),
      backgroundColor: 'rgba(156,163,175,0.1)',
      borderColor: '#9ca3af',
      borderWidth: 1.5,
      borderDash: [5, 5],
      pointBackgroundColor: '#9ca3af',
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
          grid: { color: '#f3f4f6' },
          angleLines: { color: '#e5e7eb' },
          ticks: { color: '#9ca3af', backdropColor: 'transparent' },
          pointLabels: { color: '#6b7280', font: { size: 11 } },
        },
      },
      plugins: { legend: { labels: { color: '#6b7280' } } },
    },
  });
}

// ── Gráfico de evolución (área + línea) ───────────────────────────────────────

function renderEvolucionChart(canvasId, labels, values, opts = {}) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const color   = opts.color   ?? '#4f46e5';
  const fill    = opts.fill    ?? true;
  const minimal = opts.minimal ?? false;
  const unit    = opts.unit    ?? '';

  const hexToRgb = hex => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  };

  _charts[canvasId] = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: color,
        borderWidth: 2,
        pointRadius: minimal ? 0 : 4,
        pointHoverRadius: minimal ? 3 : 6,
        pointBackgroundColor: color,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        tension: 0.35,
        fill: fill ? 'origin' : false,
        backgroundColor: fill
          ? (ctx => {
              const c = ctx.chart.ctx;
              const h = ctx.chart.chartArea?.bottom ?? 300;
              const grad = c.createLinearGradient(0, 0, 0, h);
              grad.addColorStop(0, `rgba(${hexToRgb(color)}, 0.18)`);
              grad.addColorStop(1, `rgba(${hexToRgb(color)}, 0.01)`);
              return grad;
            })
          : undefined,
        spanGaps: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: !minimal,
          backgroundColor: '#ffffff',
          borderColor: '#e5e7eb',
          borderWidth: 1,
          titleColor: '#111827',
          bodyColor: '#374151',
          padding: 10,
          callbacks: {
            label: ctx => ` ${ctx.raw?.toFixed(2) ?? '—'} ${unit}`,
          },
        },
      },
      scales: {
        x: {
          display: !minimal,
          grid: { display: false },
          ticks: { color: '#9ca3af', font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
          border: { display: false },
        },
        y: {
          display: !minimal,
          grid: { color: '#f3f4f6', drawBorder: false },
          ticks: { color: '#9ca3af', font: { size: 11 }, padding: 8 },
          border: { display: false },
        },
      },
    },
  });
}

// ── Sparkline (sin ejes, sin tooltip) ────────────────────────────────────────

function renderSparkline(canvasId, values) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas || values.length < 2) return;

  const first = values[0];
  const last  = values[values.length - 1];
  const color = last <= first ? '#10b981' : '#ef4444';  // baja = verde para grasa/pliegues

  _charts[canvasId] = new Chart(canvas, {
    type: 'line',
    data: {
      labels: values.map((_, i) => i),
      datasets: [{
        data: values,
        borderColor: color,
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.4,
        fill: false,
        spanGaps: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: { display: false },
      },
    },
  });
}
