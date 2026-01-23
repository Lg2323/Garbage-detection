import http from "./http";

export async function getRequests() {
  const res = await http.get("/api/requests/");
  return res.data;
}

export async function createRequest({ title, latitude, longitude, beforePhoto }) {
  const form = new FormData();
  form.append("title", title);
  form.append("latitude", String(latitude));
  form.append("longitude", String(longitude));
  form.append("before_photo", beforePhoto);

  const res = await http.post("/api/requests/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}
