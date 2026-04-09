// © 2026 Claude Hecker — ISMS Builder V 1.29 — AGPL-3.0
// REST routes for IT Organisational Units
'use strict'
const express      = require('express')
const router       = express.Router()
const { requireAuth, authorize } = require('../auth')
const orgUnitStore = require('../db/orgUnitStore')
const auditStore   = require('../db/auditStore')

router.get('/org-units', requireAuth, authorize('reader'), async (req, res) => {
  res.json(await orgUnitStore.getAll())
})

router.get('/org-units/:id', requireAuth, authorize('reader'), async (req, res) => {
  const u = await orgUnitStore.getById(req.params.id)
  if (!u) return res.status(404).json({ error: 'Not found' })
  res.json(u)
})

router.post('/org-units', requireAuth, authorize('admin'), async (req, res) => {
  try {
    const unit = await orgUnitStore.create(req.body)
    await auditStore.append({ user: req.user, action: 'create', resource: 'org-unit', detail: unit.name })
    res.status(201).json(unit)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

router.put('/org-units/:id', requireAuth, authorize('admin'), async (req, res) => {
  try {
    const updated = await orgUnitStore.update(req.params.id, req.body)
    if (!updated) return res.status(404).json({ error: 'Not found' })
    await auditStore.append({ user: req.user, action: 'update', resource: 'org-unit', detail: updated.name })
    res.json(updated)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

router.delete('/org-units/:id', requireAuth, authorize('admin'), async (req, res) => {
  try {
    const ok = await orgUnitStore.remove(req.params.id)
    if (!ok) return res.status(404).json({ error: 'Not found' })
    await auditStore.append({ user: req.user, action: 'delete', resource: 'org-unit', detail: req.params.id })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
