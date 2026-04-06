import { useEffect, useMemo, useState } from "react";
import { createRequest, getRequests } from "../api/requests";
import Notice from "../components/Notice";
import Pagination from "../components/Pagination";
import RequestFiltersPanel from "../components/requests/RequestFiltersPanel";
import RequestsHeader from "../components/requests/RequestsHeader";
import RequestsTable from "../components/requests/RequestsTable";
import RequestCreateModal from "../components/requests/RequestCreateModal";
import useDebouncedValue from "../hooks/useDebouncedValue";
import { reverseGeocodeLocation } from "../utils/geocoding";
import { buildRequestQuery, createRequestFilters } from "../utils/requestFilters";

const PAGE_SIZE = 8;
const CITY_ACCURACY_LIMIT_METERS = 50000;

export default function RequestsList() {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [detectingCity, setDetectingCity] = useState(false);
  const [formMsg, setFormMsg] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState(() => createRequestFilters());
  const debouncedFilters = useDebouncedValue(filters);

  const detectCity = () => {
    if (!navigator.geolocation) {
      setFormMsg({ type: "warning", text: "Геолокация не поддерживается браузером." });
      return;
    }
    setDetectingCity(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const accuracy = Number(position.coords.accuracy || 0);
          if (accuracy > CITY_ACCURACY_LIMIT_METERS) {
            setFormMsg({ type: "warning", text: "Геолокация неточная, проверьте город вручную." });
          }
          const location = await reverseGeocodeLocation(position.coords.latitude, position.coords.longitude);
          if (location.city || location.address) {
            setCity(location.city || "");
            setAddress(location.address || "");
            if (location.city && !location.address) {
              setFormMsg({
                type: "warning",
                text: "Город определён, но точный адрес не найден. Укажите адрес вручную.",
              });
            }
          } else {
            setFormMsg({ type: "warning", text: "Не удалось определить адрес и город автоматически." });
          }
        } catch {
          setFormMsg({ type: "warning", text: "Не удалось определить адрес и город автоматически." });
        } finally {
          setDetectingCity(false);
        }
      },
      () => {
        setDetectingCity(false);
        setFormMsg({ type: "warning", text: "Нет доступа к геолокации. Укажите адрес и город вручную." });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const loadRequests = async (nextFilters = filters) => {
    setLoading(true);
    try {
      const data = await getRequests(buildRequestQuery(nextFilters));
      setItems(Array.isArray(data) ? data : data?.data ?? []);
    } catch (error) {
      setMsg("Ошибка: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadRequests(debouncedFilters);
  }, [debouncedFilters]);

  useEffect(() => {
    setPage(1);
  }, [items.length]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page]);

  const hasActive = useMemo(
    () => items.some((request) => !["COMPLETED", "TRANSFERRED"].includes(request.status)),
    [items]
  );

  const updateFilter = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const resetFilters = () => {
    setFilters(createRequestFilters());
    setPage(1);
  };

  const submit = async () => {
    setFormMsg(null);

    if (!title.trim()) {
      setFormMsg({ type: "warning", text: "Введите описание." });
      return;
    }
    if (!photo) {
      setFormMsg({ type: "warning", text: "Прикрепите фото." });
      return;
    }
    if (!navigator.geolocation) {
      setFormMsg({ type: "danger", text: "Геолокация не поддерживается браузером." });
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
            setFormMsg({
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

          setFormMsg({ type: "success", text: "Заявка создана." });
          setTitle("");
          setAddress("");
          setCity("");
          setPhoto(null);
          await loadRequests(filters);
        } catch (error) {
          setFormMsg({
            type: "danger",
            text: "Ошибка отправки: " + (error.response?.data ? JSON.stringify(error.response.data) : error.message),
          });
        } finally {
          setBusy(false);
        }
      },
      (error) => {
        setBusy(false);
        setFormMsg({ type: "danger", text: "Геолокация недоступна: " + error.message });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="gc-card gc-card--soft gc-anim gc-anim--up p-4">
      <RequestsHeader hasActive={hasActive} total={items.length} onCreate={() => setOpen(true)} />

      <RequestFiltersPanel
        value={filters}
        onChange={updateFilter}
        onReset={resetFilters}
        loading={loading}
        searchPlaceholder="Поиск по id, названию, адресу или городу"
      />

      {msg && <Notice type="danger" text={msg} onClose={() => setMsg("")} />}

      <RequestsTable items={pagedItems} />

      <Pagination page={page} pageSize={PAGE_SIZE} total={items.length} onPageChange={setPage} />

      <RequestCreateModal
        open={open}
        title={title}
        address={address}
        city={city}
        photo={photo}
        busy={busy}
        detectingCity={detectingCity}
        message={formMsg}
        onClose={() => setOpen(false)}
        onMessageClose={() => setFormMsg(null)}
        onTitleChange={setTitle}
        onAddressChange={setAddress}
        onCityChange={setCity}
        onDetectCity={detectCity}
        onPhotoChange={setPhoto}
        onSubmit={submit}
      />
    </div>
  );
}
