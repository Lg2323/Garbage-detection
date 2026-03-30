import { useState } from "react";
import Notice from "../components/Notice";
import FileDropzone from "../components/FileDropzone";
import { createRequest } from "../api/requests";
import { reverseGeocodeLocation } from "../utils/geocoding";

const CITY_ACCURACY_LIMIT_METERS = 50000;

export default function CreateRequest() {
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [photo, setPhoto] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [detectingCity, setDetectingCity] = useState(false);

  const detectCity = () => {
    if (!navigator.geolocation) {
      setMsg({ type: "warning", text: "Геолокация не поддерживается браузером." });
      return;
    }
    setDetectingCity(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const accuracy = Number(position.coords.accuracy || 0);
          if (accuracy > CITY_ACCURACY_LIMIT_METERS) {
            setMsg({ type: "warning", text: "Геолокация неточная, город лучше проверить вручную." });
          }
          const location = await reverseGeocodeLocation(position.coords.latitude, position.coords.longitude);
          if (location.city || location.address) {
            setCity(location.city || "");
            setAddress(location.address || "");
            if (location.city && !location.address) {
              setMsg({
                type: "warning",
                text: "Город определён, но точный адрес не найден. Укажите адрес вручную.",
              });
            }
          } else {
            setMsg({ type: "warning", text: "Не удалось определить адрес и город автоматически." });
          }
        } catch {
          setMsg({ type: "warning", text: "Не удалось определить адрес и город автоматически." });
        } finally {
          setDetectingCity(false);
        }
      },
      () => {
        setDetectingCity(false);
        setMsg({ type: "warning", text: "Нет доступа к геолокации. Укажите адрес и город вручную." });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const submit = async () => {
    setMsg(null);

    if (!title.trim()) {
      setMsg({ type: "warning", text: "Введите описание заявки." });
      return;
    }
    if (!photo) {
      setMsg({ type: "warning", text: "Прикрепите фото." });
      return;
    }
    if (!navigator.geolocation) {
      setMsg({ type: "danger", text: "Геолокация не поддерживается браузером." });
      return;
    }

    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          let cityValue = city.trim();
          let addressValue = address.trim();
          if (!cityValue || !addressValue) {
            try {
              const location = await reverseGeocodeLocation(position.coords.latitude, position.coords.longitude);
              cityValue = cityValue || location.city;
              addressValue = addressValue || location.address;
            } catch {
              cityValue = cityValue || "";
              addressValue = addressValue || "";
            }
          }

          if (!addressValue) {
            setMsg({
              type: "warning",
              text: "Не удалось определить точный адрес автоматически. Укажите адрес вручную.",
            });
            setBusy(false);
            return;
          }

          await createRequest({
            title: title.trim(),
            address: addressValue,
            city: cityValue,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            beforePhoto: photo,
          });

          setMsg({ type: "success", text: "Заявка создана." });
          setTitle("");
          setAddress("");
          setCity("");
          setPhoto(null);
        } catch (error) {
          setMsg({
            type: "danger",
            text: "Ошибка отправки: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message),
          });
        } finally {
          setBusy(false);
        }
      },
      (error) => {
        setBusy(false);
        setMsg({ type: "danger", text: "Геолокация недоступна: " + error.message });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="gc-card gc-card--soft gc-anim gc-anim--up p-4">
      <div className="mb-3">
        <h4 className="mb-1">Новая заявка</h4>
          <div className="gc-muted">Опишите проблему, укажите адрес и приложите фото.</div>
      </div>

      <Notice type={msg?.type} text={msg?.text} onClose={() => setMsg(null)} />

      <div className="mb-3">
        <label className="form-label gc-muted">Описание</label>
        <input className="form-control" placeholder="Например: мусор рядом с контейнерной площадкой" value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>

      <div className="mb-3">
        <label className="form-label gc-muted">Адрес</label>
        <input className="form-control" placeholder="Например: ул. Ленина, 10" value={address} onChange={(event) => setAddress(event.target.value)} />
      </div>

      <div className="mb-3">
        <label className="form-label gc-muted">Город</label>
        <div className="d-flex gap-2">
          <input className="form-control" placeholder="Например: Москва" value={city} onChange={(event) => setCity(event.target.value)} />
          <button className="btn btn-outline-secondary" type="button" onClick={detectCity} disabled={detectingCity}>
            {detectingCity ? "..." : "Определить"}
          </button>
        </div>
      </div>

      <div className="mb-3">
        <FileDropzone label="Фото" file={photo} onChange={setPhoto} />
      </div>

      <button className="btn btn-primary" onClick={submit} disabled={busy}>
        {busy ? "Отправляю..." : "Отправить"}
      </button>
    </div>
  );
}
