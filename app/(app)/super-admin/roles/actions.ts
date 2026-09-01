"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/service";

export async function promoteToAdminAction(userId: string) {
  const actor = await requireRole(["super_admin"]);
  const supabase = createServiceClient();
  await supabase.from("profiles").update({ role: "admin" }).eq("id", userId).eq("status", "approved");
  await supabase
    .from("audit_log")
    .insert({ actor_id: actor.id, action: "role.promote", target_type: "profile", target_id: userId });
  revalidatePath("/super-admin/roles");
}
