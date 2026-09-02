"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/service";
import { isMedife } from "@/lib/empresas";

// RF-31: un Admin de una empresa distinta de Medife solo puede ascender a
// Admin a usuarios de su propia empresa. Un Admin de Medife y el Super
// Admin no tienen esa restricción.
export async function promoteToAdminAction(userId: string) {
  const actor = await requireRole(["admin", "super_admin"]);
  const supabase = createServiceClient();

  if (actor.role === "admin" && !isMedife(actor.empresa_id)) {
    const { data: target } = await supabase.from("profiles").select("empresa_id").eq("id", userId).single();
    if (!target || target.empresa_id !== actor.empresa_id) {
      throw new Error("No tenés permiso para ascender a un usuario de otra empresa.");
    }
  }

  await supabase.from("profiles").update({ role: "admin" }).eq("id", userId).eq("status", "approved");
  await supabase
    .from("audit_log")
    .insert({ actor_id: actor.id, action: "role.promote", target_type: "profile", target_id: userId });
  revalidatePath("/admin/roles");
}
