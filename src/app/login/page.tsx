'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    })
    if (error) {
      setError(error.message)
    } else {
      setStep('code')
    }
    setLoading(false)
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    })
    if (error) {
      setError('Invalid code. Please try again.')
    } else {
      window.location.href = '/'
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8F5EF' }}>
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="text-center mb-8">
          <svg className="w-10 h-10 mx-auto mb-4" viewBox="0 0 854 854" fill="none">
            <path d="M807 132.751C807 167.96 778.532 196.502 743.415 196.502C708.298 196.502 679.83 167.96 679.83 132.751C679.83 97.5422 708.298 69 743.415 69C778.532 69 807 97.5422 807 132.751Z" fill="#2F2C26"/>
            <path d="M616.242 427.599C616.242 322.601 531.346 237.484 426.622 237.484C321.898 237.484 237.003 322.601 237.003 427.599C237.003 532.596 321.898 617.713 426.622 617.713V727C261.698 727 128 592.953 128 427.599C128 262.244 261.698 128.197 426.622 128.197C591.547 128.197 725.245 262.244 725.245 427.599C725.245 592.953 591.547 727 426.622 727V617.713C531.346 617.713 616.242 532.596 616.242 427.599Z" fill="#2F2C26"/>
          </svg>
          <p className="text-xs font-medium tracking-wide uppercase" style={{ color: '#7a7570' }}>
            Participant Portal
          </p>
          <h1 className="text-2xl font-extrabold mt-2" style={{ color: '#2F2C26', letterSpacing: '-0.5px' }}>
            US Healthcare Track
          </h1>
          <p className="text-sm mt-1" style={{ color: '#7a7570' }}>
            {step === 'email'
              ? 'Sign in with the email you registered with.'
              : `Enter the 6-digit code sent to ${email}`}
          </p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleSendCode}>
            <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #E8E1D6' }}>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: '#7a7570' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-colors"
                style={{
                  background: '#F8F5EF',
                  border: '1.5px solid #E8E1D6',
                  color: '#2F2C26',
                }}
                onFocus={e => (e.target.style.borderColor = '#2F2C26')}
                onBlur={e => (e.target.style.borderColor = '#E8E1D6')}
              />
              {error && (
                <p className="text-xs mt-2" style={{ color: '#C62828' }}>{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full mt-4 py-3 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: loading || !email ? '#D8CFC0' : '#2F2C26',
                  color: '#fff',
                  boxShadow: loading || !email ? 'none' : '0 2px 8px rgba(47,44,38,0.25)',
                }}
              >
                {loading ? 'Sending...' : 'Send login code'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode}>
            <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #E8E1D6' }}>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: '#7a7570' }}>
                Verification Code
              </label>
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                required
                maxLength={6}
                className="w-full px-4 py-3 rounded-xl text-center text-2xl font-bold tracking-widest focus:outline-none transition-colors"
                style={{
                  background: '#F8F5EF',
                  border: '1.5px solid #E8E1D6',
                  color: '#2F2C26',
                  letterSpacing: '0.5em',
                }}
                onFocus={e => (e.target.style.borderColor = '#2F2C26')}
                onBlur={e => (e.target.style.borderColor = '#E8E1D6')}
                autoFocus
              />
              {error && (
                <p className="text-xs mt-2" style={{ color: '#C62828' }}>{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full mt-4 py-3 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: loading || otp.length !== 6 ? '#D8CFC0' : '#2F2C26',
                  color: '#fff',
                  boxShadow: loading || otp.length !== 6 ? 'none' : '0 2px 8px rgba(47,44,38,0.25)',
                }}
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('email'); setOtp(''); setError('') }}
                className="w-full mt-3 text-xs font-semibold underline underline-offset-2"
                style={{ color: '#7a7570' }}
              >
                Use a different email
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-xs mt-6" style={{ color: '#a8a29a' }}>
          By Outsome
        </p>
      </div>
    </div>
  )
}
