import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'

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
  const [selectedMonth, setSelectedMonth] = useState('')
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
  }, [user, selectedMonth])

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedMonth, pageSize])

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

    let costsQuery = supabase
      .from('manual_costs')
      .select('*')
      .order('cost_date', { ascending: false })

    if (selectedMonth) {
      const startDate = `${selectedMonth}-01`
      const endDate = `${getNextMonth(selectedMonth)}-01`

      costsQuery = costsQuery
        .gte('cost_date', startDate)
        .lt('cost_date', endDate)
    }

    const [{ data: costs, error: costsError }, { data: pvData, error: pvError }] =
      await Promise.all([
        costsQuery,
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

    if (editingId === id) resetForm()

    setMessage('Spesa manuale cancellata.')
    loadData()
  }

  function resetForm() {
    setForm(initialForm)
    setEditingId(null)
  }

  function getPvName(id) {
    return pointsOfSale.find((p) => String(p.id) === String(id))?.name || ''
  }

  function goToPrevPage() {
    setCurrentPage((prev) => Math.max(1, prev - 1))
  }

  function goToNextPage() {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
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
    <Layout onLogout={handleLogout} compactMenu>
      <div style={pageHeaderStyle}>
        <h1 style={pageTitleStyle}>Spese manuali</h1>
      </div>

      <div style={filtersWrapStyle}>
        <label style={filterLabelStyle}>Mese</label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={filterInputStyle}
        />
        <button type="button" onClick={() => setSelectedMonth('')} style={secondaryButtonStyle}>
          Tutti
        </button>

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
          type="date"
          value={form.cost_date}
          onChange={(e) => setForm({ ...form, cost_date: e.target.value })}
          style={fieldStyle}
        />

        <input
          type="text"
          placeholder="Descrizione"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          style={fieldStyle}
        />

        <input
          type="number"
          step="0.01"
          placeholder="Importo €"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          style={fieldStyle}
        />

        <label style={checkboxLabelStyle}>
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
            style={fieldStyle}
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
          style={fieldStyle}
        />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="submit" style={primaryButtonStyle}>
            {editingId ? 'Aggiorna' : 'Salva'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} style={secondaryButtonStyle}>
              Annulla modifica
            </button>
          )}
        </div>
      </form>

      {message && <p style={messageStyle}>{message}</p>}

      <h2 style={sectionTitleStyle}>Elenco</h2>

      {rows.length === 0 ? (
        <p>Nessuna spesa manuale presente.</p>
      ) : (
        <>
          <div style={paginationInfoStyle}>
            <span>
              Totale righe: <strong>{rows.length}</strong>
            </span>
            <span>
              Pagina <strong>{currentPage}</strong> di <strong>{totalPages}</strong>
            </span>
          </div>

          <table style={table}>
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
              {paginatedRows.map((row) => (
                <tr key={row.id}>
                  <td style={td}>{row.cost_date || ''}</td>
                  <td style={td}>{row.description || ''}</td>
                  <td style={td}>{row.amount || ''}</td>
                  <td style={td}>{row.is_general ? '' : getPvName(row.point_of_sale_id)}</td>
                  <td style={td}>{row.is_general ? 'Sì' : 'No'}</td>
                  <td style={td}>{row.note || ''}</td>
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

const filtersWrapStyle = {
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
  maxWidth: 500,
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

const checkboxLabelStyle = {
  fontSize: 14,
  color: '#111827',
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
  marginTop: 12,
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
  marginTop: 10,
  borderCollapse: 'collapse',
  width: '100%',
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
