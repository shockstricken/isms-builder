'use strict'

const { getDb, init: initDb } = require('../knexDatabase')

function nowISO() { return new Date().toISOString() }
function makeId() { return `goal_${Date.now()}_${Math.random().toString(36).slice(2,6)}` }
function makeKpiId() { return `kpi_${Date.now()}_${Math.random().toString(36).slice(2,4)}` }
function _json(val, fallback) { if (!val) return fallback; try { return JSON.parse(val) } catch { return fallback } }

const CATEGORIES = [
  { id: 'confidentiality', label: 'Vertraulichkeit' },
  { id: 'integrity',       label: 'Integrität' },
  { id: 'availability',    label: 'Verfügbarkeit' },
  { id: 'compliance',      label: 'Compliance' },
  { id: 'operational',     label: 'Betrieblich' },
  { id: 'technical',       label: 'Technisch' },
  { id: 'organizational',  label: 'Organisatorisch' },
]

const STATUSES = [
  { id: 'planned', label: 'Geplant' }, { id: 'active', label: 'Aktiv' },
  { id: 'achieved', label: 'Erreicht' }, { id: 'missed', label: 'Verfehlt' },
  { id: 'cancelled', label: 'Abgebrochen' },
]

const PRIORITIES = [
  { id: 'low', label: 'Niedrig' }, { id: 'medium', label: 'Mittel' },
  { id: 'high', label: 'Hoch' }, { id: 'critical', label: 'Kritisch' },
]

function calcProgress(goal) {
  const kpis = (goal.kpis || []).filter(k => k.targetValue > 0)
  if (!kpis.length) return goal.progress || 0
  const avg = kpis.reduce((s, k) => s + Math.min(100, Math.round((k.currentValue / k.targetValue) * 100)), 0) / kpis.length
  return Math.round(avg)
}

function rowToGoal(row) {
  if (!row) return null
  const d = _json(row.data, {})
  return {
    id: row.id, title: row.title, description: row.description,
    category: row.category, status: row.status, priority: row.priority,
    owner: row.owner, targetValue: row.target_value, currentValue: row.current_value,
    unit: row.unit, dueDate: row.due_date, reviewDate: row.review_date,
    targetDate: d.targetDate || row.due_date || null,
    progress: d.progress || 0,
    kpis: d.kpis || [],
    linkedControls: _json(row.linked_controls, []),
    linkedPolicies: d.linkedPolicies || [],
    applicableEntities: _json(row.applicable_entities, []),
    notes: d.notes || '', attachments: d.attachments || [],
    deletedBy: d.deletedBy || '',
    createdBy: row.created_by, createdAt: row.created_at,
    updatedAt: row.updated_at, deletedAt: row.deleted_at || null,
    progressCalc: 0,
  }
}

function packData(g) {
  return JSON.stringify({
    targetDate: g.targetDate, progress: g.progress,
    kpis: g.kpis || [], linkedPolicies: g.linkedPolicies || [],
    notes: g.notes || '', attachments: g.attachments || [],
    deletedBy: g.deletedBy || '',
  })
}

