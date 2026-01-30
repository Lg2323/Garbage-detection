import http, { setAccessToken, clearAccessToken } from "./http";

export async function registerUser(payload) {
  const res = await http.post("/api/auth/register/", payload);
  return res.data;
}

export async function loginUser({ username, password }) {
  const res = await http.post("/api/auth/login/", { username, password });
  setAccessToken(res.data.access);
  return res.data;
}

export async function bootstrapAuth() {
  const res = await http.post("/api/auth/refresh/");
  setAccessToken(res.data.access);
  return res.data;
}

export async function getMe() {
  const res = await http.get("/api/auth/me/");
  return res.data; 
}

export async function logoutUser() {
  try {
    await http.post("/api/auth/logout/");
  } finally {
    clearAccessToken();
  }
}

export async function requestPasswordReset(email) {
  const res = await http.post("/api/auth/password-reset/", { email });
  return res.data;
}

export async function confirmPasswordReset({ uid, token, newPassword }) {
  const res = await http.post("/api/auth/password-reset/confirm/", {
    uid,
    token,
    new_password: newPassword,
  });
  return res.data;
}
