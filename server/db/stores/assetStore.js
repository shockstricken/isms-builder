'use strict'

const { getDb, init: initDb } = require('../knexDatabase')

const ASSET_TYPES = {
  hardware_server: 'Server', hardware_workstation: 'Workstation / PC',
  hardware_laptop: 'Laptop / Notebook', hardware_mobile: 'Mobilgerät',
  hardware_network: 'Netzwerk-Equipment', hardware_ics_ot: 'ICS/OT-Anlage',
  hardware_building: 'Gebäudetechnik (BAS/GLT)', hardware_other: 'Hardware (Sonstige)',
  software_app: 'Anwendungssoftware', software_os: 'Betriebssystem',
  software_cloud: 'Cloud-Dienst (IaaS/PaaS)', software_saas: 'SaaS-Anwendung',
  software_other: 'Software (Sonstige)', data_database: 'Datenbank',
  data_document: 'Dokumentensammlung', data_backup: 'Backup / Archiv',
  data_other: 'Daten (Sonstige)', service_internal: 'Interner Dienst',
  service_cloud: 'Cloud-Service (extern)', service_external: 'Externer Dienstleister',
  facility_office: 'Bürogebäude', facility_datacenter: 'Rechenzentrum / Serverraum',
  facility_production: 'Produktionsstätte / Werk', facility_other: 'Einrichtung (Sonstige)',
}

const CATEGORIES = {
  hardware: 'Hardware', software: 'Software',
  data: 'Daten / Informationen', service: 'Dienste', facility: 'Einrichtungen',
}

function nowISO() { return new Date().toISOString() }
function makeId() { return `asset_${require('crypto').randomBytes(4).toString('hex')}` }
function _json(val, fallback) { if (!val) return fallback; try { return JSON.parse(val) } catch { return fallback } }

function rowToAsset(row) {
  if (!row) return null
  const d = _json(row.data, {})
  return {
    id: row.id, name: row.name, description: row.description,
    category: row.category, type: d.type || '',
    classification: row.classification, criticality: row.criticality,
    owner: row.owner, ownerEmail: d.ownerEmail || '',
    custodian: d.custodian || '', entityId: d.entityId || '',
    location: row.location, status: row.status,
    vendor: d.vendor || '', version: d.version || '',
    serialNumber: d.serialNumber || '', purchaseDate: d.purchaseDate || '',
    endOfLifeDate: row.eol_date || '',
    tags: d.tags || [], notes: d.notes || '',
    linkedControls: _json(row.linked_controls, []),
    linkedPolicies: d.linkedPolicies || [],
    applicableEntities: _json(row.applicable_entities, []),
    createdBy: row.created_by, createdAt: row.created_at,
    updatedAt: row.updated_at, deletedAt: row.deleted_at || null,
    updatedBy: d.updatedBy || '', deletedBy: d.deletedBy || '',
  }
}

function packData(a) {
  return JSON.stringify({
    type: a.type, ownerEmail: a.ownerEmail, custodian: a.custodian,
    entityId: a.entityId, vendor: a.vendor, version: a.version,
    serialNumber: a.serialNumber, purchaseDate: a.purchaseDate,
    tags: a.tags || [], notes: a.notes || '',
    linkedPolicies: a.linkedPolicies || [],
    updatedBy: a.updatedBy || '', deletedBy: a.deletedBy || '',
  })
}

