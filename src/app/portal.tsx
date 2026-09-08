'use client'

import { useRef, useCallback } from 'react'

export default function Portal({ role, email }: { role: string; email: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const handleLoad = useCallback(() => {
    const win = iframeRef.current?.contentWindow as any
    const doc = iframeRef.current?.contentDocument
    if (!win || !doc) return

    if (typeof win.setRole === 'function') {
      win.setRole(role)
      if (role !== 'organizer') {
        const seg = doc.getElementById('roleSeg')
        if (seg) seg.style.display = 'none'
      }
    }

    if (role === 'organizer') {
      injectMemberMgmt(doc)
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

function injectMemberMgmt(doc: Document) {
  const adminContent = doc.getElementById('adminContent')
  if (!adminContent) return

  const section = doc.createElement('div')
  section.id = 'memberMgmt'
  section.style.cssText = 'margin-top:32px;padding-top:24px;border-top:1px solid var(--border)'
  section.innerHTML = [
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">',
    '<h2 style="font-size:20px;font-weight:800;letter-spacing:-.5px">Team Members</h2>',
    '<span style="background:var(--brand);color:#fff;font-size:10px;font-weight:700;padding:4px 10px;border-radius:6px;letter-spacing:.8px">ADMIN</span>',
    '</div>',
    '<div id="memberList" style="display:flex;flex-direction:column;gap:8px">',
    '<div style="color:var(--muted);font-size:13px">Loading members...</div>',
    '</div>'
  ].join('')
  adminContent.parentNode?.insertBefore(section, adminContent.nextSibling)

  const roles = ['organizer', 'participant', 'speaker', 'vc']
  fetch('/api/admin/members')
    .then(r => r.json())
    .then((members: any[]) => {
      const list = doc.getElementById('memberList')
      if (!list || !Array.isArray(members)) return
      list.innerHTML = members.map((m) => {
        const initials = m.email.substring(0, 2).toUpperCase()
        const options = roles.map(r =>
          '<option value="' + r + '"' + (m.role === r ? ' selected' : '') + '>' + r.charAt(0).toUpperCase() + r.slice(1) + '</option>'
        ).join('')
        return [
          '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:#fff;border:1px solid var(--border);border-radius:12px">',
          '<div style="width:36px;height:36px;border-radius:10px;background:var(--brand-lt);display:grid;place-items:center;font-size:13px;font-weight:700;color:var(--brand);flex-shrink:0">' + initials + '</div>',
          '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + m.email + '</div></div>',
          '<select data-email="' + m.email + '" style="padding:6px 10px;font-size:12px;font-weight:600;border:1px solid var(--border);border-radius:8px;background:#fff;color:var(--text);cursor:pointer"',
          ' onchange="this.disabled=true;fetch(\'/api/admin/members\',{method:\'PUT\',headers:{\'Content-Type\':\'application/json\'},body:JSON.stringify({email:this.dataset.email,newRole:this.value})}).then(function(r){return r.json()}).then(function(d){this.disabled=false;if(d.success){this.style.borderColor=\'var(--green)\';var s=this;setTimeout(function(){s.style.borderColor=\'var(--border)\'},1500)}}.bind(this))">',
          options,
          '</select>',
          '</div>'
        ].join('')
      }).join('')
    })
}
