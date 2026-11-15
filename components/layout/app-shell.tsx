'use client';

import { useState } from 'react';
import Link from '@/components/common/app-link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Beaker,
  BookOpen,
  HeartPulse,
  Menu,
  Network,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { serviceMode } from '@/services';
import {
  SessionControl,
  SessionGate,
  SessionProvider,
} from '@/components/auth/session-provider';
import { isCourseLab, requiresSession } from '@/components/auth/access-policy';

const navigation = [
  { label: 'Care Evidence', href: '/', icon: Network },
  { label: 'Workspaces', href: '/workspaces', icon: Activity },
  { label: 'Hospital records', href: '/hospital', icon: HeartPulse },
  { label: 'Learning lab', href: '/laboratory', icon: BookOpen },
];

function navigationPath(pathname: string) {
  return isCourseLab(pathname) ||
    ['/syllabus', '/architecture', '/applications'].includes(pathname)
    ? '/laboratory'
    : pathname;
}

function Navigation({
  pathname,
  close,
}: {
  pathname: string;
  close?: () => void;
}) {
  const activePath = navigationPath(pathname);
  return (
    <nav
      className="flex-1 space-y-1 overflow-y-auto p-4"
      aria-label="Primary navigation"
    >
      <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        Your laptop
      </p>
      {navigation.map(({ label, href, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={close}
          aria-current={
            activePath === href ||
            (href !== '/' && activePath.startsWith(`${href}/`))
              ? 'page'
              : undefined
          }
          className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors ${activePath === href || (href !== '/' && activePath.startsWith(`${href}/`)) ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent'}`}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
      <p className="px-3 pt-5 text-xs leading-6 text-sidebar-foreground/50">
        Syllabus, explanations and course experiments are together in Learning
        lab.
      </p>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <SessionProvider enabled={requiresSession(pathname, serviceMode)}>
      <ShellContent>{children}</ShellContent>
    </SessionProvider>
  );
}

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  if (pathname === '/') {
    return <SessionGate required course={false}>{children}</SessionGate>;
  }
  const activePath = navigationPath(pathname);
  const section = navigation.find((item) =>
    item.href === '/' ? activePath === '/' : activePath.startsWith(item.href),
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
          <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Network className="size-5" />
          </div>
          <div>
            <p className="font-heading text-base font-semibold tracking-tight">
              SoftGraph AI
            </p>
            <p className="text-xs text-sidebar-foreground/50">
              Local knowledge workspace
            </p>
          </div>
        </div>
        <Navigation pathname={pathname} />
        <div className="m-4 rounded-xl border border-sidebar-border bg-sidebar-accent p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-teal-300">
            <span className="size-2 rounded-full bg-emerald-500" />
            {serviceMode === 'api'
              ? 'RUNNING ON YOUR LAPTOP'
              : 'SIMULATED LEARNING DEMOS'}
          </div>
          <p className="text-xs leading-relaxed text-sidebar-foreground/60">
            {serviceMode === 'api'
              ? 'Local records and source-grounded answers, with separate data for every workspace.'
              : 'Deterministic demonstrations are isolated behind typed service contracts.'}
          </p>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-slate-950/30"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-72 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl">
            <div className="flex h-20 items-center justify-between border-b px-5">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <Network className="size-4" />
                </div>
                <span className="font-semibold">SoftGraph AI</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
              >
                <X />
              </Button>
            </div>
            <Navigation
              pathname={pathname}
              close={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="lg:pl-56">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/80 px-5 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-3">
            <Button
              className="lg:hidden"
              variant="outline"
              size="icon"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu />
            </Button>
            <div>
              <p className="text-sm font-medium">
                {section?.label ?? 'SoftGraph AI'}
              </p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Evidence, connected to context
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SessionControl />
            <Badge
              variant="outline"
              className="gap-1.5 border-teal-200/70 bg-teal-50 text-teal-800"
            >
              <Beaker className="size-3" />{' '}
              {activePath === '/laboratory'
                ? 'Learning lab'
                : 'Local workspace'}
            </Badge>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] space-y-8 p-5 md:p-8">
          <SessionGate
            required={requiresSession(pathname, serviceMode)}
            course={serviceMode === 'api' && isCourseLab(pathname)}
          >
            {children}
          </SessionGate>
        </main>
      </div>
    </div>
  );
}
