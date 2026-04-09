'use strict'

const { getDb, init: initDb } = require('../knexDatabase')

const DEFAULTS = {
  templateTypes: ['Policy', 'Procedure', 'Risk Policy', 'SoA', 'Incident', 'Release'],
  riskCategories: [
    { id: 'technical',      label: 'Technical',      icon: 'ph-cpu' },
    { id: 'organizational', label: 'Organizational', icon: 'ph-users' },
    { id: 'physical',       label: 'Physical',       icon: 'ph-building' },
    { id: 'legal',          label: 'Legal',          icon: 'ph-scales' },
  ],
  riskTreatments: [
    { id: 'reduce',   label: 'Reduce' },
    { id: 'accept',   label: 'Accept' },
    { id: 'avoid',    label: 'Avoid' },
    { id: 'transfer', label: 'Transfer' },
  ],
  gdprDataCategories: ['name', 'email', 'phone', 'address', 'health', 'biometric', 'financial', 'location', 'other'],
  gdprSubjectTypes: [
    { id: 'customers',        label: 'Customers' },
    { id: 'employees',        label: 'Employees' },
    { id: 'contractors',      label: 'Contractors' },
    { id: 'website_visitors', label: 'Website Visitors' },
    { id: 'minors',           label: 'Minors' },
  ],
  incidentTypes: [
    { id: 'malware',              label: 'Malware / Malicious Software' },
    { id: 'phishing',             label: 'Phishing / Scam' },
    { id: 'data_theft',           label: 'Data Theft / Data Leak' },
    { id: 'unauthorized_access',  label: 'Unauthorized Access' },
    { id: 'ransomware',           label: 'Ransomware' },
    { id: 'social_engineering',   label: 'Social Engineering' },
    { id: 'other',                label: 'Other' },
  ],
}

const ALLOWED_LIST_IDS = Object.keys(DEFAULTS)

function _json(val, fallback) {
  if (!val) return fallback
  try { return JSON.parse(val) } catch { return fallback }
}

module.exports = {
  init: async () => {
    await initDb()
    const db = getDb()
    for (const listId of ALLOWED_LIST_IDS) {
      const row = await db('custom_lists').where('list_id', listId).first()
      if (!row) {
        await db('custom_lists').insert({
          list_id: listId,
          items: JSON.stringify(DEFAULTS[listId]),
        })
      }
    }
  },

  getAll: async () => {
    const rows = await getDb()('custom_lists')
    const result = {}
    for (const row of rows) {
      result[row.list_id] = _json(row.items, DEFAULTS[row.list_id])
    }
    for (const key of ALLOWED_LIST_IDS) {
      if (!(key in result)) result[key] = DEFAULTS[key]
    }
    return result
  },

  getList: async (listId) => {
    if (!ALLOWED_LIST_IDS.includes(listId)) return null
    const row = await getDb()('custom_lists').where('list_id', listId).first()
    return row ? _json(row.items, DEFAULTS[listId]) : DEFAULTS[listId]
  },

  setList: async (listId, items) => {
    if (!ALLOWED_LIST_IDS.includes(listId)) return null
    const db = getDb()
    const row = await db('custom_lists').where('list_id', listId).first()
    if (row) {
      await db('custom_lists').where('list_id', listId).update({ items: JSON.stringify(items) })
    } else {
      await db('custom_lists').insert({ list_id: listId, items: JSON.stringify(items) })
    }
    return items
  },

  resetList: async (listId) => {
    if (!ALLOWED_LIST_IDS.includes(listId)) return null
    await getDb()('custom_lists').where('list_id', listId).update({
      items: JSON.stringify(DEFAULTS[listId]),
    })
    return DEFAULTS[listId]
  },

  ALLOWED_LIST_IDS,
  DEFAULTS,
}
