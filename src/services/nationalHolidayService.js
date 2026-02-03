// backend/src/services/nationalHolidayService.js
import axios from "axios";
import { dbHelpers } from "../config/database.js";

// API hari libur
// https://api-harilibur.vercel.app/api
const HOLIDAY_API_URL = "https://libur.deno.dev/api";

/**
 * Fetch national holidays from API and cache in database
 */
export const fetchAndCacheHolidays = async (
  year = new Date().getFullYear(),
) => {
  try {
    console.log(`📅 Fetching national holidays for year ${year}...`);

    // Fetch from API
    const response = await axios.get(`${HOLIDAY_API_URL}?year=${year}`, {
      timeout: 10000, // 10 second timeout
    });

    if (!response.data || !Array.isArray(response.data)) {
      console.error("❌ API Response:", response.data);
      throw new Error("Invalid API response format");
    }

    const holidays = response.data;
    console.log(`✅ Fetched ${holidays.length} holidays from API`);

    // Clear existing cache for this year
    await dbHelpers.execute(
      "DELETE FROM national_holidays_cache WHERE year = ?",
      [year],
    );

    // Insert new data
    for (const holiday of holidays) {
      await dbHelpers.execute(
        `INSERT INTO national_holidays_cache 
         (year, date, name, is_national_holiday, is_cuti_bersama, fetched_at) 
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [
          year,
          holiday.date, // Fixed mapping
          holiday.name, // Fixed mapping
          !(holiday.name || "").toLowerCase().includes("cuti bersama"), // Infer national holiday
          (holiday.name || "").toLowerCase().includes("cuti bersama"), // Infer cuti bersama
        ],
      );
    }

    console.log(`✅ Cached ${holidays.length} holidays in database`);
    return holidays;
  } catch (error) {
    console.error("❌ Error fetching holidays from API:", error.message);

    // Fallback to cached data
    console.log("⚠️ Falling back to cached data...");
    const cached = await getCachedHolidays(year);

    if (cached.length === 0) {
      throw new Error("No cached data available and API fetch failed");
    }

    return cached;
  }
};

/**
 * Get cached holidays from database
 */
export const getCachedHolidays = async (year = new Date().getFullYear()) => {
  try {
    const holidays = await dbHelpers.query(
      `SELECT 
        id,
        year,
        date,
        name,
        is_national_holiday,
        is_cuti_bersama,
        fetched_at
       FROM national_holidays_cache 
       WHERE year = ?
       ORDER BY date ASC`,
      [year],
    );

    return holidays.map((h) => ({
      holiday_date: h.date,
      holiday_name: h.name,
      is_national_holiday: h.is_national_holiday,
      is_cuti_bersama: h.is_cuti_bersama,
    }));
  } catch (error) {
    console.error("❌ Error getting cached holidays:", error);
    return [];
  }
};

/**
 * Get holidays with auto-refresh if cache is old
 */
export const getHolidays = async (year = new Date().getFullYear()) => {
  try {
    // Check if we have recent cache (less than 30 days old)
    const cacheCheck = await dbHelpers.queryOne(
      `SELECT MAX(fetched_at) as last_fetch 
       FROM national_holidays_cache 
       WHERE year = ?`,
      [year],
    );

    const lastFetch = cacheCheck?.last_fetch;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (!lastFetch || new Date(lastFetch) < thirtyDaysAgo) {
      console.log("🔄 Cache is old or missing, refreshing...");
      return await fetchAndCacheHolidays(year);
    }

    // Return cached data
    return await getCachedHolidays(year);
  } catch (error) {
    console.error("❌ Error in getHolidays:", error);
    return [];
  }
};

export default {
  fetchAndCacheHolidays,
  getCachedHolidays,
  getHolidays,
};
