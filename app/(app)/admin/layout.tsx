import { requireRole } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["admin", "super_admin"]);
  return <>{children}</>;
}
