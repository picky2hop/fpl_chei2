import { requireAdmin } from "@/lib/auth/guards";
import { runAdminFantasySync } from "@/lib/data/fantasy-admin";

export async function POST(): Promise<Response> {
  try {
    await requireAdmin();
    return Response.json(await runAdminFantasySync());
  } catch {
    return Response.json({ error: "ไม่สามารถซิงก์ Fantasy ได้" }, { status: 500 });
  }
}

export async function GET(): Promise<Response> {
  try {
    await requireAdmin();
    const repository = (await import("@/lib/data/fantasy-admin")).getFantasyAdminRepository();
    const season = await repository.getActiveSeason();
    const dashboard = await repository.getDashboard({ seasonId: season.id });
    return Response.json({ season, sync: dashboard.sync });
  } catch {
    return Response.json({ error: "ไม่สามารถโหลดสถานะ Fantasy sync ได้" }, { status: 500 });
  }
}
