import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  email: string;
  nombre: string | null;
  apellido: string | null;
  celular: string | null;
  empresa: string | null;
  role: "vendedor" | "admin" | "super_admin";
  status: "pending_profile" | "pending_approval" | "approved" | "rejected";
  disabled_at: string | null;
};

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, nombre, apellido, celular, empresa, role, status, disabled_at")
    .eq("id", user.id)
    .single();

  return (profile as Profile) ?? null;
}

// Para usar en layouts server-side de rutas que requieren un usuario
// aprobado. Redirige según el estado real en vez de solo bloquear.
export async function requireApprovedUser(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.status !== "approved" || profile.disabled_at) redirect("/pending");
  return profile;
}

export async function requireRole(roles: Array<Profile["role"]>): Promise<Profile> {
  const profile = await requireApprovedUser();
  if (!roles.includes(profile.role)) redirect("/quotes");
  return profile;
}
