"use server";

import { requireApprovedUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { MEDIFE_EMPRESA_ID } from "@/lib/empresas";
import { logAction } from "@/lib/auditLog";

export type ChangePasswordState = { ok?: boolean; error?: string };

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const profile = await requireApprovedUser();
  const oldPassword = String(formData.get("oldPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!oldPassword || !newPassword) {
    return { error: "Completá los dos campos de contraseña." };
  }
  if (newPassword.length < 6) {
    return { error: "La nueva contraseña debe tener al menos 6 caracteres." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "La nueva contraseña y su repetición no coinciden." };
  }

  const supabase = await createClient();

  // Confirmamos que conoce la contraseña actual re-autenticando con ella
  // antes de permitir el cambio.
  const { error: verifyErr } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: oldPassword,
  });
  if (verifyErr) {
    return { error: "La contraseña actual no es correcta." };
  }

  const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
  if (updateErr) {
    return { error: updateErr.message };
  }

  return { ok: true };
}

export type UpdateProfileState = { ok?: boolean; error?: string; emailChangePending?: boolean };

// RF-59: cada usuario puede editar sus propios datos personales. El email
// pasa por el flujo estándar de Supabase (link de confirmación a la casilla
// nueva, misma pantalla que RF-22) — hasta que se confirma, se sigue
// iniciando sesión con el email anterior. La empresa solo es editable acá
// para el rol Vendedor: para Admin/Super Admin cambia su alcance de acceso
// (RF-31/RF-32), y eso sigue siendo exclusivo del Super Admin (RF-37).
export async function updateProfileAction(
  _prevState: UpdateProfileState,
  formData: FormData
): Promise<UpdateProfileState> {
  const profile = await requireApprovedUser();
  const email = String(formData.get("email") || "").trim();
  const nombre = String(formData.get("nombre") || "").trim();
  const apellido = String(formData.get("apellido") || "").trim();
  const celular = String(formData.get("celular") || "").trim();
  const empresaId = String(formData.get("empresa_id") || "").trim();

  if (!email || !nombre || !apellido || !celular) {
    return { error: "Completá todos los campos." };
  }

  const supabase = await createClient();
  const service = createServiceClient();

  const profileUpdate: Record<string, string> = { nombre, apellido, celular };
  if (profile.role === "vendedor" && empresaId && empresaId !== profile.empresa_id) {
    // T-A3: valida que sea una empresa real (no cualquier string) y evita que
    // un vendedor se autoasigne Medife, lo que ampliaría su alcance si más
    // adelante lo ascienden a Admin (RF-32). Cambiar a Medife sigue siendo
    // potestad exclusiva del Super Admin (RF-37).
    if (empresaId === MEDIFE_EMPRESA_ID) {
      return { error: "No podés autoasignarte la empresa Medife. Pedile a un Super Admin que lo haga." };
    }
    const { data: empresaExists } = await service.from("empresas").select("id").eq("id", empresaId).maybeSingle();
    if (!empresaExists) {
      return { error: "La empresa seleccionada no existe." };
    }
    profileUpdate.empresa_id = empresaId;
  }
  const { error: profileErr } = await service.from("profiles").update(profileUpdate).eq("id", profile.id);
  if (profileErr) {
    return { error: profileErr.message };
  }
  if (profileUpdate.empresa_id) {
    await logAction({ actorId: profile.id, action: "user.change_empresa", targetType: "profile", targetId: profile.id });
  }

  let emailChangePending = false;
  if (email !== profile.email) {
    const { error: emailErr } = await supabase.auth.updateUser({ email });
    if (emailErr) {
      return { error: emailErr.message };
    }
    emailChangePending = true;
  }

  return { ok: true, emailChangePending };
}