module.exports = {
  init: async () => { await initDb() },

  getAll: async ({ status, category, entity } = {}) => {
    const q = getDb()('goals').whereNull('deleted_at')
    if (status) q.where('status', status)
    if (category) q.where('category', category)
    let list = (await q).map(r => { const g = rowToGoal(r); g.progressCalc = calcProgress(g); return g })
    if (entity) list = list.filter(g => !g.applicableEntities?.length || g.applicableEntities.includes(entity))
    return list
  },

  getById: async (id) => {
    const row = await getDb()('goals').where('id', id).whereNull('deleted_at').first()
    if (!row) return null
    const g = rowToGoal(row)
    g.progressCalc = calcProgress(g)
    return g
  },

  create: async (fields, createdBy) => {
    const id = makeId()
    const now = nowISO()
    const item = {
      id, title: fields.title || 'Ohne Titel',
      description: fields.description || '',
      category: CATEGORIES.some(c => c.id === fields.category) ? fields.category : 'organizational',
      status: STATUSES.some(s => s.id === fields.status) ? fields.status : 'planned',
      priority: PRIORITIES.some(p => p.id === fields.priority) ? fields.priority : 'medium',
      owner: fields.owner || createdBy || '',
      targetDate: fields.targetDate || null,
      reviewDate: fields.reviewDate || null,
      progress: parseInt(fields.progress) || 0,
      kpis: Array.isArray(fields.kpis) ? fields.kpis.map(k => ({ ...k, id: k.id || makeKpiId() })) : [],
      linkedControls: Array.isArray(fields.linkedControls) ? fields.linkedControls : [],
      linkedPolicies: Array.isArray(fields.linkedPolicies) ? fields.linkedPolicies : [],
      applicableEntities: Array.isArray(fields.applicableEntities) ? fields.applicableEntities : [],
      notes: fields.notes || '', attachments: [],
      createdBy: createdBy || 'system',
    }
    await getDb()('goals').insert({
      id, title: item.title, description: item.description,
      category: item.category, status: item.status, priority: item.priority,
      owner: item.owner, target_value: null, current_value: null, unit: null,
      due_date: item.targetDate, review_date: item.reviewDate,
      applicable_entities: JSON.stringify(item.applicableEntities),
      linked_controls: JSON.stringify(item.linkedControls),
      data: packData(item),
      created_by: item.createdBy, created_at: now, updated_at: now,
    })
    const result = { ...item, createdAt: now, updatedAt: now, deletedAt: null }
    result.progressCalc = calcProgress(result)
    return result
  },

  update: async (id, fields) => {
    const row = await getDb()('goals').where('id', id).whereNull('deleted_at').first()
    if (!row) return null
    const g = rowToGoal(row)
    const updatable = ['title','description','category','status','priority','owner',
      'targetDate','reviewDate','progress','kpis','linkedControls','linkedPolicies','applicableEntities','notes']
    for (const k of updatable) {
      if (fields[k] !== undefined) g[k] = fields[k]
    }
    if (fields.kpis) g.kpis = fields.kpis.map(k => ({ ...k, id: k.id || makeKpiId() }))
    g.updatedAt = nowISO()
    await getDb()('goals').where('id', id).update({
      title: g.title, description: g.description,
      category: g.category, status: g.status, priority: g.priority,
      owner: g.owner, due_date: g.targetDate, review_date: g.reviewDate,
      applicable_entities: JSON.stringify(g.applicableEntities || []),
      linked_controls: JSON.stringify(g.linkedControls || []),
      data: packData(g), updated_at: g.updatedAt,
    })
    g.progressCalc = calcProgress(g)
    return g
  },

  delete: async (id, deletedBy) => {
    const row = await getDb()('goals').where('id', id).first()
    if (!row) return false
    const d = _json(row.data, {})
    d.deletedBy = deletedBy || ''
    await getDb()('goals').where('id', id).update({
      deleted_at: nowISO(), data: JSON.stringify(d),
    })
    return true
  },

  permanentDelete: async (id) => {
    const affected = await getDb()('goals').where('id', id).del()
    return affected > 0
  },

  restore: async (id) => {
    const row = await getDb()('goals').where('id', id).first()
    if (!row) return null
    const d = _json(row.data, {})
    delete d.deletedBy
    await getDb()('goals').where('id', id).update({
      deleted_at: null, data: JSON.stringify(d), updated_at: nowISO(),
    })
    const g = rowToGoal({ ...row, deleted_at: null })
    g.progressCalc = calcProgress(g)
    return g
  },

  getDeleted: async () => {
    const rows = await getDb()('goals').whereNotNull('deleted_at')
    return rows.map(r => { const g = rowToGoal(r); g.progressCalc = calcProgress(g); return g })
  },

  getSummary: async () => {
    const rows = await getDb()('goals').whereNull('deleted_at')
    const list = rows.map(r => { const g = rowToGoal(r); g.progressCalc = calcProgress(g); return g })
    const now = new Date()
    return {
      total: list.length,
      active: list.filter(g => g.status === 'active').length,
      achieved: list.filter(g => g.status === 'achieved').length,
      planned: list.filter(g => g.status === 'planned').length,
      overdue: list.filter(g => g.targetDate && new Date(g.targetDate) < now && !['achieved','cancelled'].includes(g.status)).length,
      avgProgress: list.length ? Math.round(list.reduce((s, g) => s + g.progressCalc, 0) / list.length) : 0,
    }
  },

  getCalendarEvents: async () => {
    const rows = await getDb()('goals').whereNull('deleted_at')
    const list = rows.map(r => { const g = rowToGoal(r); g.progressCalc = calcProgress(g); return g })
    const events = []
    for (const g of list) {
      if (['cancelled','achieved'].includes(g.status)) continue
      if (g.targetDate) events.push({ date: g.targetDate, type: 'goal_due', label: `Ziel fällig: ${g.title}`, goalId: g.id, title: g.title })
      if (g.reviewDate) events.push({ date: g.reviewDate, type: 'goal_review', label: `Ziel-Review: ${g.title}`, goalId: g.id, title: g.title })
    }
    return events
  },

  CATEGORIES, STATUSES, PRIORITIES,
}
