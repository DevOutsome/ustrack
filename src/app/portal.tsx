'use client'

import { useRef, useCallback } from 'react'

export default function Portal({ role, email }: { role: string; email: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const handleLoad = useCallback(() => {
    const win = iframeRef.current?.contentWindow as any
    if (win && typeof win.setRole === 'function') {
      win.setRole(role)
      // Hide role switcher for non-organizers
      if (role !== 'organizer') {
        const seg = win.document.getElementById('roleSeg')
        if (seg) seg.style.display = 'none'
      }
    }
  }, [role])

  return (
    <iframe
      ref={iframeRef}
      src="/app.html"
      className="w-full h-screen border-0"
      title="US Healthcare Track"
      onLoad={handleLoad}
    />
  )
}
