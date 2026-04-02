import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'

const initialForm = {
  name: '',
}

export default function Categorie() {
  const [user, setUser] = useState(null)
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

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

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  async function loadData() {
    setLoading(true)
    setMessage('')

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    setRows(data || [])
    setLoading(false)
  }

  const normalizedRows = useMemo(() => {
    return [...rows].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''))
    )
  }, [rows])

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')

    const cleanedName = form.name.trim()

    if (!cleanedName) {
      setMessage('Inserisci il nome della categoria')
      return
    }

    const duplicate = rows.find((row) => {
      if (editingId && row.id === editingId) return false
      return String(row.name || '').trim().toLowerCase() === cleanedName.toLowerCase()
    })

    if (duplicate) {
      setMessage('Esiste già una categoria con questo nome')
      return
    }

    setSaving(true)

    if (editingId) {
      const { data, error } = await supabase
        .from('categories')
        .update({ name: cleanedName })
        .eq('id', editingId)
        .select()
        .single()

      if (error) {
        setMessage(error.message)
        setSaving(false)
        return
      }

      setRows((prev) => prev.map((row) => (row.id === editingId ? data : row)))
      setMessage('Categoria aggiornata.')
    } else {
      const { data, error } = await supabase
        .from('categories')
        .insert({ name: cleanedName })
        .select()
        .single()

      if (error) {
        setMessage(error.message)
        setSaving(false)
        return
      }

      setRows((prev) => [...prev, data])
      setMessage('Categoria inserita.')
    }

    resetForm()
    setSaving(false)
  }

  function handleEdit(row) {
    setEditingId(row.id)
    setForm({
      name: row.name || '',
    })
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id) {
    const category = rows.find((row) => row.id === id)
    const confirmText = category?.name
      ? `Vuoi davvero cancellare la categoria "${category.name}"?`
      : 'Vuoi davvero cancellare questa categoria?'

    const conferma = window.confirm(confirmText)
    if (!conferma) return

    setDeletingId(id)
    setMessage('')

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)

    if (error) {
      setMessage(error.message)
      setDeletingId(null)
      return
    }

    setRows((prev) => prev.filter((row) => row.id !== id))

    if (editingId === id) {
      resetForm()
    }

    setMessage('Categoria cancellata.')
    setDeletingId(null)
  }

  function resetForm() {
    setForm(initialForm)
    setEditingId(null)
  }

  if (!user) {
    return (
      <div style={{ padding: 40, fontFamily: 'Arial, sans-serif' }}>
        <h1>Categorie</h1>
        <p>Devi prima accedere.</p>
        <Link href="/">Torna al login</Link>
      </div>
    )
  }

  return (
    <Layout onLogout={handleLogout} compactMenu>
      <div style={pageHeaderStyle}>
        <h1 style={pageTitleStyle}>Categorie</h1>
      </div>

      <form onSubmit={handleSubmit} style={formWrapStyle}>
        <input
          type="text"
          placeholder="Nome categoria"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          style={fieldStyle}
        />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="submit"
            style={saving ? disabledPrimaryButtonStyle : primaryButtonStyle}
            disabled={saving}
          >
            {saving ? 'Salvataggio...' : editingId ? 'Aggiorna' : 'Salva categoria'}
          </button>

          {editingId && (
            <button type="button" onClick={resetForm} style={secondaryButtonStyle}>
              Annulla
            </button>
          )}
        </div>
      </form>

      {message && <p style={messageStyle}>{message}</p>}

      <h2 style={sectionTitleStyle}>Elenco categorie</h2>

      {loading ? (
        <p style={messageStyle}>Caricamento...</p>
      ) : normalizedRows.length === 0 ? (
        <p>Nessuna categoria presente.</p>
      ) : (
        <div style={tableWrapStyle}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Nome</th>
                <th style={th}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {normalizedRows.map((row) => (
                <tr key={row.id}>
                  <td style={td}>{row.name || ''}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleEdit(row)}
                        style={smallButtonStyle}
                        disabled={deletingId === row.id}
                      >
                        Modifica
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(row.id)}
                        style={
                          deletingId === row.id
                            ? disabledDangerButtonStyle
                            : smallDangerButtonStyle
                        }
                        disabled={deletingId === row.id}
                      >
                        {deletingId === row.id ? 'Cancellazione...' : 'Cancella'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}

const pageHeaderStyle = {
  display: 'flex',
  gap: 16,
  alignItems: 'center',
  marginBottom: 20,
}

const pageTitleStyle = {
  margin: 0,
  color: '#111827',
  fontSize: 28,
}

const formWrapStyle = {
  marginTop: 24,
  display: 'grid',
  gap: 12,
  maxWidth: 560,
  padding: 20,
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 16,
}

const fieldStyle = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid #d1d5db',
  borderRadius: 12,
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
  background: '#fff',
}

const primaryButtonStyle = {
  padding: '10px 14px',
  border: 'none',
  borderRadius: 10,
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 600,
}

const disabledPrimaryButtonStyle = {
  padding: '10px 14px',
  border: 'none',
  borderRadius: 10,
  background: '#9ca3af',
  color: '#fff',
  cursor: 'not-allowed',
  fontSize: 14,
  fontWeight: 600,
}

const secondaryButtonStyle = {
  padding: '10px 14px',
  border: '1px solid #d1d5db',
  borderRadius: 10,
  background: '#fff',
  cursor: 'pointer',
  fontSize: 14,
}

const smallButtonStyle = {
  padding: '8px 10px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  background: '#fff',
  cursor: 'pointer',
  fontSize: 13,
}

const smallDangerButtonStyle = {
  padding: '8px 10px',
  border: '1px solid #ef4444',
  borderRadius: 8,
  background: '#fff',
  color: '#b91c1c',
  cursor: 'pointer',
  fontSize: 13,
}

const disabledDangerButtonStyle = {
  padding: '8px 10px',
  border: '1px solid #fca5a5',
  borderRadius: 8,
  background: '#fef2f2',
  color: '#fca5a5',
  cursor: 'not-allowed',
  fontSize: 13,
}

const messageStyle = {
  marginTop: 16,
  color: '#111827',
}

const sectionTitleStyle = {
  marginTop: 32,
  color: '#111827',
}

const tableWrapStyle = {
  width: '100%',
  overflowX: 'auto',
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 16,
  marginTop: 12,
}

const table = {
  borderCollapse: 'collapse',
  width: '100%',
  minWidth: 500,
}

const th = {
  borderBottom: '1px solid #e5e7eb',
  padding: 10,
  textAlign: 'left',
  background: '#f9fafb',
  color: '#111827',
  fontSize: 14,
  whiteSpace: 'nowrap',
}

const td = {
  borderBottom: '1px solid #f1f5f9',
  padding: 10,
  fontSize: 14,
  color: '#111827',
}
