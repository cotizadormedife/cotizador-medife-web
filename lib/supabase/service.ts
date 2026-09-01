import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente con service_role — bypassa RLS. Server-only: nunca importar desde
// un componente cliente ni exponer SUPABASE_SERVICE_ROLE_KEY como NEXT_PUBLIC_.
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
