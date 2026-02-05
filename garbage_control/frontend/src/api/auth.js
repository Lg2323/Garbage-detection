import http, { setAccessToken, clearAccessToken } from "./http";

export async function registerUser(payload) {
  console.info("[AUTH] register request", { username: payload?.username, email: payload?.email });
  try {
    const res = await http.post("/api/auth/register/", payload);
    console.info("[AUTH] register success", { username: payload?.username });
    return res.data;
  } catch (err) {
    console.error("[AUTH] register failed", { error: err.response?.data ?? err.message });
    throw err;
  }
}

export async function loginUser({ username, password }) {
  console.info("[AUTH] login request", { username });
  try {
    const res = await http.post("/api/auth/login/", { username, password });
    setAccessToken(res.data.access);
    console.info("[AUTH] login success", { username });
    return res.data;
  } catch (err) {
    console.error("[AUTH] login failed", { username, error: err.response?.data ?? err.message });
    throw err;
  }
}

export async function bootstrapAuth() {
  console.info("[AUTH] bootstrap start");
  try {
    const res = await http.post("/api/auth/refresh/");
    setAccessToken(res.data.access);
    console.info("[AUTH] bootstrap success");
    return res.data;
  } catch (err) {
    console.warn("[AUTH] bootstrap skipped", { error: err.response?.status ?? err.message });
    throw err;
  }
}

export async function getMe() {
  const res = await http.get("/api/auth/me/");
  console.info("[AUTH] me loaded", { role: res.data?.role, username: res.data?.username });
  return res.data;
}

export async function logoutUser() {
  console.info("[AUTH] logout request");
  try {
    await http.post("/api/auth/logout/");
    console.info("[AUTH] logout success");
  } catch (err) {
    console.error("[AUTH] logout failed", { error: err.response?.data ?? err.message });
    throw err;
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
