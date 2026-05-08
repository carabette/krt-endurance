// ============================================================
// KRT Endurance — Google Apps Script Backend
// Publicar como Web App: Execute as Me, Access: Anyone
// ============================================================

const SHEET_ID = '1T1lvVHVnecuUcUOhfCZLmzNXlZDHlylAJ7T4ccVSD8w';

// Nomes das abas
const SHEETS = {
  RACES: 'races',
  TEAMS: 'teams',
  DRIVERS: 'drivers',
  TIMESLOTS: 'timeslots',
  AVAILABILITY: 'availability',
  TEAM_ASSIGNMENTS: 'team_assignments',
  SCHEDULE: 'schedule',
};

function getSpreadsheet() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function getSheet(name) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    // Fallback: busca case-insensitive em todas as abas (getSheetByName pode retornar null por cache)
    const allSheets = ss.getSheets();
    sheet = allSheets.find(s => s.getName().toLowerCase().trim() === name.toLowerCase().trim()) || null;
  }
  if (!sheet) {
    sheet = ss.insertSheet(name);
    initSheetHeaders(sheet, name);
  }
  return sheet;
}

function initSheetHeaders(sheet, name) {
  const headers = {
    races: ['race_id','race_name','race_date','local_start_time','sim_start_time','race_duration_hours','slot_duration_minutes','night_start_sim','night_end_sim','night_start_real','night_end_real','rain_threshold_pct','team_password','status'],
    teams: ['team_id','race_id','team_name','car_name','iracing_car_id','num_drivers','fuel_capacity_liters','default_avg_laptime_sec','default_avg_fuel_per_lap','stint_duration_minutes','pit_stop_seconds'],
    drivers: ['driver_id','name','iracing_cid','irating','cars_available','active'],
    timeslots: ['slot_id','race_id','slot_number','local_start','local_end','sim_start','sim_end','rain_pct','is_night_sim','is_night_real'],
    availability: ['availability_id','submitted_at','race_id','driver_name','available_from','available_to','ok_rain','ok_night_sim','ok_night_real','max_stint_minutes','min_rest_minutes','custom_avg_laptime_sec','custom_avg_fuel_per_lap','effective_stint_minutes'],
    team_assignments: ['race_id','team_id','team_name','driver_name','role','irating_at_assignment'],
    schedule: ['schedule_id','race_id','slot_id','team_id','team_name','slot_number','local_start','local_end','driver_primary','driver_backup','status'],
  };
  if (headers[name]) {
    sheet.appendRow(headers[name]);
    sheet.getRange(1, 1, 1, headers[name].length).setFontWeight('bold');
  }
}

// ============================================================
// Utilitários
// ============================================================

function generateUUID() {
  return Utilities.getUuid();
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      const v = row[i];
      // Google Sheets armazena time-only como Date com epoch 1899-12-30.
      // Converte para "HH:MM" usando timezone do script (São Paulo).
      if (v instanceof Date && v.getFullYear() < 1900) {
        obj[h] = String(v.getHours()).padStart(2, '0') + ':' + String(v.getMinutes()).padStart(2, '0');
      } else if (v instanceof Date) {
        obj[h] = v.toISOString();
      } else {
        obj[h] = v;
      }
    });
    return obj;
  });
}

function objectsToRows(objects, headers) {
  return objects.map(obj => headers.map(h => obj[h] !== undefined ? obj[h] : ''));
}

function ensureColumn(sheet, colName) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (!headers.includes(colName)) {
    const newCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, newCol).setValue(colName).setFontWeight('bold');
  }
}

function appendObject(sheet, obj) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(h => obj[h] !== undefined ? obj[h] : '');
  sheet.appendRow(row);
}

