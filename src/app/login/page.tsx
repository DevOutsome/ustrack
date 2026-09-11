'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
export default function LoginPage() {
  const [email, setEmail] = useState(''); const [otp, setOtp] = useState(''); const [step, setStep] = useState<'email'|'code'>('email'); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const supabase = createClient()
  async function handleSendCode(e: React.FormEvent) { e.preventDefault(); setLoading(true); setError(''); const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }); if (error) { setError(error.message) } else { setStep('code') }; setLoading(false) }
  async function handleVerifyCode(e: React.FormEvent) { e.preventDefault(); setLoading(true); setError(''); const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' }); if (error) { setError('Invalid code. Please try again.') } else { window.location.href = '/' }; setLoading(false) }
  const dis = loading || !email, dis2 = loading || otp.length !== 6
  return (
    <div style={{ fontFamily:"'Inter',-apple-system,sans-serif",minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden' }}>
      <div style={{ position:'fixed',inset:0,zIndex:0 }}>
        <img src="/sf-sunset-web.jpg" alt="" style={{ width:'100%',height:'100%',objectFit:'cover',objectPosition:'center 45%' }} />
        <div style={{ position:'absolute',inset:0,background:'linear-gradient(135deg,rgba(47,44,38,.55) 0%,rgba(47,44,38,.25) 50%,rgba(47,44,38,.5) 100%)' }} />
      </div>
      <div style={{ position:'relative',zIndex:1,width:'100%',maxWidth:400,margin:24,background:'rgba(248,245,239,.92)',backdropFilter:'blur(20px) saturate(180%)',WebkitBackdropFilter:'blur(20px) saturate(180%)',borderRadius:24,padding:'40px 36px',boxShadow:'0 24px 64px rgba(0,0,0,.25),0 0 0 1px rgba(255,255,255,.15)' }}>
        <svg style={{ width:40,height:40,margin:'0 auto 20px',display:'block' }} viewBox="0 0 854 854" fill="none">
          <path d="M807 132.751C807 167.96 778.532 196.502 743.415 196.502C708.298 196.502 679.83 167.96 679.83 132.751C679.83 97.5422 708.298 69 743.415 69C778.532 69 807 97.5422 807 132.751Z" fill="#2F2C26"/>
          <path d="M616.242 427.599C616.242 322.601 531.346 237.484 426.622 237.484C321.898 237.484 237.003 322.601 237.003 427.599C237.003 532.596 321.898 617.713 426.622 617.713V727C261.698 727 128 592.953 128 427.599C128 262.244 261.698 128.197 426.622 128.197C591.547 128.197 725.245 262.244 725.245 427.599C725.245 592.953 591.547 727 426.622 727V617.713C531.346 617.713 616.242 532.596 616.242 427.599Z" fill="#2F2C26"/>
        </svg>
        <p style={{ textAlign:'center',fontSize:11,fontWeight:600,letterSpacing:1.5,textTransform:'uppercase',color:'#7a7570',marginBottom:6 }}>Participant Portal</p>
        <h1 style={{ textAlign:'center',fontSize:26,fontWeight:800,color:'#2F2C26',letterSpacing:'-0.5px',marginBottom:4,margin:0 }}>US Healthcare Track</h1>
        <p style={{ textAlign:'center',fontSize:12.5,color:'#7a7570',fontWeight:500,marginBottom:28 }}>{step==='email'?'Oct 19–Nov 1, 2026 · San Francisco, CA':'Enter the 6-digit code sent to '+email}</p>
        {step==='email'?(
          <form onSubmit={handleSendCode}>
            <label style={{ display:'block',fontSize:11,fontWeight:600,letterSpacing:1,textTransform:'uppercase',color:'#7a7570',marginBottom:8 }}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" required style={{ width:'100%',padding:'13px 16px',borderRadius:12,border:'1.5px solid #E8E1D6',background:'#fff',fontSize:15,color:'#2F2C26',outline:'none',fontFamily:'inherit',boxSizing:'border-box' }} onFocus={e=>e.target.style.borderColor='#2F2C26'} onBlur={e=>e.target.style.borderColor='#E8E1D6'} />
            {error&&<p style={{ fontSize:12,marginTop:8,color:'#C62828' }}>{error}</p>}
            <button type="submit" disabled={dis} style={{ width:'100%',marginTop:16,padding:14,borderRadius:12,border:'none',background:dis?'#D8CFC0':'#2F2C26',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',boxShadow:dis?'none':'0 2px 8px rgba(47,44,38,.25)' }}>{loading?'Sending...':'Send login code'}</button>
          </form>
        ):(
          <form onSubmit={handleVerifyCode}>
            <label style={{ display:'block',fontSize:11,fontWeight:600,letterSpacing:1,textTransform:'uppercase',color:'#7a7570',marginBottom:8 }}>Verification Code</label>
            <input type="text" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000" required maxLength={6} autoFocus style={{ width:'100%',padding:'13px 16px',borderRadius:12,border:'1.5px solid #E8E1D6',background:'#fff',fontSize:24,fontWeight:700,color:'#2F2C26',outline:'none',fontFamily:'inherit',textAlign:'center',letterSpacing:'0.5em',boxSizing:'border-box' }} onFocus={e=>e.target.style.borderColor='#2F2C26'} onBlur={e=>e.target.style.borderColor='#E8E1D6'} />
            {error&&<p style={{ fontSize:12,marginTop:8,color:'#C62828' }}>{error}</p>}
            <button type="submit" disabled={dis2} style={{ width:'100%',marginTop:16,padding:14,borderRadius:12,border:'none',background:dis2?'#D8CFC0':'#2F2C26',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',boxShadow:dis2?'none':'0 2px 8px rgba(47,44,38,.25)' }}>{loading?'Verifying...':'Verify'}</button>
            <button type="button" onClick={()=>{setStep('email');setOtp('');setError('')}} style={{ width:'100%',marginTop:12,background:'none',border:'none',fontSize:12,fontWeight:600,color:'#7a7570',cursor:'pointer',textDecoration:'underline',fontFamily:'inherit' }}>Use a different email</button>
          </form>
        )}
        <p style={{ textAlign:'center',fontSize:12,color:'#a8a29a',marginTop:24 }}>By Outsome</p>
      </div>
    </div>
  )
}
