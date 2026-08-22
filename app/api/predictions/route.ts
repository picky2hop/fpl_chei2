import { createPredictionsHandler } from "@/lib/api/predictions-handler";
import { requireUser } from "@/lib/auth/guards";
import { listPredictions, savePrediction, savePredictions } from "@/lib/data/predictions";

const handler = createPredictionsHandler({ requireUser, listPredictions, savePrediction, savePredictions });

export const GET = handler;
export const POST = handler;
export const PUT = handler;
