#!/usr/bin/env node
'use strict'
/**
 * Migration: JSON file stores → MariaDB/MySQL
 *
 * Prerequisites:
 *   1. Install mysql2:  npm install mysql2
 *   2. Create database: CREATE DATABASE isms_builder CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
 *   3. Create user:     CREATE USER 'isms'@'localhost' IDENTIFIED BY 'yourpass';
 *                       GRANT ALL PRIVILEGES ON isms_builder.* TO 'isms'@'localhost';
 *
 * Configure connection via .env or environment variables:
 *   DB_HOST=localhost  DB_PORT=3306  DB_USER=isms  DB_PASS=yourpass  DB_NAME=isms_builder
 *
 * Run once before switching STORAGE_BACKEND=mariadb:
 *   node tools/migrate-json-to-mariadb.js
 *
 * Idempotent: rows with existing IDs are skipped (INSERT IGNORE).
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const path = require('path')
const fs   = require('fs')

let mysql2
try {
  mysql2 = require('mysql2/promise')
} catch {
  console.error('ERROR: mysql2 package not found. Run: npm install mysql2')
  process.exit(1)
}

const DATA    = path.join(__dirname, '../data')
const gdprDir = path.join(DATA, 'gdpr')

function readJson(file, fallback = []) {
  const p = path.join(DATA, file)
  if (!fs.existsSync(p)) return fallback
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return fallback }
}

function readGdpr(file) {
  const p = path.join(gdprDir, file)
  if (!fs.existsSync(p)) return []
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return [] }
}

function arr(v)  { return JSON.stringify(Array.isArray(v) ? v : []) }
function str(v)  { return v != null ? String(v) : '' }
function bit(v)  { return v ? 1 : 0 }
function now()   { return new Date().toISOString() }

let migrated = 0
let skipped  = 0

async function run(conn, label, sql, rows) {
  console.log(`\n── ${label} (${rows.length} records) ──`)
  for (const params of rows) {
    try {
      const [result] = await conn.execute(sql, params)
      if (result.affectedRows > 0) { migrated++; process.stdout.write('.') }
      else                          { skipped++;  process.stdout.write('s') }
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') { skipped++; process.stdout.write('s') }
      else console.error(`\n  ERROR: ${e.message}`)
    }
  }
  console.log()
}

async function main() {
  const pool = mysql2.createPool({
    host:     process.env.DB_HOST || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306', 10),
    user:     process.env.DB_USER || 'isms',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'isms_builder',
    ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    charset:  'utf8mb4',
    multipleStatements: false,
  })

  console.log(`Connecting to MariaDB/MySQL at ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME || 'isms_builder'} …`)

  const conn = await pool.getConnection()
  console.log('Connected.')

  // Ensure schema exists
  const { init: initDb } = require('../server/db/mariadbDatabase')
  await initDb()
  console.log('Schema ready.')

  try {
    // ── Templates ────────────────────────────────────────────────────────────
    const templates = readJson('templates.json', [])
    await run(conn, 'Templates', `
      INSERT IGNORE INTO templates
        (id, type, language, title, content, version, status, owner, next_review_date,
         parent_id, sort_order, created_at, updated_at,
         linked_controls, applicable_entities, attachments, history, status_history)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, templates.map(t => [
      t.id, t.type, t.language || 'de', str(t.title), str(t.content),
      t.version || 1, t.status || 'draft', t.owner || null,
      t.nextReviewDate || t.reviewDate || null,
      t.parentId || null, t.sortOrder || 0,
      t.createdAt || now(), t.updatedAt || now(),
      arr(t.linkedControls), arr(t.applicableEntities), arr(t.attachments),
      arr(t.history), arr(t.statusHistory),
    ]))

    // ── Training ─────────────────────────────────────────────────────────────
    const training = readJson('training.json', [])
    await run(conn, 'Training', `
      INSERT IGNORE INTO training
        (id, title, description, category, status, due_date, completed_date,
         instructor, assignees, applicable_entities, evidence, mandatory,
         created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, training.map(t => [
      t.id, str(t.title), str(t.description), str(t.category), str(t.status),
      t.dueDate || null, t.completedDate || null,
      str(t.instructor), str(t.assignees), arr(t.applicableEntities),
      str(t.evidence), bit(t.mandatory),
      str(t.createdBy), t.createdAt || now(), t.updatedAt || now(),
    ]))

    // ── Entities ─────────────────────────────────────────────────────────────
    const entities = readJson('entities.json', [])
    await run(conn, 'Entities', `
      INSERT IGNORE INTO entities (id, name, short, type, parent_id, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?)
    `, entities.map(e => [
      e.id, str(e.name), str(e.short || e.shortName || ''),
      str(e.type), e.parentId || null,
      e.createdAt || now(), e.updatedAt || now(),
    ]))

    // ── Risks ─────────────────────────────────────────────────────────────────
    const risks = readJson('risks.json', [])
    await run(conn, 'Risks', `
      INSERT IGNORE INTO risks
        (id, title, description, category, likelihood, impact, risk_score, status,
         owner, applicable_entities, treatments, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, risks.map(r => [
      r.id, str(r.title), str(r.description), str(r.category),
      r.likelihood || 2, r.impact || 2,
      r.riskScore || r.score || (r.likelihood||2) * (r.impact||2),
      str(r.status), str(r.owner), arr(r.applicableEntities),
      arr(r.treatments), str(r.createdBy),
      r.createdAt || now(), r.updatedAt || now(),
    ]))

    // ── Guidance ──────────────────────────────────────────────────────────────
    const guidance = readJson('guidance.json', [])
    await run(conn, 'Guidance', `
      INSERT IGNORE INTO guidance
        (id, title, category, content, file_name, file_type, file_size, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `, guidance.map(g => [
      g.id, str(g.title), str(g.category), str(g.content),
      g.fileName || null, g.fileType || null, g.fileSize || null,
      str(g.createdBy), g.createdAt || now(), g.updatedAt || now(),
    ]))

    // ── Goals ─────────────────────────────────────────────────────────────────
    const goals = readJson('goals.json', [])
    await run(conn, 'Goals', `
      INSERT IGNORE INTO goals
        (id, title, description, category, status, priority, target_value,
         current_value, unit, due_date, review_date, owner,
         applicable_entities, linked_controls, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, goals.map(g => [
      g.id, str(g.title), str(g.description), str(g.category),
      str(g.status), str(g.priority),
      g.targetValue ?? null, g.currentValue ?? null, g.unit || null,
      g.dueDate || null, g.reviewDate || null, str(g.owner),
      arr(g.applicableEntities), arr(g.linkedControls),
      str(g.createdBy), g.createdAt || now(), g.updatedAt || now(),
    ]))

    // ── Assets ────────────────────────────────────────────────────────────────
    const assets = readJson('assets.json', [])
    await run(conn, 'Assets', `
      INSERT IGNORE INTO assets
        (id, name, description, category, classification, criticality, owner,
         location, eol_date, status, applicable_entities, linked_controls,
         created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, assets.map(a => [
      a.id, str(a.name), str(a.description), str(a.category),
      str(a.classification), str(a.criticality), str(a.owner),
      str(a.location), a.eolDate || null, str(a.status),
      arr(a.applicableEntities), arr(a.linkedControls),
      str(a.createdBy), a.createdAt || now(), a.updatedAt || now(),
    ]))

    // ── Suppliers ─────────────────────────────────────────────────────────────
    const suppliers = readJson('suppliers.json', [])
    await run(conn, 'Suppliers', `
      INSERT IGNORE INTO suppliers
        (id, name, category, contact, risk_level, status, contract_end, next_audit,
         notes, applicable_entities, linked_controls, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, suppliers.map(s => [
      s.id, str(s.name), str(s.category), str(s.contact),
      str(s.riskLevel), str(s.status),
      s.contractEnd || null, s.nextAudit || null,
      str(s.notes), arr(s.applicableEntities), arr(s.linkedControls),
      str(s.createdBy), s.createdAt || now(), s.updatedAt || now(),
    ]))

    // ── GDPR sub-stores ───────────────────────────────────────────────────────
    const vvt = readGdpr('vvt.json')
    await run(conn, 'GDPR VVT', `
      INSERT IGNORE INTO gdpr_vvt
        (id, name, purpose, legal_basis, legal_basis_note, data_categories,
         data_subjects, recipients, retention, applicable_entities, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, vvt.map(v => [
      v.id, str(v.name), str(v.purpose), str(v.legalBasis), str(v.legalBasisNote),
      arr(v.dataCategories), arr(v.dataSubjects), str(v.recipients), str(v.retention),
      arr(v.applicableEntities), str(v.createdBy), v.createdAt||now(), v.updatedAt||now(),
    ]))

    const av = readGdpr('av.json')
    await run(conn, 'GDPR AV', `
      INSERT IGNORE INTO gdpr_av
        (id, processor, service, contract_date, review_date, status, checklist,
         applicable_entities, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `, av.map(a => [
      a.id, str(a.processor), str(a.service), a.contractDate||null, a.reviewDate||null,
      str(a.status), arr(a.checklist), arr(a.applicableEntities),
      str(a.createdBy), a.createdAt||now(), a.updatedAt||now(),
    ]))

    const gdprIncidents = readGdpr('incidents.json')
    await run(conn, 'GDPR Incidents', `
      INSERT IGNORE INTO gdpr_incidents
        (id, title, description, incident_type, discovered_at, reported_at,
         authority_notified, subjects_notified, status, measures,
         applicable_entities, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, gdprIncidents.map(i => [
      i.id, str(i.title), str(i.description), str(i.incidentType),
      i.discoveredAt||null, i.reportedAt||null,
      bit(i.authorityNotified), bit(i.subjectsNotified),
      str(i.status), str(i.measures), arr(i.applicableEntities),
      str(i.createdBy), i.createdAt||now(), i.updatedAt||now(),
    ]))

    const toms = readGdpr('toms.json')
    await run(conn, 'GDPR TOMs', `
      INSERT IGNORE INTO gdpr_toms
        (id, category, title, description, status, review_date,
         applicable_entities, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `, toms.map(t => [
      t.id, str(t.category), str(t.title), str(t.description),
      str(t.status), t.reviewDate||null, arr(t.applicableEntities),
      str(t.createdBy), t.createdAt||now(), t.updatedAt||now(),
    ]))

    const dsar = readGdpr('dsar.json')
    await run(conn, 'GDPR DSAR', `
      INSERT IGNORE INTO gdpr_dsar
        (id, requester, request_type, received_at, due_date, extended_due_date,
         status, notes, applicable_entities, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `, dsar.map(d => [
      d.id, str(d.requester), str(d.requestType),
      d.receivedAt||null, d.dueDate||null, d.extendedDueDate||null,
      str(d.status), str(d.notes), arr(d.applicableEntities),
      str(d.createdBy), d.createdAt||now(), d.updatedAt||now(),
    ]))

    const dsfa = readGdpr('dsfa.json')
    await run(conn, 'GDPR DSFA', `
      INSERT IGNORE INTO gdpr_dsfa
        (id, title, description, likelihood, impact, risk_score, measures,
         status, applicable_entities, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `, dsfa.map(d => [
      d.id, str(d.title), str(d.description),
      d.likelihood || 2, d.impact || 2,
      d.riskScore || d.risk_score || (d.likelihood||2)*(d.impact||2),
      str(d.measures), str(d.status), arr(d.applicableEntities),
      str(d.createdBy), d.createdAt||now(), d.updatedAt||now(),
    ]))

    // ── BCM ───────────────────────────────────────────────────────────────────
    const bcmRaw = (() => {
      try { return JSON.parse(fs.readFileSync(path.join(DATA, 'bcm.json'), 'utf8')) } catch { return {} }
    })()
    const bcmRows = [
      ...(bcmRaw.bia       || []).map(x => ({ ...x, _type: 'bia' })),
      ...(bcmRaw.plans     || []).map(x => ({ ...x, _type: 'plan' })),
      ...(bcmRaw.exercises || []).map(x => ({ ...x, _type: 'exercise' })),
    ]
    await run(conn, 'BCM', `
      INSERT IGNORE INTO bcm_entries (id, bcm_type, data, created_by, created_at, updated_at, deleted_at)
      VALUES (?,?,?,?,?,?,?)
    `, bcmRows.map(x => [
      x.id, x._type, JSON.stringify(x),
      str(x.createdBy), x.createdAt||now(), x.updatedAt||now(), x.deletedAt||null,
    ]))

    // ── Legal ─────────────────────────────────────────────────────────────────
    const legalDir = path.join(DATA, 'legal')
    const legalRows = [
      ...(() => { try { return JSON.parse(fs.readFileSync(path.join(legalDir, 'contracts.json'), 'utf8')) } catch { return [] } })()
        .map(x => ({ ...x, _type: 'contract' })),
      ...(() => { try { return JSON.parse(fs.readFileSync(path.join(legalDir, 'ndas.json'), 'utf8')) } catch { return [] } })()
        .map(x => ({ ...x, _type: 'nda' })),
      ...(() => { try { return JSON.parse(fs.readFileSync(path.join(legalDir, 'policies.json'), 'utf8')) } catch { return [] } })()
        .map(x => ({ ...x, _type: 'policy' })),
    ]
    await run(conn, 'Legal', `
      INSERT IGNORE INTO legal_entries (id, legal_type, data, created_by, created_at, updated_at, deleted_at)
      VALUES (?,?,?,?,?,?,?)
    `, legalRows.map(x => [
      x.id, x._type, JSON.stringify(x),
      str(x.createdBy), x.createdAt||now(), x.updatedAt||now(), x.deletedAt||null,
    ]))

    // ── Findings ──────────────────────────────────────────────────────────────
    const findings = readJson('findings.json', [])
    await run(conn, 'Findings', `
      INSERT IGNORE INTO findings (id, data, created_by, created_at, updated_at, deleted_at)
      VALUES (?,?,?,?,?,?)
    `, findings.map(f => [
      f.id, JSON.stringify(f),
      str(f.createdBy), f.createdAt||now(), f.updatedAt||now(), f.deletedAt||null,
    ]))

    // ── Public Incidents ──────────────────────────────────────────────────────
    const pubInc = readJson('public-incidents.json', [])
    await run(conn, 'Public Incidents', `
      INSERT IGNORE INTO public_incidents (id, ref, data, submitted_at, deleted_at)
      VALUES (?,?,?,?,?)
    `, pubInc.map(p => [
      p.id, str(p.refNumber || p.ref || ''), JSON.stringify(p),
      p.submittedAt||p.createdAt||now(), p.deletedAt||null,
    ]))

    // ── SoA Controls ──────────────────────────────────────────────────────────
    const soa = readJson('soa.json', [])
    await run(conn, 'SoA Controls', `
      INSERT IGNORE INTO soa_controls
        (id, framework, control_id, title, description, theme, applicable,
         implementation_status, justification, evidence, owner,
         applicable_entities, linked_templates, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, soa.map(c => [
      c.id, str(c.framework), str(c.controlId || c.control_id || ''),
      str(c.title), str(c.description || ''), str(c.theme || ''),
      bit(c.applicable !== false),
      str(c.implementationStatus || c.implementation_status || 'not_implemented'),
      str(c.justification || ''), str(c.evidence || ''), str(c.owner || ''),
      arr(c.applicableEntities), arr(c.linkedTemplates),
      c.createdAt||now(), c.updatedAt||now(),
    ]))

    // ── RBAC Users ────────────────────────────────────────────────────────────
    const rbacRaw = (() => {
      try { return JSON.parse(fs.readFileSync(path.join(DATA, 'rbac_users.json'), 'utf8')) } catch { return {} }
    })()
    const rbacRows = Object.values(rbacRaw)
    await run(conn, 'RBAC Users', `
      INSERT IGNORE INTO rbac_users
        (id, email, display_name, role, functions, password_hash, totp_secret, totp_enabled, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `, rbacRows.map(u => [
      u.id || u.username || u.email,
      str(u.email || u.username),
      str(u.displayName || u.display_name || u.username || ''),
      str(u.role || 'reader'),
      arr(u.functions),
      str(u.passwordHash || u.password_hash || ''),
      u.totpSecret || u.totp_secret || null,
      bit(u.totpEnabled || u.totp_enabled),
      u.createdAt || now(), u.updatedAt || now(),
    ]))

    // ── Org Settings ──────────────────────────────────────────────────────────
    const orgSettings = (() => {
      try { return JSON.parse(fs.readFileSync(path.join(DATA, 'org-settings.json'), 'utf8')) } catch { return {} }
    })()
    const orgRows = Object.entries(orgSettings).map(([k, v]) => [k, JSON.stringify(v)])
    await run(conn, 'Org Settings', `
      INSERT IGNORE INTO org_settings (key_name, value) VALUES (?,?)
    `, orgRows)

    // ── Org Units ─────────────────────────────────────────────────────────────
    const orgUnits = readJson('org-units.json', [])
    await run(conn, 'Org Units', `
      INSERT IGNORE INTO org_units (id, data, created_at, updated_at)
      VALUES (?,?,?,?)
    `, orgUnits.map(u => [
      u.id, JSON.stringify(u), u.createdAt||now(), u.updatedAt||now(),
    ]))

    // ── Governance ────────────────────────────────────────────────────────────
    const govRaw = (() => {
      try { return JSON.parse(fs.readFileSync(path.join(DATA, 'governance.json'), 'utf8')) } catch { return {} }
    })()
    await run(conn, 'Governance Reviews', `
      INSERT IGNORE INTO governance_reviews
        (id, title, type, date, next_review_date, status, chair, participants,
         input_audit_results, input_stakeholder_feedback, input_performance,
         input_nonconformities, input_previous_actions, input_risks_opportunities,
         input_external_changes, decisions, improvements, resource_needs, notes,
         linked_controls, linked_policies, created_by, created_at, updated_at, deleted_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, (govRaw.reviews||[]).map(r => [
      r.id, str(r.title), str(r.type||'annual'),
      str(r.date||''), str(r.nextReviewDate||''), str(r.status||'planned'), str(r.chair||''),
      str(r.participants||''),
      str(r.inputAuditResults||''), str(r.inputStakeholderFeedback||''),
      str(r.inputPerformance||''), str(r.inputNonconformities||''),
      str(r.inputPreviousActions||''), str(r.inputRisksOpportunities||''),
      str(r.inputExternalChanges||''),
      str(r.decisions||''), str(r.improvements||''), str(r.resourceNeeds||''), str(r.notes||''),
      arr(r.linkedControls), arr(r.linkedPolicies),
      str(r.createdBy), r.createdAt||now(), r.updatedAt||now(), r.deletedAt||null,
    ]))
    await run(conn, 'Governance Actions', `
      INSERT IGNORE INTO governance_actions
        (id, title, description, status, priority, due_date, responsible,
         linked_review, created_by, created_at, updated_at, deleted_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `, (govRaw.actions||[]).map(a => [
      a.id, str(a.title), str(a.description||''),
      str(a.status||'open'), str(a.priority||'medium'),
      a.dueDate||null, str(a.responsible||''),
      a.linkedReview||null,
      str(a.createdBy), a.createdAt||now(), a.updatedAt||now(), a.deletedAt||null,
    ]))
    await run(conn, 'Governance Meetings', `
      INSERT IGNORE INTO governance_meetings
        (id, title, date, location, participants, agenda, minutes, status,
         created_by, created_at, updated_at, deleted_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `, (govRaw.meetings||[]).map(m => [
      m.id, str(m.title), str(m.date||''), str(m.location||''),
      str(m.participants||''), str(m.agenda||''), str(m.minutes||''),
      str(m.status||'planned'),
      str(m.createdBy), m.createdAt||now(), m.updatedAt||now(), m.deletedAt||null,
    ]))

    // ── Crossmap Groups ───────────────────────────────────────────────────────
    const crossmap = readJson('crossmap.json', [])
    await run(conn, 'Crossmap Groups', `
      INSERT IGNORE INTO crossmap_groups (id, topic, description, controls, created_at, updated_at)
      VALUES (?,?,?,?,?,?)
    `, crossmap.map(g => [
      g.id, str(g.topic), str(g.description||''),
      arr(g.controls), g.createdAt||now(), g.updatedAt||now(),
    ]))

    // ── Custom Lists ──────────────────────────────────────────────────────────
    const customLists = (() => {
      try { return JSON.parse(fs.readFileSync(path.join(DATA, 'custom-lists.json'), 'utf8')) } catch { return {} }
    })()
    await run(conn, 'Custom Lists', `
      INSERT IGNORE INTO custom_lists (key_name, value) VALUES (?,?)
    `, Object.entries(customLists).map(([k, v]) => [k, JSON.stringify(v)]))

    // ── Policy Distributions ──────────────────────────────────────────────────
    const dists = readJson('policy-distributions.json', [])
    await run(conn, 'Policy Distributions', `
      INSERT IGNORE INTO policy_distributions
        (id, template_id, template_title, template_type, template_version,
         mode, target_group, due_date, email_list, notes, status,
         created_by, created_at, updated_at, deleted_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, dists.map(d => [
      d.id, str(d.templateId), str(d.templateTitle||''),
      str(d.templateType||'Policy'), d.templateVersion||1,
      str(d.mode||'manual'), str(d.targetGroup||''),
      d.dueDate||null, arr(d.emailList), str(d.notes||''), str(d.status||'active'),
      str(d.createdBy), d.createdAt||now(), d.updatedAt||d.createdAt||now(), d.deletedAt||null,
    ]))

    // ── Policy Acknowledgements ───────────────────────────────────────────────
    const acks = readJson('policy-acks.json', [])
    await run(conn, 'Policy Acks', `
      INSERT IGNORE INTO policy_acks
        (id, distribution_id, recipient_email, recipient_name, token,
         status, acknowledged_at, ip_address, user_agent, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `, acks.map(a => [
      a.id, str(a.distributionId), str(a.recipientEmail||''),
      str(a.recipientName||''), str(a.token||''),
      str(a.status||'pending'), a.acknowledgedAt||null,
      a.ipAddress||null, a.userAgent||null,
      a.createdAt||now(),
    ]))

    // ── Assessments ───────────────────────────────────────────────────────────
    const assessments = readJson('assessments.json', [])
    await run(conn, 'Assessments', `
      INSERT IGNORE INTO assessments
        (id, supplier_id, title, language, status, due_date, token,
         questions, answers, score, submitted_at, reviewed_by, reviewed_at,
         notes, created_by, created_at, updated_at, deleted_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, assessments.map(a => [
      a.id, str(a.supplierId), str(a.title||''),
      str(a.language||'de'), str(a.status||'pending'),
      a.dueDate||null, str(a.token||''),
      arr(a.questions), arr(a.answers),
      a.score ?? null, a.submittedAt||null,
      a.reviewedBy||null, a.reviewedAt||null,
      str(a.notes||''), str(a.createdBy),
      a.createdAt||now(), a.updatedAt||now(), a.deletedAt||null,
    ]))

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log(`\n✓ Migration complete: ${migrated} rows inserted, ${skipped} rows skipped (already existed).`)
    console.log(`\n  Next steps:`)
    console.log(`    1. Set STORAGE_BACKEND=mariadb in your .env`)
    console.log(`    2. Restart the server: npm start`)

  } finally {
    conn.release()
    await pool.end()
  }
}

main().catch(e => {
  console.error('Migration failed:', e.message)
  process.exit(1)
})
