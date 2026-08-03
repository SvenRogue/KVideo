/**
 * Guard for server-side outbound fetches.
 * Blocks private/reserved networks and non-http(s) schemes so proxy-style
 * routes cannot be turned into internal network scanners.
 * ponytail: DNS names that resolve to private IPs after the check are not
 * covered (that needs a resolver); this blocks IP-literal and local-name SSRF.
 */

const PRIVATE_IPV4_RANGES: ReadonlyArray<readonly [string, string]> = [
  ['0.0.0.0', '0.255.255.255'],
  ['10.0.0.0', '10.255.255.255'],
  ['100.64.0.0', '100.127.255.255'],
  ['127.0.0.0', '127.255.255.255'],
  ['169.254.0.0', '169.254.255.255'],
  ['172.16.0.0', '172.31.255.255'],
  ['192.168.0.0', '192.168.255.255'],
  ['198.18.0.0', '198.19.255.255'],
  ['224.0.0.0', '255.255.255.255'],
];

function ipv4ToNumber(parts: readonly number[]): number {
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const value = ipv4ToNumber(parts);
  return PRIVATE_IPV4_RANGES.some(([start, end]) => {
    return value >= ipv4ToNumber(start.split('.').map(Number)) &&
      value <= ipv4ToNumber(end.split('.').map(Number));
  });
}

function isBlockedIpv6(hostname: string): boolean {
  const lower = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('::ffff:')) {
    return isPrivateIpv4(lower.slice(7));
  }
  // Unique local (fc00::/7), link-local (fe80::/10) and unspecified prefixes.
  return lower.startsWith('fc') || lower.startsWith('fd') ||
    lower.startsWith('fe8') || lower.startsWith('fe9') ||
    lower.startsWith('fea') || lower.startsWith('feb') || lower.startsWith('::');
}

export function isBlockedTargetUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return true;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;

  const hostname = parsed.hostname;
  if (!hostname) return true;

  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower.endsWith('.lan')
  ) {
    return true;
  }

  return lower.includes(':') ? isBlockedIpv6(lower) : isPrivateIpv4(lower);
}
