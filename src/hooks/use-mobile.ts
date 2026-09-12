import * as React from 'react';

const MOBILE_BREAKPOINT = 768;

function readIsMobile(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

/**
 * Phone layout below 768px.
 *
 * This is a SPA — there is no server render to mismatch — so the first paint
 * must already know the viewport. Starting as `undefined` and coercing with
 * `!!` made every phone load desktop-first: the 380px entry-list pane plus
 * the reader overflowed a ~390px screen until the effect ran.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(readIsMobile);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(readIsMobile());
    mql.addEventListener('change', onChange);
    setIsMobile(readIsMobile());
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
