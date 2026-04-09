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

  getBia: async () => {
    const rows = await getDb()('bcm_entries').where('bcm_type', 'bia').whereNull('deleted_at')
    return rows.map(rowToItem)
  },
  getBiaById: async (id) => {
    const row = await getDb()('bcm_entries').where('id', id).where('bcm_type', 'bia').whereNull('deleted_at').first()
    return rowToItem(row)
  },
  createBia: async (fields, { createdBy } = {}) => {
    const id = makeId('bia')
    const now = nowISO()
    const item = {
      id, title: fields.title || 'Ohne Titel',
      processOwner: fields.processOwner || '', department: fields.department || '',
      criticality: fields.criticality || 'medium',
      rto: typeof fields.rto === 'number' ? fields.rto : (parseFloat(fields.rto) || 0),
      rpo: typeof fields.rpo === 'number' ? fields.rpo : (parseFloat(fields.rpo) || 0),
      mtpd: typeof fields.mtpd === 'number' ? fields.mtpd : (parseFloat(fields.mtpd) || 0),
      dependencies: Array.isArray(fields.dependencies) ? fields.dependencies : [],
      affectedSystems: Array.isArray(fields.affectedSystems) ? fields.affectedSystems : [],
      status: fields.status || 'draft', lastReviewDate: fields.lastReviewDate || '',
      notes: fields.notes || '', entityId: fields.entityId || '',
      linkedControls: Array.isArray(fields.linkedControls) ? fields.linkedControls : [],
      linkedPolicies: Array.isArray(fields.linkedPolicies) ? fields.linkedPolicies : [],
      createdBy: createdBy || 'system', createdAt: now, updatedAt: now, deletedAt: null,
    }
    await getDb()('bcm_entries').insert({
      id, bcm_type: 'bia', data: JSON.stringify(item),
      created_by: createdBy || 'system', created_at: now, updated_at: now,
    })
    return item
  },
  updateBia: async (id, patch, { changedBy } = {}) => {
    const row = await getDb()('bcm_entries').where('id', id).where('bcm_type', 'bia').whereNull('deleted_at').first()
    if (!row) return null
    const item = rowToItem(row)
    const allowed = ['title','processOwner','department','criticality','rto','rpo','mtpd',
      'dependencies','affectedSystems','status','lastReviewDate','notes','entityId','linkedControls','linkedPolicies']
    for (const k of allowed) { if (patch[k] !== undefined) item[k] = patch[k] }
    item.updatedAt = nowISO()
    if (changedBy) item.updatedBy = changedBy
    await getDb()('bcm_entries').where('id', id).update({ data: JSON.stringify(item), updated_at: item.updatedAt })
    return item
  },
  deleteBia: async (id) => {
    const affected = await getDb()('bcm_entries').where('id', id).where('bcm_type', 'bia').whereNull('deleted_at').update({ deleted_at: nowISO() })
    return affected > 0
  },

  getPlans: async () => {
    const rows = await getDb()('bcm_entries').where('bcm_type', 'plan').whereNull('deleted_at')
    return rows.map(rowToItem)
  },
  getPlanById: async (id) => {
    const row = await getDb()('bcm_entries').where('id', id).where('bcm_type', 'plan').whereNull('deleted_at').first()
    return rowToItem(row)
  },
  createPlan: async (fields, { createdBy } = {}) => {
    const id = makeId('bcp')
    const now = nowISO()
    const item = {
      id, title: fields.title || 'Ohne Titel', type: fields.type || 'bcp',
      scope: fields.scope || '', planOwner: fields.planOwner || '',
      status: fields.status || 'draft', version: fields.version || '1.0',
      lastTested: fields.lastTested || '', nextTest: fields.nextTest || '',
      testResult: fields.testResult || 'not_tested',
      linkedBiaIds: Array.isArray(fields.linkedBiaIds) ? fields.linkedBiaIds : [],
      procedures: fields.procedures || '', entityId: fields.entityId || '',
      linkedControls: Array.isArray(fields.linkedControls) ? fields.linkedControls : [],
      linkedPolicies: Array.isArray(fields.linkedPolicies) ? fields.linkedPolicies : [],
      createdBy: createdBy || 'system', createdAt: now, updatedAt: now, deletedAt: null,
    }
    await getDb()('bcm_entries').insert({
      id, bcm_type: 'plan', data: JSON.stringify(item),
      created_by: createdBy || 'system', created_at: now, updated_at: now,
    })
    return item
  },
  updatePlan: async (id, patch, { changedBy } = {}) => {
    const row = await getDb()('bcm_entries').where('id', id).where('bcm_type', 'plan').whereNull('deleted_at').first()
    if (!row) return null
    const item = rowToItem(row)
    const allowed = ['title','type','scope','planOwner','status','version','lastTested',
      'nextTest','testResult','linkedBiaIds','procedures','entityId','linkedControls','linkedPolicies']
    for (const k of allowed) { if (patch[k] !== undefined) item[k] = patch[k] }
    item.updatedAt = nowISO()
    if (changedBy) item.updatedBy = changedBy
    await getDb()('bcm_entries').where('id', id).update({ data: JSON.stringify(item), updated_at: item.updatedAt })
    return item
  },
  deletePlan: async (id) => {
    const affected = await getDb()('bcm_entries').where('id', id).where('bcm_type', 'plan').whereNull('deleted_at').update({ deleted_at: nowISO() })
    return affected > 0
  },

  getExercises: async () => {
    const rows = await getDb()('bcm_entries').where('bcm_type', 'exercise').whereNull('deleted_at')
    return rows.map(rowToItem)
  },
  getExerciseById: async (id) => {
    const row = await getDb()('bcm_entries').where('id', id).where('bcm_type', 'exercise').whereNull('deleted_at').first()
    return rowToItem(row)
  },
  createExercise: async (fields, { createdBy } = {}) => {
    const id = makeId('bex')
    const now = nowISO()
    const item = {
      id, title: fields.title || 'Ohne Titel', type: fields.type || 'tabletop',
      date: fields.date || '', conductor: fields.conductor || '',
      participants: Array.isArray(fields.participants) ? fields.participants : [],
      linkedPlanId: fields.linkedPlanId || '', result: fields.result || 'planned',
      findings: fields.findings || '', actions: fields.actions || '',
      nextExercise: fields.nextExercise || '',
      linkedControls: Array.isArray(fields.linkedControls) ? fields.linkedControls : [],
      linkedPolicies: Array.isArray(fields.linkedPolicies) ? fields.linkedPolicies : [],
      createdBy: createdBy || 'system', createdAt: now, updatedAt: now, deletedAt: null,
    }
    await getDb()('bcm_entries').insert({
      id, bcm_type: 'exercise', data: JSON.stringify(item),
      created_by: createdBy || 'system', created_at: now, updated_at: now,
    })
    return item
  },
  updateExercise: async (id, patch, { changedBy } = {}) => {
    const row = await getDb()('bcm_entries').where('id', id).where('bcm_type', 'exercise').whereNull('deleted_at').first()
    if (!row) return null
    const item = rowToItem(row)
    const allowed = ['title','type','date','conductor','participants','linkedPlanId',
      'result','findings','actions','nextExercise','linkedControls','linkedPolicies']
    for (const k of allowed) { if (patch[k] !== undefined) item[k] = patch[k] }
    item.updatedAt = nowISO()
    if (changedBy) item.updatedBy = changedBy
    await getDb()('bcm_entries').where('id', id).update({ data: JSON.stringify(item), updated_at: item.updatedAt })
    return item
  },
  deleteExercise: async (id) => {
    const affected = await getDb()('bcm_entries').where('id', id).where('bcm_type', 'exercise').whereNull('deleted_at').update({ deleted_at: nowISO() })
    return affected > 0
  },

  getSummary: async () => {
    const db = getDb()
    const biaRows = (await db('bcm_entries').where('bcm_type', 'bia').whereNull('deleted_at')).map(rowToItem)
    const planRows = (await db('bcm_entries').where('bcm_type', 'plan').whereNull('deleted_at')).map(rowToItem)
    const exRows = (await db('bcm_entries').where('bcm_type', 'exercise').whereNull('deleted_at')).map(rowToItem)
    const today = new Date().toISOString().slice(0, 10)
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    const biaCritical = biaRows.filter(b => b.criticality === 'critical').length
    const linkedBiaIds = new Set(planRows.flatMap(p => p.linkedBiaIds || []))
    const withoutPlan = biaRows.filter(b => !linkedBiaIds.has(b.id)).length
    const plansApproved = planRows.filter(p => p.status === 'approved' || p.status === 'tested').length
    const plansTested = planRows.filter(p => p.status === 'tested' || (p.testResult && p.testResult !== 'not_tested')).length
    const overdueTest = planRows.filter(p => p.nextTest && p.nextTest < today).length
    const nextTestSoon = planRows.filter(p => p.nextTest && p.nextTest >= today && p.nextTest <= in30).length
    const upcoming = exRows.filter(e => e.result === 'planned' && e.date && e.date >= today).length
    const pastResults = exRows.filter(e => e.result !== 'planned' && e.date && e.date < today).sort((a, b) => new Date(b.date) - new Date(a.date))
    const lastResult = pastResults.length ? pastResults[0].result : null
    return {
      bia: { total: biaRows.length, critical: biaCritical, withoutPlan },
      plans: { total: planRows.length, approved: plansApproved, tested: plansTested, overdueTest, nextTestSoon },
      exercises: { total: exRows.length, upcoming, lastResult },
    }
  },
}
