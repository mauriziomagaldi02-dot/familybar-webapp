import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

const initialForm = {
  name: '',
  vat_number: '',
  tax_code: '',
}

export default function Fornitori() {
  const [user, setUser] = useState(null)
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
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

    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name')

    if (error) {
      setMessage(error.message)
      return
    }

    setRows(data || [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')

    const payload = {
      name: form.name || null,
      vat_number: form.vat_number || null,
      tax_code: form.tax_code || null,
      normalized_name: normalizeName(form.name),
    }

    if (!payload.name) {
      setMessage('Inserisci il nome fornitore')
      return
    }

    if (editingId) {
      const { error } = await supabase
        .from('suppliers')
        .update(payload)
        .eq('id', editingId)

      if (error) {
        setMessage(error.message)
        return
      }

      setMessage('Fornitore aggiornato')
    } else {
      const { error } = await supabase
        .from('suppliers')
        .insert(payload)

      if (error) {
        setMessage(error.message)
        return
      }

      setMessage('Fornitore inserito')
    }

    resetForm()
    loadData()
  }

  function handleEdit(row) {
    setEditingId(row.id)
    setForm({
      name: row.name || '',
      vat_number: row.vat_number || '',
      tax_code: row.tax_code || '',
    })
    setMessage('')
  }

  async function handleDelete(id) {
    const conferma = window.confirm('Vuoi cancellare questo fornitore?')
    if (!conferma) return

    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Fornitore cancellato')
    loadData()
  }

  function resetForm() {
    setForm(initialForm)
    setEditingId(null)
  }

  if (!user) {
    return (
      <div style={{ padding: 40 }}>
        <p>Devi accedere</p>
        <Link href="/">Home</Link>
      </div>
    )
  }

  return (
    <div style={{ padding: 40, fontFamily: 'Arial' }}>
      <div style={{ display: 'flex', gap: 16 }}>
        <h1>Fornitori</h1>
        <Link href="/">Home</Link>
      </div>

      {/* FORM */}
      <form
        onSubmit={handleSubmit}
        style={{ marginTop: 20, display: 'grid', gap: 10, maxWidth: 400 }}
      >
        <input
          placeholder="Nome fornitore"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <input
          placeholder="P.IVA"
          value={form.vat_number}
          onChange={(e) => setForm({ ...form, vat_number: e.target.value })}
        />

        <input
          placeholder="Codice fiscale"
          value={form.tax_code}
          onChange={(e) => setForm({ ...form, tax_code: e.target.value })}
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit">
            {editingId ? 'Aggiorna' : 'Salva'}
          </button>

          {editingId && (
            <button type="button" onClick={resetForm}>
              Annulla
            </button>
          )}
        </div>
      </form>

      {message && <p style={{ marginTop: 10 }}>{message}</p>}

      {/* TABELLA */}
      <h2 style={{ marginTop: 30 }}>Elenco fornitori</h2>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Nome</th>
            <th style={th}>P.IVA</th>
            <th style={th}>Codice fiscale</th>
            <th style={th}>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.name}</td>
              <td style={td}>{row.vat_number || ''}</td>
              <td style={td}>{row.tax_code || ''}</td>
              <td style={td}>
                <button onClick={() => handleEdit(row)}>Modifica</button>
                <button onClick={() => handleDelete(row.id)}>Cancella</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,]/g, '')
    .trim()
}

const th = {
  border: '1px solid #ccc',
  padding: 8,
  background: '#f5f5f5',
}

const td = {
  border: '1px solid #ccc',
  padding: 8,
}
