import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasCourseAccess,
  isCourseLab,
  requiresSession,
} from '../components/auth/access-policy.js';
import type { Session } from '../services/api/workspace-service.js';

test('API laboratory deep links require a session while mock demos and reference pages stay open', () => {
  for (const route of [
    '/ingestion',
    '/graph',
    '/retrieval',
    '/fuzzy',
    '/evolutionary',
    '/swarm',
    '/hybrid',
    '/explainability',
    '/benchmarks',
  ]) {
    assert.equal(requiresSession(route, 'api'), true);
    assert.equal(requiresSession(`${route}/saved`, 'api'), true);
    assert.equal(requiresSession(route, 'mock'), false);
  }
  for (const route of [
    '/applications',
    '/architecture',
    '/syllabus',
    '/laboratory',
    '/graphical',
  ]) {
    assert.equal(requiresSession(route, 'api'), false);
    assert.equal(isCourseLab(route), false);
  }
  assert.equal(requiresSession('/', 'api'), true);
  assert.equal(requiresSession('/', 'mock'), true);
  assert.equal(requiresSession('/hospital', 'api'), true);
  assert.equal(requiresSession('/hospital', 'mock'), true);
  assert.equal(requiresSession('/hospital/patients/saved', 'api'), true);
  assert.equal(requiresSession('/hospital/patients/saved', 'mock'), true);
  assert.equal(requiresSession('/hospitality', 'api'), false);
  assert.equal(isCourseLab('/hospital'), false);
});

test('course laboratory access follows server session membership and preserves local mode', () => {
  const session: Session = {
    authenticated: true,
    local_mode: false,
    actor: { user: 'owner', role: 'editor', workspaces: ['personal'] },
  };
  assert.equal(hasCourseAccess(null), false);
  assert.equal(hasCourseAccess(session), false);
  assert.equal(
    hasCourseAccess({
      ...session,
      actor: { ...session.actor!, workspaces: ['course'] },
    }),
    true,
  );
  assert.equal(
    hasCourseAccess({
      ...session,
      authenticated: false,
      actor: { ...session.actor!, workspaces: ['course'] },
    }),
    false,
  );
  assert.equal(
    hasCourseAccess({ authenticated: false, local_mode: true, actor: null }),
    true,
  );
});
