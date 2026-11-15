/** The Vouch wordmark: a check inside a shield, then the name. */
export function Logo({ size = 'md', inverted = false }: { size?: 'md' | 'lg'; inverted?: boolean }) {
  const mark = size === 'lg' ? 'h-10 w-10' : 'h-7 w-7';
  const glyph = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <span className="group flex items-center gap-2.5">
      <span
        className={`grid place-items-center rounded-full transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-110 ${mark} ${
          inverted ? 'bg-white text-black' : 'bg-black text-white'
        }`}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className={glyph} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      </span>
      <span className={`font-semibold tracking-tight ${size === 'lg' ? 'text-2xl' : 'text-base'}`}>Vouch</span>
    </span>
  );
}
