import { listEmpresas } from "@/lib/empresas";
import EmpresasClient from "./EmpresasClient";

export default async function EmpresasPage() {
  const empresas = await listEmpresas();
  return (
    <div>
      <h1 style={{ fontSize: 22, margin: "0 0 16px" }}>Empresas / Equipos de Ventas / Brokers</h1>
      <EmpresasClient empresas={empresas} />
    </div>
  );
}
