import http from "./http";

export async function me() {
  const res = await http.get("/api/auth/me/");
  return res.data;
}

export async function getWorkers() {
  const res = await http.get("/api/auth/workers/");
  return res.data; 
}
