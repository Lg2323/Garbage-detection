import http from "./http";

export async function getRequests() {
  const res = await http.get("/api/requests/");
  return res.data;
}

export async function getCompletedRequests() {
  const res = await http.get("/api/requests/completed/");
  return res.data;
}

export async function getCityStats(city) {
  const params = city ? { city } : undefined;
  const res = await http.get("/api/requests/stats/", { params });
  return res.data;
}

export async function getRequest(id) {
  const res = await http.get(`/api/requests/${id}/`);
  return res.data;
}

export async function createRequest({ title, latitude, longitude, beforePhoto }) {
  const form = new FormData();
  form.append("title", title);
  form.append("latitude", latitude);
  form.append("longitude", longitude);
  form.append("before_photo", beforePhoto);

  const res = await http.post("/api/requests/", form);
  return res.data;
}

export async function assignWorker(id, worker_id) {
  const res = await http.post(`/api/requests/${id}/assign_worker/`, { worker_id });
  return res.data;
}

export async function takeInWork(id) {
  const res = await http.post(`/api/requests/${id}/take_in_work/`);
  return res.data;
}

export async function uploadAfterPhoto(id, afterPhoto) {
  const form = new FormData();
  form.append("after_photo", afterPhoto);
  const res = await http.post(`/api/requests/${id}/upload_after_photo/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function returnToWork(id, payload) {
  const res = await http.post(`/api/requests/${id}/return_to_work/`, payload);
  return res.data;
}
