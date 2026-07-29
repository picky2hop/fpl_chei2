import { createAdminParticipantHandler } from "@/lib/api/admin-participant-handler";
import { requireAdmin } from "@/lib/auth/guards";
import { setParticipantStatus } from "@/lib/data/admin";
import { listParticipantOptions } from "@/lib/data/admin-options";

const handler = createAdminParticipantHandler({ requireAdmin, setParticipantStatus, listOptions: listParticipantOptions });

export const GET = handler;
export const POST = handler;
