const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";

/** When both are set, invitations are stored in Supabase instead of the app server. */
export const isSupabase = Boolean(url && key);

/** Share links are public: the app server by default, or Supabase when configured. */
export const isLive = true;

export const supabaseUrl = url;
export const supabaseAnonKey = key;
