import { DateTime } from "luxon";

// Deteksi apakah string valid datetime (contoh: 2025-10-17 21:41:00)
const isDateTimeString = (val) => {
  if (typeof val !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(val);
};

// Konversi waktu ke zona waktu server
const convertToServerTimezone = (datetime) => {
  try {
    const zone = process.env.SERVER_TIMEZONE || "Asia/Jakarta";
    return DateTime.fromSQL(datetime, { zone: "utc" })
      .setZone(zone)
      .toFormat("yyyy-MM-dd HH:mm:ss");
  } catch {
    return datetime;
  }
};

// Rekursif: ubah semua field yang berupa datetime di object/array
const deepConvertDates = (data) => {
  if (Array.isArray(data)) {
    return data.map((item) => deepConvertDates(item));
  } else if (typeof data === "object" && data !== null) {
    const result = {};
    for (const key of Object.keys(data)) {
      const value = data[key];
      if (isDateTimeString(value)) {
        result[key] = convertToServerTimezone(value);
      } else if (typeof value === "object") {
        result[key] = deepConvertDates(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
  return data;
};

// Middleware utama
export const timezoneMiddleware = (req, res, next) => {
  const oldJson = res.json.bind(res);

  res.json = (data) => {
    try {
      const converted = deepConvertDates(data);
      return oldJson(converted);
    } catch (err) {
      console.error("❌ Timezone conversion error:", err);
      return oldJson(data);
    }
  };

  next();
};
