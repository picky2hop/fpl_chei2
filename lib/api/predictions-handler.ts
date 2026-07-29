import { isPredictionChoice, type PredictionChoice } from "../domain/predictions.ts";

export type PredictionResponse = {
  fixtureId: string;
  choice: PredictionChoice;
  status: string;
};

export type PredictionsHandlerDependencies = {
  requireUser: () => Promise<{ id: string }>;
  savePrediction: (input: { userId: string; fixtureId: string; choice: PredictionChoice }) => Promise<PredictionResponse>;
  listPredictions: (input: { userId: string; gameweekId: string }) => Promise<PredictionResponse[]>;
};

function isValidId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 100;
}

export function createPredictionsHandler(dependencies: PredictionsHandlerDependencies) {
  return async function handler(request: Request): Promise<Response> {
    let user: { id: string };
    try {
      user = await dependencies.requireUser();
    } catch {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    if (request.method === "GET") {
      const gameweekId = new URL(request.url).searchParams.get("gameweekId");
      if (!isValidId(gameweekId)) return Response.json({ error: "gameweekId is required" }, { status: 400 });
      try {
        return Response.json({ gameweekId, predictions: await dependencies.listPredictions({ userId: user.id, gameweekId }) });
      } catch {
        return Response.json({ error: "Unable to load predictions" }, { status: 500 });
      }
    }

    if (request.method !== "PUT" && request.method !== "POST") {
      return new Response(null, { status: 405, headers: { allow: "GET, POST, PUT" } });
    }

    if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    if (
      typeof body !== "object" ||
      body === null ||
      !("fixtureId" in body) ||
      !("choice" in body) ||
      !isValidId(body.fixtureId) ||
      !isPredictionChoice(body.choice)
    ) {
      return Response.json({ error: "fixtureId and a valid choice are required" }, { status: 400 });
    }

    try {
      const prediction = await dependencies.savePrediction({ userId: user.id, fixtureId: body.fixtureId, choice: body.choice });
      return Response.json({ prediction });
    } catch (error) {
      const status = typeof error === "object" && error !== null && "status" in error && (error.status === 409 || error.status === 422)
        ? error.status
        : 500;
      return Response.json({ error: status === 409 ? "Prediction is locked" : "Unable to save prediction" }, { status });
    }
  };
}
