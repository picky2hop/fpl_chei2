export function hasAvatarImage(avatarUrl: string | null | undefined): boolean {
  return Boolean(avatarUrl?.trim());
}