function cors(output) {
  return ContentService
    .createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const str = String(timeStr);
  const parts = str.split(':');
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  if (parts.length === 3) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  return 0;
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// ============================================================
// HTTP Handlers
// ============================================================

function doGet(e) {
  // Operações de escrita chegam via GET com payload JSON codificado
  // (contorna bloqueio de CORS em POST cross-origin com redirect)
  if (e.parameter.payload) {
    try {
      const body = JSON.parse(e.parameter.payload);
      return dispatchWrite(body);
    } catch (err) {
      return cors({ error: err.message });
    }
  }

  const action = e.parameter.action;
  const params = e.parameter;
  try {
    switch (action) {
      case 'getRaces':       return cors(getRaces());
      case 'getRaceDetail':  return cors(getRaceDetail(params.race_id));
      case 'getDrivers':     return cors(getDrivers());
      case 'getTeams':       return cors(getTeams(params.race_id));
      case 'getSchedule':    return cors(getSchedule(params.race_id));
      case 'getAvailability':return cors(getAvailability(params.race_id));
      case 'debug':          return cors({ sheets: SpreadsheetApp.openById(SHEET_ID).getSheets().map(s => s.getName()) });
      default:               return cors({ error: 'Ação não encontrada: ' + action });
    }
  } catch (err) {
    return cors({ error: err.message });
  }
}

function dispatchWrite(body) {
  const action = body.action;
  try {
    switch (action) {
      case 'submitAvailability': return cors(submitAvailability(body));
      case 'assignTeams':        return cors(assignTeams(body));
      case 'autoSchedule':       return cors(autoSchedule(body));
      case 'updateSlot':         return cors(updateSlot(body));
      case 'createRace':          return cors(createRace(body));
      case 'createDriver':        return cors(createDriver(body));
      case 'updateDriver':        return cors(updateDriver(body));
      case 'selfRegisterDriver':  return cors(selfRegisterDriver(body));
      default:                    return cors({ error: 'Ação não encontrada: ' + action });
    }
  } catch (err) {
    return cors({ error: err.message });
  }
}

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch(_) {
    return cors({ error: 'Payload inválido' });
  }
  const action = body.action;
  try {
    switch (action) {
      case 'submitAvailability': return cors(submitAvailability(body));
      case 'assignTeams':        return cors(assignTeams(body));
      case 'autoSchedule':       return cors(autoSchedule(body));
      case 'updateSlot':         return cors(updateSlot(body));
      case 'createRace':         return cors(createRace(body));
      case 'createDriver':       return cors(createDriver(body));
      case 'updateDriver':       return cors(updateDriver(body));
      case 'selfRegisterDriver': return cors(selfRegisterDriver(body));
      default:                   return cors({ error: 'Ação não encontrada: ' + action });
    }
  } catch (err) {
    return cors({ error: err.message });
  }
}

// ============================================================
// Leitura
// ============================================================

function getRaces() {
  return sheetToObjects(getSheet(SHEETS.RACES));
}

function getRaceDetail(raceId) {
  const races = sheetToObjects(getSheet(SHEETS.RACES));
  const race = races.find(r => r.race_id === raceId);
  if (!race) throw new Error('Corrida não encontrada');
  const timeslots = sheetToObjects(getSheet(SHEETS.TIMESLOTS)).filter(t => t.race_id === raceId);
  const teams = sheetToObjects(getSheet(SHEETS.TEAMS)).filter(t => t.race_id === raceId);
  return { race, timeslots, teams };
}

function getDrivers() {
  return sheetToObjects(getSheet(SHEETS.DRIVERS)).filter(d => d.active === true || d.active === 'TRUE' || d.active === true);
}

function getTeams(raceId) {
  return sheetToObjects(getSheet(SHEETS.TEAMS)).filter(t => t.race_id === raceId);
}

function getSchedule(raceId) {
  const schedule = sheetToObjects(getSheet(SHEETS.SCHEDULE)).filter(s => s.race_id === raceId);
  const assignments = sheetToObjects(getSheet(SHEETS.TEAM_ASSIGNMENTS)).filter(a => a.race_id === raceId);
  const availability = sheetToObjects(getSheet(SHEETS.AVAILABILITY)).filter(a => a.race_id === raceId);
  return { schedule, assignments, availability };
}

function getAvailability(raceId) {
  const availability = sheetToObjects(getSheet(SHEETS.AVAILABILITY)).filter(a => a.race_id === raceId);
  return { availability };
}

// ============================================================
// Criar Corrida
// ============================================================

