import type { Session } from '../../services/api/workspace-service.js';

const courseRoutes = [
  '/ingestion',
  '/graph',
  '/retrieval',
  '/fuzzy',
  '/evolutionary',
  '/swarm',
  '/hybrid',
  '/explainability',
  '/benchmarks',
];

export function isCourseLab(pathname: string): boolean {
  return courseRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function requiresSession(
  pathname: string,
  mode: 'api' | 'mock',
): boolean {
  // Product workspaces always use the backend, including in demo mode.
  // Learning lab gates its selected API panel so reference material stays open.
  return (
    pathname === '/' ||
    pathname === '/workspaces' ||
    pathname === '/hospital' ||
    pathname.startsWith('/hospital/') ||
    (mode === 'api' && isCourseLab(pathname))
  );
}

export function hasCourseAccess(session: Session | null): boolean {
  return Boolean(
    session?.local_mode ||
    (session?.authenticated && session.actor?.workspaces.includes('course')),
  );
}
