import env from '#start/env'

/**
 * Returns the public R2 URL for a file key when R2_PUBLIC_URL and R2_BUCKET are set.
 * Use this for returned/stored URLs so the app can play audio and display images
 * (the S3 driver's getUrl() returns the internal cloudflarestorage.com endpoint).
 */
export function getPublicFileUrl(key: string): string | null {
  const base = env.get('R2_PUBLIC_URL')
  const bucket = env.get('R2_BUCKET')
  if (!base || !bucket) return null
  const baseTrimmed = base.replace(/\/+$/, '')
  return `${baseTrimmed}/${bucket}/${key}`
}
