export type LineTextMessage = { type: "text"; text: string };
export type LineMessage = LineTextMessage | {
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

  if (!response.ok) throw new Error(`LINE reply failed with status ${response.status}`);
  return response;
}
