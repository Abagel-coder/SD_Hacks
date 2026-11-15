import type { ReactNode } from 'react';
import type { RiskCode } from '@/lib/types';

/** 24px line icons drawn with currentColor, so they follow the text colour around them. */
function Svg({ children, className = 'h-4 w-4' }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
      strokeLinejoin="round" className={className} aria-hidden>
      {children}
    </svg>
  );
}

/** Invoice Guard mark: a shield with a check. */
export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-lg bg-accent text-white shadow-sm ${className}`}>
      <Svg className="h-[60%] w-[60%]">
        <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" />
        <path d="M9 12l2 2 4-4" />
      </Svg>
    </span>
  );
}

const RISK_PATHS: Record<RiskCode, ReactNode> = {
  BLOCKLIST_HIT: (<><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></>),
  BANK_CHANGED: (<><path d="M3 10l9-6 9 6" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8" /><path d="M3 20h18" /></>),
  LOOKALIKE_DOMAIN: (<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>),
  DOMAIN_MISMATCH: (<><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18" /></>),
  NEW_DOMAIN: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  AMOUNT_ANOMALY: (<><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>),
  URGENCY_OR_SECRECY: (<><path d="M12 3l9 16H3z" /><path d="M12 10v4" /><path d="M12 17h.01" /></>),
  UNKNOWN_VENDOR: (<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
  AI_FLAGGED: (<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />),
  NO_WEB_PRESENCE: (<><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /><path d="M8 8l6 6" /></>),
};

export function RiskIcon({ code, className }: { code: RiskCode; className?: string }) {
  return <Svg className={className}>{RISK_PATHS[code] ?? <circle cx="12" cy="12" r="9" />}</Svg>;
}

export function SimilarIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="9" cy="12" r="5" />
      <circle cx="15" cy="12" r="5" />
    </Svg>
  );
}
