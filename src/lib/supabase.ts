import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isLive, supabaseAnonKey, supabaseUrl } from "./mode";

export const supabase: SupabaseClient | null = isLive
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
