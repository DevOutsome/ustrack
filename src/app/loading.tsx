/**
 * Shown by Next.js while page.tsx awaits the auth + approval checks.
 * Matches the portal's cream palette so the transition into the app is seamless.
 */
export default function Loading() {
  return (
    <main style={{
      minHeight: '100vh', background: '#F7F3EC', display: 'grid', placeItems: 'center',
      fontFamily: 'Inter, "Noto Sans KR", system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <svg viewBox="0 0 854 854" width="40" height="40" style={{ display: 'block', margin: '0 auto 14px', animation: 'ustrackPulse 1.4s ease-in-out infinite' }}>
          <path d="M807 132.751C807 167.96 778.532 196.502 743.415 196.502C708.298 196.502 679.83 167.96 679.83 132.751C679.83 97.5422 708.298 69 743.415 69C778.532 69 807 97.5422 807 132.751Z" fill="#2F2C26"/>
          <path d="M616.242 427.599C616.242 322.601 531.346 237.484 426.622 237.484C321.898 237.484 237.003 322.601 237.003 427.599C237.003 532.596 321.898 617.713 426.622 617.713V727C261.698 727 128 592.953 128 427.599C128 262.244 261.698 128.197 426.622 128.197C591.547 128.197 725.245 262.244 725.245 427.599C725.245 592.953 591.547 727 426.622 727V617.713C531.346 617.713 616.242 532.596 616.242 427.599Z" fill="#2F2C26"/>
        </svg>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.4px', color: '#857F76', textTransform: 'uppercase' }}>Loading</div>
      </div>
      <style>{`@keyframes ustrackPulse{0%,100%{opacity:.35;transform:scale(.96)}50%{opacity:1;transform:scale(1)}}`}</style>
    </main>
  )
}
