import { requireUser } from "@/lib/auth/guards";
import { getDashboardData } from "@/lib/data/dashboard";

export async function GET(): Promise<Response> {
  try {
    const user = await requireUser();
    return Response.json(await getDashboardData(user.id));
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && (error.status === 401 || error.status === 403) ? error.status : 500;
    return Response.json({ error: status === 401 ? "Authentication required" : status === 403 ? "Forbidden" : "Unable to load dashboard" }, { status });
  }
}
