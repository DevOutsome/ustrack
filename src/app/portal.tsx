'use client'
import { useRef, useCallback } from 'react'

/**
 * Hosts the portal UI (public/app.html) in an iframe and injects the
 * organiser-only member management panel.
 *
 * Presentation rules (mobile nav, attendee chips, housekeeping dimming) live
 * inside app.html so they survive every re-render - do not re-add one-shot DOM
 * patching here, it silently stopped working once the schedule started loading
 * asynchronously.
 */
export default function Portal({ role, email }: { role: string; email: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const handleLoad = useCallback(() => {
    const win = iframeRef.current?.contentWindow as unknown as { setRole?: (r: string) => void }
    const doc = iframeRef.current?.contentDocument
    if (!win || !doc) return

    if (typeof win.setRole === 'function') {
      win.setRole(role)
      if (role !== 'organizer') {
        const seg = doc.getElementById('roleSeg')
        if (seg) seg.style.display = 'none'
      }
    }

    if (role !== 'organizer') return

    const anchor = doc.getElementById('adminContent')
    if (!anchor) return

    const style = doc.createElement('style')
    style.textContent = `
.at{position:relative;width:40px;height:22px;border-radius:11px;background:#D8CFC0;cursor:pointer;transition:background .2s;flex-shrink:0}
.at.on{background:#2F2C26}
.at::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.15);transition:transform .2s}
.at.on::after{transform:translateX(18px)}
.mc{display:flex;align-items:center;gap:12px;padding:12px 16px;background:#fff;border:1px solid #E8E1D6;border-radius:12px;transition:border-color .3s}
.mc.pend{border-color:#EADFC2;background:#FEFBF3}
.mc-av{width:36px;height:36px;border-radius:10px;background:#F3F0EA;display:grid;place-items:center;font-size:13px;font-weight:700;color:#2F2C26;flex-shrink:0}
.mc-main{flex:1;min-width:0}
.mc-name{font-size:13.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mc-sub{font-size:11.5px;color:#857F76;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mc-tag{font-size:11px;font-weight:600;padding:2px 8px;border-radius:5px;margin-top:3px;display:inline-block}
.mc-act{display:flex;align-items:center;gap:9px;flex-shrink:0}
.mc-lbl{font-size:11px;font-weight:600;color:#857F76}
.approve-btn{height:30px;padding:0 13px;border-radius:8px;border:1.5px solid #2F2C26;background:#2F2C26;color:#fff;font-size:12px;font-weight:600;cursor:pointer}
.approve-btn:disabled{opacity:.5;cursor:default}
.revoke-btn{height:28px;padding:0 10px;border-radius:8px;border:1px solid #E8E1D6;background:#fff;color:#857F76;font-size:11.5px;font-weight:600;cursor:pointer}
.mm-h{display:flex;align-items:center;gap:10px;margin:22px 0 10px}
.mm-h h3{font-size:13px;font-weight:800;letter-spacing:-.2px}
.mm-count{background:#2F2C26;color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:5px}
.mm-count.warn{background:#C8892C}
.mm-empty{font-size:12.5px;color:#857F76;padding:8px 0}`
    doc.head.appendChild(style)

    const section = doc.createElement('div')
    section.id = 'memberMgmt'
    section.style.cssText = 'margin-top:32px;padding-top:24px;border-top:1px solid #E8E1D6'
    section.innerHTML = `
<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
  <h2 style="font-size:20px;font-weight:800;letter-spacing:-.5px">All Users</h2>
  <span style="background:#2F2C26;color:#fff;font-size:10px;font-weight:700;padding:4px 10px;border-radius:6px;letter-spacing:.8px">ADMIN</span>
</div>
<p style="font-size:12px;color:#857F76;margin-bottom:4px">New signups wait here until you let them in. Admin grants organizer access.</p>
<div id="ml"><div style="color:#857F76;font-size:13px;padding:10px 0">Loading…</div></div>`
    anchor.parentNode?.insertBefore(section, anchor.nextSibling)

    type Member = { email: string; name: string; company: string; role: string; approved: boolean }

    const initials = (s: string) =>
      s.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')

    const render = (members: Member[]) => {
      const list = doc.getElementById('ml')
      if (!list) return
      const pending = members.filter(m => !m.approved)
      const active = members.filter(m => m.approved)

      const card = (m: Member) => `
<div class="mc${m.approved ? '' : ' pend'}" data-e="${m.email}">
  <div class="mc-av">${initials(m.name || m.email)}</div>
  <div class="mc-main">
    <div class="mc-name">${m.name}</div>
    <div class="mc-sub">${m.email}${m.company ? ' · ' + m.company : ''}</div>
    <span class="mc-tag" style="background:${m.role === 'organizer' ? '#E3ECFD' : '#E8F5E9'};color:${m.role === 'organizer' ? '#153F9E' : '#1B5E20'}">${m.role.charAt(0).toUpperCase() + m.role.slice(1)}</span>
  </div>
  <div class="mc-act">
    ${m.approved
      ? `<span class="mc-lbl">Admin</span><div class="at${m.role === 'organizer' ? ' on' : ''}" data-e="${m.email}"></div>
         <button class="revoke-btn" data-revoke="${m.email}">Remove</button>`
      : `<button class="approve-btn" data-approve="${m.email}">Approve</button>`}
  </div>
</div>`

      list.innerHTML = `
<div class="mm-h"><h3>Waiting for approval</h3><span class="mm-count${pending.length ? ' warn' : ''}">${pending.length}</span></div>
${pending.length ? pending.map(card).join('') : '<div class="mm-empty">No one waiting.</div>'}
<div class="mm-h"><h3>Has access</h3><span class="mm-count">${active.length}</span></div>
${active.map(card).join('')}`

      const send = async (body: Record<string, unknown>, el: HTMLElement) => {
        el.setAttribute('disabled', 'true')
        el.style.opacity = '0.5'
        try {
          const res = await fetch('/api/admin/members', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          const data = await res.json()
          if (!res.ok || !data.success) throw new Error(data.error || 'Failed')
          await load()
        } catch (err) {
          el.removeAttribute('disabled')
          el.style.opacity = ''
          alert(err instanceof Error ? err.message : 'Failed')
        }
      }

      list.querySelectorAll<HTMLElement>('[data-approve]').forEach(b =>
        b.addEventListener('click', () => send({ email: b.dataset.approve, approved: true }, b)))

      list.querySelectorAll<HTMLElement>('[data-revoke]').forEach(b =>
        b.addEventListener('click', () => {
          if (!confirm(`Remove access for ${b.dataset.revoke}?`)) return
          send({ email: b.dataset.revoke, approved: false }, b)
        }))

      list.querySelectorAll<HTMLElement>('.at').forEach(t =>
        t.addEventListener('click', () => {
          const next = t.classList.contains('on') ? 'participant' : 'organizer'
          send({ email: t.dataset.e, newRole: next }, t)
        }))
    }

    const load = async () => {
      const res = await fetch('/api/admin/members')
      const members = await res.json()
      if (Array.isArray(members)) render(members)
    }

    void load()
  }, [role])

  return (
    <iframe
      ref={iframeRef}
      src="/app.html"
      className="w-full h-screen border-0"
      title="US Healthcare Track"
      onLoad={handleLoad}
      data-user={email}
    />
  )
}
