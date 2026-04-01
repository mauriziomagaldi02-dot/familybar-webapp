import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

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
    return suppliers.find((s) => s.id === id)?.name || ''
  }

  function getPvName(id) {
    return pointsOfSale.find((p) => p.id === id)?.name || ''
  }

  function getCategoryName(id) {
    return categories.find((c) => c.id === id)?.name || ''
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
        <h1 style={{ margin: 0 }}>Mappature fornitori</h1>
        <Link href="/">Home</Link>
      </div>

      <div style={{ marginTop: 20 }}>
        <button type="button" onClick={handleApplyMappings} disabled={isApplying}>
          {isApplying ? 'Applicazione in corso...' : 'Applica mappature alle fatture'}
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ marginTop: 24, display: 'grid', gap: 12, maxWidth: 520 }}
      >
        <select
          value={form.supplier_id}
          onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
        >
          <option value="">Seleziona fornitore</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

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
        >
          <option value="">Seleziona categoria predefinita</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
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

      {message && <p style={{ marginTop: 16 }}>{message}</p>}

      <h2 style={{ marginTop: 32 }}>Elenco mappature</h2>

      {rows.length === 0 ? (
        <p>Nessuna mappatura presente.</p>
      ) : (
        <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
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
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={td}>{getSupplierName(row.supplier_id)}</td>
                <td style={td}>{row.is_general ? '' : getPvName(row.point_of_sale_id)}</td>
                <td style={td}>{getCategoryName(row.category_id)}</td>
                <td style={td}>{row.is_general ? 'Sì' : 'No'}</td>
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
            ))}
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
