export function photoKeyFromFplPhoto(value: unknown): string | undefined {
  const filename = String(value ?? "").trim().split(/[\\/]/).pop() ?? "";
  const match = filename.match(/^(\d+)\.[a-z0-9]+$/i);
  return match?.[1];
}

export function buildFplPlayerPhotoUrl(photoKey: string | number): string {
  return `https://resources.premierleague.com/premierleague25/photos/players/110x140/${photoKey}.png`;
}
