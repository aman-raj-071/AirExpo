const routePaths = new Set(['/api/routes', '/api/route-geocode', '/api/route-air-quality']);
export function normalizeRoutePath(path) {
  const candidate = typeof path === 'string' ? path.replace(/^\/api\/cloud/, '') : path;
  return routePaths.has(candidate) ? candidate : path;
}