function createRace(body) {
  verifyAdminPassword(body.password);

  const raceId = generateUUID();
  const race = {
    race_id: raceId,
    race_name: body.race_name,
    race_date: body.race_date,
    local_start_time: body.local_start_time,
    sim_start_time: body.sim_start_time,
    race_duration_hours: Number(body.race_duration_hours),
    slot_duration_minutes: Number(body.slot_duration_minutes),
    night_start_sim: body.night_start_sim || '',
    night_end_sim: body.night_end_sim || '',
    night_start_real: body.night_start_real || '',
    night_end_real: body.night_end_real || '',
    rain_threshold_pct: Number(body.rain_threshold_pct) || 10,
    team_password: body.team_password,
    status: 'open',
  };
  appendObject(getSheet(SHEETS.RACES), race);

  // Criar equipes
  const teamSheet = getSheet(SHEETS.TEAMS);
  (body.teams || []).forEach(team => {
    const fuelCap = Number(team.fuel_capacity_liters) || 0;
    const lapFuel = Number(team.default_avg_fuel_per_lap) || 1;
    const lapTime = Number(team.default_avg_laptime_sec) || 120;
    const stintMin = lapFuel > 0 ? Math.floor(fuelCap / lapFuel) * lapTime / 60 : 60;
    appendObject(teamSheet, {
      team_id: generateUUID(),
      race_id: raceId,
      team_name: team.team_name,
      car_name: team.car_name,
      iracing_car_id: team.iracing_car_id || '',
      num_drivers: Number(team.num_drivers) || 4,
      fuel_capacity_liters: fuelCap,
      default_avg_laptime_sec: lapTime,
      default_avg_fuel_per_lap: lapFuel,
      stint_duration_minutes: Math.round(stintMin),
      pit_stop_seconds: Number(team.pit_stop_seconds) || 90,
    });
  });

  // Gerar timeslots automaticamente
  generateTimeslots(raceId, race);

  return { success: true, race_id: raceId };
}

function generateTimeslots(raceId, race) {
  const sheet = getSheet(SHEETS.TIMESLOTS);
  const startLocal = timeToMinutes(race.local_start_time);
  const startSim = timeToMinutes(race.sim_start_time);
  const totalMinutes = Number(race.race_duration_hours) * 60;
  const slotDuration = Number(race.slot_duration_minutes);
  const rainThreshold = Number(race.rain_threshold_pct) || 10;

  const nightStartSim = timeToMinutes(race.night_start_sim);
  const nightEndSim = timeToMinutes(race.night_end_sim);
  const nightStartReal = timeToMinutes(race.night_start_real);
  const nightEndReal = timeToMinutes(race.night_end_real);

  const numSlots = Math.ceil(totalMinutes / slotDuration);

  for (let i = 0; i < numSlots; i++) {
    const localStart = (startLocal + i * slotDuration) % (24 * 60);
    const localEnd = (startLocal + (i + 1) * slotDuration) % (24 * 60);
    const simStart = (startSim + i * slotDuration) % (24 * 60);
    const simEnd = (startSim + (i + 1) * slotDuration) % (24 * 60);

    const isNightSim = isInNightWindow(simStart, nightStartSim, nightEndSim);
    const isNightReal = isInNightWindow(localStart, nightStartReal, nightEndReal);

    appendObject(sheet, {
      slot_id: generateUUID(),
      race_id: raceId,
      slot_number: i + 1,
      local_start: minutesToTime(localStart),
      local_end: minutesToTime(localEnd),
      sim_start: minutesToTime(simStart),
      sim_end: minutesToTime(simEnd),
      rain_pct: 0,
      is_night_sim: isNightSim,
      is_night_real: isNightReal,
    });
  }
}

function isInNightWindow(minuteOfDay, nightStart, nightEnd) {
  if (!nightStart && !nightEnd) return false;
  if (nightStart < nightEnd) {
    return minuteOfDay >= nightStart && minuteOfDay < nightEnd;
  }
  // Atravessa meia-noite
  return minuteOfDay >= nightStart || minuteOfDay < nightEnd;
}

// ============================================================
// Pilotos
// ============================================================

