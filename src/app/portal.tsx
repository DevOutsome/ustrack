'use client'
import { useRef, useCallback } from 'react'
export default function Portal({ role, email }: { role: string; email: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const handleLoad = useCallback(() => {
    const win = iframeRef.current?.contentWindow as any
    const doc = iframeRef.current?.contentDocument
    if (!win || !doc) return
    const mob = doc.createElement('style'); mob.textContent = '@media(max-width:600px){.nav{padding:0 12px;gap:8px}.nav-bridge,.nav-brand{display:none}.nav-tabs{gap:0;padding:2px}.nav-tab{padding:6px 9px;font-size:12px}.nav-tab.admin-tab::before{margin-right:4px}.nav-bell{width:32px;height:32px}}'; doc.head.appendChild(mob)
    const fix = doc.createElement('style'); fix.textContent = '.att-chip{position:relative;min-width:90px;max-width:90px;overflow:hidden;white-space:nowrap;justify-content:flex-start;font-size:11.5px!important;padding:4px 8px!important}.att-chip::after{content:"";position:absolute;right:0;top:0;bottom:0;width:24px;background:linear-gradient(to right,transparent,#F7F5F0);pointer-events:none}.att-chip .dot-g,.att-chip .dot-r{flex-shrink:0}.event-card.housekeeping{opacity:.4;border-style:dashed!important;padding:10px 14px!important;min-height:0!important;display:flex!important;flex-direction:row!important;align-items:center!important;gap:10px!important}.event-card.housekeeping .ec-top{display:contents!important}.event-card.housekeeping .ec-time{flex-direction:row!important;align-items:center!important;gap:6px!important}.event-card.housekeeping .t-range{font-size:12px!important}.event-card.housekeeping .sun,.event-card.housekeeping .sun-tip,.event-card.housekeeping .ec-badge,.event-card.housekeeping .ec-footer,.event-card.housekeeping .ec-loc,.event-card.housekeeping .ec-meta,.event-card.housekeeping button{display:none!important}.event-card.housekeeping .ec-body{display:contents!important}.event-card.housekeeping .ec-title{font-size:13px!important;font-weight:500!important;color:var(--muted)!important}'; doc.head.appendChild(fix)
    if (typeof win.setRole === 'function') {
      win.setRole(role)
      if (role !== 'organizer') { const seg = doc.getElementById('roleSeg'); if (seg) seg.style.display = 'none' }
    }
    doc.querySelectorAll('.event-card.cat-house_activity,.event-card.cat-move,.event-card.cat-free').forEach(function(c: any) { c.classList.add('housekeeping') })
    doc.querySelectorAll('.event-card').forEach(function(c: any) { var t = c.querySelector('.ec-title')?.textContent?.trim() || ''; if (/^(Unpack|Set up|Prep for|Wrap up|Move to|Free Time|Free Day|Off Day|Break|분리수거|Grocery)/i.test(t)) c.classList.add('housekeeping') })
    if (role === 'organizer') {
      var ac = doc.getElementById('adminContent'); if (!ac) return
      var s = doc.createElement('style'); s.textContent = '.at{position:relative;width:40px;height:22px;border-radius:11px;background:#D8CFC0;cursor:pointer;transition:background .2s;flex-shrink:0}.at.on{background:#2F2C26}.at::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.15);transition:transform .2s}.at.on::after{transform:translateX(18px)}.mc{display:flex;align-items:center;gap:12px;padding:12px 16px;background:#fff;border:1px solid #E8E1D6;border-radius:12px;transition:border-color .3s}'; doc.head.appendChild(s)
      var sec = doc.createElement('div'); sec.id = 'memberMgmt'; sec.style.cssText = 'margin-top:32px;padding-top:24px;border-top:1px solid #E8E1D6'
      sec.innerHTML = '<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px"><h2 style="font-size:20px;font-weight:800;letter-spacing:-.5px">All Users</h2><span style="background:#2F2C26;color:#fff;font-size:10px;font-weight:700;padding:4px 10px;border-radius:6px;letter-spacing:.8px">ADMIN</span></div><p style="font-size:12px;color:#857F76;margin-bottom:14px">Toggle Admin to grant organizer access (Admin tab + meal dashboard).</p><div id="ml" style="display:flex;flex-direction:column;gap:8px"><div style="color:#857F76;font-size:13px">Loading...</div></div>'
      ac.parentNode?.insertBefore(sec, ac.nextSibling)
      fetch('/api/admin/members').then(function(r){return r.json()}).then(function(ms: any[]){
        var ml = doc.getElementById('ml'); if(!ml||!Array.isArray(ms)) return
        ml.innerHTML = ms.map(function(m: any){
          var ini = m.email.substring(0,2).toUpperCase(), isA = m.role==='organizer', rl = m.role.charAt(0).toUpperCase()+m.role.slice(1)
          return '<div class="mc" data-e="'+m.email+'"><div style="width:36px;height:36px;border-radius:10px;background:#F3F0EA;display:grid;place-items:center;font-size:13px;font-weight:700;color:#2F2C26;flex-shrink:0">'+ini+'</div><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+m.email+'</div><span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:5px;background:'+(isA?'#E3ECFD':'#E8F5E9')+';color:'+(isA?'#153F9E':'#1B5E20')+'">'+rl+'</span></div><span style="font-size:11px;font-weight:600;color:#857F76">Admin</span><div class="at'+(isA?' on':'')+'" data-e="'+m.email+'"></div></div>'
        }).join('')
        ml.querySelectorAll('.at').forEach(function(t: any){
          t.addEventListener('click',function(){
            var em=t.dataset.e, isOn=t.classList.contains('on'), nr=isOn?'participant':'organizer'
            t.style.opacity='0.5'; t.style.pointerEvents='none'
            fetch('/api/admin/members',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:em,newRole:nr})}).then(function(r){return r.json()}).then(function(d){
              t.style.opacity=''; t.style.pointerEvents=''
              if(d.success){ t.classList.toggle('on'); var c=t.closest('.mc'); if(c){var sp=c.querySelector('span[style*="padding"]'); if(sp){sp.textContent=nr.charAt(0).toUpperCase()+nr.slice(1); sp.style.background=nr==='organizer'?'#E3ECFD':'#E8F5E9'; sp.style.color=nr==='organizer'?'#153F9E':'#1B5E20'} c.style.borderColor='#2E7D32'; setTimeout(function(){c.style.borderColor='#E8E1D6'},1500)}}
            })
          })
        })
      })
    }
  }, [role])
  return (<iframe ref={iframeRef} src="/app.html" className="w-full h-screen border-0" title="US Healthcare Track" onLoad={handleLoad} />)
}
