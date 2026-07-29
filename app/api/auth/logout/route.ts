import { deleteSession } from "@/lib/auth/session";

export async function POST(): Promise<Response> {
  await deleteSession();
  return new Response(null, { status: 204 });
}
