// © 2026 Claude Hecker — ISMS Builder V 1.29 — AGPL-3.0
'use strict'
const express = require('express')
const router = express.Router()
const { requireAuth, authorize } = require('../auth')
const trainingStore = require('../db/trainingStore')
const embeddingStore = require('../ai/embeddingStore')

router.get('/training/summary', requireAuth, authorize('reader'), async (req, res) => {
  res.json(await trainingStore.getSummary())
})
router.get('/training', requireAuth, authorize('reader'), async (req, res) => {
  const { status, category, entity } = req.query
  res.json(await trainingStore.getAll({ status, category, entity }))
})
router.get('/training/:id', requireAuth, authorize('reader'), async (req, res) => {
  const item = await trainingStore.getById(req.params.id)
  if (!item) return res.status(404).json({ error: 'Not found' })
  res.json(item)
})
router.post('/training', requireAuth, authorize('editor'), async (req, res) => {
  const item = await trainingStore.create(req.body, req.user)
  await embeddingStore.indexDoc(item, 'Schulung', '#training')
  res.status(201).json(item)
})
router.put('/training/:id', requireAuth, authorize('editor'), async (req, res) => {
  const item = await trainingStore.update(req.params.id, req.body)
  if (!item) return res.status(404).json({ error: 'Not found' })
  await embeddingStore.indexDoc(item, 'Schulung', '#training')
  res.json(item)
})
router.delete('/training/:id', requireAuth, authorize('admin'), async (req, res) => {
  const ok = await trainingStore.delete(req.params.id, req.user)
  if (!ok) return res.status(404).json({ error: 'Not found' })
  await require('../db/auditStore').append({ user: req.user, action: 'delete', resource: 'training', resourceId: req.params.id })
  res.json({ deleted: true })
})
router.delete('/training/:id/permanent', requireAuth, authorize('admin'), async (req, res) => {
  const ok = await trainingStore.permanentDelete(req.params.id)
  if (!ok) return res.status(404).json({ error: 'Not found' })
  await require('../db/auditStore').append({ user: req.user, action: 'permanent_delete', resource: 'training', resourceId: req.params.id })
  await embeddingStore.removeDoc(req.params.id)
  res.json({ deleted: true, permanent: true })
})
router.post('/training/:id/restore', requireAuth, authorize('admin'), async (req, res) => {
  const item = await trainingStore.restore(req.params.id)
  if (!item) return res.status(404).json({ error: 'Not found' })
  await require('../db/auditStore').append({ user: req.user, action: 'restore', resource: 'training', resourceId: req.params.id })
  res.json(item)
})

module.exports = router
