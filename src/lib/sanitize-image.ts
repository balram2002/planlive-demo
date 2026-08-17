/** Only ever accept images we hosted ourselves (ImageKit or local /uploads). */
export function sanitizeImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (/^\/uploads\/[a-z0-9_-]+\.(jpg|png|webp)$/i.test(value)) return value;
  if (/^https:\/\/ik\.imagekit\.io\/[^\s"'<>]+$/i.test(value)) return value;
  return null;
}