module.exports = {
  init: async () => { await initDb() },

  getAll: async ({ category, type, classification, criticality, status, entityId } = {}) => {
    const q = getDb()('assets').whereNull('deleted_at')
    if (category) q.where('category', category)
    if (classification) q.where('classification', classification)
    if (criticality) q.where('criticality', criticality)
    if (status) q.where('status', status)
    let list = (await q).map(rowToAsset)
    if (type) list = list.filter(i => i.type === type)
    if (entityId) list = list.filter(i => i.entityId === entityId)
    return list
  },

  getById: async (id) => {
    const row = await getDb()('assets').where('id', id).whereNull('deleted_at').first()
    return rowToAsset(row)
  },

  create: async (data, { createdBy } = {}) => {
    const a = {
      id: makeId(),
      name: data.name || '', category: data.category || 'hardware',
      type: data.type || '', description: data.description || '',
      owner: data.owner || '', ownerEmail: data.ownerEmail || '',
      custodian: data.custodian || '', entityId: data.entityId || '',
      location: data.location || '',
      classification: data.classification || 'internal',
      criticality: data.criticality || 'medium',
      status: data.status || 'active',
      vendor: data.vendor || '', version: data.version || '',
      serialNumber: data.serialNumber || '', purchaseDate: data.purchaseDate || '',
      endOfLifeDate: data.endOfLifeDate || '',
      tags: Array.isArray(data.tags) ? data.tags : (data.tags ? String(data.tags).split(',').map(t => t.trim()).filter(Boolean) : []),
      notes: data.notes || '',
      linkedControls: Array.isArray(data.linkedControls) ? data.linkedControls : [],
      linkedPolicies: Array.isArray(data.linkedPolicies) ? data.linkedPolicies : [],
      createdBy: createdBy || 'system',
    }
    const now = nowISO()
    await getDb()('assets').insert({
      id: a.id, name: a.name, description: a.description,
      category: a.category, classification: a.classification,
      criticality: a.criticality, owner: a.owner, location: a.location,
      eol_date: a.endOfLifeDate || null, status: a.status,
      applicable_entities: JSON.stringify(data.applicableEntities || []),
      linked_controls: JSON.stringify(a.linkedControls),
      data: packData(a), created_by: a.createdBy, created_at: now, updated_at: now,
    })
    return { ...a, createdAt: now, updatedAt: now }
  },

  update: async (id, patch, { changedBy } = {}) => {
    const row = await getDb()('assets').where('id', id).whereNull('deleted_at').first()
    if (!row) return null
    const a = rowToAsset(row)
    const allowed = ['name','category','type','description','owner','ownerEmail','custodian','entityId',
      'location','classification','criticality','status','vendor','version','serialNumber',
      'purchaseDate','endOfLifeDate','tags','notes','linkedControls','linkedPolicies']
    for (const k of allowed) {
      if (patch[k] !== undefined) a[k] = patch[k]
    }
    if (patch.tags !== undefined && !Array.isArray(a.tags)) {
      a.tags = String(a.tags).split(',').map(t => t.trim()).filter(Boolean)
    }
    a.updatedAt = nowISO()
    if (changedBy) a.updatedBy = changedBy
    await getDb()('assets').where('id', id).update({
      name: a.name, description: a.description, category: a.category,
      classification: a.classification, criticality: a.criticality,
      owner: a.owner, location: a.location, status: a.status,
      eol_date: a.endOfLifeDate || null,
      linked_controls: JSON.stringify(a.linkedControls || []),
      data: packData(a), updated_at: a.updatedAt,
    })
    return a
  },

  remove: async (id) => {
    const affected = await getDb()('assets').where('id', id).whereNull('deleted_at')
      .update({ deleted_at: nowISO() })
    return affected > 0
  },

  getSummary: async () => {
    const rows = await getDb()('assets').whereNull('deleted_at')
    const list = rows.map(rowToAsset)
    const now = new Date()
    const in90 = new Date(now.getTime() + 90 * 86400000)
    const byCategory = { hardware: 0, software: 0, data: 0, service: 0, facility: 0 }
    const byClassification = { public: 0, internal: 0, confidential: 0, strictly_confidential: 0 }
    const byCriticality = { low: 0, medium: 0, high: 0, critical: 0 }
    let unclassified = 0, criticalUnclassified = 0, endOfLifeSoon = 0
    for (const a of list) {
      if (byCategory[a.category] !== undefined) byCategory[a.category]++
      if (byClassification[a.classification] !== undefined) byClassification[a.classification]++
      else unclassified++
      if (byCriticality[a.criticality] !== undefined) byCriticality[a.criticality]++
      if (!a.classification || a.classification === 'public') unclassified++
      if ((a.criticality === 'critical' || a.criticality === 'high') && (!a.classification || a.classification === 'public')) criticalUnclassified++
      if (a.endOfLifeDate) {
        const eol = new Date(a.endOfLifeDate)
        if (eol >= now && eol <= in90) endOfLifeSoon++
      }
    }
    return {
      total: list.length,
      active: list.filter(i => i.status === 'active').length,
      decommissioned: list.filter(i => i.status === 'decommissioned').length,
      planned: list.filter(i => i.status === 'planned').length,
      unclassified, byCategory, byClassification, byCriticality,
      criticalUnclassified, endOfLifeSoon,
    }
  },

  ASSET_TYPES, CATEGORIES,
}
