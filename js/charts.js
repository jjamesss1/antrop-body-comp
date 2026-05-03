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

// ── Somatocarta (Chart.js scatter + triángulo Heath-Carter) ─────────────────

const _somatoTrianglePlugin = {
  id: 'somatoTriangle',
  beforeDatasetsDraw(chart) {
    const { ctx, scales: { x: xs, y: ys } } = chart;
    if (!xs || !ys) return;
    const px = (dx, dy) => ({ px: xs.getPixelForValue(dx), py: ys.getPixelForValue(dy) });

    const meso = px( 0,   9);
    const endo = px(-6,  -3.5);
    const ecto = px( 6,  -3.5);
    const ctr  = px( 0,   0);

    ctx.save();

    // Triángulo exterior
    ctx.beginPath();
    ctx.moveTo(meso.px, meso.py);
    ctx.lineTo(endo.px, endo.py);
    ctx.lineTo(ecto.px, ecto.py);
    ctx.closePath();
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Líneas divisorias centro→vértice
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#e5e7eb';
    [[meso, ctr], [endo, ctr], [ecto, ctr]].forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(b.px, b.py);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Etiquetas de vértice
    ctx.font = 'bold 9px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#9ca3af';
    ctx.textAlign = 'center';
    ctx.fillText('MESOMORFO', meso.px, meso.py - 8);
    ctx.textAlign = 'right';
    ctx.fillText('ENDOMORFO', endo.px - 4, endo.py + 14);
    ctx.textAlign = 'left';
    ctx.fillText('ECTOMORFO', ecto.px + 4, ecto.py + 14);

    ctx.restore();
  },
};

function renderSomatocarta(canvasId, somato, somatoAnterior = null, lightMode = false) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas || !somato) return;

  const datasets = [];

  if (somatoAnterior?.x != null && somatoAnterior?.y != null) {
    datasets.push({
      label: 'Anterior',
      data: [{ x: somatoAnterior.x, y: somatoAnterior.y }],
      backgroundColor: 'rgba(148,163,184,0.75)',
      borderColor: '#94a3b8',
      borderWidth: 1.5,
      pointRadius: 6,
      pointHoverRadius: 8,
    });
  }

  if (somato?.x != null && somato?.y != null) {
    datasets.push({
      label: 'Actual',
      data: [{ x: somato.x, y: somato.y }],
      backgroundColor: 'rgba(79,70,229,0.9)',
      borderColor: '#818cf8',
      borderWidth: 2,
      pointRadius: 8,
      pointHoverRadius: 10,
    });
  }

  _charts[canvasId] = new Chart(canvas, {
    type: 'scatter',
    data: { datasets },
    plugins: [_somatoTrianglePlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#ffffff',
          borderColor: '#e5e7eb',
          borderWidth: 1,
          titleColor: '#111827',
          bodyColor: '#374151',
          callbacks: {
            label: ctx => ` ${ctx.dataset.label} (${ctx.raw.x?.toFixed(1)}, ${ctx.raw.y?.toFixed(1)})`,
          },
        },
      },
      scales: {
        x: {
          min: -9, max: 9,
          grid: { color: '#f3f4f6' },
          border: { display: false },
          ticks: {
            color: '#9ca3af',
            stepSize: 3,
            callback: v => (v % 3 === 0 && v !== -9 && v !== 9) ? v : '',
          },
        },
        y: {
          min: -5, max: 12,
          grid: { color: '#f3f4f6' },
          border: { display: false },
          ticks: { display: false },
        },
      },
    },
  });
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
