'use strict'

const { getDb, init: initDb } = require('../knexDatabase')

const SEED = [
  {
    id:          'ou-cio',
    name:        'CIO',
    type:        'cio',
    parentId:    null,
    head:        '',
    email:       '',
    description: 'Chief Information Officer — strategic IT governance and oversight',
  },
  {
    id:          'ou-groupit',
    name:        'GroupIT',
    type:        'group',
    parentId:    'ou-cio',
    head:        '',
    email:       '',
    description: 'IT Stabsstelle — central infrastructure operations.',
  },
  {
    id:          'ou-groupapp',
    name:        'GroupApp',
    type:        'group',
    parentId:    'ou-cio',
    head:        '',
    email:       '',
    description: 'Applications Programming & Deployment.',
  },
  {
    id:          'ou-localit',
    name:        'Local IT',
    type:        'local',
    parentId:    'ou-groupit',
    head:        '',
    email:       '',
    description: 'Local IT teams at subsidiary level.',
  },
]

function nowISO() { return new Date().toISOString() }

function _json(val, fallback) {
  if (!val) return fallback
  try { return JSON.parse(val) } catch { return fallback }
}

function rowToUnit(row) {
  if (!row) return null
  const d = _json(row.data, {})
  return {
    id: row.id,
    name: d.name || '',
    type: d.type || 'group',
    parentId: d.parentId || null,
    head: d.head || '',
    email: d.email || '',
    description: d.description || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

module.exports = {
  init: async () => {
    await initDb()
    const db = getDb()
    for (const s of SEED) {
      const exists = await db('org_units').where('id', s.id).first()
      if (!exists) {
        const now = nowISO()
        await db('org_units').insert({
          id: s.id,
          data: JSON.stringify({
            name: s.name,
            type: s.type,
            parentId: s.parentId,
            head: s.head,
            email: s.email,
            description: s.description,
          }),
          created_at: now,
          updated_at: now,
        })
      }
    }
  },

  getAll: async () => {
    const rows = await getDb()('org_units')
    return rows.map(rowToUnit)
  },

  getById: async (id) => {
    const row = await getDb()('org_units').where('id', id).first()
    return rowToUnit(row)
  },

  create: async (body) => {
    const id = 'ou-' + Date.now()
    const now = nowISO()
    const name = (body.name || '').trim()
    if (!name) throw new Error('name required')
    const data = {
      name,
      type: body.type || 'group',
      parentId: body.parentId || null,
      head: (body.head || '').trim(),
      email: (body.email || '').trim(),
      description: (body.description || '').trim(),
    }
    await getDb()('org_units').insert({
      id,
      data: JSON.stringify(data),
      created_at: now,
      updated_at: now,
    })
    return { id, ...data, createdAt: now, updatedAt: now }
  },

  update: async (id, body) => {
    const row = await getDb()('org_units').where('id', id).first()
    if (!row) return null
    const current = rowToUnit(row)
    const now = nowISO()
    const data = {
      name:        body.name        !== undefined ? (body.name || '').trim()        : current.name,
      type:        body.type        !== undefined ? body.type                        : current.type,
      parentId:    body.parentId    !== undefined ? (body.parentId || null)          : current.parentId,
      head:        body.head        !== undefined ? (body.head || '').trim()         : current.head,
      email:       body.email       !== undefined ? (body.email || '').trim()        : current.email,
      description: body.description !== undefined ? (body.description || '').trim() : current.description,
    }
    if (!data.name) throw new Error('name required')
    await getDb()('org_units').where('id', id).update({
      data: JSON.stringify(data),
      updated_at: now,
    })
    return { id, ...data, createdAt: current.createdAt, updatedAt: now }
  },

  remove: async (id) => {
    const affected = await getDb()('org_units').where('id', id).del()
    return affected > 0
  },
}
