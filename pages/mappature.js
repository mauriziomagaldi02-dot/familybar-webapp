import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'

const initialForm = {
  supplier_id: '',
  point_of_sale_id: '',
  category_id: '',
  is_general: false,
}

export default function Mappature() {
  const [user, setUser] = useState(null)
  const [rows, setRows] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [pointsOfSale, setPointsOfSale] = useState([])
  const [categories, setCategories] = useState([])
  const [message, setMessage] = useState('')
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
  const [isApplying, setIsApplying] = useState(false)
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

    const [
      { data: mappingsData, error: mappingsError },
      { data: suppliersData, error: suppliersError },
      { data: pvData, error: pvError },
      { data: categoriesData, error: categoriesError },
    ] = await Promise.all([
      supabase.from('supplier_mappings').select('*').order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('points_of_sale').select('*').order('name'),
      supabase.from('categories').select('*').order('name'),
    ])

    if (mappingsError || suppliersError || pvError || categoriesError) {
      setMessage(
        mappingsError?.message ||
          suppliersError?.message ||
          pvError?.message ||
          categoriesError?.message ||
          'Errore caricamento dati'
      )
      return
    }

    setRows(mappingsData || [])
    setSuppliers(suppliersData || [])
    setPointsOfSale(pvData || [])
    setCategories(categoriesData || [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')

    const payload = {
      supplier_id: form.supplier_id || null,
      point_of_sale_id: form.is_general ? null : form.point_of_sale_id || null,
      category_id: form.category_id || null,
      is_general: !!form.is_general,
    }

    if (!payload.supplier_id) {
      setMessage('Seleziona un fornitore.')
      return
    }

    if (editingId) {
      const { error } = await supabase
        .from('supplier_mappings')
        .update(payload)
        .eq('id', editingId)

      if (error) {
        setMessage(error.message)
        return
      }

      setMessage('Mappatura aggiornata.')
    } else {
      const { error } = await supabase
        .from('supplier_mappings')
        .insert(payload)

      if (error) {
        setMessage(error.message)
        return
      }

      setMessage('Mappatura salvata.')
    }

    resetForm()
    loadData()
  }

  function handleEdit(row) {
    setEditingId(row.id)
    setForm({
      supplier_id: row.supplier_id || '',
      point_of_sale_id: row.point_of_sale_id || '',
      category_id: row.category_id || '',
      is_general: !!row.is_general,
    })
    setMessage('')
  }

  async function handleDelete(id) {
    const conferma = window.confirm('Vuoi davvero cancellare questa mappatura?')
    if (!conferma) return

    const { error } = await supabase
      .from('supplier_mappings')
      .delete()
      .eq('id', id)

    if (error) {
      setMessage(error.message)
      return
    }

    if (editingId === id) resetForm()

    setMessage('Mappatura cancellata.')
    loadData()
  }

  async function handleApplyMappings() {
    setMessage('')
    setIsApplying(true)

    try {
      const { data: mappings, error: mappingsError } = await supabase
        .from('supplier_mappings')
        .select('*')

      if (mappingsError) throw new Error(mappingsError.message)

      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')

      if (invoicesError) throw new Error(invoicesError.message)

      if (!mappings || mappings.length === 0) {
        setMessage('Nessuna mappatura da applicare.')
        setIsApplying(false)
        return
      }

      if (!invoices || invoices.length === 0) {
        setMessage('Nessuna fattura presente.')
        setIsApplying(false)
        return
      }

      const mappingsBySupplier = new Map()
      for (const mapping of mappings) {
        if (mapping.supplier_id) {
          mappingsBySupplier.set(mapping.supplier_id, mapping)
        }
      }

      const invoicesToUpdate = invoices.filter((inv) => mappingsBySupplier.has(inv.supplier_id))

      if (invoicesToUpdate.length === 0) {
        setMessage('Nessuna fattura compatibile con le mappature.')
        setIsApplying(false)
        return
      }

      let updatedCount = 0

      for (const invoice of invoicesToUpdate) {
        const mapping = mappingsBySupplier.get(invoice.supplier_id)

        const payload = {
          point_of_sale_id: mapping.is_general ? null : mapping.point_of_sale_id || null,
          category_id: mapping.category_id || null,
          is_general: !!mapping.is_general,
        }

        const { error } = await supabase
          .from('invoices')
          .update(payload)
          .eq('id', invoice.id)

        if (error) throw new Error(error.message)

        updatedCount += 1
      }

      setMessage(`Mappature applicate a ${updatedCount} fatture.`)
    } catch (err) {
      setMessage(err.message || 'Errore applicazione mappature')
    } finally {
      setIsApplying(false)
    }
  }

  function resetForm() {
    setForm(initialForm)
    setEditingId(null)
  }

  function getSupplierName(id) {
    return suppliers.find((s) => String(s.id) === String(id))?.name || ''
  }

  function getPvName(id) {
    return pointsOfSale.find((p) => String(p.id) === String(id))?.name || ''
  }

  function getCategoryName(id) {
    return categories.find((c) => String(c.id) === String(id))?.name || ''
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
        <h1 style={pageTitleStyle}>Mappature fornitori</h1>
      </div>

      <div style={actionWrapStyle}>
        <button
          type="button"
          onClick={handleApplyMappings}
          disabled={isApplying}
          style={isApplying ? disabledButtonStyle : primaryButtonStyle}
        >
          {isApplying ? 'Applicazione in corso...' : 'Applica mappature alle fatture'}
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
        <select
          value={form.supplier_id}
          onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
          style={fieldStyle}
        >
          <option value="">Seleziona fornitore</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

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
            <option value="">Seleziona PV predefinito</option>
            {pointsOfSale.map((pv) => (
              <option key={pv.id} value={pv.id}>
                {pv.name}
              </option>
            ))}
          </select>
        )}

        <select
          value={form.category_id}
          onChange={(e) => setForm({ ...form, category_id: e.target.value })}
          style={fieldStyle}
        >
          <option value="">Seleziona categoria predefinita</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

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

      <h2 style={sectionTitleStyle}>Elenco mappature</h2>

      {rows.length === 0 ? (
        <p>Nessuna mappatura presente.</p>
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
                <th style={th}>Fornitore</th>
                <th style={th}>PV</th>
                <th style={th}>Categoria</th>
                <th style={th}>Generale</th>
                <th style={th}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row) => (
                <tr key={row.id}>
                  <td style={td}>{getSupplierName(row.supplier_id)}</td>
                  <td style={td}>{row.is_general ? '' : getPvName(row.point_of_sale_id)}</td>
                  <td style={td}>{getCategoryName(row.category_id)}</td>
                  <td style={td}>{row.is_general ? 'Sì' : 'No'}</td>
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
  marginTop: 24,
  display: 'grid',
  gap: 12,
  maxWidth: 520,
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
  marginTop: 16,
  color: '#111827',
}

const sectionTitleStyle = {
  marginTop: 32,
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
  borderCollapse: 'collapse',
  width: '100%',
  marginTop: 12,
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
