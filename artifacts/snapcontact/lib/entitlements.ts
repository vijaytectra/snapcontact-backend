/** Future storefront-localized lifetime access boundary. No billing SDK or products
 * are configured. Currency/prices must eventually come from the device storefront,
 * never from the selected phone-number country or an IP address. */
export type Access = { allowed: true; source: 'free-release' };
export function getCaptureAccess(): Access {
  return { allowed: true, source: 'free-release' };
}
