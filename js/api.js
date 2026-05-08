// ============================================================
// KRT Endurance — Módulo de API
// Substitua SCRIPT_URL pelo URL do seu Google Apps Script publicado
// ============================================================

const API = (() => {
  const SCRIPT_URL = window.KRT_CONFIG?.scriptUrl || '';

  async function get(action, params = {}) {
    if (!SCRIPT_URL) throw new Error('URL do script não configurado. Edite js/config.js');
    const url = new URL(SCRIPT_URL);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  async function post(body) {
    // Apps Script POST + redirect causa bloqueio de CORS no browser.
    // Solução: enviar o payload codificado como parâmetro GET, que retorna
    // com Access-Control-Allow-Origin: * sem redirect intermediário.
    if (!SCRIPT_URL) throw new Error('URL do script não configurado. Edite js/config.js');
    const url = new URL(SCRIPT_URL);
    url.searchParams.set('payload', JSON.stringify(body));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('Erro de rede: ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  return {
    getRaces: () => get('getRaces'),
    getRaceDetail: (raceId) => get('getRaceDetail', { race_id: raceId }),
    getDrivers: () => get('getDrivers'),
    getTeams: (raceId) => get('getTeams', { race_id: raceId }),
    getSchedule: (raceId) => get('getSchedule', { race_id: raceId }),
    getAvailability: (raceId) => get('getAvailability', { race_id: raceId }),

    submitAvailability: (data) => post({ action: 'submitAvailability', ...data }),
    assignTeams: (data) => post({ action: 'assignTeams', ...data }),
    autoSchedule: (data) => post({ action: 'autoSchedule', ...data }),
    updateSlot: (data) => post({ action: 'updateSlot', ...data }),
    createRace: (data) => post({ action: 'createRace', ...data }),
    createDriver: (data) => post({ action: 'createDriver', ...data }),
    updateDriver: (data) => post({ action: 'updateDriver', ...data }),
    selfRegisterDriver: (data) => post({ action: 'selfRegisterDriver', ...data }),
  };
})();
