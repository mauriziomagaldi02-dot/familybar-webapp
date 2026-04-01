import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

export default function SpeseManuali() {
  const [user, setUser] = useState(null)
  const [rows, setRows] = useState([])
  const [pointsOfSale, setPointsOfSale] = useState([])
  const [form, setForm] = useState({
    cost_date: '',
    description: '',
    amount: '',
    point_of_sale_id: '',
    is_general: false,
    note: '',
  })
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null))
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
    const [{ data: costs }, { data: pvData }] = await Promise.all([
      supabase.from('manual_costs').select('*').order('cost_date', { ascending: false }),
      supabase.from('points_of_sale').select('*').order('name'),
    ])
    setRows(costs || [])
    setPointsOfSale(pvData || [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')

    const payload = {
      cost_date: form.cost_date || null,
      description: form.description || null,
      amount: form.amount ? Number(form.amount) : null,
      point_of_sale_id: form.is_general ? null : form.point_of_sale_id || null,
      is_general: !!form.is_general,
      note: form.note || null,
    }

    const { error } = await supabase.from('manual_costs').insert(payload)

    if (error) {
      setMessage(error.message)
      return
    }

    setForm({
      cost_date: '',
      description: '',
      amount: '',
      point_of_sale_id: '',
      is_general: false,
      note: '',
    })

    setMessage('Spesa manuale inserita.')
    loadData()
  }

  if (!user) {
    return (
      <div style={{ padding: 40, fontFamily: 'Arial, sans-serif' }}>
        <p>Devi accedere</p>
        <Link href="/">Torna alla home</Link>
      </div>
    )
  }

  return (
    <div style={{ padding: 40, fontFamily: 'Arial, sans-serif' }}>
      <h1>Spese manuali</h1>
      <Link href="/">Home</Link>

      <form onSubmit={handleSubmit} style={{ marginTop: 20, display: 'grid', gap: 10, maxWidth: 500 }}>
        <input
          type="date"
          value={form.cost_date}
          onChange={(e) => setForm({ ...form, cost_date: e.target.value })}
        />

        <input
          type="text"
          placeholder="Descrizione"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <input
          type="number"
          step="0.01"
          placeholder="Importo €"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />

        <label>
          <input
            type="checkbox"
            checked={form.is_general}
            onChange={(e) => setForm({ ...form, is_general: e.target.checked })}
          />
          {' '}Costo generale
        </label>

        {!form.is_general && (
          <select
            value={form.point_of_sale_id}
            onChange={(e) => setForm({ ...form, point_of_sale_id: e.target.value })}
          >
            <option value="">Seleziona PV</option>
            {pointsOfSale.map((pv) => (
              <option key={pv.id} value={pv.id}>
                {pv.name}
              </option>
            ))}
          </select>
        )}

        <input
          type="text"
          placeholder="Note"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />

        <button type="submit">Salva</button>
      </form>

      {message && <p>{message}</p>}

      <h2 style={{ marginTop: 30 }}>Elenco</h2>

      <table style={{ marginTop: 10, borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={th}>Data</th>
            <th style={th}>Descrizione</th>
            <th style={th}>Importo</th>
            <th style={th}>PV</th>
            <th style={th}>Generale</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const pv = pointsOfSale.find((p) => p.id === row.point_of_sale_id)
            return (
              <tr key={row.id}>
                <td style={td}>{row.cost_date || ''}</td>
                <td style={td}>{row.description || ''}</td>
                <td style={td}>{row.amount || ''}</td>
                <td style={td}>{pv?.name || ''}</td>
                <td style={td}>{row.is_general ? 'Sì' : 'No'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
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
