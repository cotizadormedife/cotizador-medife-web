import { listEmpresas } from "@/lib/empresas";
import RegisterForm from "./RegisterForm";

export default async function RegisterPage() {
  const empresas = await listEmpresas();
  return <RegisterForm empresas={empresas} />;
}
