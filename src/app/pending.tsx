'use client'
import { useState } from 'react'

/**
 * Shown to a signed-in account that an organiser has not admitted yet.
 * It deliberately reveals nothing about the program - no schedule, no address,
 * no roster - only that the request was received.
 */
export default function Pending({ email }: { email: string }) {
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function introduce(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Please add your name'); return }
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: name, company }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save')
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{
      minHeight: '100vh', background: '#F7F3EC', display: 'grid', placeItems: 'center',
      padding: '24px', fontFamily: 'Inter, "Noto Sans KR", system-ui, sans-serif', color: '#2F2C26',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{
          background: '#fff', border: '1px solid #E8E1D6', borderRadius: 16,
          padding: '32px 28px', boxShadow: '0 2px 14px rgba(47,44,38,.06)',
        }}>
          <h1 style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.5px', margin: '0 0 10px' }}>
            You&apos;re on the list
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: '#5F5A52', margin: '0 0 6px' }}>
            We received your request for <b>{email}</b>. An Outsome organiser will let you in shortly.
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: '#857F76', margin: '0 0 22px' }}>
            You&apos;ll see the full schedule as soon as you&apos;re approved. No need to sign up again.
          </p>

          {saved ? (
            <div style={{
              background: '#EDF6EC', border: '1px solid #CBE3C8', color: '#2E6B2B',
              borderRadius: 10, padding: '12px 14px', fontSize: 13.5, fontWeight: 600,
            }}>
              Thanks {name.split(' ')[0]} - we know who you are now.
            </div>
          ) : (
            <form onSubmit={introduce}>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: '#857F76', margin: '0 0 10px' }}>
                Help us recognise you
              </p>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Your name" maxLength={80}
                style={inputStyle}
              />
              <input
                value={company} onChange={e => setCompany(e.target.value)}
                placeholder="Company (optional)" maxLength={80}
                style={{ ...inputStyle, marginTop: 8 }}
              />
              {error && <div style={{ color: '#A33', fontSize: 12.5, marginTop: 8 }}>{error}</div>}
              <button type="submit" disabled={busy} style={{
                marginTop: 14, width: '100%', height: 42, borderRadius: 10, border: 'none',
                background: '#2F2C26', color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
              }}>
                {busy ? 'Saving…' : 'Send'}
              </button>
            </form>
          )}
        </div>
        <p style={{ textAlign: 'center', fontSize: 12, color: '#A39C91', marginTop: 18 }}>
          Wrong account? <a href="/login" style={{ color: '#2F2C26' }}>Use a different email</a>
        </p>
      </div>
    </main>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 13px', border: '1px solid #E8E1D6', borderRadius: 9,
  fontSize: 14, fontFamily: 'inherit', color: '#2F2C26', background: '#fff', outline: 'none',
}
