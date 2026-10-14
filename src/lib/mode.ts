const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";

export const isLive = Boolean(url && key);

export const supabaseUrl = url;
export const supabaseAnonKey = key;
