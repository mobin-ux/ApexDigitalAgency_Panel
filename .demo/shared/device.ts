/**
 * "Mac · Chrome" from a user-agent string, for Settings › Signed-in devices.
 * Deliberately coarse: the browser family and the platform are what a person
 * recognises as "my laptop", and versions only make two rows look different
 * when they are the same machine.
 */
export type DeviceKind = 'phone' | 'tablet' | 'laptop' | 'desktop'

export function describeDevice(ua: string | null | undefined): { name: string, kind: DeviceKind } {
  const s = ua ?? ''
  const os = /iPad/.test(s)
    ? 'iPad'
    : /iPhone/.test(s)
      ? 'iPhone'
      : /Android/.test(s)
        ? 'Android'
        : /Mac OS X|Macintosh/.test(s)
          ? 'Mac'
          : /Windows/.test(s)
            ? 'Windows'
            : /CrOS/.test(s) ? 'Chromebook' : /Linux/.test(s) ? 'Linux' : ''
  const browser = /Edg\//.test(s)
    ? 'Edge'
    : /OPR\//.test(s)
      ? 'Opera'
      : /Firefox\//.test(s)
        ? 'Firefox'
        : /Chrome\/|CriOS\//.test(s)
          ? 'Chrome'
          : /Safari\//.test(s) ? 'Safari' : ''
  const kind: DeviceKind = os === 'iPad' || (/Android/.test(s) && !/Mobile/.test(s))
    ? 'tablet'
    : os === 'iPhone' || os === 'Android'
      ? 'phone'
      : os === 'Mac' || os === 'Chromebook' ? 'laptop' : 'desktop'
  const name = [os, browser].filter(Boolean).join(' · ') || 'Unknown browser'
  return { name, kind }
}
