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
  let currentTimeslots = [];
  let currentRace = null;
  let currentAvailabilities = [];

  // ============================================================
  // Inicialização
  // ============================================================

  try {
    [races, drivers] = await Promise.all([API.getRaces(), API.getDrivers()]);
    populateRaceSelect(races);
    populateDriverSelect(drivers);
  } catch (err) {
    showFeedback('error', 'Erro ao carregar dados: ' + err.message);
  }

  function populateRaceSelect(raceList) {
    const open = raceList.filter(r => r.status === 'open' || r.status === 'scheduled');
    if (open.length === 0) {
      raceSelect.innerHTML = '<option value="">Nenhuma corrida aberta</option>';
    } else {
      raceSelect.innerHTML = '<option value="">Selecione a corrida…</option>';
      open.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.race_id;
        opt.textContent = `${r.race_name} — ${formatDate(r.race_date)}`;
        raceSelect.appendChild(opt);
      });
    }
  }

  function populateDriverSelect(driverList) {
    driverSelect.innerHTML = '<option value="">Selecione seu nome…</option>';
    driverList.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.name;
      opt.textContent = d.name;
      driverSelect.appendChild(opt);
    });
    // Opção para se cadastrar
    const sep = document.createElement('option');
    sep.disabled = true;
    sep.textContent = '──────────────';
    driverSelect.appendChild(sep);
    const newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = '+ Meu nome não está na lista…';
    driverSelect.appendChild(newOpt);
  }

  // ============================================================
  // Mudança de corrida → carrega timeslots
  // ============================================================

  raceSelect.addEventListener('change', async () => {
    const raceId = raceSelect.value;
    document.getElementById('slot-section').style.display = 'none';
    document.getElementById('slot-grid').innerHTML = '';
    document.getElementById('edit-notice').style.display = 'none';
    renderSubmittedList([]);
    currentTimeslots = [];
    currentTeams = [];
    currentRace = null;
    currentAvailabilities = [];

    if (!raceId) { updatePreview(); return; }

    const slotSection = document.getElementById('slot-section');
    const slotGrid = document.getElementById('slot-grid');
    slotSection.style.display = 'block';
    slotGrid.innerHTML = '<div class="loading"><div class="spinner"></div><span>Carregando slots…</span></div>';

    try {
      const [detail, avData] = await Promise.all([
        API.getRaceDetail(raceId),
        API.getAvailability(raceId).catch(() => ({ availability: [] })),
      ]);
      currentRace = detail.race;
      currentTeams = detail.teams || [];
      currentTimeslots = (detail.timeslots || []).sort((a, b) => Number(a.slot_number) - Number(b.slot_number));
      currentAvailabilities = avData.availability || [];
      updateRaceInfo(currentRace);
      renderSlotGrid(currentRace, currentTimeslots);
      renderSubmittedList(currentAvailabilities);
      prefillFromExisting(driverSelect.value);
      updatePreview();
    } catch (err) {
      slotSection.style.display = 'none';
      currentTeams = [];
      showFeedback('error', 'Erro ao carregar corrida: ' + err.message);
    }
  });

  // ============================================================
  // Grade de slots
  // ============================================================

  function renderSlotGrid(race, slots) {
    const section = document.getElementById('slot-section');
    const grid = document.getElementById('slot-grid');
    if (!slots || slots.length === 0) return;

    const [rh, rm] = (race.local_start_time || '00:00').split(':').map(Number);
    const raceStartMin = rh * 60 + rm;
    const slotDuration = Number(race.slot_duration_minutes) || 60;

    grid.innerHTML = '';
    slots.forEach(slot => {
      const n = Number(slot.slot_number);
      const slotAbsMin = raceStartMin + (n - 1) * slotDuration;
      const dayOffset = Math.floor(slotAbsMin / (24 * 60));

      // Compute actual calendar date for day label
      const baseDate = new Date(race.race_date);
      const slotDate = new Date(baseDate);
      slotDate.setUTCDate(slotDate.getUTCDate() + dayOffset);
      const dayName = slotDate.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' });
      const dateStr = slotDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });

      const label = document.createElement('label');
      label.className = 'slot-chip';
      label.dataset.slot = n;

      const icons = [];
      if (slot.is_night_real === true || slot.is_night_real === 'true' || slot.is_night_real === 'TRUE') icons.push('🌙');
      if (Number(slot.rain_pct) > 0) icons.push('🌧');

      label.innerHTML = `
        <input type="checkbox" name="slot" value="${n}" />
        <span class="slot-chip-inner">
          <span class="slot-num">Slot ${n}</span>
          <span class="slot-date">${dayName} ${dateStr}</span>
          <span class="slot-time">${slot.local_start}–${slot.local_end}</span>
          ${icons.length ? `<span class="slot-icons">${icons.join('')}</span>` : ''}
        </span>`;
      grid.appendChild(label);
    });

    section.style.display = 'block';
  }

  // ============================================================
  // Auto-cadastro de piloto
  // ============================================================

  driverSelect.addEventListener('change', () => {
    const reg = document.getElementById('self-register-section');
    if (driverSelect.value === '__new__') {
      reg.style.display = 'block';
      document.getElementById('edit-notice').style.display = 'none';
      if (window.renderCarCheckboxes) window.renderCarCheckboxes('reg-cars-container', '');
    } else {
      reg.style.display = 'none';
      prefillFromExisting(driverSelect.value);
    }
  });

  document.getElementById('register-btn').addEventListener('click', async () => {
    const raceId = raceSelect.value;
    if (!raceId) { showFeedback('error', 'Selecione a corrida primeiro.'); return; }
    const password = document.getElementById('password').value;
    if (!password) { showFeedback('error', 'Informe a senha do time antes de se cadastrar.'); return; }

    const name = document.getElementById('reg-name').value.trim();
    const irating = document.getElementById('reg-irating').value;
    if (!name) { showFeedback('error', 'Informe seu nome.'); return; }

    const btn = document.getElementById('register-btn');
    btnLoading(btn, true, 'Cadastrando…');
    try {
      const cars = window.getSelectedCars ? window.getSelectedCars('reg-cars-container') : '';
      await API.selfRegisterDriver({ name, irating: irating || 1500, race_id: raceId, password, cars_available: cars });
      drivers = await API.getDrivers();
      populateDriverSelect(drivers);
      driverSelect.value = name;
      document.getElementById('self-register-section').style.display = 'none';
      showFeedback('success', `Piloto <strong>${name}</strong> cadastrado! Agora preencha o restante do formulário.`);
    } catch (err) {
      showFeedback('error', 'Erro ao cadastrar: ' + err.message);
    } finally {
      btnLoading(btn, false, 'Cadastrar');
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
    if (!driverName || driverName === '__new__') { showFeedback('error', 'Selecione seu nome.'); return; }

    // Slots selecionados
    const checkedSlots = [...document.querySelectorAll('#slot-grid input[name=slot]:checked')]
      .map(cb => Number(cb.value))
      .sort((a, b) => a - b);

    if (currentTimeslots.length > 0 && checkedSlots.length === 0) {
      showFeedback('error', 'Selecione ao menos um slot de disponibilidade.'); return;
    }

    const slotFrom = checkedSlots.length > 0 ? checkedSlots[0] : '';
    const slotTo   = checkedSlots.length > 0 ? checkedSlots[checkedSlots.length - 1] : '';

    // Derivar available_from / available_to a partir dos slots selecionados
    const fromSlotObj = currentTimeslots.find(s => Number(s.slot_number) === slotFrom);
    const toSlotObj   = currentTimeslots.find(s => Number(s.slot_number) === slotTo);
    const availFrom = fromSlotObj ? fromSlotObj.local_start : '';
    const availTo   = toSlotObj   ? toSlotObj.local_end     : '';

    const maxStintH = parseFloat(document.getElementById('max-stint').value) || 0;
    const minRestH  = parseFloat(document.getElementById('min-rest').value) || 0;
    if (maxStintH <= 0) { showFeedback('error', 'Informe o tempo máximo no carro.'); return; }

    const password = document.getElementById('password').value;
    if (!password) { showFeedback('error', 'Informe a senha do time.'); return; }

    const payload = {
      race_id: raceId,
      driver_name: driverName,
      available_from: availFrom,
      available_to: availTo,
      slot_from: slotFrom,
      slot_to: slotTo,
      slots_csv: checkedSlots.join(','),
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
    btnLoading(submitBtn, true, 'Enviando…');

    try {
      await API.submitAvailability(payload);
      showFeedback('success', `Disponibilidade de <strong>${driverName}</strong> registrada com sucesso!`);
      form.reset();
      document.getElementById('slot-section').style.display = 'none';
      document.getElementById('slot-grid').innerHTML = '';
      document.getElementById('self-register-section').style.display = 'none';
      document.getElementById('edit-notice').style.display = 'none';
      stintPreview?.classList.remove('visible');
      collBody?.classList.remove('open');
      collBtn?.classList.remove('open');
      currentTimeslots = [];
      // Refresh submitted list
      API.getAvailability(raceId).then(avData => {
        currentAvailabilities = avData.availability || [];
        renderSubmittedList(currentAvailabilities);
      }).catch(() => {});
    } catch (err) {
      showFeedback('error', 'Erro ao enviar: ' + err.message);
    } finally {
      btnLoading(submitBtn, false, 'Enviar Disponibilidade');
    }
  });

  // ============================================================
  // Helpers
  // ============================================================

  function btnLoading(btn, loading, label) {
    if (loading) {
      btn.disabled = true;
      btn.dataset.origText = btn.textContent;
      btn.innerHTML = label + ' <span class="spinner" style="width:14px;height:14px;border-width:2px;vertical-align:middle;display:inline-block;flex-shrink:0"></span>';
    } else {
      btn.disabled = false;
      btn.textContent = btn.dataset.origText || label;
    }
  }

  function showFeedback(type, html) {
    feedback.innerHTML = `<div class="alert alert-${type}">${html}</div>`;
    feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderSubmittedList(avs) {
    const container = document.getElementById('submitted-pilots');
    if (!container) return;
    if (!avs || avs.length === 0) {
      container.innerHTML = '';
      return;
    }
    const names = [...new Set(avs.map(a => a.driver_name))];
    container.innerHTML = `
      <div style="background:#f8f9fa;border:1px solid #e0e0e0;border-radius:6px;padding:12px 16px;">
        <div style="font-size:11px;font-weight:700;color:#777;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">
          Disponibilidade enviada — ${names.length} piloto${names.length !== 1 ? 's' : ''}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${names.map(n => `
            <span style="background:#e8f5e9;border:1px solid #a5d6a7;color:#2e7d32;border-radius:16px;padding:3px 10px;font-size:12px;font-weight:600;">✓ ${n}</span>
          `).join('')}
        </div>
      </div>`;
  }

  function prefillFromExisting(driverName) {
    const notice = document.getElementById('edit-notice');
    if (!notice) return;
    if (!driverName || driverName === '__new__' || !currentAvailabilities.length) {
      notice.style.display = 'none';
      return;
    }
    const existing = currentAvailabilities.find(a => a.driver_name === driverName);
    if (!existing) {
      notice.style.display = 'none';
      return;
    }

    notice.style.display = 'block';

    // Pre-fill selected slots
    if (existing.slots_csv) {
      const selected = new Set(String(existing.slots_csv).split(',').map(s => s.trim()));
      document.querySelectorAll('#slot-grid input[name=slot]').forEach(cb => {
        cb.checked = selected.has(String(cb.value));
      });
    }

    // Pre-fill conditions
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.checked = toBool(val); };
    set('ok-rain',      existing.ok_rain);
    set('ok-night-sim', existing.ok_night_sim);
    set('ok-night-real', existing.ok_night_real);

    // Pre-fill max stint / min rest (stored in minutes, input expects hours)
    const maxStintEl = document.getElementById('max-stint');
    const minRestEl  = document.getElementById('min-rest');
    if (maxStintEl && existing.max_stint_minutes) maxStintEl.value = (Number(existing.max_stint_minutes) / 60).toFixed(1).replace(/\.0$/, '');
    if (minRestEl  && existing.min_rest_minutes)  minRestEl.value  = (Number(existing.min_rest_minutes)  / 60).toFixed(1).replace(/\.0$/, '');

    // Pre-fill optional driving data
    const lapEl  = document.getElementById('custom-laptime');
    const fuelEl = document.getElementById('custom-fuel');
    if (lapEl  && existing.custom_avg_laptime_sec)  lapEl.value  = existing.custom_avg_laptime_sec;
    if (fuelEl && existing.custom_avg_fuel_per_lap) fuelEl.value = existing.custom_avg_fuel_per_lap;

    updatePreview();
  }

  function toBool(val) {
    return val === true || val === 'TRUE' || val === 'true' || val === '1';
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
    try { return new Date(val).toLocaleDateString('pt-BR'); } catch (_) { return String(val); }
  }
})();
