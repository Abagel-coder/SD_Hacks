'use client';

import type { ReactNode } from 'react';
import { useReveal } from '@/hooks/useReveal';

export function Reveal({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const { ref, className: revealClass } = useReveal();
  return (
    <div
      ref={(node) => {
        ref.current = node;
      }}
      className={`${revealClass} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
