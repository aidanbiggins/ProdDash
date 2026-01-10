import { useState, useEffect } from 'react';

/**
 * Hook to detect mobile viewport
 * @param breakpoint - Max width in pixels to consider as mobile (default: 768)
 * @returns boolean indicating if viewport is mobile-sized
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    // Check if window is available (SSR safety)
    if (typeof window === 'undefined') return false;
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Check on mount (in case initial state was wrong)
    handleResize();

    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}

export default useIsMobile;