function createDriver(body) {
  verifyAdminPassword(body.password);
  appendObject(getSheet(SHEETS.DRIVERS), {
    driver_id: generateUUID(),
    name: body.name,
    iracing_cid: body.iracing_cid || '',
    irating: Number(body.irating) || 1500,
    cars_available: Array.isArray(body.cars_available) ? body.cars_available.join(',') : (body.cars_available || ''),
    active: true,
  });
  return { success: true };
}

function selfRegisterDriver(body) {
  // Piloto se auto-cadastra usando a senha da corrida (não admin)
  verifyRacePassword(body.race_id, body.password);
  const name = String(body.name || '').trim();
  if (!name) throw new Error('Nome obrigatório');

  const sheet = getSheet(SHEETS.DRIVERS);
  const existing = sheetToObjects(sheet);
  if (existing.find(d => d.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Piloto com esse nome já existe. Selecione seu nome na lista.');
  }

  appendObject(sheet, {
    driver_id: generateUUID(),
    name: name,
    iracing_cid: body.iracing_cid || '',
    irating: Number(body.irating) || 1500,
    cars_available: body.cars_available || '',
    active: true,
  });
  return { success: true, name };
}

function updateDriver(body) {
  verifyAdminPassword(body.password);
  const sheet = getSheet(SHEETS.DRIVERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('driver_id');
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] === body.driver_id) {
      Object.keys(body).forEach(key => {
        const col = headers.indexOf(key);
        if (col >= 0) sheet.getRange(i + 1, col + 1).setValue(body[key]);
      });
      return { success: true };
    }
  }
  throw new Error('Piloto não encontrado');
}

// ============================================================
// Disponibilidade
// ============================================================

function submitAvailability(body) {
  verifyRacePassword(body.race_id, body.password);

  const teams = sheetToObjects(getSheet(SHEETS.TEAMS)).filter(t => t.race_id === body.race_id);
  const teamObj = teams.find(t => t.team_id === body.team_id || t.team_name === body.team_name);
  const fuelCap = teamObj ? Number(teamObj.fuel_capacity_liters) : 0;
  const defaultStint = teamObj ? Number(teamObj.stint_duration_minutes) : 60;

  let effectiveStint = defaultStint;
  const customLap = Number(body.custom_avg_laptime_sec);
  const customFuel = Number(body.custom_avg_fuel_per_lap);
  if (customLap > 0 && customFuel > 0 && fuelCap > 0) {
    effectiveStint = Math.round(Math.floor(fuelCap / customFuel) * customLap / 60);
  }

  const availSheet = getSheet(SHEETS.AVAILABILITY);
  ensureColumn(availSheet, 'slot_from');
  ensureColumn(availSheet, 'slot_to');
  ensureColumn(availSheet, 'slots_csv');

  // Upsert: remove previous submissions by this driver for this race
  clearDriverAvailability(availSheet, body.race_id, body.driver_name);

  appendObject(availSheet, {
    availability_id: generateUUID(),
    submitted_at: new Date().toISOString(),
    race_id: body.race_id,
    driver_name: body.driver_name,
    available_from: body.available_from || '',
    available_to: body.available_to || '',
    ok_rain: body.ok_rain === true || body.ok_rain === 'true',
    ok_night_sim: body.ok_night_sim === true || body.ok_night_sim === 'true',
    ok_night_real: body.ok_night_real === true || body.ok_night_real === 'true',
    max_stint_minutes: Number(body.max_stint_minutes) || 120,
    min_rest_minutes: Number(body.min_rest_minutes) || 30,
    custom_avg_laptime_sec: customLap || '',
    custom_avg_fuel_per_lap: customFuel || '',
    effective_stint_minutes: effectiveStint,
    slot_from: Number(body.slot_from) || '',
    slot_to: Number(body.slot_to) || '',
    slots_csv: body.slots_csv || '',
  });
  return { success: true };
}

// ============================================================
// Algoritmo 1: Balanceamento de Equipes (Snake Draft)
// ============================================================

