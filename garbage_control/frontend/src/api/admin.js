import http from "./http";

export const ADMIN_RESOURCE_PATHS = {
  users: "users",
  federalSubjects: "federal-subjects",
  municipalities: "municipalities",
  localities: "localities",
  organizationTypes: "organization-types",
  organizations: "organizations",
  departments: "departments",
  brigades: "brigades",
  territoryTypes: "territory-types",
  ownershipTypes: "ownership-types",
  responsibilityZones: "responsibility-zones",
};

function getResourcePath(resourceKey) {
  const path = ADMIN_RESOURCE_PATHS[resourceKey];
  if (!path) {
    throw new Error(`Unknown admin resource: ${resourceKey}`);
  }
  return path;
}

export async function listRequests(params = {}) {
  const res = await http.get("/api/requests/", { params });
  return res.data;
}

export async function getRequest(id) {
  const res = await http.get(`/api/requests/${id}/`);
  return res.data;
}

export async function listWorkers() {
  const res = await http.get("/api/auth/workers/");
  return res.data;
}

export async function assignWorker(requestId, workerId) {
  const res = await http.post(`/api/requests/${requestId}/assign_worker/`, {
    worker_id: workerId,
  });
  return res.data;
}

export async function classifyRequest(requestId, payload) {
  const res = await http.post(`/api/requests/${requestId}/classify/`, payload);
  return res.data;
}

export async function setRequestStatus(requestId, status) {
  const res = await http.post(`/api/requests/${requestId}/set_status/`, { status });
  return res.data;
}

export async function verifyRequest(requestId, payload = {}) {
  const res = await http.post(`/api/requests/${requestId}/verify/`, payload);
  return res.data;
}

export async function externalTransferRequest(requestId, payload) {
  const res = await http.post(`/api/requests/${requestId}/external-transfer/`, payload);
  return res.data;
}

export async function listUsers(q = "") {
  const res = await http.get("/api/admin/users/", { params: q ? { q } : {} });
  return res.data;
}

export async function createUser(payload) {
  const res = await http.post("/api/admin/users/", payload);
  return res.data;
}

export async function updateUser(id, payload) {
  const res = await http.patch(`/api/admin/users/${id}/`, payload);
  return res.data;
}

export async function deleteUser(id) {
  const res = await http.delete(`/api/admin/users/${id}/`);
  return res.data;
}

export async function adminStats() {
  const res = await http.get("/api/admin/stats/");
  return res.data;
}

export async function getAdminReferenceOptions() {
  const res = await http.get("/api/admin/reference-options/");
  return res.data;
}

export async function listAdminResource(resourceKey, params = {}) {
  const path = getResourcePath(resourceKey);
  const res = await http.get(`/api/admin/${path}/`, { params });
  return res.data;
}

export async function createAdminResource(resourceKey, payload) {
  const path = getResourcePath(resourceKey);
  const res = await http.post(`/api/admin/${path}/`, payload);
  return res.data;
}

export async function updateAdminResource(resourceKey, id, payload) {
  const path = getResourcePath(resourceKey);
  const res = await http.patch(`/api/admin/${path}/${id}/`, payload);
  return res.data;
}

export async function deleteAdminResource(resourceKey, id) {
  const path = getResourcePath(resourceKey);
  const res = await http.delete(`/api/admin/${path}/${id}/`);
  return res.data;
}
