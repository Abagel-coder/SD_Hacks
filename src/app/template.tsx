/** A template re-mounts on every navigation, so each page fades in as you move around the site. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page flex flex-1 flex-col">{children}</div>;
}
