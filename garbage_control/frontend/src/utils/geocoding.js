import http from "../api/http";

export async function reverseGeocodeCity(lat, lon) {
  const res = await http.get("/api/requests/detect-city/", {
    params: { lat, lon },
  });
  return (res.data?.city || "").trim();
}
