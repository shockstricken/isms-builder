'use strict'

const path = require('path')
const fs = require('fs')

const FILES_DIR = path.join(process.env.DATA_DIR || path.join(__dirname, '../../../data'), 'legal', 'files')
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true })

const { getDb, init: initDb } = require('../knexDatabase')

function nowISO() { return new Date().toISOString() }
function makeId(prefix) { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,6)}` }
function _json(val, fallback) { if (!val) return fallback; try { return JSON.parse(val) } catch { return fallback } }

const CONTRACT_TYPES = ['service','supply','nda','framework','other']
const CONTRACT_STATUSES = ['draft','review','active','expired','terminated']
const NDA_TYPES = ['bilateral','unilateral_recv','unilateral_give']
const NDA_STATUSES = ['draft','signed','expired','terminated']
const POLICY_TYPES = ['privacy_notice','cookie','consent_form','employee','internal','other']
const POLICY_STATUSES = ['draft','review','published','archived']

function rowToItem(row) {
  if (!row) return null
  return { id: row.id, ..._json(row.data, {}), createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at, deletedAt: row.deleted_at || null }
}

const contracts = {
  getAll: async ({ status, type, entity } = {}) => {
    const q = getDb()('legal_entries').where('legal_type', 'contract').whereNull('deleted_at')
    let list = (await q).map(rowToItem)
    if (status) list = list.filter(c => c.status === status)
    if (type) list = list.filter(c => c.contractType === type)
    if (entity) list = list.filter(c => !c.applicableEntities?.length || c.applicableEntities.includes(entity))
    return list
  },
  getById: async (id) => {
    const row = await getDb()('legal_entries').where('id', id).where('legal_type', 'contract').whereNull('deleted_at').first()
    return rowToItem(row)
  },
  create: async (fields, createdBy) => {
    const id = makeId('contract')
    const now = nowISO()
    const item = {
      id, title: fields.title || 'Ohne Titel',
      contractType: CONTRACT_TYPES.includes(fields.contractType) ? fields.contractType : 'other',
      counterparty: fields.counterparty || '', description: fields.description || '',
      startDate: fields.startDate || null, endDate: fields.endDate || null,
      autoRenew: !!fields.autoRenew,
      noticePeriodDays: parseInt(fields.noticePeriodDays) || null,
      owner: fields.owner || createdBy || '',
      status: CONTRACT_STATUSES.includes(fields.status) ? fields.status : 'draft',
      value: fields.value || '', currency: fields.currency || 'EUR',
      linkedVvt: Array.isArray(fields.linkedVvt) ? fields.linkedVvt : [],
      applicableEntities: Array.isArray(fields.applicableEntities) ? fields.applicableEntities : [],
      notes: fields.notes || '',
      linkedControls: Array.isArray(fields.linkedControls) ? fields.linkedControls : [],
      linkedPolicies: Array.isArray(fields.linkedPolicies) ? fields.linkedPolicies : [],
      attachments: [],
      createdBy: createdBy || 'system', createdAt: now, updatedAt: now,
    }
    await getDb()('legal_entries').insert({ id, legal_type: 'contract', data: JSON.stringify(item), created_by: createdBy || 'system', created_at: now, updated_at: now })
    return item
  },
  update: async (id, fields) => {
    const row = await getDb()('legal_entries').where('id', id).where('legal_type', 'contract').first()
    if (!row) return null
    const item = rowToItem(row)
    const updatable = ['title','contractType','counterparty','description','startDate','endDate',
      'autoRenew','noticePeriodDays','owner','status','value','currency','linkedVvt','applicableEntities','notes',
      'linkedControls','linkedPolicies']
    for (const k of updatable) { if (fields[k] !== undefined) item[k] = fields[k] }
    item.updatedAt = nowISO()
    await getDb()('legal_entries').where('id', id).update({ data: JSON.stringify(item), updated_at: item.updatedAt })
    return item
  },
  delete: async (id, deletedBy) => {
    const row = await getDb()('legal_entries').where('id', id).where('legal_type', 'contract').first()
    if (!row) return false
    const item = rowToItem(row)
    item.deletedAt = nowISO()
    item.deletedBy = deletedBy || null
    await getDb()('legal_entries').where('id', id).update({ deleted_at: nowISO(), data: JSON.stringify(item) })
    return true
  },
  permanentDelete: async (id) => {
    const affected = await getDb()('legal_entries').where('id', id).where('legal_type', 'contract').del()
    return affected > 0
  },
  restore: async (id) => {
    const row = await getDb()('legal_entries').where('id', id).first()
    if (!row) return null
    const item = rowToItem(row)
    delete item.deletedAt
    delete item.deletedBy
    await getDb()('legal_entries').where('id', id).update({ deleted_at: null, data: JSON.stringify(item) })
    return rowToItem({ ...row, deleted_at: null })
  },
  getDeleted: async () => {
    const rows = await getDb()('legal_entries').where('legal_type', 'contract').whereNotNull('deleted_at')
    return rows.map(rowToItem)
  },
  addAttachment: async (id, meta) => {
    const row = await getDb()('legal_entries').where('id', id).where('legal_type', 'contract').first()
    if (!row) return null
    const item = rowToItem(row)
    if (!item.attachments) item.attachments = []
    item.attachments.push(meta)
    item.updatedAt = nowISO()
    await getDb()('legal_entries').where('id', id).update({ data: JSON.stringify(item), updated_at: item.updatedAt })
    return item
  },
  removeAttachment: async (id, attId) => {
    const row = await getDb()('legal_entries').where('id', id).where('legal_type', 'contract').first()
    if (!row) return null
    const item = rowToItem(row)
    const attIdx = (item.attachments || []).findIndex(a => a.id === attId)
    if (attIdx === -1) return null
    const [att] = item.attachments.splice(attIdx, 1)
    item.updatedAt = nowISO()
    await getDb()('legal_entries').where('id', id).update({ data: JSON.stringify(item), updated_at: item.updatedAt })
    return att
  },
  getExpiring: async (daysAhead = 60) => {
    const rows = await getDb()('legal_entries').where('legal_type', 'contract').whereNull('deleted_at')
    const list = rows.map(rowToItem).filter(c => ['active','review'].includes(c.status) && c.endDate)
    const now = new Date()
    const cut = new Date(now.getTime() + daysAhead * 86400000)
    return list.filter(c => {
      const end = new Date(c.endDate)
      const notice = c.noticePeriodDays || 0
      const noticeDate = new Date(end.getTime() - notice * 86400000)
      return noticeDate <= cut
    }).map(c => {
      const end = new Date(c.endDate)
      const notice = c.noticePeriodDays || 0
      return { ...c, noticeDate: new Date(end.getTime() - notice * 86400000).toISOString().slice(0, 10) }
    })
  },
}

const ndas = {
  getAll: async ({ status, entity } = {}) => {
    const q = getDb()('legal_entries').where('legal_type', 'nda').whereNull('deleted_at')
    let list = (await q).map(rowToItem)
    if (status) list = list.filter(n => n.status === status)
    if (entity) list = list.filter(n => !n.applicableEntities?.length || n.applicableEntities.includes(entity))
    return list
  },
  getById: async (id) => {
    const row = await getDb()('legal_entries').where('id', id).where('legal_type', 'nda').whereNull('deleted_at').first()
    return rowToItem(row)
  },
  create: async (fields, createdBy) => {
    const id = makeId('nda')
    const now = nowISO()
    const item = {
      id, title: fields.title || 'NDA',
      ndaType: NDA_TYPES.includes(fields.ndaType) ? fields.ndaType : 'bilateral',
      counterparty: fields.counterparty || '', signingDate: fields.signingDate || null,
      expiryDate: fields.expiryDate || null, scope: fields.scope || '',
      owner: fields.owner || createdBy || '',
      status: NDA_STATUSES.includes(fields.status) ? fields.status : 'draft',
      applicableEntities: Array.isArray(fields.applicableEntities) ? fields.applicableEntities : [],
      notes: fields.notes || '',
      linkedControls: Array.isArray(fields.linkedControls) ? fields.linkedControls : [],
      linkedPolicies: Array.isArray(fields.linkedPolicies) ? fields.linkedPolicies : [],
      attachments: [],
      createdBy: createdBy || 'system', createdAt: now, updatedAt: now,
    }
    await getDb()('legal_entries').insert({ id, legal_type: 'nda', data: JSON.stringify(item), created_by: createdBy || 'system', created_at: now, updated_at: now })
    return item
  },
  update: async (id, fields) => {
    const row = await getDb()('legal_entries').where('id', id).where('legal_type', 'nda').first()
    if (!row) return null
    const item = rowToItem(row)
    const updatable = ['title','ndaType','counterparty','signingDate','expiryDate','scope','owner','status','applicableEntities','notes','linkedControls','linkedPolicies']
    for (const k of updatable) { if (fields[k] !== undefined) item[k] = fields[k] }
    item.updatedAt = nowISO()
    await getDb()('legal_entries').where('id', id).update({ data: JSON.stringify(item), updated_at: item.updatedAt })
    return item
  },
  delete: async (id, deletedBy) => {
    const row = await getDb()('legal_entries').where('id', id).where('legal_type', 'nda').first()
    if (!row) return false
    const item = rowToItem(row)
    item.deletedAt = nowISO()
    item.deletedBy = deletedBy || null
    await getDb()('legal_entries').where('id', id).update({ deleted_at: nowISO(), data: JSON.stringify(item) })
    return true
  },
  permanentDelete: async (id) => {
    const affected = await getDb()('legal_entries').where('id', id).where('legal_type', 'nda').del()
    return affected > 0
  },
  restore: async (id) => {
    const row = await getDb()('legal_entries').where('id', id).first()
    if (!row) return null
    const item = rowToItem(row)
    delete item.deletedAt
    delete item.deletedBy
    await getDb()('legal_entries').where('id', id).update({ deleted_at: null, data: JSON.stringify(item) })
    return rowToItem({ ...row, deleted_at: null })
  },
  getDeleted: async () => {
    const rows = await getDb()('legal_entries').where('legal_type', 'nda').whereNotNull('deleted_at')
    return rows.map(rowToItem)
  },
  addAttachment: async (id, meta) => {
    const row = await getDb()('legal_entries').where('id', id).where('legal_type', 'nda').first()
    if (!row) return null
    const item = rowToItem(row)
    if (!item.attachments) item.attachments = []
    item.attachments.push(meta)
    item.updatedAt = nowISO()
    await getDb()('legal_entries').where('id', id).update({ data: JSON.stringify(item), updated_at: item.updatedAt })
    return item
  },
  removeAttachment: async (id, attId) => {
    const row = await getDb()('legal_entries').where('id', id).where('legal_type', 'nda').first()
    if (!row) return null
    const item = rowToItem(row)
    const attIdx = (item.attachments || []).findIndex(a => a.id === attId)
    if (attIdx === -1) return null
    const [att] = item.attachments.splice(attIdx, 1)
    item.updatedAt = nowISO()
    await getDb()('legal_entries').where('id', id).update({ data: JSON.stringify(item), updated_at: item.updatedAt })
    return att
  },
}

const privacyPolicies = {
  getAll: async ({ status, entity } = {}) => {
    const q = getDb()('legal_entries').where('legal_type', 'privacy_policy').whereNull('deleted_at')
    let list = (await q).map(rowToItem)
    if (status) list = list.filter(p => p.status === status)
    if (entity) list = list.filter(p => !p.applicableEntities?.length || p.applicableEntities.includes(entity))
    return list
  },
  getById: async (id) => {
    const row = await getDb()('legal_entries').where('id', id).where('legal_type', 'privacy_policy').whereNull('deleted_at').first()
    return rowToItem(row)
  },
  create: async (fields, createdBy) => {
    const id = makeId('policy')
    const now = nowISO()
    const item = {
      id, title: fields.title || 'Ohne Titel',
      policyType: POLICY_TYPES.includes(fields.policyType) ? fields.policyType : 'other',
      description: fields.description || '', content: fields.content || '',
      publishedAt: fields.publishedAt || null, nextReviewDate: fields.nextReviewDate || null,
      url: fields.url || '', owner: fields.owner || createdBy || '',
      status: POLICY_STATUSES.includes(fields.status) ? fields.status : 'draft',
      version: 1,
      applicableEntities: Array.isArray(fields.applicableEntities) ? fields.applicableEntities : [],
      notes: fields.notes || '',
      linkedControls: Array.isArray(fields.linkedControls) ? fields.linkedControls : [],
      linkedPolicies: Array.isArray(fields.linkedPolicies) ? fields.linkedPolicies : [],
      attachments: [],
      createdBy: createdBy || 'system', createdAt: now, updatedAt: now,
    }
    await getDb()('legal_entries').insert({ id, legal_type: 'privacy_policy', data: JSON.stringify(item), created_by: createdBy || 'system', created_at: now, updated_at: now })
    return item
  },
  update: async (id, fields) => {
    const row = await getDb()('legal_entries').where('id', id).where('legal_type', 'privacy_policy').first()
    if (!row) return null
    const item = rowToItem(row)
    const updatable = ['title','policyType','description','content','publishedAt','nextReviewDate',
      'url','owner','status','applicableEntities','notes','linkedControls','linkedPolicies']
    for (const k of updatable) { if (fields[k] !== undefined) item[k] = fields[k] }
    if (fields.status && fields.status !== item.status) item.version = (item.version || 0) + 1
    item.updatedAt = nowISO()
    await getDb()('legal_entries').where('id', id).update({ data: JSON.stringify(item), updated_at: item.updatedAt })
    return item
  },
  delete: async (id, deletedBy) => {
    const row = await getDb()('legal_entries').where('id', id).where('legal_type', 'privacy_policy').first()
    if (!row) return false
    const item = rowToItem(row)
    item.deletedAt = nowISO()
    item.deletedBy = deletedBy || null
    await getDb()('legal_entries').where('id', id).update({ deleted_at: nowISO(), data: JSON.stringify(item) })
    return true
  },
  permanentDelete: async (id) => {
    const affected = await getDb()('legal_entries').where('id', id).where('legal_type', 'privacy_policy').del()
    return affected > 0
  },
  restore: async (id) => {
    const row = await getDb()('legal_entries').where('id', id).first()
    if (!row) return null
    const item = rowToItem(row)
    delete item.deletedAt
    delete item.deletedBy
    await getDb()('legal_entries').where('id', id).update({ deleted_at: null, data: JSON.stringify(item) })
    return rowToItem({ ...row, deleted_at: null })
  },
  getDeleted: async () => {
    const rows = await getDb()('legal_entries').where('legal_type', 'privacy_policy').whereNotNull('deleted_at')
    return rows.map(rowToItem)
  },
  addAttachment: async (id, meta) => {
    const row = await getDb()('legal_entries').where('id', id).where('legal_type', 'privacy_policy').first()
    if (!row) return null
    const item = rowToItem(row)
    if (!item.attachments) item.attachments = []
    item.attachments.push(meta)
    item.updatedAt = nowISO()
    await getDb()('legal_entries').where('id', id).update({ data: JSON.stringify(item), updated_at: item.updatedAt })
    return item
  },
  removeAttachment: async (id, attId) => {
    const row = await getDb()('legal_entries').where('id', id).where('legal_type', 'privacy_policy').first()
    if (!row) return null
    const item = rowToItem(row)
    const attIdx = (item.attachments || []).findIndex(a => a.id === attId)
    if (attIdx === -1) return null
    const [att] = item.attachments.splice(attIdx, 1)
    item.updatedAt = nowISO()
    await getDb()('legal_entries').where('id', id).update({ data: JSON.stringify(item), updated_at: item.updatedAt })
    return att
  },
}

async function getSummary() {
  const db = getDb()
  const cList = (await db('legal_entries').where('legal_type', 'contract').whereNull('deleted_at')).map(rowToItem)
  const nList = (await db('legal_entries').where('legal_type', 'nda').whereNull('deleted_at')).map(rowToItem)
  const pList = (await db('legal_entries').where('legal_type', 'privacy_policy').whereNull('deleted_at')).map(rowToItem)
  return {
    contracts: { total: cList.length, active: cList.filter(c => c.status === 'active').length, expiring: (await contracts.getExpiring(60)).length },
    ndas: { total: nList.length, signed: nList.filter(n => n.status === 'signed').length },
    policies: { total: pList.length, published: pList.filter(p => p.status === 'published').length, draft: pList.filter(p => p.status === 'draft').length },
  }
}

module.exports = {
  contracts, ndas, privacyPolicies, getSummary,
  FILES_DIR,
  CONTRACT_TYPES, CONTRACT_STATUSES, NDA_TYPES, NDA_STATUSES, POLICY_TYPES, POLICY_STATUSES,
}
