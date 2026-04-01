import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

export default function CostiPersonale() {
  const [user, setUser] = useState(null)
  const [dataList, setDataList] = useState([])
  const [pointsOfSale, setPointsOfSale] = useState([])
  const [form, setForm] = useState({
    period_month: '',
    amount: '',
    worked_hours: '',
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
    const [{ data }, { data: pvData }] = await Promise.all([
      supabase.from('staff_costs').select('*').order('period_month', { ascending: false }),
      supabase.from('points_of_sale').select('*').order('name'),
    ])

    setDataList(data || [])
    setPointsOfSale(pvData || [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')

    const payload = {
      period_month: form.period_month || null,
      amount: form.amount ? Number(form.amount) : null,
      worked_hours: form.worked_hours ? Number(form.worked_hours) : null,
      point_of_sale_id: form.point_of_sale_id || null,
    }

    const { error } = await supabase.from('staff_costs').insert(payload)

    if (error) {
      setMessage(error.message)
      return
    }

    setForm({
      period_month: '',
      amount: '',
      worked_hours: '',
      point_of_sale_id: '',
    })

    setMessage('Costo personale inserito.')
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
      <h1>Costi personale</h1>
      <Link href="/">Home</Link>

      <form onSubmit={handleSubmit} style={{ marginTop: 20, display: 'grid', gap: 10, maxWidth: 400 }}>
        <input
          type="month"
          value={form.period_month}
          onChange={(e) => setForm({ ...form, period_month: e.target.value })}
        />

        <input
          type="number"
          step="0.01"
          placeholder="Costo €"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />

        <input
          type="number"
          step="0.01"
          placeholder="Ore lavorate"
          value={form.worked_hours}
          onChange={(e) => setForm({ ...form, worked_hours: e.target.value })}
        />

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

        <button type="submit">Salva</button>
      </form>

      {message && <p>{message}</p>}

      <h2 style={{ marginTop: 30 }}>Elenco</h2>

      <table style={{ marginTop: 10, borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={th}>Mese</th>
            <th style={th}>Costo</th>
            <th style={th}>Ore</th>
            <th style={th}>PV</th>
          </tr>
        </thead>
        <tbody>
          {dataList.map((row) => {
            const pv = pointsOfSale.find((p) => p.id === row.point_of_sale_id)

            return (
              <tr key={row.id}>
                <td style={td}>{row.period_month}</td>
                <td style={td}>{row.amount}</td>
                <td style={td}>{row.worked_hours}</td>
                <td style={td}>{pv?.name || ''}</td>
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
