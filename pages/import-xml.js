import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

export default function ImportXml() {
  const [user, setUser] = useState(null)
  const [suppliers, setSuppliers] = useState([])
  const [mappings, setMappings] = useState([])
  const [message, setMessage] = useState('')
  const [previewRows, setPreviewRows] = useState([])
  const [isImporting, setIsImporting] = useState(false)

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
    if (user) loadReferenceData()
  }, [user])

  const suppliersByNormalizedName = useMemo(() => {
    const map = new Map()
    for (const s of suppliers) {
      if (s.name) {
        map.set(normalizeSupplierName(s.name), s)
      }
    }
    return map
  }, [suppliers])

  const mappingsBySupplierId = useMemo(() => {
    const map = new Map()
    for (const m of mappings) {
      if (m.supplier_id) {
        map.set(m.supplier_id, m)
      }
    }
    return map
  }, [mappings])

  async function loadReferenceData() {
    setMessage('')

    const [
      { data: suppliersData, error: suppliersError },
      { data: mappingsData, error: mappingsError },
    ] = await Promise.all([
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('supplier_mappings').select('*'),
    ])

    if (suppliersError || mappingsError) {
      setMessage(
        suppliersError?.message ||
          mappingsError?.message ||
          'Errore caricamento dati di riferimento'
      )
      return
    }

    setSuppliers(suppliersData || [])
    setMappings(mappingsData || [])
  }

  async function handleFilesChange(e) {
    const selectedFiles = Array.from(e.target.files || [])
    setMessage('')

    if (selectedFiles.length === 0) {
      setPreviewRows([])
      return
    }

    const parsedRows = []

    for (const file of selectedFiles) {
      try {
        const text = await file.text()
        const parsed = parseFatturaXml(text, file.name)

        const matchedSupplier = parsed.supplier_name
          ? suppliersByNormalizedName.get(normalizeSupplierName(parsed.supplier_name))
          : null

        const mapping = matchedSupplier
          ? mappingsBySupplierId.get(matchedSupplier.id)
          : null

        parsedRows.push({
          ...parsed,
          supplier_id: matchedSupplier?.id || null,
          matched_supplier_name: matchedSupplier?.name || '',
          point_of_sale_id: mapping?.is_general ? null : mapping?.point_of_sale_id || null,
          category_id: mapping?.category_id || null,
          is_general: !!mapping?.is_general,
          will_create_supplier: !matchedSupplier,
        })
      } catch (error) {
        parsedRows.push({
          source_filename: file.name,
          error: error.message || 'Errore parsing XML',
        })
      }
    }

    setPreviewRows(parsedRows)
  }

  async function handleImport() {
    if (previewRows.length === 0) {
      setMessage('Nessun file da importare.')
      return
    }

    setIsImporting(true)
    setMessage('')

    try {
      let inserted = 0
      let createdSuppliers = 0
      let skipped = 0

      let localSuppliers = [...suppliers]
      let localMappings = [...mappings]

      for (const row of previewRows) {
        if (row.error) {
          skipped += 1
          continue
        }

        let supplierId = row.supplier_id
        let supplierName = row.supplier_name || ''

        if (!supplierId && supplierName) {
          const { data: newSupplier, error: supplierError } = await supabase
            .from('suppliers')
            .insert({ name: supplierName })
            .select()
            .single()

          if (supplierError) {
            skipped += 1
            continue
          }

          supplierId = newSupplier.id
          localSuppliers.push(newSupplier)
          createdSuppliers += 1
        }

        if (!supplierId) {
          skipped += 1
          continue
        }

        const mapping =
          localMappings.find((m) => m.supplier_id === supplierId) || null

        const payload = {
          supplier_id: supplierId,
          supplier_name: supplierName || null,
          invoice_date: row.invoice_date || null,
          invoice_number: row.invoice_number || null,
          amount: row.amount ? Number(row.amount) : null,
          point_of_sale_id: mapping?.is_general ? null : mapping?.point_of_sale_id || null,
          category_id: mapping?.category_id || null,
          is_general: !!mapping?.is_general,
          source_filename: row.source_filename || null,
        }

        const { error } = await supabase.from('invoices').insert(payload)

        if (error) {
          skipped += 1
          continue
        }

        inserted += 1
      }

      setMessage(
        `Import completato. Fatture inserite: ${inserted}. Nuovi fornitori creati: ${createdSuppliers}. Saltate: ${skipped}.`
      )

      setPreviewRows([])
      await loadReferenceData()
    } catch (error) {
      setMessage(error.message || 'Errore durante importazione')
    } finally {
      setIsImporting(false)
    }
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
        <h1 style={{ margin: 0 }}>Import XML Fatture</h1>
        <Link href="/">Home</Link>
      </div>

      <div style={{ marginTop: 24, display: 'grid', gap: 12, maxWidth: 700 }}>
        <input
          type="file"
          accept=".xml,text/xml,application/xml"
          multiple
          onChange={handleFilesChange}
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={handleImport}
            disabled={isImporting || previewRows.length === 0}
          >
            {isImporting ? 'Importazione in corso...' : 'Importa fatture'}
          </button>
        </div>
      </div>

      {message && <p style={{ marginTop: 16 }}>{message}</p>}

      <h2 style={{ marginTop: 32 }}>Anteprima import</h2>

      {previewRows.length === 0 ? (
        <p>Nessun file caricato.</p>
      ) : (
        <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
          <thead>
            <tr>
              <th style={th}>File</th>
              <th style={th}>Fornitore XML</th>
              <th style={th}>Fornitore trovato</th>
              <th style={th}>Numero</th>
              <th style={th}>Data</th>
              <th style={th}>Imponibile</th>
              <th style={th}>Generale</th>
              <th style={th}>Esito</th>
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, idx) => (
              <tr key={idx}>
                <td style={td}>{row.source_filename || ''}</td>
                <td style={td}>{row.supplier_name || ''}</td>
                <td style={td}>{row.matched_supplier_name || ''}</td>
                <td style={td}>{row.invoice_number || ''}</td>
                <td style={td}>{row.invoice_date || ''}</td>
                <td style={td}>{row.amount || ''}</td>
                <td style={td}>{row.is_general ? 'Sì' : 'No'}</td>
                <td style={td}>
                  {row.error
                    ? `Errore: ${row.error}`
                    : row.supplier_id
                    ? 'Pronto'
                    : row.will_create_supplier
                    ? 'Nuovo fornitore: verrà creato'
                    : 'Pronto'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function parseFatturaXml(xmlText, filename) {
  const parser = new DOMParser()
  const xml = parser.parseFromString(xmlText, 'application/xml')

  const parseError = xml.querySelector('parsererror')
  if (parseError) {
    throw new Error('XML non valido')
  }

  const supplierName =
    getNodeText(xml, 'CedentePrestatore Denominazione') ||
    joinParts(
      getNodeText(xml, 'CedentePrestatore Nome'),
      getNodeText(xml, 'CedentePrestatore Cognome')
    )

  const invoiceNumber = getNodeText(xml, 'DatiGeneraliDocumento Numero')
  const invoiceDate = getNodeText(xml, 'DatiGeneraliDocumento Data')

  let amount = getNodeText(xml, 'DatiGeneraliDocumento ImportoTotaleDocumento')

  if (!amount) {
    const imponibili = getAllNodeTexts(xml, 'DatiRiepilogo ImponibileImporto')
      .map((v) => Number(sanitizeNumber(v)))
      .filter((v) => !Number.isNaN(v))

    if (imponibili.length > 0) {
      amount = String(imponibili.reduce((sum, v) => sum + v, 0))
    }
  }

  if (!supplierName) {
    throw new Error('Fornitore non trovato nel file XML')
  }

  return {
    source_filename: filename,
    supplier_name: supplierName,
    invoice_number: invoiceNumber || '',
    invoice_date: invoiceDate || '',
    amount: sanitizeNumber(amount || ''),
  }
}

function getNodeText(xml, path) {
  const parts = path.split(' ')
  let nodes = [xml.documentElement]

  for (const part of parts) {
    const nextNodes = []
    for (const node of nodes) {
      const found = Array.from(node.getElementsByTagName('*')).filter(
        (el) => stripPrefix(el.tagName) === part
      )
      for (const item of found) nextNodes.push(item)
    }
    if (nextNodes.length === 0) return ''
    nodes = nextNodes
  }

  return nodes[0]?.textContent?.trim() || ''
}

function getAllNodeTexts(xml, path) {
  const parts = path.split(' ')
  let nodes = [xml.documentElement]

  for (const part of parts) {
    const nextNodes = []
    for (const node of nodes) {
      const found = Array.from(node.getElementsByTagName('*')).filter(
        (el) => stripPrefix(el.tagName) === part
      )
      for (const item of found) nextNodes.push(item)
    }
    if (nextNodes.length === 0) return []
    nodes = nextNodes
  }

  return nodes.map((n) => n.textContent?.trim() || '').filter(Boolean)
}

function stripPrefix(tagName) {
  return String(tagName).split(':').pop()
}

function normalizeSupplierName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,]/g, '')
    .trim()
}

function sanitizeNumber(value) {
  return String(value || '').replace(',', '.').trim()
}

function joinParts(...parts) {
  return parts.filter(Boolean).join(' ').trim()
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
