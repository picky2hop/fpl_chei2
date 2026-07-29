import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import AdminPanel from "./admin-panel";

export default async function AdminPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/dashboard");
  }
  return <AdminPanel />;
}
