import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'

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
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

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

  useEffect(() => {
    setCurrentPage(1)
  }, [pageSize, rows.length])

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return rows.slice(startIndex, startIndex + pageSize)
  }, [rows, currentPage, pageSize])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

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

    if (editingId === id) resetForm()

    setMessage('Fornitore cancellato')
    loadData()
  }

  function resetForm() {
    setForm(initialForm)
    setEditingId(null)
  }

  function goToPrevPage() {
    setCurrentPage((prev) => Math.max(1, prev - 1))
  }

  function goToNextPage() {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
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
    <Layout onLogout={handleLogout} compactMenu>
      <div style={pageHeaderStyle}>
        <h1 style={pageTitleStyle}>Fornitori</h1>
      </div>

      <div style={actionWrapStyle}>
        <label style={filterLabelStyle}>Mostra</label>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          style={filterInputStyle}
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>

      <form
        onSubmit={handleSubmit}
        style={formWrapStyle}
      >
        <input
          placeholder="Nome fornitore"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          style={fieldStyle}
        />

        <input
          placeholder="P.IVA"
          value={form.vat_number}
          onChange={(e) => setForm({ ...form, vat_number: e.target.value })}
          style={fieldStyle}
        />

        <input
          placeholder="Codice fiscale"
          value={form.tax_code}
          onChange={(e) => setForm({ ...form, tax_code: e.target.value })}
          style={fieldStyle}
        />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="submit" style={primaryButtonStyle}>
            {editingId ? 'Aggiorna' : 'Salva'}
          </button>

          {editingId && (
            <button type="button" onClick={resetForm} style={secondaryButtonStyle}>
              Annulla
            </button>
          )}
        </div>
      </form>

      {message && <p style={messageStyle}>{message}</p>}

      <h2 style={sectionTitleStyle}>Elenco fornitori</h2>

      {rows.length === 0 ? (
        <p>Nessun fornitore presente.</p>
      ) : (
        <>
          <div style={paginationInfoStyle}>
            <span>
              Totale fornitori: <strong>{rows.length}</strong>
            </span>
            <span>
              Pagina <strong>{currentPage}</strong> di <strong>{totalPages}</strong>
            </span>
          </div>

          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Nome</th>
                <th style={th}>P.IVA</th>
                <th style={th}>Codice fiscale</th>
                <th style={th}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row) => (
                <tr key={row.id}>
                  <td style={td}>{row.name}</td>
                  <td style={td}>{row.vat_number || ''}</td>
                  <td style={td}>{row.tax_code || ''}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => handleEdit(row)} style={smallButtonStyle}>
                        Modifica
                      </button>
                      <button type="button" onClick={() => handleDelete(row.id)} style={smallDangerButtonStyle}>
                        Cancella
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={paginationWrapStyle}>
            <button
              type="button"
              onClick={goToPrevPage}
              disabled={currentPage === 1}
              style={currentPage === 1 ? disabledButtonStyle : secondaryButtonStyle}
            >
              ← Precedente
            </button>

            <button
              type="button"
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              style={currentPage === totalPages ? disabledButtonStyle : secondaryButtonStyle}
            >
              Successiva →
            </button>
          </div>
        </>
      )}
    </Layout>
  )
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,]/g, '')
    .trim()
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

const actionWrapStyle = {
  marginTop: 20,
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  flexWrap: 'wrap',
  marginBottom: 12,
}

const filterLabelStyle = {
  fontSize: 14,
  fontWeight: 600,
  color: '#374151',
}

const filterInputStyle = {
  padding: '10px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 10,
  fontSize: 14,
  background: '#fff',
}

const formWrapStyle = {
  marginTop: 20,
  display: 'grid',
  gap: 10,
  maxWidth: 400,
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

const secondaryButtonStyle = {
  padding: '10px 14px',
  border: '1px solid #d1d5db',
  borderRadius: 10,
  background: '#fff',
  cursor: 'pointer',
  fontSize: 14,
}

const disabledButtonStyle = {
  padding: '10px 14px',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  background: '#f3f4f6',
  color: '#9ca3af',
  cursor: 'not-allowed',
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

const messageStyle = {
  marginTop: 10,
  color: '#111827',
}

const sectionTitleStyle = {
  marginTop: 30,
  color: '#111827',
}

const paginationInfoStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  marginTop: 12,
  marginBottom: 12,
  fontSize: 14,
  color: '#374151',
}

const paginationWrapStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  marginTop: 16,
}

const table = {
  width: '100%',
  borderCollapse: 'collapse',
}

const th = {
  border: '1px solid #ccc',
  padding: 8,
  background: '#f5f5f5',
  textAlign: 'left',
}

const td = {
  border: '1px solid #ccc',
  padding: 8,
}
