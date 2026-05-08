// ============================================================
// KRT Endurance — Catálogo de Carros iRacing
// Fonte: iracing.com/cars + traxion.gg/complete-iracing-car-list/
// ============================================================

window.IRACING_CARS = [
  // ── GTP / Hypercar ──────────────────────────────────────────
  { cat: 'GTP',  name: 'Acura ARX-06 GTP' },
  { cat: 'GTP',  name: 'BMW M Hybrid V8 GTP' },
  { cat: 'GTP',  name: 'Cadillac V-Series.R GTP' },
  { cat: 'GTP',  name: 'Ferrari 499P' },
  { cat: 'GTP',  name: 'Porsche 963 GTP' },

  // ── GT3 ─────────────────────────────────────────────────────
  { cat: 'GT3',  name: 'Acura NSX GT3 EVO 22' },
  { cat: 'GT3',  name: 'Aston Martin GT3 EVO' },
  { cat: 'GT3',  name: 'Audi R8 LMS GT3' },
  { cat: 'GT3',  name: 'Audi R8 LMS EVO II GT3' },
  { cat: 'GT3',  name: 'BMW M4 GT3 EVO' },
  { cat: 'GT3',  name: 'BMW Z4 GT3' },
  { cat: 'GT3',  name: 'Chevrolet Corvette Z06 GT3.R' },
  { cat: 'GT3',  name: 'Ferrari 296 GT3' },
  { cat: 'GT3',  name: 'Ferrari 488 GT3' },
  { cat: 'GT3',  name: 'Ferrari 488 GT3 Evo 2020' },
  { cat: 'GT3',  name: 'Ford Mustang GT3' },
  { cat: 'GT3',  name: 'Lamborghini Huracán GT3 EVO' },
  { cat: 'GT3',  name: 'McLaren 720S GT3 EVO' },
  { cat: 'GT3',  name: 'McLaren MP4-12C GT3' },
  { cat: 'GT3',  name: 'Mercedes-AMG GT3' },
  { cat: 'GT3',  name: 'Mercedes-AMG GT3 2020' },
  { cat: 'GT3',  name: 'Porsche 911 GT3 R' },
  { cat: 'GT3',  name: 'Porsche 911 GT3 R (992)' },

  // ── GTE ─────────────────────────────────────────────────────
  { cat: 'GTE',  name: 'BMW M8 GTE' },
  { cat: 'GTE',  name: 'Chevrolet Corvette C8.R GTE' },
  { cat: 'GTE',  name: 'Ferrari 488 GTE' },
  { cat: 'GTE',  name: 'Ford GT GTE' },
  { cat: 'GTE',  name: 'Porsche 911 RSR' },

  // ── GT4 ─────────────────────────────────────────────────────
  { cat: 'GT4',  name: 'Ford Mustang GT4' },
  { cat: 'GT4',  name: 'Mercedes-AMG GT4' },
  { cat: 'GT4',  name: 'Porsche 718 Cayman GT4 MR' },
  { cat: 'GT4',  name: 'McLaren 570S GT4' },

  // ── LMP2 ────────────────────────────────────────────────────
  { cat: 'LMP2', name: 'Dallara P217 LMP2' },
  { cat: 'LMP2', name: 'Ligier JS P320' },
  { cat: 'LMP2', name: 'Oreca 07' },

  // ── LMP1 / Prototype ────────────────────────────────────────
  { cat: 'LMP1', name: 'Audi R18' },
  { cat: 'LMP1', name: 'Porsche 919 Hybrid' },
  { cat: 'LMP1', name: 'Dallara iR-01' },
];

/**
 * Preenche um elemento <datalist> com todos os carros.
 * @param {string} datalistId - ID do elemento <datalist>
 */
window.populateCarDatalist = function (datalistId) {
  const dl = document.getElementById(datalistId);
  if (!dl) return;
  dl.innerHTML = '';
  window.IRACING_CARS.forEach(car => {
    const opt = document.createElement('option');
    opt.value = car.name;
    opt.dataset.cat = car.cat;
    dl.appendChild(opt);
  });
};

/**
 * Renderiza checkboxes de carros em um container.
 * @param {string} containerId - ID do container div
 * @param {string} selectedCsv - Carros já selecionados (CSV)
 */
window.renderCarCheckboxes = function (containerId, selectedCsv) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const selected = (selectedCsv || '').split(',').map(c => c.trim()).filter(Boolean);

  // Agrupar por categoria
  const byCategory = {};
  window.IRACING_CARS.forEach(car => {
    if (!byCategory[car.cat]) byCategory[car.cat] = [];
    byCategory[car.cat].push(car);
  });

  container.innerHTML = '';
  Object.entries(byCategory).forEach(([cat, cars]) => {
    const group = document.createElement('div');
    group.style.cssText = 'margin-bottom:10px';
    group.innerHTML = `<div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:4px">${cat}</div>`;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px';
    cars.forEach(car => {
      const label = document.createElement('label');
      label.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font-size:12px;border:1px solid var(--color-border);border-radius:4px;padding:3px 8px;cursor:pointer;background:var(--color-bg)';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.name = 'car';
      cb.value = car.name;
      cb.checked = selected.includes(car.name);
      cb.addEventListener('change', () => {
        label.style.background = cb.checked ? 'var(--color-team-1)' : '';
        label.style.borderColor = cb.checked ? '#b8a26a' : '';
      });
      if (cb.checked) {
        label.style.background = 'var(--color-team-1)';
        label.style.borderColor = '#b8a26a';
      }
      label.appendChild(cb);
      label.appendChild(document.createTextNode(car.name));
      wrap.appendChild(label);
    });
    group.appendChild(wrap);
    container.appendChild(group);
  });
};

/**
 * Retorna CSV dos carros selecionados em um container de checkboxes.
 * @param {string} containerId
 */
window.getSelectedCars = function (containerId) {
  const container = document.getElementById(containerId);
  if (!container) return '';
  return [...container.querySelectorAll('input[name=car]:checked')]
    .map(cb => cb.value)
    .join(',');
};
