export function formatApiError(error, fallback = "Operation failed.") {
  const data = error?.response?.data;
  if (!data) {
    return error?.message || fallback;
  }

  if (typeof data === "string") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => String(item)).join("; ");
  }

  if (typeof data === "object") {
    const parts = Object.entries(data).flatMap(([field, value]) => {
      const messages = Array.isArray(value) ? value : [value];
      return messages
        .filter((message) => message !== null && message !== undefined && message !== "")
        .map((message) => {
          if (field === "non_field_errors" || field === "detail" || field === "error") {
            return String(message);
          }
          return `${field}: ${String(message)}`;
        });
    });

    if (parts.length) {
      return parts.join("; ");
    }
  }

  return fallback;
}