function assignTeams(body) {
  verifyRacePassword(body.race_id, body.password);

  const raceId = body.race_id;
  const drivers = getDrivers();
  const teams = sheetToObjects(getSheet(SHEETS.TEAMS)).filter(t => t.race_id === raceId);
  const availability = sheetToObjects(getSheet(SHEETS.AVAILABILITY)).filter(a => a.race_id === raceId);

  // Pilotos que submeteram disponibilidade para esta corrida
  const availableDriverNames = [...new Set(availability.map(a => a.driver_name))];
  const availableDrivers = drivers.filter(d => availableDriverNames.includes(d.name));

  // Para cada equipe, pilotos elegíveis = têm o carro (comparação case-insensitive)
  // Piloto sem carros cadastrados (cars_available vazio) é elegível para qualquer equipe
  const teamEligible = teams.map(team => {
    const carId = String(team.iracing_car_id || team.car_name || '').trim().toLowerCase();
    const eligible = availableDrivers.filter(d => {
      const rawCars = String(d.cars_available || '').trim();
      if (!rawCars) return true; // sem restrição de carro
      const cars = rawCars.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
      return carId === '' || cars.includes(carId);
    }).sort((a, b) => Number(b.irating) - Number(a.irating));
    return { team, eligible, assigned: [], iRatingSum: 0 };
  });

  // Snake draft: sempre aloca para a equipe com menor média de iRating
  const maxDriversPerTeam = Math.max(...teams.map(t => Number(t.num_drivers) || 4));
  const allAssigned = new Set();

  for (let round = 0; round < maxDriversPerTeam; round++) {
    // Ordena equipes por média iRating crescente (equipe mais fraca pega primeiro)
    teamEligible.sort((a, b) => {
      const avgA = a.assigned.length > 0 ? a.iRatingSum / a.assigned.length : 0;
      const avgB = b.assigned.length > 0 ? b.iRatingSum / b.assigned.length : 0;
      return avgA - avgB;
    });

    for (const te of teamEligible) {
      if (te.assigned.length >= (Number(te.team.num_drivers) || 4)) continue;
      const next = te.eligible.find(d => !allAssigned.has(d.name));
      if (next) {
        te.assigned.push(next);
        te.iRatingSum += Number(next.irating);
        allAssigned.add(next.name);
      }
    }
  }

  // Limpar alocações anteriores desta corrida
  const assignSheet = getSheet(SHEETS.TEAM_ASSIGNMENTS);
  clearRaceRows(assignSheet, raceId);

  // Gravar
  teamEligible.forEach(te => {
    te.assigned.forEach((driver, idx) => {
      appendObject(assignSheet, {
        race_id: raceId,
        team_id: te.team.team_id,
        team_name: te.team.team_name,
        driver_name: driver.name,
        role: idx === 0 ? 'primary' : 'reserve',
        irating_at_assignment: driver.irating,
      });
    });
  });

  const result = teamEligible.map(te => ({
    team: te.team.team_name,
    drivers: te.assigned.map(d => d.name),
    avg_irating: te.assigned.length > 0 ? Math.round(te.iRatingSum / te.assigned.length) : 0,
  }));

  return { success: true, assignments: result };
}

// ============================================================
// Algoritmo 2: Auto-Agendamento de Stints
// ============================================================

