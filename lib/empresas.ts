import { createServiceClient } from "@/lib/supabase/service";

export const MEDIFE_EMPRESA_ID = "00000000-0000-0000-0000-000000000001";

export type Empresa = { id: string; nombre: string; direccion: string };

export function isMedife(empresaId: string | null): boolean {
  return empresaId === MEDIFE_EMPRESA_ID;
}

// Medife primero, después el resto por orden alfabético.
export async function listEmpresas(): Promise<Empresa[]> {
  const supabase = createServiceClient();
  const { data } = await supabase.from("empresas").select("id, nombre, direccion").order("nombre");
  const rows = data ?? [];
  const medife = rows.filter((e) => e.id === MEDIFE_EMPRESA_ID);
  const resto = rows.filter((e) => e.id !== MEDIFE_EMPRESA_ID);
  return [...medife, ...resto];
}
