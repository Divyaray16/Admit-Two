import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabase, supabaseAnonKey, supabaseUrl } from "./mode";

export const supabase: SupabaseClient | null = isSupabase ? createClient(supabaseUrl, supabaseAnonKey) : null;
