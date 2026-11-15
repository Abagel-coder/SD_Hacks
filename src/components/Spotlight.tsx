'use client';

import type { HTMLAttributes, MouseEvent } from 'react';

/** A div whose `spotlight` glow follows the pointer. */
export function Spotlight({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  function move(event: MouseEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--x', `${event.clientX - box.left}px`);
    event.currentTarget.style.setProperty('--y', `${event.clientY - box.top}px`);
  }
  return <div onMouseMove={move} className={`spotlight ${className}`} {...props} />;
}
