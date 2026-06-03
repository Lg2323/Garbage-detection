import http from "./http";

export async function getAvailableRouteRequests(params = {}) {
  const res = await http.get("/api/routes/available-requests/", { params });
  return res.data;
}

export async function getRoutes(params = {}) {
  const res = await http.get("/api/routes/", { params });
  return res.data;
}

export async function getRoute(id) {
  const res = await http.get(`/api/routes/${id}/`);
  return res.data;
}

export async function createRoute(payload) {
  const res = await http.post("/api/routes/", payload);
  return res.data;
}

export async function assignRoute(id, payload) {
  const res = await http.post(`/api/routes/${id}/assign/`, payload);
  return res.data;
}

export async function startRoute(id) {
  const res = await http.post(`/api/routes/${id}/start/`);
  return res.data;
}

export async function completeRoute(id) {
  const res = await http.post(`/api/routes/${id}/complete/`);
  return res.data;
}

export async function cancelRoute(id) {
  const res = await http.post(`/api/routes/${id}/cancel/`);
  return res.data;
}

export async function rebuildRoadRoute(id) {
  const res = await http.post(`/api/routes/${id}/rebuild-road-route/`);
  return res.data;
}
