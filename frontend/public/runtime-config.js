// Bu dosya Docker container açılırken `API_BASE` env'iyle override edilir.
// Yerel `npm start` için varsayılan `/api/v1` yeterlidir (proxy dev sunucusu kullanılır).
window.__APP_CONFIG__ = window.__APP_CONFIG__ || { apiBase: '/api/v1' };
