'use strict'

const { getDb, init: initDb } = require('../knexDatabase')

function nowISO() { return new Date().toISOString() }
function makeId(prefix) { return `${prefix}_${require('crypto').randomBytes(4).toString('hex')}` }
function _json(val, fallback) { if (!val) return fallback; try { return JSON.parse(val) } catch { return fallback } }

function rowToItem(row) {
  if (!row) return null
  return { id: row.id, ..._json(row.data, {}), createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at, deletedAt: row.deleted_at || null }
}

module.exports = {
  init: async () => { await initDb() },

  getReviews: async () => {
    const rows = await getDb()('governance_entries').where('gov_type', 'review').whereNull('deleted_at')
    return rows.map(rowToItem)
  },
  getReviewById: async (id) => {
    const row = await getDb()('governance_entries').where('id', id).where('gov_type', 'review').whereNull('deleted_at').first()
    return rowToItem(row)
  },
  createReview: async (fields, { createdBy } = {}) => {
    const id = makeId('mgmt')
    const now = nowISO()
    const item = {
      id, title: fields.title || 'Ohne Titel', type: fields.type || 'annual',
      date: fields.date || '', nextReviewDate: fields.nextReviewDate || '',
      status: fields.status || 'planned', chair: fields.chair || '',
      participants: fields.participants || '',
      inputAuditResults: fields.inputAuditResults || '',
      inputStakeholderFeedback: fields.inputStakeholderFeedback || '',
      inputPerformance: fields.inputPerformance || '',
      inputNonconformities: fields.inputNonconformities || '',
      inputPreviousActions: fields.inputPreviousActions || '',
      inputRisksOpportunities: fields.inputRisksOpportunities || '',
      inputExternalChanges: fields.inputExternalChanges || '',
      decisions: fields.decisions || '', improvements: fields.improvements || '',
      resourceNeeds: fields.resourceNeeds || '', notes: fields.notes || '',
      linkedControls: Array.isArray(fields.linkedControls) ? fields.linkedControls : [],
      linkedPolicies: Array.isArray(fields.linkedPolicies) ? fields.linkedPolicies : [],
      createdBy: createdBy || 'system', createdAt: now, updatedAt: now, deletedAt: null,
    }
    await getDb()('governance_entries').insert({ id, gov_type: 'review', data: JSON.stringify(item), created_by: createdBy || 'system', created_at: now, updated_at: now })
    return item
  },
  updateReview: async (id, patch, { changedBy } = {}) => {
    const row = await getDb()('governance_entries').where('id', id).where('gov_type', 'review').whereNull('deleted_at').first()
    if (!row) return null
    const item = rowToItem(row)
    const allowed = ['title','type','date','nextReviewDate','status','chair','participants',
      'inputAuditResults','inputStakeholderFeedback','inputPerformance','inputNonconformities',
      'inputPreviousActions','inputRisksOpportunities','inputExternalChanges',
      'decisions','improvements','resourceNeeds','notes','linkedControls','linkedPolicies']
    for (const k of allowed) { if (patch[k] !== undefined) item[k] = patch[k] }
    item.updatedAt = nowISO()
    if (changedBy) item.updatedBy = changedBy
    await getDb()('governance_entries').where('id', id).update({ data: JSON.stringify(item), updated_at: item.updatedAt })
    return item
  },
  deleteReview: async (id) => {
    const affected = await getDb()('governance_entries').where('id', id).where('gov_type', 'review').whereNull('deleted_at').update({ deleted_at: nowISO() })
    return affected > 0
  },

  getActions: async () => {
    const rows = await getDb()('governance_entries').where('gov_type', 'action').whereNull('deleted_at')
    return rows.map(rowToItem)
  },
  getActionById: async (id) => {
    const row = await getDb()('governance_entries').where('id', id).where('gov_type', 'action').whereNull('deleted_at').first()
    return rowToItem(row)
  },
  createAction: async (fields, { createdBy } = {}) => {
    const id = makeId('gact')
    const now = nowISO()
    const item = {
      id, title: fields.title || 'Ohne Titel', description: fields.description || '',
      source: fields.source || 'management_review', sourceRef: fields.sourceRef || '',
      owner: fields.owner || '', ownerEmail: fields.ownerEmail || '',
      dueDate: fields.dueDate || '', completedDate: fields.completedDate || '',
      priority: fields.priority || 'medium', status: fields.status || 'open',
      progress: typeof fields.progress === 'number' ? fields.progress : 0,
      notes: fields.notes || '', entityId: fields.entityId || '',
      linkedControls: Array.isArray(fields.linkedControls) ? fields.linkedControls : [],
      linkedPolicies: Array.isArray(fields.linkedPolicies) ? fields.linkedPolicies : [],
      createdBy: createdBy || 'system', createdAt: now, updatedAt: now, deletedAt: null,
    }
    await getDb()('governance_entries').insert({ id, gov_type: 'action', data: JSON.stringify(item), created_by: createdBy || 'system', created_at: now, updated_at: now })
    return item
  },
  updateAction: async (id, patch, { changedBy } = {}) => {
    const row = await getDb()('governance_entries').where('id', id).where('gov_type', 'action').whereNull('deleted_at').first()
    if (!row) return null
    const item = rowToItem(row)
    const allowed = ['title','description','source','sourceRef','owner','ownerEmail',
      'dueDate','completedDate','priority','status','progress','notes','entityId','linkedControls','linkedPolicies']
    for (const k of allowed) { if (patch[k] !== undefined) item[k] = patch[k] }
    if (patch.status === 'completed' && !item.completedDate) item.completedDate = nowISO().slice(0, 10)
    item.updatedAt = nowISO()
    if (changedBy) item.updatedBy = changedBy
    await getDb()('governance_entries').where('id', id).update({ data: JSON.stringify(item), updated_at: item.updatedAt })
    return item
  },
  deleteAction: async (id) => {
    const affected = await getDb()('governance_entries').where('id', id).where('gov_type', 'action').whereNull('deleted_at').update({ deleted_at: nowISO() })
    return affected > 0
  },

  getMeetings: async () => {
    const rows = await getDb()('governance_entries').where('gov_type', 'meeting').whereNull('deleted_at')
    return rows.map(rowToItem)
  },
  getMeetingById: async (id) => {
    const row = await getDb()('governance_entries').where('id', id).where('gov_type', 'meeting').whereNull('deleted_at').first()
    return rowToItem(row)
  },
  createMeeting: async (fields, { createdBy } = {}) => {
    const id = makeId('meet')
    const now = nowISO()
    const item = {
      id, title: fields.title || 'Ohne Titel', committee: fields.committee || 'isms_committee',
      date: fields.date || '', location: fields.location || '',
      chair: fields.chair || '', secretary: fields.secretary || '',
      participants: fields.participants || '', agenda: fields.agenda || '',
      decisions: fields.decisions || '', nextMeetingDate: fields.nextMeetingDate || '',
      approved: fields.approved === true, approvedBy: fields.approvedBy || '',
      notes: fields.notes || '',
      linkedControls: Array.isArray(fields.linkedControls) ? fields.linkedControls : [],
      linkedPolicies: Array.isArray(fields.linkedPolicies) ? fields.linkedPolicies : [],
      createdBy: createdBy || 'system', createdAt: now, updatedAt: now, deletedAt: null,
    }
    await getDb()('governance_entries').insert({ id, gov_type: 'meeting', data: JSON.stringify(item), created_by: createdBy || 'system', created_at: now, updated_at: now })
    return item
  },
  updateMeeting: async (id, patch, { changedBy } = {}) => {
    const row = await getDb()('governance_entries').where('id', id).where('gov_type', 'meeting').whereNull('deleted_at').first()
    if (!row) return null
    const item = rowToItem(row)
    const allowed = ['title','committee','date','location','chair','secretary','participants',
      'agenda','decisions','nextMeetingDate','approved','approvedBy','notes','linkedControls','linkedPolicies']
    for (const k of allowed) { if (patch[k] !== undefined) item[k] = patch[k] }
    item.updatedAt = nowISO()
    if (changedBy) item.updatedBy = changedBy
    await getDb()('governance_entries').where('id', id).update({ data: JSON.stringify(item), updated_at: item.updatedAt })
    return item
  },
  deleteMeeting: async (id) => {
    const affected = await getDb()('governance_entries').where('id', id).where('gov_type', 'meeting').whereNull('deleted_at').update({ deleted_at: nowISO() })
    return affected > 0
  },

  getSummary: async () => {
    const db = getDb()
    const reviews = (await db('governance_entries').where('gov_type', 'review').whereNull('deleted_at')).map(rowToItem)
    const actions = (await db('governance_entries').where('gov_type', 'action').whereNull('deleted_at')).map(rowToItem)
    const meetings = (await db('governance_entries').where('gov_type', 'meeting').whereNull('deleted_at')).map(rowToItem)
    const today = new Date().toISOString().slice(0, 10)
    const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)
    return {
      reviews: {
        total: reviews.length, planned: reviews.filter(r => r.status === 'planned').length,
        completed: reviews.filter(r => r.status === 'completed').length,
        approved: reviews.filter(r => r.status === 'approved').length,
        nextPlanned: reviews.filter(r => r.status === 'planned' && r.date).map(r => r.date).sort()[0] || null,
      },
      actions: {
        total: actions.length, open: actions.filter(a => a.status === 'open').length,
        inProgress: actions.filter(a => a.status === 'in_progress').length,
        completed: actions.filter(a => a.status === 'completed').length,
        overdue: actions.filter(a => (a.status === 'open' || a.status === 'in_progress') && a.dueDate && a.dueDate < today).length,
        critical: actions.filter(a => a.priority === 'critical' && (a.status === 'open' || a.status === 'in_progress')).length,
      },
      meetings: {
        total: meetings.length,
        upcoming: meetings.filter(m => m.date && m.date >= today && m.date <= in90).length,
        lastMeeting: meetings.filter(m => m.date && m.date < today).map(m => m.date).sort().slice(-1)[0] || null,
      },
    }
  },
}
