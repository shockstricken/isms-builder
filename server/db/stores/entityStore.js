'use strict'

const { getDb, init: initDb } = require('../knexDatabase')

const SEED = [
  { id: 'entity_holding', name: 'Holding GmbH', type: 'holding', parent: null, shortCode: 'HLD', active: true },
  { id: 'entity_sub1',    name: 'Gesellschaft Alpha GmbH', type: 'subsidiary', parent: 'entity_holding', shortCode: 'ALP', active: true },
  { id: 'entity_sub2',    name: 'Gesellschaft Beta GmbH',  type: 'subsidiary', parent: 'entity_holding', shortCode: 'BET', active: true },
  { id: 'entity_sub3',    name: 'Gesellschaft Gamma GmbH', type: 'subsidiary', parent: 'entity_holding', shortCode: 'GAM', active: true },
]

function nowISO() { return new Date().toISOString() }
function genId() { return `entity_${Date.now()}` }

function rowToEntity(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    short: row.short,
    type: row.type,
    parent: row.parent_id || null,
    shortCode: row.short,
    active: true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

module.exports = {
  init: async () => {
    await initDb()
    const db = getDb()
    for (const s of SEED) {
      const exists = await db('entities').where('id', s.id).first()
      if (!exists) {
        const now = nowISO()
        await db('entities').insert({
          id: s.id,
          name: s.name,
          short: s.shortCode || '',
          type: s.type,
          parent_id: s.parent || null,
          created_at: now,
          updated_at: now,
        })
      }
    }
  },

  getAll: async () => {
    const rows = await getDb()('entities')
    return rows.map(rowToEntity).filter(e => e.active !== false)
  },

  getById: async (id) => {
    const row = await getDb()('entities').where('id', id).first()
    return rowToEntity(row)
  },

  getTree: async () => {
    const rows = await getDb()('entities')
    const all = rows.map(rowToEntity).filter(e => e.active !== false)
    const map = {}
    for (const e of all) map[e.id] = { ...e, children: [] }
    const roots = []
    for (const e of all) {
      if (e.parent && map[e.parent]) {
        map[e.parent].children.push(map[e.id])
      } else {
        roots.push(map[e.id])
      }
    }
    return roots
  },

  create: async ({ name, type = 'subsidiary', parent = 'entity_holding', shortCode = '', active = true }) => {
    const id = genId()
    const now = nowISO()
    await getDb()('entities').insert({
      id,
      name,
      short: shortCode || '',
      type,
      parent_id: parent || null,
      created_at: now,
      updated_at: now,
    })
    return { id, name, type, parent: parent || null, shortCode, active, createdAt: now, updatedAt: now }
  },

  update: async (id, fields) => {
    const row = await getDb()('entities').where('id', id).first()
    if (!row) return null
    const e = rowToEntity(row)
    const allowed = ['name', 'type', 'parent', 'shortCode', 'active']
    for (const key of allowed) {
      if (fields[key] !== undefined) e[key] = fields[key]
    }
    const now = nowISO()
    await getDb()('entities').where('id', id).update({
      name: e.name,
      short: e.shortCode || e.short || '',
      type: e.type,
      parent_id: e.parent || null,
      updated_at: now,
    })
    return { ...e, updatedAt: now }
  },

  delete: async (id) => {
    const row = await getDb()('entities').where('id', id).first()
    if (!row) return false
    await getDb()('entities').where('id', id).del()
    return true
  },
}
