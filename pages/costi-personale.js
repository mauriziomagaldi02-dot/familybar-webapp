import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

const initialForm = {
  period_month: '',
  amount: '',
  worked_hours: '',
  point_of_sale_id: '',
}

export default function CostiPersonale() {
  const [user, setUser] = useState(null)
  const [rows, setRows] = useState([])
  const [pointsOfSale, setPointsOfSale] = useState([])
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)

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

    const [{ data, error }, { data: pvData, error: pvError }] = await Promise.all([
      supabase.from('staff_costs').select('*').order('period_month', { ascending: false }),
      supabase.from('points_of_sale').select('*').order('name'),
    ])

    if (error || pvError) {
      setMessage(error?.message || pvError?.message || 'Errore caricamento dati')
      return
    }

    setRows(data || [])
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

    if (editingId) {
      const { error } = await supabase
        .from('staff_costs')
        .update(payload)
        .eq('id', editingId)

      if (error) {
        setMessage(error.message)
        return
      }

      setMessage('Costo personale aggiornato.')
    } else {
      const { error } = await supabase
        .from('staff_costs')
        .insert(payload)

      if (error) {
        setMessage(error.message)
        return
      }

      setMessage('Costo personale inserito.')
    }

    resetForm()
    loadData()
  }

  function handleEdit(row) {
    setEditingId(row.id)
    setForm({
      period_month: row.period_month || '',
      amount: row.amount ?? '',
      worked_hours: row.worked_hours ?? '',
      point_of_sale_id: row.point_of_sale_id || '',
    })
    setMessage('')
  }

  async function handleDelete(id) {
    const conferma = window.confirm('Vuoi davvero cancellare questo costo del personale?')
    if (!conferma) return

    const { error } = await supabase
      .from('staff_costs')
      .delete()
      .eq('id', id)

    if (error) {
      setMessage(error.message)
      return
    }

    if (editingId === id) {
      resetForm()
    }

    setMessage('Costo personale cancellato.')
    loadData()
  }

  function resetForm() {
    setForm(initialForm)
    setEditingId(null)
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
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Costi personale</h1>
        <Link href="/">Home</Link>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ marginTop: 20, display: 'grid', gap: 10, maxWidth: 420 }}
      >
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

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit">{editingId ? 'Aggiorna' : 'Salva'}</button>
          {editingId && (
            <button type="button" onClick={resetForm}>
              Annulla
            </button>
          )}
        </div>
      </form>

      {message && <p style={{ marginTop: 12 }}>{message}</p>}

      <h2 style={{ marginTop: 30 }}>Elenco</h2>

      {rows.length === 0 ? (
        <p>Nessun costo del personale presente.</p>
      ) : (
        <table style={{ marginTop: 10, borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={th}>Mese</th>
              <th style={th}>Costo</th>
              <th style={th}>Ore</th>
              <th style={th}>PV</th>
              <th style={th}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const pv = pointsOfSale.find((p) => p.id === row.point_of_sale_id)

              return (
                <tr key={row.id}>
                  <td style={td}>{row.period_month || ''}</td>
                  <td style={td}>{row.amount || ''}</td>
                  <td style={td}>{row.worked_hours || ''}</td>
                  <td style={td}>{pv?.name || ''}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => handleEdit(row)}>
                        Modifica
                      </button>
                      <button type="button" onClick={() => handleDelete(row.id)}>
                        Cancella
                      </button>
                    </div>
                  </td>
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
