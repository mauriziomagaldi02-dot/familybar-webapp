import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

export default function Ricavi() {
  const [user, setUser] = useState(null)
  const [revenues, setRevenues] = useState([])
  const [pointsOfSale, setPointsOfSale] = useState([])
  const [form, setForm] = useState({
    date: '',
    amount: '',
    point_of_sale_id: '',
  })
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
    if (user) loadData()
  }, [user])

  async function loadData() {
    setMessage('')

    const [{ data: revenuesData, error: revenuesError }, { data: pvData }] =
      await Promise.all([
        supabase.from('revenues').select('*').order('date', { ascending: false }),
        supabase.from('points_of_sale').select('*').order('name'),
      ])

    if (revenuesError) {
      setMessage(revenuesError.message)
      return
    }

    setRevenues(revenuesData || [])
    setPointsOfSale(pvData || [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')

    const payload = {
      date: form.date || null,
      amount: form.amount ? Number(form.amount) : null,
      point_of_sale_id: form.point_of_sale_id || null,
    }

    const { error } = await supabase.from('revenues').insert(payload)

    if (error) {
      setMessage(error.message)
      return
    }

    setForm({
      date: '',
      amount: '',
      point_of_sale_id: '',
    })

    setMessage('Ricavo inserito.')
    loadData()
  }

  if (!user) {
    return (
      <div style={{ padding: 40, fontFamily: 'Arial, sans-serif' }}>
        <h1>Ricavi</h1>
        <p>Devi prima accedere.</p>
        <Link href="/">Torna al login</Link>
      </div>
    )
  }

  return (
    <div style={{ padding: 40, fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Ricavi</h1>
        <Link href="/">Home</Link>
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: 24, display: 'grid', gap: 12, maxWidth: 500 }}>
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />

        <input
          type="number"
          step="0.01"
          placeholder="Importo"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />

        <select
          value={form.point_of_sale_id}
          onChange={(e) => setForm({ ...form, point_of_sale_id: e.target.value })}
        >
          <option value="">Seleziona punto vendita</option>
          {pointsOfSale.map((pv) => (
            <option key={pv.id} value={pv.id}>
              {pv.name}
            </option>
          ))}
        </select>

        <button type="submit">Salva ricavo</button>
      </form>

      {message && <p style={{ marginTop: 16 }}>{message}</p>}

      <h2 style={{ marginTop: 32 }}>Elenco ricavi</h2>

      {revenues.length === 0 ? (
        <p>Nessun ricavo presente.</p>
      ) : (
        <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
          <thead>
            <tr>
              <th style={th}>Data</th>
              <th style={th}>Importo</th>
              <th style={th}>PV</th>
            </tr>
          </thead>
          <tbody>
            {revenues.map((rev) => {
              const pv = pointsOfSale.find((p) => p.id === rev.point_of_sale_id)

              return (
                <tr key={rev.id}>
                  <td style={td}>{rev.date || ''}</td>
                  <td style={td}>{rev.amount ?? ''}</td>
                  <td style={td}>{pv?.name || ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

const th = {
  border: '1px solid #ccc',
  padding: 8,
  textAlign: 'left',
  background: '#f5f5f5',
}

const td = {
  border: '1px solid #ccc',
  padding: 8,
}