function autoSchedule(body) {
  verifyRacePassword(body.race_id, body.password);

  const raceId = body.race_id;
  const { race, timeslots, teams } = getRaceDetail(raceId);
  const availability = sheetToObjects(getSheet(SHEETS.AVAILABILITY)).filter(a => a.race_id === raceId);
  const assignments  = sheetToObjects(getSheet(SHEETS.TEAM_ASSIGNMENTS)).filter(a => a.race_id === raceId);

  const rainThreshold   = Number(race.rain_threshold_pct) || 10;
  const raceStartMin    = timeToMinutes(race.local_start_time);
  const raceDurationMin = Number(race.race_duration_hours) * 60;
  const slotDuration    = Number(race.slot_duration_minutes) || 60;

  const sortedSlots = timeslots.slice().sort((a, b) => Number(a.slot_number) - Number(b.slot_number));

  // Annotate each slot with absolute minutes from race start (0 = race start)
  sortedSlots.forEach((s, i) => {
    s._absStart = i * slotDuration;
    s._absEnd   = (i + 1) * slotDuration;
  });

  // Slot active at a given absolute minute from race start
  function slotAtAbs(absMin) {
    return sortedSlots.find(s => s._absStart <= absMin && s._absEnd > absMin) || null;
  }

  // Is driver available at a given absolute minute?
  function availAtAbs(name, absMin) {
    const slot = slotAtAbs(absMin);
    if (!slot) return false;
    const localMin = (raceStartMin + absMin) % (24 * 60);
    return isAvailableInSlot(name, slot, localMin, (localMin + slotDuration) % (24 * 60));
  }

  function conditionsAtAbs(name, absMin) {
    const slot = slotAtAbs(absMin);
    if (!slot) return false;
    const isRain = Number(slot.rain_pct) >= rainThreshold;
    return conditionsOk(name, slot, isRain);
  }

  // Absolute minute at which driver's availability ends
  function availEndAbs(name) {
    const av = getLatestAvailability(name, availability);
    if (!av) return 0;
    const csv = String(av.slots_csv || '').trim();
    if (csv) {
      const nums = csv.split(',').map(s => Number(s.trim())).filter(n => n > 0);
      if (nums.length) return Math.max(...nums) * slotDuration;
    }
    const toSlot = Number(av.slot_to);
    if (toSlot > 0) return toSlot * slotDuration;
    return raceDurationMin;
  }

  // Inner availability/conditions helpers (close over `availability`)
  function isAvailableInSlot(driverName, slot, slotStartMin, slotEndMin) {
    const avail = getLatestAvailability(driverName, availability);
    if (!avail) return false;
    const slotsCsv = String(avail.slots_csv || '').trim();
    if (slotsCsv) {
      const selected = slotsCsv.split(',').map(s => Number(s.trim())).filter(n => n > 0);
      return selected.includes(Number(slot.slot_number));
    }
    const fromSlot = Number(avail.slot_from) || 0;
    const toSlot   = Number(avail.slot_to)   || 0;
    if (fromSlot > 0 && toSlot > 0) {
      return Number(slot.slot_number) >= fromSlot && Number(slot.slot_number) <= toSlot;
    }
    const fromTime = String(avail.available_from || '').trim();
    const toTime   = String(avail.available_to   || '').trim();
    if (fromTime && toTime) {
      return timeRangeContains(timeToMinutes(fromTime), timeToMinutes(toTime), slotStartMin, slotEndMin);
    }
    return true;
  }

  function conditionsOk(driverName, slot, isRain) {
    const avail = getLatestAvailability(driverName, availability);
    if (!avail) return false;
    if (isRain && !toBool(avail.ok_rain)) return false;
    if (toBool(slot.is_night_sim)  && !toBool(avail.ok_night_sim))  return false;
    if (toBool(slot.is_night_real) && !toBool(avail.ok_night_real)) return false;
    return true;
  }

  const schedule = [];

  teams.forEach(team => {
    const pitStopMin  = (Number(team.pit_stop_seconds) || 90) / 60;
    const teamDrivers = assignments.filter(a => a.team_id === team.team_id).map(a => a.driver_name);

    if (!teamDrivers.length) {
      sortedSlots.forEach(slot => schedule.push(makeRow(raceId, team, slot, '', '')));
      return;
    }

    // Per-driver state: continuousMin tracks cumulative driving time in the current
    // continuous block. It resets to 0 only after minRest minutes of actual rest.
    const driverState = {};
    function ds(name) {
      if (!driverState[name]) driverState[name] = { totalMin: 0, continuousMin: 0, lastEndAbs: null, stintCount: 0 };
      return driverState[name];
    }

    // Compute effective continuous minutes at a given absolute time.
    // Returns 0 (fresh start) if the driver has rested long enough since their last stint.
    function effectiveCont(name, absMin) {
      const s = ds(name);
      if (s.lastEndAbs === null) return 0;
      const av = getLatestAvailability(name, availability);
      const minRest = Number(av?.min_rest_minutes) || 30;
      return (absMin - s.lastEndAbs) >= minRest ? 0 : s.continuousMin;
    }

    // A driver can start another stint only if their accumulated continuous time
    // plus the next fuel-based stint won't exceed their max_stint_minutes.
    // If it would, they need minRest minutes of rest first (which resets the counter).
    function canDriveAtAbs(name, absMin) {
      const av = getLatestAvailability(name, availability);
      if (!av) return false;
      const maxStint = Number(av.max_stint_minutes) || 120;
      const stintDur = calcStintDuration(av, team);
      return effectiveCont(name, absMin) + stintDur <= maxStint;
    }

    const target = raceDurationMin / teamDrivers.length;
    const stintTimeline = []; // { driver, backup, startAbs, endAbs }
    let curAbs = 0;
    let lastDriver = null; // track previous stint driver for continuity preference

    while (curAbs < raceDurationMin) {
      const eligible = teamDrivers.filter(name =>
        availAtAbs(name, curAbs) && conditionsAtAbs(name, curAbs) && canDriveAtAbs(name, curAbs)
      );

      if (!eligible.length) {
        curAbs += slotDuration; // no driver available — skip forward one slot
        continue;
      }

      // Continuity preference: keep the previous driver in the car if they're still
      // eligible AND they haven't done more than 1 stint ahead of the least-driven
      // eligible driver (stint-count fairness guard). Using stint count (not minutes)
      // works correctly from the start of the race when other drivers are at 0.
      const otherEligible = eligible.filter(n => n !== lastDriver);
      const minOtherStints = otherEligible.length > 0
        ? Math.min(...otherEligible.map(n => ds(n).stintCount))
        : Infinity;
      const canContinue = lastDriver !== null &&
        eligible.includes(lastDriver) &&
        ds(lastDriver).stintCount <= minOtherStints + 1;

      // Sort: continuity first (when fair), then urgency → equity → iRating.
      eligible.sort((a, b) => {
        if (canContinue) {
          if (a === lastDriver) return -1;
          if (b === lastDriver) return 1;
        }
        const aNeed = Math.max(0, target - ds(a).totalMin);
        const bNeed = Math.max(0, target - ds(b).totalMin);
        if (Math.abs(aNeed - bNeed) > 1) return bNeed - aNeed;
        if (ds(a).totalMin !== ds(b).totalMin) return ds(a).totalMin - ds(b).totalMin;
        return getDriverIRating(b, assignments) - getDriverIRating(a, assignments);
      });

      const driver   = eligible[0];
      lastDriver = driver;
      const av       = getLatestAvailability(driver, availability);
      const maxStint = Number(av?.max_stint_minutes) || 120;
      const eCont    = effectiveCont(driver, curAbs);
      // Cap stint to what's left before hitting the driver's max continuous time
      const stintDur = Math.min(calcStintDuration(av, team), maxStint - eCont);
      const endAbs   = Math.min(curAbs + stintDur, availEndAbs(driver), raceDurationMin);

      const backup = teamDrivers.find(n =>
        n !== driver && availAtAbs(n, curAbs) && conditionsAtAbs(n, curAbs)
      ) || '';

      stintTimeline.push({ driver, backup, startAbs: curAbs, endAbs });

      const s = ds(driver);
      s.continuousMin = eCont + (endAbs - curAbs); // accumulate (or fresh start if rested)
      s.totalMin     += endAbs - curAbs;
      s.lastEndAbs    = endAbs;
      s.stintCount   += 1;

      curAbs = endAbs + pitStopMin; // advance past pit stop
    }

    // Map stint timeline to grid: one schedule row per display slot.
    // Each slot shows the driver whose stint is active at that slot's start time
    // (or the one who starts earliest within the slot if no one starts before it).
    sortedSlots.forEach(slot => {
      const active =
        stintTimeline.find(s => s.startAbs <= slot._absStart && s.endAbs > slot._absStart) ||
        stintTimeline.find(s => s.startAbs > slot._absStart  && s.startAbs < slot._absEnd);

      if (!active) { schedule.push(makeRow(raceId, team, slot, '', '')); return; }

      const row = makeRow(raceId, team, slot, active.driver, active.backup);
      // Override with actual stint times (not slot boundary times)
      row.local_start = minutesToTime((raceStartMin + active.startAbs) % (24 * 60));
      row.local_end   = minutesToTime((raceStartMin + active.endAbs)   % (24 * 60));
      schedule.push(row);
    });
  });

  const scheduleSheet = getSheet(SHEETS.SCHEDULE);
  clearRaceRows(scheduleSheet, raceId);
  schedule.forEach(row => appendObject(scheduleSheet, row));

  return { success: true, slots_scheduled: schedule.length };
}

