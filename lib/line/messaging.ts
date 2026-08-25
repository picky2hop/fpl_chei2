export type LineTextMessage = { type: "text"; text: string };
export type LineTextV2Message = {
  type: "textV2";
  text: string;
  substitution: Record<string, {
    type: "mention";
    mentionee: { type: "user"; userId: string };
  }>;
};
export type LineMessage = LineTextMessage | LineTextV2Message | {
  type: "flex";
  altText: string;
  contents: Record<string, unknown>;
};

export type ReplyToLineInput = {
  accessToken: string;
  replyToken: string;
  messages: LineMessage[];
  fetchImpl?: typeof fetch;
};

export type LineMessagingApiDiagnostic = {
  status: number;
  message?: string;
  details?: Array<{
    message?: string;
    property?: string;
  }>;
};

export class LineMessagingApiError extends Error {
  readonly diagnostic: LineMessagingApiDiagnostic;

  constructor(diagnostic: LineMessagingApiDiagnostic) {
    super(`LINE reply failed with status ${diagnostic.status}`);
    this.name = "LineMessagingApiError";
    this.diagnostic = diagnostic;
  }
}

function redactDiagnosticValue(value: string, sensitiveValues: string[]): string {
  return sensitiveValues.reduce(
    (redacted, sensitiveValue) => sensitiveValue ? redacted.split(sensitiveValue).join("[REDACTED]") : redacted,
    value,
  );
}

async function lineMessagingApiDiagnostic(
  response: Response,
  sensitiveValues: string[],
): Promise<LineMessagingApiDiagnostic> {
  const diagnostic: LineMessagingApiDiagnostic = { status: response.status };
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return diagnostic;
  }
  if (typeof body !== "object" || body === null) return diagnostic;

  const errorBody = body as { message?: unknown; details?: unknown };
  if (typeof errorBody.message === "string") {
    diagnostic.message = redactDiagnosticValue(errorBody.message, sensitiveValues);
  }
  if (Array.isArray(errorBody.details)) {
    const details = errorBody.details.flatMap((value) => {
      if (typeof value !== "object" || value === null) return [];
      const detail = value as { message?: unknown; property?: unknown };
      const safeDetail: { message?: string; property?: string } = {};
      if (typeof detail.message === "string") {
        safeDetail.message = redactDiagnosticValue(detail.message, sensitiveValues);
      }
      if (typeof detail.property === "string") {
        safeDetail.property = redactDiagnosticValue(detail.property, sensitiveValues);
      }
      return Object.keys(safeDetail).length > 0 ? [safeDetail] : [];
    });
    if (details.length > 0) diagnostic.details = details;
  }
  return diagnostic;
}

export async function replyToLine(input: ReplyToLineInput): Promise<Response> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${input.accessToken}`,
    },
    body: JSON.stringify({ replyToken: input.replyToken, messages: input.messages }),
  });

  if (!response.ok) {
    throw new LineMessagingApiError(await lineMessagingApiDiagnostic(response, [input.accessToken, input.replyToken]));
  }
  return response;
}
