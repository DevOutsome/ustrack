/**
 * Shown by Next.js while page.tsx awaits the auth + approval checks.
 * Same cream palette and same revolving-dot mark as the in-app loading states,
 * so the hand-off into the portal never changes loader mid-flight.
 */
const RING = 'M616.242 427.599C616.242 322.601 531.346 237.484 426.622 237.484C321.898 237.484 237.003 322.601 237.003 427.599C237.003 532.596 321.898 617.713 426.622 617.713V727C261.698 727 128 592.953 128 427.599C128 262.244 261.698 128.197 426.622 128.197C591.547 128.197 725.245 262.244 725.245 427.599C725.245 592.953 591.547 727 426.622 727V617.713C531.346 617.713 616.242 532.596 616.242 427.599Z'

export default function Loading() {
  return (
    <main style={{
      minHeight: '100vh', background: '#F7F3EC', display: 'grid', placeItems: 'center',
      fontFamily: 'Inter, "Noto Sans KR", system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <svg viewBox="0 0 854 854" width="44" height="44" className="ld-mark" style={{ display: 'block', margin: '0 auto 14px', overflow: 'visible', color: '#2F2C26' }}>
          <path d={RING} fill="currentColor" />
          <circle className="ld-dot" cx="743.415" cy="132.751" r="63.585" />
        </svg>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.4px', color: '#857F76', textTransform: 'uppercase' }}>Loading</div>
      </div>
      <style>{`
.ld-mark .ld-dot{fill:currentColor;transform-box:view-box;transform-origin:426.622px 427.599px;animation:ldOrbit 1.4s linear infinite}
@keyframes ldOrbit{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){
.ld-mark .ld-dot{animation:none}
.ld-mark{animation:ldPulse 1.4s ease-in-out infinite}
@keyframes ldPulse{0%,100%{opacity:.4}50%{opacity:1}}}
      `}</style>
    </main>
  )
}