function makeRow(raceId, team, slot, driverPrimary, driverBackup) {
  return {
    schedule_id:    generateUUID(),
    race_id:        raceId,
    slot_id:        slot.slot_id,
    team_id:        team.team_id,
    team_name:      team.team_name,
    slot_number:    slot.slot_number,
    local_start:    slot.local_start,
    local_end:      slot.local_end,
    driver_primary: driverPrimary,
    driver_backup:  driverBackup,
    status:         'planned',
  };
}

function calcStintDuration(avail, team) {
  const customLap = Number(avail.custom_avg_laptime_sec);
  const customFuel = Number(avail.custom_avg_fuel_per_lap);
  const fuelCap = Number(team.fuel_capacity_liters);
  if (customLap > 0 && customFuel > 0 && fuelCap > 0) {
    return Math.round(Math.floor(fuelCap / customFuel) * customLap / 60);
  }
  return Number(team.stint_duration_minutes) || 60;
}

function getLatestAvailability(driverName, availabilities) {
  const entries = availabilities
    .filter(a => a.driver_name === driverName)
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  return entries[0] || null;
}

function getDriverIRating(driverName, assignments) {
  const a = assignments.find(x => x.driver_name === driverName);
  return a ? Number(a.irating_at_assignment) : 1500;
}

