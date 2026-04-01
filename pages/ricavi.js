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
  const [selectedMonth, setSelectedMonth] = useState('')

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
  }, [user, selectedMonth])

  async function loadData() {
    setMessage('')

    let revenuesQuery = supabase
      .from('revenues')
      .select('*')
      .order('date', { ascending: false })

    if (selectedMonth) {
      const startDate = `${selectedMonth}-01`
      const endDate = `${getNextMonth(selectedMonth)}-01`

      revenuesQuery = revenuesQuery
        .gte('date', startDate)
        .lt('date', endDate)
    }

    const [{ data: rev, error: revError }, { data: pv, error: pvError }] =
      await Promise.all([
        revenuesQuery,
        supabase.from('points_of_sale').select('*').order('name'),
      ])

    if (revError || pvError) {
      setMessage(revError?.message || pvError?.message || 'Errore caricamento dati')
      return
    }

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
      const { error } = await supabase
        .from('revenues')
        .update(payload)
        .eq('id', editingId)

      if (error) {
        setMessage(error.message)
        return
      }

      setMessage('Ricavo aggiornato.')
    } else {
      const { error } = await supabase.from('revenues').insert(payload)

      if (error) {
        setMessage(error.message)
        return
      }

      setMessage('Ricavo inserito.')
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
    setMessage('')
  }

  async function handleDelete(id) {
    const conferma = window.confirm('Vuoi davvero cancellare questo ricavo?')
    if (!conferma) return

    const { error } = await supabase.from('revenues').delete().eq('id', id)

    if (error) {
      setMessage(error.message)
      return
    }

    if (editingId === id) resetForm()

    setMessage('Ricavo cancellato.')
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
        <h1 style={{ margin: 0 }}>Ricavi</h1>
        <Link href="/">Home</Link>
      </div>

      <div style={{ marginTop: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
        <label>Mese:</label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        />
        <button type="button" onClick={() => setSelectedMonth('')}>
          Tutti
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ marginTop: 20, display: 'grid', gap: 10, maxWidth: 400 }}
      >
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

      <h2 style={{ marginTop: 30 }}>Elenco ricavi</h2>

      {rows.length === 0 ? (
        <p>Nessun ricavo presente.</p>
      ) : (
        <table style={{ marginTop: 10, borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={th}>Data</th>
              <th style={th}>Importo</th>
              <th style={th}>PV</th>
              <th style={th}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const pv = pointsOfSale.find((p) => p.id === row.point_of_sale_id)

              return (
                <tr key={row.id}>
                  <td style={td}>{row.date || ''}</td>
                  <td style={td}>{row.amount || ''}</td>
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

function getNextMonth(month) {
  const [year, mon] = month.split('-').map(Number)
  let nextYear = year
  let nextMonth = mon + 1

  if (nextMonth === 13) {
    nextMonth = 1
    nextYear = year + 1
  }

  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`
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
