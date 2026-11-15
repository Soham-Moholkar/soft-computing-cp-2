import type { ComponentProps } from 'react';

type AppLinkProps = Omit<ComponentProps<'a'>, 'href'> & { href: string };

// Native navigation avoids broken lazy navigation/prefetch exports in the current
// vinext production bundle. Cookies, query strings and browser link behavior persist.
export default function AppLink({ children, ...props }: AppLinkProps) {
  return <a {...props}>{children}</a>;
}
