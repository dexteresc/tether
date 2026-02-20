const config = {
  API_BASE_URL: import.meta.env.VITE_API_URL || "/api",
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321",
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
  LLM_SERVICE_URL: import.meta.env.VITE_LLM_SERVICE_URL || "http://localhost:8000",
};

export default config;