function timeRangeContains(fromMin, toMin, slotStart, slotEnd) {
  // Lida com ranges que cruzam meia-noite
  if (fromMin <= toMin) {
    return fromMin <= slotStart && toMin >= slotEnd;
  }
  // Atravessa meia-noite
  return slotStart >= fromMin || slotEnd <= toMin;
}

function toBool(val) {
  return val === true || val === 'TRUE' || val === 'true';
}

// ============================================================
// Atualização manual de slot
// ============================================================

function updateSlot(body) {
  verifyRacePassword(body.race_id, body.password);
  const sheet = getSheet(SHEETS.SCHEDULE);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('schedule_id');
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] === body.schedule_id) {
      const fields = ['driver_primary', 'driver_backup', 'status'];
      fields.forEach(f => {
        if (body[f] !== undefined) {
          const col = headers.indexOf(f);
          if (col >= 0) sheet.getRange(i + 1, col + 1).setValue(body[f]);
        }
      });
      const statusCol = headers.indexOf('status');
      if (statusCol >= 0) sheet.getRange(i + 1, statusCol + 1).setValue('manual');
      return { success: true };
    }
  }
  throw new Error('Slot não encontrado');
}

// ============================================================
// Helpers internos
// ============================================================

function verifyRacePassword(raceId, password) {
  // Admin password bypasses the team password check
  const props = PropertiesService.getScriptProperties();
  const adminPass = props.getProperty('ADMIN_PASSWORD') || 'krt2024';
  if (String(password) === String(adminPass)) return;
  const races = sheetToObjects(getSheet(SHEETS.RACES));
  const race = races.find(r => r.race_id === raceId);
  if (!race) throw new Error('Corrida não encontrada');
  if (String(race.team_password) !== String(password)) throw new Error('Senha incorreta');
}

function verifyAdminPassword(password) {
  const props = PropertiesService.getScriptProperties();
  const adminPass = props.getProperty('ADMIN_PASSWORD') || 'krt2024';
  if (String(password) !== String(adminPass)) throw new Error('Senha de admin incorreta');
}

function clearDriverAvailability(sheet, raceId, driverName) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return;
  const headers   = data[0];
  const raceIdx   = headers.indexOf('race_id');
  const driverIdx = headers.indexOf('driver_name');
  if (raceIdx < 0 || driverIdx < 0) return;
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][raceIdx]) === String(raceId) &&
        String(data[i][driverIdx]) === String(driverName)) {
      sheet.deleteRow(i + 1);
    }
  }
}

function clearRaceRows(sheet, raceId) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return;
  const headers = data[0];
  const raceIdx = headers.indexOf('race_id');
  if (raceIdx < 0) return;
  // Deletar de baixo para cima para não mudar índices
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][raceIdx]) === String(raceId)) {
      sheet.deleteRow(i + 1);
    }
  }
}
