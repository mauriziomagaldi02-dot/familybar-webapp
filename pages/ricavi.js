import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

const initialForm = {
  date: '',
  amount: '',
  point_of_sale_id: '',
}

export default function Ricavi() {
  const [user, setUser] = useState(null)
  const [rows, setRows] = useState([])
  const [pointsOfSale, setPointsOfSale] = useState([])
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)

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
    const [{ data: rev }, { data: pv }] = await Promise.all([
      supabase.from('revenues').select('*').order('date', { ascending: false }),
      supabase.from('points_of_sale').select('*').order('name'),
    ])

    setRows(rev || [])
    setPointsOfSale(pv || [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')

    const payload = {
      date: form.date || null,
      amount: form.amount ? Number(form.amount) : null,
      point_of_sale_id: form.point_of_sale_id || null,
    }

    if (editingId) {
      await supabase.from('revenues').update(payload).eq('id', editingId)
      setMessage('Ricavo aggiornato')
    } else {
      await supabase.from('revenues').insert(payload)
      setMessage('Ricavo inserito')
    }

    resetForm()
    loadData()
  }

  function handleEdit(row) {
    setEditingId(row.id)
    setForm({
      date: row.date || '',
      amount: row.amount ?? '',
      point_of_sale_id: row.point_of_sale_id || '',
    })
  }

  async function handleDelete(id) {
    if (!confirm('Cancellare?')) return
    await supabase.from('revenues').delete().eq('id', id)
    if (editingId === id) resetForm()
    loadData()
  }

  function resetForm() {
    setForm(initialForm)
    setEditingId(null)
  }

  if (!user) return <p>Devi accedere</p>

  return (
    <div style={{ padding: 40 }}>
      <h1>Ricavi</h1>
      <Link href="/">Home</Link>

      <form onSubmit={handleSubmit} style={{ marginTop: 20, display: 'grid', gap: 10, maxWidth: 400 }}>
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />

        <input
          type="number"
          placeholder="Importo"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />

        <select
          value={form.point_of_sale_id}
          onChange={(e) => setForm({ ...form, point_of_sale_id: e.target.value })}
        >
          <option value="">PV</option>
          {pointsOfSale.map((pv) => (
            <option key={pv.id} value={pv.id}>{pv.name}</option>
          ))}
        </select>

        <button>{editingId ? 'Aggiorna' : 'Salva'}</button>
        {editingId && <button type="button" onClick={resetForm}>Annulla</button>}
      </form>

      <p>{message}</p>

      <table style={{ marginTop: 20 }}>
        <tbody>
          {rows.map((r) => {
            const pv = pointsOfSale.find((p) => p.id === r.point_of_sale_id)
            return (
              <tr key={r.id}>
                <td>{r.date}</td>
                <td>{r.amount}</td>
                <td>{pv?.name}</td>
                <td>
                  <button onClick={() => handleEdit(r)}>Modifica</button>
                  <button onClick={() => handleDelete(r.id)}>Cancella</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
