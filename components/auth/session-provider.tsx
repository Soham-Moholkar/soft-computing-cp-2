'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import Link from '@/components/common/app-link';
import {
  ArrowRight,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { ApiClient } from '@/services/api/client';
import type { Session } from '@/services/api/workspace-service';
import { hasCourseAccess } from './access-policy';

type Status = 'idle' | 'checking' | 'ready' | 'signing-in' | 'signing-out';
interface SessionState {
  session: Session | null;
  status: Status;
  error: string;
}
interface SessionContextValue extends SessionState {
  refresh: () => Promise<void>;
  signIn: (accessKey: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);
const platform = new ApiClient();
const signedOut: Session = {
  authenticated: false,
  local_mode: false,
  actor: null,
};

export function SessionProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<SessionState>({
    session: null,
    status: 'idle',
    error: '',
  });
  const active = useRef<AbortController | null>(null);
  const operation = useRef<Status>('idle');

  const run = useCallback(
    async (
      status: Status,
      request: (signal: AbortSignal) => Promise<Session>,
    ) => {
      active.current?.abort();
      const controller = new AbortController();
      active.current = controller;
      operation.current = status;
      setState((previous) => ({ ...previous, status, error: '' }));
      try {
        const session = await request(controller.signal);
        if (!controller.signal.aborted) {
          operation.current = 'ready';
          setState({ session, status: 'ready', error: '' });
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          operation.current = 'ready';
          setState((previous) => ({
            ...previous,
            status: 'ready',
            error:
              cause instanceof Error
                ? cause.message
                : 'Could not reach the knowledge service.',
          }));
        }
      }
    },
    [],
  );

  const refresh = useCallback(
    () =>
      run('checking', (signal) =>
        platform.get<Session>('/auth/session', signal),
      ),
    [run],
  );
  const signIn = useCallback(
    (accessKey: string) =>
      run('signing-in', async (signal) => {
        await platform.post<Session>(
          '/auth/session',
          { access_key: accessKey },
          signal,
        );
        // Confirm that the browser accepted the session cookie before opening data.
        const session = await platform.get<Session>('/auth/session', signal);
        if (!session.authenticated && !session.local_mode)
          throw new Error(
            'Your session could not be saved. Enable cookies and try again.',
          );
        return session;
      }),
    [run],
  );
  const signOut = useCallback(
    () => run('signing-out', () => platform.delete<Session>('/auth/session')),
    [run],
  );

  useEffect(() => {
    let disposed = false;
    if (enabled)
      void Promise.resolve().then(() => {
        if (!disposed) void refresh();
      });
    return () => {
      disposed = true;
    };
  }, [enabled, refresh]);

  useEffect(() => {
    const expire = () => {
      if (
        operation.current === 'signing-in' ||
        operation.current === 'signing-out'
      )
        return;
      active.current?.abort();
      operation.current = 'ready';
      setState({
        session: signedOut,
        status: 'ready',
        error:
          'Your session has expired. Sign in to continue where you left off.',
      });
    };
    window.addEventListener('softgraph:session-expired', expire);
    return () => {
      active.current?.abort();
      window.removeEventListener('softgraph:session-expired', expire);
    };
  }, []);

  return (
    <SessionContext value={{ ...state, refresh, signIn, signOut }}>
      {children}
    </SessionContext>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context)
    throw new Error('useSession must be used within SessionProvider');
  return context;
}

export function SessionGate({
  required,
  course,
  children,
}: {
  required: boolean;
  course: boolean;
  children: React.ReactNode;
}) {
  const { session, status, error, refresh } = useSession();
  if (!required) return children;
  if (status === 'idle' || status === 'checking' || status === 'signing-out') {
    return (
      <output className="flex min-h-72 items-center justify-center gap-3 text-slate-500">
        <LoaderCircle className="size-5 animate-spin" />
        Connecting to your workspace…
      </output>
    );
  }
  if (!session) {
    return (
      <section className="mx-auto max-w-md space-y-4 rounded-2xl border bg-white p-8">
        <h1 className="text-xl font-semibold">Workspace unavailable</h1>
        <p role="alert" className="text-sm leading-6 text-slate-600">
          {error || 'Could not connect to your knowledge service.'}
        </p>
        <button
          onClick={() => void refresh()}
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
        >
          Try again
        </button>
      </section>
    );
  }
  if (!session.local_mode && !session.authenticated) return <SignInForm />;
  if (course && !hasCourseAccess(session)) {
    return (
      <section className="mx-auto max-w-lg space-y-4 rounded-2xl border bg-white p-8">
        <ShieldCheck className="size-8 text-teal-700" />
        <h1 className="text-xl font-semibold">
          Course workspace access required
        </h1>
        <p className="text-sm leading-6 text-slate-600">
          This laboratory uses the course workspace. Your current account can
          open its assigned environments.
        </p>
        <Link
          href="/workspaces"
          className="inline-flex items-center gap-2 text-sm font-medium text-teal-700"
        >
          Open your environments <ArrowRight className="size-4" />
        </Link>
      </section>
    );
  }
  return (
    <>
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}
      {children}
    </>
  );
}

function SignInForm() {
  const { signIn, status, error } = useSession();
  const [accessKey, setAccessKey] = useState('');
  const busy = status === 'signing-in';
  return (
    <section className="mx-auto max-w-md rounded-2xl border bg-white p-8">
      <LockKeyhole className="size-8 text-teal-700" />
      <h1 className="mt-5 text-2xl font-semibold">
        Welcome to your knowledge space.
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        Sign in with your access key to open this page. Your account determines
        which workspaces you can use.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void signIn(accessKey);
        }}
        className="mt-6 space-y-4"
        aria-busy={busy}
      >
        <label className="block text-sm">
          Access key
          <input
            type="password"
            autoComplete="current-password"
            required
            disabled={busy}
            className="mt-2 w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            value={accessKey}
            onChange={(event) => setAccessKey(event.target.value)}
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          type="submit"
          disabled={busy}
        >
          {busy ? (
            <>
              <LoaderCircle className="size-4 animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              Open workspace <ArrowRight className="size-4" />
            </>
          )}
        </button>
      </form>
    </section>
  );
}

export function SessionControl() {
  const { session, status, signOut } = useSession();
  if (!session || (!session.local_mode && !session.authenticated)) return null;
  return (
    <div className="flex items-center gap-3 text-xs text-slate-500">
      <span className="hidden sm:inline">
        {session.local_mode
          ? 'Local workspace · editor'
          : `${session.actor?.user ?? 'Owner'} · ${session.actor?.role ?? 'editor'}`}
      </span>
      {session.authenticated ? (
        <button
          disabled={status !== 'ready'}
          onClick={() => void signOut()}
          className="whitespace-nowrap underline underline-offset-4 disabled:opacity-50"
        >
          {status === 'signing-out' ? 'Signing out…' : 'Sign out'}
        </button>
      ) : null}
    </div>
  );
}
