import http from "../api/http";

export async function reverseGeocodeLocation(lat, lon) {
  const res = await http.get("/api/requests/detect-city/", {
    params: { lat, lon },
  });
  return {
    city: (res.data?.city || "").trim(),
    address: (res.data?.address || "").trim(),
  };
}

export async function reverseGeocodeCity(lat, lon) {
  const location = await reverseGeocodeLocation(lat, lon);
  return location.city;
}
