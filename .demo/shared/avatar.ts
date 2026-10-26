/**
 * Profile photos (Settings › Profile). `User.avatar` holds the URL the photo
 * is served from, versioned by the file id so a new photo is a new URL and the
 * old one can be cached for good. Older rows hold Tairo demo paths
 * (`/img/avatars/…`, one of which never existed), so a value only counts as a
 * photo when it has this exact shape; anything else shows initials.
 */
const PHOTO = /^\/api\/avatars\/[0-9a-f-]{36}\?v=[0-9a-f]{8}$/i

export function avatarUrl(userId: string, fileId: string): string {
  return `/api/avatars/${userId}?v=${fileId.slice(0, 8)}`
}

/** The photo URL, or null when the account has no photo of its own. */
export function avatarPhoto(avatar: string | null | undefined): string | null {
  return avatar && PHOTO.test(avatar) ? avatar : null
}

/** Image types a browser can show in an `<img>`; HEIC and PSD are uploads, not photos. */
export const AVATAR_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024
export const AVATAR_MIN_PX = 200
