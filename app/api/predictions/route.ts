import { createPredictionsHandler } from "@/lib/api/predictions-handler";
import { requireUser } from "@/lib/auth/guards";
import { listPredictions, savePrediction } from "@/lib/data/predictions";

export const GET = createPredictionsHandler({ requireUser, listPredictions, savePrediction });
export const POST = createPredictionsHandler({ requireUser, listPredictions, savePrediction });
export const PUT = createPredictionsHandler({ requireUser, listPredictions, savePrediction });
