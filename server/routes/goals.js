// © 2026 Claude Hecker — ISMS Builder V 1.29 — AGPL-3.0
'use strict'
const express = require('express')
const router = express.Router()
const { requireAuth, authorize } = require('../auth')
const goalsStore = require('../db/goalsStore')
const embeddingStore = require('../ai/embeddingStore')

router.get('/goals/summary', requireAuth, authorize('reader'), async (req, res) => {
  res.json(await goalsStore.getSummary())
})
router.get('/goals', requireAuth, authorize('reader'), async (req, res) => {
  const { status, category, entity } = req.query
  res.json(await goalsStore.getAll({ status, category, entity }))
})
router.get('/goals/:id', requireAuth, authorize('reader'), async (req, res) => {
  const g = await goalsStore.getById(req.params.id)
  if (!g) return res.status(404).json({ error: 'Not found' })
  res.json(g)
})
router.post('/goals', requireAuth, authorize('editor'), async (req, res) => {
  const g = await goalsStore.create(req.body, req.user)
  await embeddingStore.indexDoc(g, 'Sicherheitsziel', '#goals')
  res.status(201).json(g)
})
router.put('/goals/:id', requireAuth, authorize('editor'), async (req, res) => {
  const g = await goalsStore.update(req.params.id, req.body)
  if (!g) return res.status(404).json({ error: 'Not found' })
  await embeddingStore.indexDoc(g, 'Sicherheitsziel', '#goals')
  res.json(g)
})
router.delete('/goals/:id', requireAuth, authorize('admin'), async (req, res) => {
  const ok = await goalsStore.delete(req.params.id, req.user)
  if (!ok) return res.status(404).json({ error: 'Not found' })
  await require('../db/auditStore').append({ user: req.user, action: 'delete', resource: 'goal', resourceId: req.params.id })
  res.json({ deleted: true })
})

router.delete('/goals/:id/permanent', requireAuth, authorize('admin'), async (req, res) => {
  const ok = await goalsStore.permanentDelete(req.params.id)
  if (!ok) return res.status(404).json({ error: 'Not found' })
  await require('../db/auditStore').append({ user: req.user, action: 'permanent_delete', resource: 'goal', resourceId: req.params.id })
  await embeddingStore.removeDoc(req.params.id)
  res.json({ deleted: true, permanent: true })
})

router.post('/goals/:id/restore', requireAuth, authorize('admin'), async (req, res) => {
  const item = await goalsStore.restore(req.params.id)
  if (!item) return res.status(404).json({ error: 'Not found' })
  await require('../db/auditStore').append({ user: req.user, action: 'restore', resource: 'goal', resourceId: req.params.id })
  res.json(item)
})

module.exports = router
