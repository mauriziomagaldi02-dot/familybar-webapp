import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState(null)
  const [pointsOfSale, setPointsOfSale] = useState([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user || null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) loadPointsOfSale()
  }, [user])

  async function loadPointsOfSale() {
    const { data, error } = await supabase
      .from('points_of_sale')
      .select('*')
      .order('name')

    if (error) {
      setMessage(error.message)
      return
    }

    setPointsOfSale(data || [])
  }

  async function handleLogin(e) {
    e.preventDefault()
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setMessage('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Utente creato. Se richiesto, conferma la mail.')
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (!user) {
    return (
      <div style={{ padding: 40, fontFamily: 'Arial, sans-serif', maxWidth: 420 }}>
        <h1>Familybar Web App</h1>
        <p>Accesso utenti</p>

        <form style={{ display: 'grid', gap: 12 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: 10 }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: 10 }}
          />

          <button onClick={handleLogin} style={{ padding: 10 }}>
            Accedi
          </button>

          <button type="button" onClick={handleRegister} style={{ padding: 10 }}>
            Crea utente
          </button>
        </form>

        {message && <p style={{ marginTop: 16 }}>{message}</p>}
      </div>
    )
  }

  return (
    <div style={{ padding: 40, fontFamily: 'Arial, sans-serif' }}>
      <h1>Familybar Web App</h1>
      <p>Accesso effettuato come: {user.email}</p>
      <button onClick={handleLogout} style={{ padding: 10, marginTop: 10 }}>
        Esci
      </button>

      <h2 style={{ marginTop: 30 }}>Punti vendita</h2>

      {pointsOfSale.length === 0 ? (
        <p>Nessun punto vendita presente.</p>
      ) : (
        <ul>
          {pointsOfSale.map((pv) => (
            <li key={pv.id}>{pv.name}</li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: 24 }}>
        <Link href="/fatture">Vai a Fatture</Link>
      </div>
<div style={{ marginTop: 12 }}>
  <Link href="/ricavi">Vai a Ricavi</Link>
</div>

      {message && <p style={{ marginTop: 16 }}>{message}</p>}
    </div>
  )
}
