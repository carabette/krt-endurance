// ============================================================
// KRT Endurance — Renderização da Grade de Stints
// ============================================================

const Schedule = (() => {
  // Paleta de cores por equipe (até 6 equipes)
  const TEAM_COLORS = [
    { bg: '#D8C48B', light: '#ede8d0', dark: '#b8a060', text: '#4a3800', cls: 'team-1', sepCls: 'team-1' },
    { bg: '#FCF9CE', light: '#fefcec', dark: '#d4cc6e', text: '#5a5000', cls: 'team-2', sepCls: 'team-2' },
    { bg: '#c8dff0', light: '#e8f3fb', dark: '#6aadde', text: '#1a3a55', cls: 'team-3', sepCls: '' },
    { bg: '#d4f0d4', light: '#eafaea', dark: '#6ac46a', text: '#1a4a1a', cls: 'team-4', sepCls: '' },
    { bg: '#f0d4e8', light: '#faeaf5', dark: '#c46aaa', text: '#4a1a3a', cls: 'team-5', sepCls: '' },
    { bg: '#f0e8d4', light: '#faf5ea', dark: '#c4aa6a', text: '#4a3a1a', cls: 'team-6', sepCls: '' },
  ];

  function rainClass(pct) {
    const p = Number(pct) || 0;
    if (p === 0) return 'rain-0';
    if (p < 5)  return 'rain-1';
    if (p < 10) return 'rain-2';
    if (p < 15) return 'rain-10';
    if (p < 20) return 'rain-15';
    if (p < 30) return 'rain-20';
    return 'rain-30';
  }

  function pctClass(pct) {
    const p = Number(pct) || 0;
    if (p < 10) return 'pct-low';
    if (p < 20) return 'pct-mid';
    return 'pct-high';
  }

  function renderGrid(container, race, timeslots, teams, schedule, assignments) {
    container.innerHTML = '';

    if (!timeslots || timeslots.length === 0) {
      container.innerHTML = '<div class="loading"><span>Nenhum slot de tempo encontrado para esta corrida.</span></div>';
      return;
    }

    const sorted = [...timeslots].sort((a, b) => Number(a.slot_number) - Number(b.slot_number));

    // Map schedule by team+slot
    const scheduleMap = {};
    (schedule || []).forEach(s => {
      scheduleMap[`${s.team_id}_${s.slot_id}`] = s;
    });

    // Map assignments by team
    const assignMap = {};
    (assignments || []).forEach(a => {
      if (!assignMap[a.team_id]) assignMap[a.team_id] = [];
      assignMap[a.team_id].push(a);
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'schedule-wrapper';

    const grid = document.createElement('div');
    grid.className = 'schedule-grid';

    // === HEADER ===
    const headerGroup = document.createElement('div');
    headerGroup.className = 'grid-header-group';

    // Row 1: Hora local (rotacionada 90° para caber na largura)
    const row1 = buildHeaderRow('', sorted, s => {
      const cell = document.createElement('div');
      cell.className = `time-cell-rotated${toBool(s.is_night_real) ? ' night' : ''}`;
      cell.innerHTML = `<span>${s.local_start}</span>`;
      return cell;
    }, false);
    headerGroup.appendChild(row1);

    // Row 2: Rain
    const row2 = buildRainRow(sorted);
    row2.classList.add('rain-row');
    headerGroup.appendChild(row2);

    grid.appendChild(headerGroup);

    // === BODY: team sections ===
    const body = document.createElement('div');
    body.className = 'grid-body-group';

    teams.forEach((team, teamIdx) => {
      const color = TEAM_COLORS[teamIdx % TEAM_COLORS.length];
      const teamDrivers = (assignMap[team.team_id] || []).sort((a, b) => Number(b.irating_at_assignment) - Number(a.irating_at_assignment));

      // Team separator row
      const sepRow = document.createElement('div');
      sepRow.className = `grid-row team-separator ${color.sepCls}`;
      const sepLabel = document.createElement('div');
      sepLabel.className = 'grid-cell label';
      sepLabel.colSpan = sorted.length + 2;
      sepLabel.textContent = `${team.team_name} — ${team.car_name}`;
      sepLabel.style.cssText = `background:${color.light};border-top-color:${color.dark}`;
      const sepIr = document.createElement('div');
      sepIr.className = 'grid-cell irating';
      sepIr.style.background = color.light;
      sepRow.appendChild(sepLabel);
      sepRow.appendChild(sepIr);
      sorted.forEach(() => {
        const c = document.createElement('div');
        c.className = 'grid-cell slot';
        c.style.background = color.light;
        sepRow.appendChild(c);
      });
      body.appendChild(sepRow);

      if (teamDrivers.length === 0) {
        const emptyRow = document.createElement('div');
        emptyRow.className = 'grid-row';
        const lbl = document.createElement('div');
        lbl.className = 'grid-cell label';
        lbl.style.color = '#aaa';
        lbl.textContent = 'Sem pilotos alocados';
        emptyRow.appendChild(lbl);
        body.appendChild(emptyRow);
        return;
      }

      // Driver rows
      teamDrivers.forEach(driverAssign => {
        const driverRow = document.createElement('div');
        driverRow.className = 'grid-row driver-row';

        const labelCell = document.createElement('div');
        labelCell.className = 'grid-cell label';
        labelCell.innerHTML = `<span class="driver-name">${driverAssign.driver_name}</span>`;

        const irCell = document.createElement('div');
        irCell.className = 'grid-cell irating';
        irCell.textContent = driverAssign.irating_at_assignment || '';

        driverRow.appendChild(labelCell);
        driverRow.appendChild(irCell);

        sorted.forEach(slot => {
          const entry = scheduleMap[`${team.team_id}_${slot.slot_id}`];
          const slotCell = document.createElement('div');
          slotCell.className = 'grid-cell slot';

          const stint = document.createElement('div');
          const isPrimary = entry && entry.driver_primary === driverAssign.driver_name;
          const isBackup  = entry && entry.driver_backup  === driverAssign.driver_name;

          if (isPrimary) {
            stint.className = `stint-cell stint-active ${color.cls}`;
            stint.style.cssText = `background:${color.bg};color:${color.text};border-left-color:${color.dark}`;

            if (Number(slot.rain_pct) >= (race.rain_threshold_pct || 10)) {
              const overlay = document.createElement('div');
              overlay.className = 'stint-rain-overlay';
              stint.appendChild(overlay);
            }
            if (toBool(slot.is_night_sim)) {
              const nightOverlay = document.createElement('div');
              nightOverlay.className = 'stint-night-overlay';
              stint.appendChild(nightOverlay);
            }

            // Edit button (admin mode)
            const editBtn = document.createElement('button');
            editBtn.className = 'slot-edit-btn';
            editBtn.textContent = '✎';
            editBtn.title = 'Editar slot';
            editBtn.dataset.scheduleId = entry.schedule_id;
            editBtn.dataset.raceId = entry.race_id;
            editBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              Schedule.openEditModal(entry);
            });
            stint.appendChild(editBtn);

          } else if (isBackup) {
            stint.className = 'stint-cell stint-backup';
          } else {
            stint.className = 'stint-cell stint-unavailable';
          }

          slotCell.appendChild(stint);
          driverRow.appendChild(slotCell);
        });

        body.appendChild(driverRow);
      });
    });

    grid.appendChild(body);
    wrapper.appendChild(grid);

    // Legend
    const legend = document.createElement('div');
    legend.className = 'schedule-legend';
    legend.innerHTML = `
      <div class="legend-item"><div class="legend-box stint-active-t1"></div><span>Stint ativo (Eq. 1)</span></div>
      <div class="legend-item"><div class="legend-box stint-active-t2"></div><span>Stint ativo (Eq. 2)</span></div>
      <div class="legend-item"><div class="legend-box stint-backup-l"></div><span>Backup</span></div>
      <div class="legend-item"><div class="legend-box stint-unavail-l"></div><span>Indisponível</span></div>
      <div class="legend-item"><span style="color:#3a3a6e">■</span><span>Noite (sim)</span></div>
      <div class="legend-item"><span style="color:#2196f3">—</span><span>Chuva</span></div>
    `;
    wrapper.appendChild(legend);
    container.appendChild(wrapper);
  }

  function buildHeaderRow(labelText, slots, cellBuilderFn, showIrating = true) {
    const row = document.createElement('div');
    row.className = 'grid-row';

    const label = document.createElement('div');
    label.className = 'grid-cell label';
    label.textContent = labelText;
    row.appendChild(label);

    if (showIrating) {
      const ir = document.createElement('div');
      ir.className = 'grid-cell irating';
      ir.textContent = 'iR';
      row.appendChild(ir);
    } else {
      const ir = document.createElement('div');
      ir.className = 'grid-cell irating';
      row.appendChild(ir);
    }

    slots.forEach(slot => {
      const cell = document.createElement('div');
      cell.className = 'grid-cell slot';
      const content = cellBuilderFn(slot);
      if (content) cell.appendChild(content);
      row.appendChild(cell);
    });

    return row;
  }

  function buildRainRow(slots) {
    const row = document.createElement('div');
    row.className = 'grid-row';

    const label = document.createElement('div');
    label.className = 'grid-cell label';
    label.textContent = 'Chuva';
    row.appendChild(label);

    const ir = document.createElement('div');
    ir.className = 'grid-cell irating';
    row.appendChild(ir);

    slots.forEach(slot => {
      const cell = document.createElement('div');
      cell.className = 'grid-cell slot';

      const pct = Number(slot.rain_pct) || 0;
      const ind = document.createElement('div');
      ind.className = 'rain-indicator';

      const pctEl = document.createElement('span');
      pctEl.className = `rain-pct ${pctClass(pct)}`;
      pctEl.textContent = pct + '%';

      const bar = document.createElement('div');
      bar.className = `rain-bar-cell ${rainClass(pct)}`;

      ind.appendChild(pctEl);
      ind.appendChild(bar);
      cell.appendChild(ind);
      row.appendChild(cell);
    });

    return row;
  }

  function renderDetailTable(container, teams, schedule, timeslots) {
    container.innerHTML = '';

    if (!schedule || schedule.length === 0) return;

    const sorted = [...timeslots].sort((a, b) => Number(a.slot_number) - Number(b.slot_number));
    const slotMap = {};
    sorted.forEach(s => { slotMap[s.slot_id] = s; });

    const table = document.createElement('table');
    table.className = 'detail-table';

    // Build column headers: Chuva, Entra, Sai + for each team: Piloto, Backup
    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    ['Chuva', 'Entra', 'Sai'].forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      hr.appendChild(th);
    });
    teams.forEach(team => {
      const th1 = document.createElement('th');
      th1.textContent = `${team.team_name} — Piloto`;
      hr.appendChild(th1);
      const th2 = document.createElement('th');
      th2.textContent = `${team.team_name} — Backup`;
      hr.appendChild(th2);
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    // Group schedule by slot
    const slotGroups = {};
    schedule.forEach(s => {
      if (!slotGroups[s.slot_id]) slotGroups[s.slot_id] = {};
      slotGroups[s.slot_id][s.team_id] = s;
    });

    sorted.forEach(slot => {
      const group = slotGroups[slot.slot_id] || {};
      const pct = Number(slot.rain_pct) || 0;
      const tr = document.createElement('tr');
      if (pct >= 20) tr.classList.add('rain-high');
      else if (pct >= 10) tr.classList.add('rain-mid');

      const tdChuva = document.createElement('td');
      tdChuva.className = pctClass(pct);
      tdChuva.textContent = pct + '%';

      const tdEntra = document.createElement('td');
      tdEntra.textContent = slot.local_start;

      const tdSai = document.createElement('td');
      tdSai.textContent = slot.local_end;

      tr.appendChild(tdChuva);
      tr.appendChild(tdEntra);
      tr.appendChild(tdSai);

      teams.forEach(team => {
        const entry = group[team.team_id];
        const tdP = document.createElement('td');
        tdP.textContent = entry ? (entry.driver_primary || '—') : '—';
        const tdB = document.createElement('td');
        tdB.textContent = entry ? (entry.driver_backup || '—') : '—';
        tr.appendChild(tdP);
        tr.appendChild(tdB);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    const wrap = document.createElement('div');
    wrap.className = 'detail-table-wrap';
    wrap.appendChild(table);
    container.appendChild(wrap);
  }

  // Edit modal (simple inline)
  let editModal = null;

  function openEditModal(entry) {
    if (!document.getElementById('admin-panel')?.classList.contains('unlocked')) return;

    if (editModal) editModal.remove();

    editModal = document.createElement('div');
    editModal.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:1000;
      display:flex;align-items:center;justify-content:center
    `;
    editModal.innerHTML = `
      <div style="background:#fff;border-radius:8px;padding:24px;min-width:340px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,0.2)">
        <h3 style="margin-bottom:16px;font-size:15px;">Editar Slot ${entry.local_start} – ${entry.local_end}</h3>
        <div class="form-group">
          <label>Piloto titular</label>
          <input id="edit-primary" type="text" value="${entry.driver_primary || ''}" />
        </div>
        <div class="form-group">
          <label>Backup</label>
          <input id="edit-backup" type="text" value="${entry.driver_backup || ''}" />
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
          <button class="btn btn-secondary" id="edit-cancel">Cancelar</button>
          <button class="btn btn-primary" id="edit-save">Salvar</button>
        </div>
      </div>
    `;
    document.body.appendChild(editModal);

    document.getElementById('edit-cancel').addEventListener('click', () => editModal.remove());
    document.getElementById('edit-save').addEventListener('click', async () => {
      const password = document.getElementById('admin-password')?.value || '';
      try {
        await API.updateSlot({
          schedule_id: entry.schedule_id,
          race_id: entry.race_id,
          driver_primary: document.getElementById('edit-primary').value,
          driver_backup: document.getElementById('edit-backup').value,
          password,
        });
        editModal.remove();
        window.loadSchedule && window.loadSchedule();
      } catch (err) {
        alert('Erro: ' + err.message);
      }
    });
  }

  function toBool(val) {
    return val === true || val === 'TRUE' || val === 'true';
  }

  return { renderGrid, renderDetailTable, openEditModal };
})();
