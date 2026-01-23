import axios from "axios";

export const API_URL = "http://localhost:8000";

const http = axios.create({
  baseURL: API_URL,
  withCredentials: true, // чтобы refresh cookie ходил туда-сюда
});

let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function clearAccessToken() {
  accessToken = null;
}

http.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let isRefreshing = false;
let queue = [];

function processQueue(err, token = null) {
  queue.forEach(({ resolve, reject }) => (err ? reject(err) : resolve(token)));
  queue = [];
}

http.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (isRefreshing) {
        const token = await new Promise((resolve, reject) => queue.push({ resolve, reject }));
        original.headers.Authorization = `Bearer ${token}`;
        return http(original);
      }

      isRefreshing = true;
      try {
        const r = await axios.post(`${API_URL}/api/auth/refresh/`, null, { withCredentials: true });
        setAccessToken(r.data.access);
        processQueue(null, r.data.access);
        original.headers.Authorization = `Bearer ${r.data.access}`;
        return http(original);
      } catch (e) {
        processQueue(e, null);
        clearAccessToken();
        throw e;
      } finally {
        isRefreshing = false;
      }
    }

    throw error;
  }
);

export default http;
