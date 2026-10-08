import React, { useState, useEffect, useRef } from 'react';

interface LazyMountProps {
  children: React.ReactNode;
  fallbackHeight?: string;
  rootMargin?: string;
  forceMount?: boolean;
  label?: string;
}

/**
 * Defers mounting of heavy below-the-fold components until they approach the viewport
 * (or when forceMount becomes true, e.g., when a user clicks a direct navigation action).
 */
export const LazyMount: React.FC<LazyMountProps> = ({
  children,
  fallbackHeight = 'min-h-[320px]',
  rootMargin = '350px 0px',
  forceMount = false,
  label = 'Cargando sección...',
}) => {
  const [shouldRender, setShouldRender] = useState<boolean>(forceMount);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (forceMount) {
      setShouldRender(true);
    }
  }, [forceMount]);

  useEffect(() => {
    if (shouldRender) return;
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setShouldRender(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldRender, rootMargin]);

  return (
    <div ref={containerRef}>
      {shouldRender ? (
        children
      ) : (
        <div
          aria-busy="true"
          className={`w-full ${fallbackHeight} rounded-2xl border border-[#E8C5C8]/70 bg-white/70 flex flex-col items-center justify-center p-8 text-center animate-pulse`}
        >
          <div className="w-8 h-8 rounded-full border-2 border-[#5C1329] border-t-transparent animate-spin mb-3" />
          <span className="text-xs font-medium text-[#5C1329]">{label}</span>
        </div>
      )}
    </div>
  );
};
