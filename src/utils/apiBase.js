// backend/utils/apiBase.js
export const getApiBaseUrl = () => {
  const envUrl = process.env.API_BASE_URL;
  if (envUrl) return envUrl;

  const host = process.env.HOST || "localhost";
  const port = process.env.PORT || 4000;

  // kalau di production, pakai domain
  if (
    host.includes("ciptamuffler.com") ||
    host.includes("theciptagroup.co.id")
  ) {
    // return "https://api.theciptagroup.co.id";
    return "http://10.4.1.3:4500";
  }

  return `http://${host}:${port}`;
};
