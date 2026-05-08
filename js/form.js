// ============================================================
// KRT Endurance — Lógica do Formulário de Disponibilidade
// ============================================================

(async function () {
  const raceSelect   = document.getElementById('race-select');
  const driverSelect = document.getElementById('driver-select');
  const form         = document.getElementById('availability-form');
  const feedback     = document.getElementById('form-feedback');
  const stintPreview = document.getElementById('stint-preview');
  const collBtn      = document.getElementById('collapsible-btn');
  const collBody     = document.getElementById('collapsible-body');

  let races = [];
  let drivers = [];
  let currentTeams = [];

  // ============================================================
  // Inicialização
  // ============================================================

  try {
    [races, drivers] = await Promise.all([API.getRaces(), API.getDrivers()]);

    // Popular corridas abertas
    const openRaces = races.filter(r => r.status === 'open' || r.status === 'scheduled');
    if (openRaces.length === 0) {
      raceSelect.innerHTML = '<option value="">Nenhuma corrida aberta</option>';
    } else {
      raceSelect.innerHTML = '<option value="">Selecione a corrida…</option>';
      openRaces.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.race_id;
        opt.textContent = `${r.race_name} — ${formatDate(r.race_date)}`;
        raceSelect.appendChild(opt);
      });
    }

    // Popular pilotos
    driverSelect.innerHTML = '<option value="">Selecione seu nome…</option>';
    drivers.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.name;
      opt.textContent = d.name;
      driverSelect.appendChild(opt);
    });

  } catch (err) {
    showFeedback('error', 'Erro ao carregar dados: ' + err.message);
  }

  // ============================================================
  // Mudança de corrida → atualiza info e preview
  // ============================================================

  raceSelect.addEventListener('change', async () => {
    const raceId = raceSelect.value;
    if (!raceId) { currentTeams = []; updatePreview(); return; }
    try {
      const detail = await API.getRaceDetail(raceId);
      currentTeams = detail.teams || [];
      updateRaceInfo(detail.race);
      updatePreview();
    } catch (err) {
      currentTeams = [];
    }
  });

  // ============================================================
  // Preview de stint estimado
  // ============================================================

  const customLapInput  = document.getElementById('custom-laptime');
  const customFuelInput = document.getElementById('custom-fuel');

  function updatePreview() {
    if (!stintPreview) return;
    const customLap  = parseFloat(customLapInput?.value) || 0;
    const customFuel = parseFloat(customFuelInput?.value) || 0;

    let text = '';

    if (currentTeams.length > 0) {
      const lines = currentTeams.map(team => {
        const fuelCap   = Number(team.fuel_capacity_liters) || 0;
        const defLap    = Number(team.default_avg_laptime_sec);
        const defFuel   = Number(team.default_avg_fuel_per_lap);
        const defaultMin = defFuel > 0 ? Math.round(Math.floor(fuelCap / defFuel) * defLap / 60) : Number(team.stint_duration_minutes);

        if (customLap > 0 && customFuel > 0 && fuelCap > 0) {
          const laps = Math.floor(fuelCap / customFuel);
          const custom = Math.round(laps * customLap / 60);
          return `${team.team_name}: ~${custom} min (${laps} voltas) — padrão seria ${defaultMin} min`;
        }
        return `${team.team_name}: ~${defaultMin} min (padrão)`;
      });
      text = lines.join('\n');
    }

    if (text) {
      stintPreview.textContent = 'Stint estimado:\n' + text;
      stintPreview.classList.add('visible');
    } else {
      stintPreview.classList.remove('visible');
    }
  }

  customLapInput?.addEventListener('input', updatePreview);
  customFuelInput?.addEventListener('input', updatePreview);

  // ============================================================
  // Collapsible
  // ============================================================

  collBtn?.addEventListener('click', () => {
    const open = collBody.classList.toggle('open');
    collBtn.classList.toggle('open', open);
  });

  // ============================================================
  // Submit
  // ============================================================

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    feedback.innerHTML = '';

    const raceId = raceSelect.value;
    if (!raceId) { showFeedback('error', 'Selecione uma corrida.'); return; }

    const driverName = driverSelect.value;
    if (!driverName) { showFeedback('error', 'Selecione seu nome.'); return; }

    const availFrom = document.getElementById('available-from').value;
    const availTo   = document.getElementById('available-to').value;
    if (!availFrom || !availTo) { showFeedback('error', 'Preencha o horário de disponibilidade.'); return; }

    const maxStintH = parseFloat(document.getElementById('max-stint').value) || 0;
    const minRestH  = parseFloat(document.getElementById('min-rest').value) || 0;
    if (maxStintH <= 0) { showFeedback('error', 'Informe o tempo máximo no carro.'); return; }
    if (minRestH < 0)   { showFeedback('error', 'Informe o descanso mínimo.'); return; }

    const password = document.getElementById('password').value;
    if (!password) { showFeedback('error', 'Informe a senha do time.'); return; }

    const payload = {
      race_id: raceId,
      driver_name: driverName,
      available_from: availFrom,
      available_to: availTo,
      ok_rain:      document.getElementById('ok-rain').checked,
      ok_night_sim: document.getElementById('ok-night-sim').checked,
      ok_night_real:document.getElementById('ok-night-real').checked,
      max_stint_minutes: Math.round(maxStintH * 60),
      min_rest_minutes:  Math.round(minRestH * 60),
      custom_avg_laptime_sec:  parseFloat(customLapInput?.value)  || '',
      custom_avg_fuel_per_lap: parseFloat(customFuelInput?.value) || '',
      password,
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando…';

    try {
      await API.submitAvailability(payload);
      showFeedback('success', `Disponibilidade de <strong>${driverName}</strong> registrada com sucesso!`);
      form.reset();
      stintPreview?.classList.remove('visible');
      collBody?.classList.remove('open');
      collBtn?.classList.remove('open');
    } catch (err) {
      showFeedback('error', 'Erro ao enviar: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar Disponibilidade';
    }
  });

  // ============================================================
  // Helpers
  // ============================================================

  function showFeedback(type, html) {
    feedback.innerHTML = `<div class="alert alert-${type}">${html}</div>`;
    feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function updateRaceInfo(race) {
    const el = document.getElementById('race-info');
    if (!el) return;
    el.innerHTML = `
      <span>📅 ${formatDate(race.race_date)}</span>
      <span>⏱ ${race.race_duration_hours}h</span>
      <span>🕐 Início local: ${race.local_start_time}</span>
    `;
  }

  function formatDate(val) {
    if (!val) return '—';
    try {
      return new Date(val).toLocaleDateString('pt-BR');
    } catch (_) { return String(val); }
  }
})();
