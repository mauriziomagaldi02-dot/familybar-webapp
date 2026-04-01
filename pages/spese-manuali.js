import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

const initialForm = {
  cost_date: '',
  description: '',
  amount: '',
  point_of_sale_id: '',
  is_general: false,
  note: '',
}

export default function SpeseManuali() {
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

    const [{ data: costs, error: costsError }, { data: pvData, error: pvError }] =
      await Promise.all([
        supabase.from('manual_costs').select('*').order('cost_date', { ascending: false }),
        supabase.from('points_of_sale').select('*').order('name'),
      ])

    if (costsError || pvError) {
      setMessage(costsError?.message || pvError?.message || 'Errore caricamento dati')
      return
    }

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

    if (editingId) {
      const { error } = await supabase
        .from('manual_costs')
        .update(payload)
        .eq('id', editingId)

      if (error) {
        setMessage(error.message)
        return
      }

      setMessage('Spesa manuale aggiornata.')
    } else {
      const { error } = await supabase.from('manual_costs').insert(payload)

      if (error) {
        setMessage(error.message)
        return
      }

      setMessage('Spesa manuale inserita.')
    }

    resetForm()
    loadData()
  }

  function handleEdit(row) {
    setEditingId(row.id)
    setForm({
      cost_date: row.cost_date || '',
      description: row.description || '',
      amount: row.amount ?? '',
      point_of_sale_id: row.point_of_sale_id || '',
      is_general: !!row.is_general,
      note: row.note || '',
    })
    setMessage('')
  }

  async function handleDelete(id) {
    const conferma = window.confirm('Vuoi davvero cancellare questa spesa?')

    if (!conferma) return

    const { error } = await supabase.from('manual_costs').delete().eq('id', id)

    if (error) {
      setMessage(error.message)
      return
    }

    if (editingId === id) {
      resetForm()
    }

    setMessage('Spesa manuale cancellata.')
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
        <h1 style={{ margin: 0 }}>Spese manuali</h1>
        <Link href="/">Home</Link>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ marginTop: 20, display: 'grid', gap: 10, maxWidth: 500 }}
      >
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
            onChange={(e) =>
              setForm({
                ...form,
                is_general: e.target.checked,
                point_of_sale_id: e.target.checked ? '' : form.point_of_sale_id,
              })
            }
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

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit">
            {editingId ? 'Aggiorna' : 'Salva'}
          </button>

          {editingId && (
            <button type="button" onClick={resetForm}>
              Annulla modifica
            </button>
          )}
        </div>
      </form>

      {message && <p style={{ marginTop: 12 }}>{message}</p>}

      <h2 style={{ marginTop: 30 }}>Elenco</h2>

      {rows.length === 0 ? (
        <p>Nessuna spesa manuale presente.</p>
      ) : (
        <table style={{ marginTop: 10, borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={th}>Data</th>
              <th style={th}>Descrizione</th>
              <th style={th}>Importo</th>
              <th style={th}>PV</th>
              <th style={th}>Generale</th>
              <th style={th}>Note</th>
              <th style={th}>Azioni</th>
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
                  <td style={td}>{row.is_general ? '' : pv?.name || ''}</td>
                  <td style={td}>{row.is_general ? 'Sì' : 'No'}</td>
                  <td style={td}>{row.note || ''}</td>
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
