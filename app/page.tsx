import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";

export default async function Home() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.status !== "approved" || profile.disabled_at) redirect("/pending");
  redirect("/quotes");
}
