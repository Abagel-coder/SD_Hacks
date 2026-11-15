'use client';

import { useEffect, useRef, useState } from 'react';

/** Counts up from the last shown value to the new one with an ease-out. */
export function CountUp({ value, format = String }: { value: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1200);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(t < 1 ? origin + (value - origin) * eased : value);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  // Whole numbers while counting; the exact value (cents included) once it lands.
  return <>{format(shown === value ? value : Math.round(shown))}</>;
}
