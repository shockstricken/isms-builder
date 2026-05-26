// © 2026 Claude Hecker — ISMS Builder — AGPL-3.0
'use strict'
/**
 * MariaDB/MySQL connection pool + schema initialisation.
 * Requires the 'mysql2' package: npm install mysql2
 *
 * Required env vars:
 *   DB_HOST      (default: localhost)
 *   DB_PORT      (default: 3306)
 *   DB_USER      (default: isms)
 *   DB_PASS      (required)
 *   DB_NAME      (default: isms_builder)
 *   DB_SSL       (optional: 'true' to enable TLS)
 *
 * Alternative: set DATABASE_URL as a mysql2 connection string
 *   mysql://user:pass@host:3306/dbname
 */

let mysql2
try {
  mysql2 = require('mysql2/promise')
} catch {
  throw new Error('[mariadb] mysql2 package not found. Run: npm install mysql2')
}

let _pool = null

function getPool() {
  if (_pool) return _pool
  _pool = mysql2.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306', 10),
    user:     process.env.DB_USER     || 'isms',
    password: process.env.DB_PASS     || '',
    database: process.env.DB_NAME     || 'isms_builder',
    ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    timezone:           'Z',           // store/return UTC
    charset:            'utf8mb4',
  })
  return _pool
}

// ── Schema DDL ────────────────────────────────────────────────────────────────

const SCHEMA_SQL = [
  // Templates
  `CREATE TABLE IF NOT EXISTS templates (
    id                  VARCHAR(120)    NOT NULL PRIMARY KEY,
    type                VARCHAR(80)     NOT NULL,
    language            VARCHAR(10)     NOT NULL DEFAULT 'de',
    title               VARCHAR(512)    NOT NULL DEFAULT '',
    content             LONGTEXT        NOT NULL,
    version             INT             NOT NULL DEFAULT 1,
    status              VARCHAR(30)     NOT NULL DEFAULT 'draft',
    owner               VARCHAR(120)    DEFAULT NULL,
    next_review_date    VARCHAR(20)     DEFAULT NULL,
    parent_id           VARCHAR(120)    DEFAULT NULL,
    sort_order          INT             NOT NULL DEFAULT 0,
    created_at          VARCHAR(30)     NOT NULL,
    updated_at          VARCHAR(30)     NOT NULL,
    linked_controls     LONGTEXT        NOT NULL DEFAULT ('[]'),
    applicable_entities LONGTEXT        NOT NULL DEFAULT ('[]'),
    attachments         LONGTEXT        NOT NULL DEFAULT ('[]'),
    history             LONGTEXT        NOT NULL DEFAULT ('[]'),
    status_history      LONGTEXT        NOT NULL DEFAULT ('[]'),
    deleted_at          VARCHAR(30)     DEFAULT NULL,
    deleted_by          VARCHAR(120)    DEFAULT NULL,
    INDEX idx_type        (type),
    INDEX idx_status      (status),
    INDEX idx_parent      (parent_id),
    INDEX idx_deleted     (deleted_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Training
  `CREATE TABLE IF NOT EXISTS training (
    id                  VARCHAR(120)    NOT NULL PRIMARY KEY,
    title               VARCHAR(512)    NOT NULL DEFAULT '',
    description         LONGTEXT        NOT NULL,
    category            VARCHAR(80)     NOT NULL DEFAULT 'other',
    status              VARCHAR(30)     NOT NULL DEFAULT 'planned',
    due_date            VARCHAR(20)     DEFAULT NULL,
    completed_date      VARCHAR(20)     DEFAULT NULL,
    instructor          VARCHAR(120)    NOT NULL DEFAULT '',
    assignees           LONGTEXT        NOT NULL DEFAULT (''),
    applicable_entities LONGTEXT        NOT NULL DEFAULT ('[]'),
    evidence            LONGTEXT        NOT NULL,
    mandatory           TINYINT(1)      NOT NULL DEFAULT 0,
    created_by          VARCHAR(120)    NOT NULL DEFAULT 'system',
    created_at          VARCHAR(30)     NOT NULL,
    updated_at          VARCHAR(30)     NOT NULL,
    deleted_at          VARCHAR(30)     DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Entities (Konzernstruktur)
  `CREATE TABLE IF NOT EXISTS entities (
    id          VARCHAR(120)    NOT NULL PRIMARY KEY,
    name        VARCHAR(256)    NOT NULL,
    short       VARCHAR(30)     NOT NULL DEFAULT '',
    type        VARCHAR(50)     NOT NULL DEFAULT 'subsidiary',
    parent_id   VARCHAR(120)    DEFAULT NULL,
    created_at  VARCHAR(30)     NOT NULL,
    updated_at  VARCHAR(30)     NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // SoA Controls
  `CREATE TABLE IF NOT EXISTS soa_controls (
    id                  VARCHAR(120)    NOT NULL PRIMARY KEY,
    framework           VARCHAR(50)     NOT NULL DEFAULT 'ISO27001',
    control_id          VARCHAR(50)     NOT NULL DEFAULT '',
    title               VARCHAR(512)    NOT NULL DEFAULT '',
    description         LONGTEXT        NOT NULL,
    theme               VARCHAR(80)     NOT NULL DEFAULT '',
    applicable          TINYINT(1)      NOT NULL DEFAULT 1,
    status              VARCHAR(50)     NOT NULL DEFAULT 'not_implemented',
    justification       LONGTEXT        NOT NULL,
    evidence            LONGTEXT        NOT NULL,
    owner               VARCHAR(120)    NOT NULL DEFAULT '',
    applicable_entities LONGTEXT        NOT NULL DEFAULT ('[]'),
    linked_templates    LONGTEXT        NOT NULL DEFAULT ('[]'),
    linked_policies     LONGTEXT        NOT NULL DEFAULT ('[]'),
    is_custom           TINYINT(1)      NOT NULL DEFAULT 0,
    updated_by          VARCHAR(120)    DEFAULT NULL,
    created_at          VARCHAR(30)     NOT NULL,
    updated_at          VARCHAR(30)     NOT NULL,
    deleted_at          VARCHAR(30)     DEFAULT NULL,
    INDEX idx_fw (framework)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Guidance
  `CREATE TABLE IF NOT EXISTS guidance (
    id          VARCHAR(120)    NOT NULL PRIMARY KEY,
    title       VARCHAR(512)    NOT NULL DEFAULT '',
    category    VARCHAR(80)     NOT NULL DEFAULT 'systemhandbuch',
    content     LONGTEXT        NOT NULL,
    file_name   VARCHAR(256)    DEFAULT NULL,
    file_type   VARCHAR(80)     DEFAULT NULL,
    file_size   INT             DEFAULT NULL,
    created_by  VARCHAR(120)    NOT NULL DEFAULT 'system',
    created_at  VARCHAR(30)     NOT NULL,
    updated_at  VARCHAR(30)     NOT NULL,
    deleted_at  VARCHAR(30)     DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Risks
  `CREATE TABLE IF NOT EXISTS risks (
    id                  VARCHAR(120)    NOT NULL PRIMARY KEY,
    title               VARCHAR(512)    NOT NULL DEFAULT '',
    description         LONGTEXT        NOT NULL,
    category            VARCHAR(80)     NOT NULL DEFAULT 'other',
    threat              LONGTEXT        NOT NULL,
    vulnerability       LONGTEXT        NOT NULL,
    probability         INT             NOT NULL DEFAULT 2,
    impact              INT             NOT NULL DEFAULT 2,
    risk_score          INT             NOT NULL DEFAULT 4,
    treatment_option    VARCHAR(30)     NOT NULL DEFAULT 'mitigate',
    mitigation_notes    LONGTEXT        NOT NULL,
    status              VARCHAR(30)     NOT NULL DEFAULT 'open',
    needs_review        TINYINT(1)      NOT NULL DEFAULT 0,
    owner               VARCHAR(120)    NOT NULL DEFAULT '',
    due_date            VARCHAR(20)     DEFAULT NULL,
    review_date         VARCHAR(20)     DEFAULT NULL,
    source              VARCHAR(50)     NOT NULL DEFAULT 'manual',
    scan_ref            VARCHAR(120)    NOT NULL DEFAULT '',
    cvss_score          FLOAT           DEFAULT NULL,
    cve_ids             LONGTEXT        NOT NULL DEFAULT ('[]'),
    applicable_entities LONGTEXT        NOT NULL DEFAULT ('[]'),
    linked_controls     LONGTEXT        NOT NULL DEFAULT ('[]'),
    linked_templates    LONGTEXT        NOT NULL DEFAULT ('[]'),
    linked_policies     LONGTEXT        NOT NULL DEFAULT ('[]'),
    treatment_plans     LONGTEXT        NOT NULL DEFAULT ('[]'),
    approved_by         VARCHAR(120)    DEFAULT NULL,
    approved_at         VARCHAR(30)     DEFAULT NULL,
    created_by          VARCHAR(120)    NOT NULL DEFAULT 'system',
    updated_by          VARCHAR(120)    DEFAULT NULL,
    deleted_by          VARCHAR(120)    DEFAULT NULL,
    created_at          VARCHAR(30)     NOT NULL,
    updated_at          VARCHAR(30)     NOT NULL,
    deleted_at          VARCHAR(30)     DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // GDPR VVT
  `CREATE TABLE IF NOT EXISTS gdpr_vvt (
    id                  VARCHAR(120)    NOT NULL PRIMARY KEY,
    name                VARCHAR(512)    NOT NULL DEFAULT '',
    purpose             LONGTEXT        NOT NULL,
    legal_basis         VARCHAR(120)    NOT NULL DEFAULT '',
    legal_basis_note    LONGTEXT        NOT NULL,
    data_categories     LONGTEXT        NOT NULL DEFAULT ('[]'),
    data_subjects       LONGTEXT        NOT NULL DEFAULT ('[]'),
    recipients          LONGTEXT        NOT NULL,
    retention           LONGTEXT        NOT NULL,
    applicable_entities LONGTEXT        NOT NULL DEFAULT ('[]'),
    created_by          VARCHAR(120)    NOT NULL DEFAULT 'system',
    created_at          VARCHAR(30)     NOT NULL,
    updated_at          VARCHAR(30)     NOT NULL,
    deleted_at          VARCHAR(30)     DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // GDPR AV (Auftragsverarbeiter)
  `CREATE TABLE IF NOT EXISTS gdpr_av (
    id                  VARCHAR(120)    NOT NULL PRIMARY KEY,
    processor           VARCHAR(256)    NOT NULL DEFAULT '',
    service             LONGTEXT        NOT NULL,
    contract_date       VARCHAR(20)     DEFAULT NULL,
    review_date         VARCHAR(20)     DEFAULT NULL,
    status              VARCHAR(30)     NOT NULL DEFAULT 'active',
    checklist           LONGTEXT        NOT NULL DEFAULT ('[]'),
    applicable_entities LONGTEXT        NOT NULL DEFAULT ('[]'),
    created_by          VARCHAR(120)    NOT NULL DEFAULT 'system',
    created_at          VARCHAR(30)     NOT NULL,
    updated_at          VARCHAR(30)     NOT NULL,
    deleted_at          VARCHAR(30)     DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // GDPR DSFA
  `CREATE TABLE IF NOT EXISTS gdpr_dsfa (
    id                  VARCHAR(120)    NOT NULL PRIMARY KEY,
    title               VARCHAR(512)    NOT NULL DEFAULT '',
    description         LONGTEXT        NOT NULL,
    likelihood          INT             NOT NULL DEFAULT 2,
    impact              INT             NOT NULL DEFAULT 2,
    risk_score          INT             NOT NULL DEFAULT 4,
    measures            LONGTEXT        NOT NULL,
    status              VARCHAR(30)     NOT NULL DEFAULT 'draft',
    applicable_entities LONGTEXT        NOT NULL DEFAULT ('[]'),
    created_by          VARCHAR(120)    NOT NULL DEFAULT 'system',
    created_at          VARCHAR(30)     NOT NULL,
    updated_at          VARCHAR(30)     NOT NULL,
    deleted_at          VARCHAR(30)     DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // GDPR Incidents (Datenpannen)
  `CREATE TABLE IF NOT EXISTS gdpr_incidents (
    id                  VARCHAR(120)    NOT NULL PRIMARY KEY,
    title               VARCHAR(512)    NOT NULL DEFAULT '',
    description         LONGTEXT        NOT NULL,
    incident_type       VARCHAR(80)     NOT NULL DEFAULT 'confidentiality',
    discovered_at       VARCHAR(30)     DEFAULT NULL,
    reported_at         VARCHAR(30)     DEFAULT NULL,
    authority_notified  TINYINT(1)      NOT NULL DEFAULT 0,
    subjects_notified   TINYINT(1)      NOT NULL DEFAULT 0,
    status              VARCHAR(30)     NOT NULL DEFAULT 'open',
    measures            LONGTEXT        NOT NULL,
    applicable_entities LONGTEXT        NOT NULL DEFAULT ('[]'),
    created_by          VARCHAR(120)    NOT NULL DEFAULT 'system',
    created_at          VARCHAR(30)     NOT NULL,
    updated_at          VARCHAR(30)     NOT NULL,
    deleted_at          VARCHAR(30)     DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // GDPR DSAR (Betroffenenrechte)
  `CREATE TABLE IF NOT EXISTS gdpr_dsar (
    id                  VARCHAR(120)    NOT NULL PRIMARY KEY,
    requester           VARCHAR(256)    NOT NULL DEFAULT '',
    request_type        VARCHAR(80)     NOT NULL DEFAULT 'access',
    received_at         VARCHAR(30)     DEFAULT NULL,
    due_date            VARCHAR(30)     DEFAULT NULL,
    extended_due_date   VARCHAR(30)     DEFAULT NULL,
    status              VARCHAR(30)     NOT NULL DEFAULT 'open',
    notes               LONGTEXT        NOT NULL,
    applicable_entities LONGTEXT        NOT NULL DEFAULT ('[]'),
    created_by          VARCHAR(120)    NOT NULL DEFAULT 'system',
    created_at          VARCHAR(30)     NOT NULL,
    updated_at          VARCHAR(30)     NOT NULL,
    deleted_at          VARCHAR(30)     DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // GDPR TOMs
  `CREATE TABLE IF NOT EXISTS gdpr_toms (
    id                  VARCHAR(120)    NOT NULL PRIMARY KEY,
    category            VARCHAR(80)     NOT NULL DEFAULT 'access_control',
    title               VARCHAR(512)    NOT NULL DEFAULT '',
    description         LONGTEXT        NOT NULL,
    status              VARCHAR(30)     NOT NULL DEFAULT 'implemented',
    review_date         VARCHAR(20)     DEFAULT NULL,
    applicable_entities LONGTEXT        NOT NULL DEFAULT ('[]'),
    created_by          VARCHAR(120)    NOT NULL DEFAULT 'system',
    created_at          VARCHAR(30)     NOT NULL,
    updated_at          VARCHAR(30)     NOT NULL,
    deleted_at          VARCHAR(30)     DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // GDPR DSB (Datenschutzbeauftragter) — Singleton
  `CREATE TABLE IF NOT EXISTS gdpr_dsb (
    id           VARCHAR(30)     NOT NULL PRIMARY KEY DEFAULT 'singleton',
    name         VARCHAR(256)    NOT NULL DEFAULT '',
    email        VARCHAR(256)    NOT NULL DEFAULT '',
    phone        VARCHAR(80)     NOT NULL DEFAULT '',
    external     TINYINT(1)      NOT NULL DEFAULT 0,
    appointed_at VARCHAR(30)     DEFAULT NULL,
    file_name    VARCHAR(256)    DEFAULT NULL,
    file_type    VARCHAR(80)     DEFAULT NULL,
    updated_at   VARCHAR(30)     NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // RBAC Users
  `CREATE TABLE IF NOT EXISTS rbac_users (
    id            VARCHAR(120)    NOT NULL PRIMARY KEY,
    email         VARCHAR(256)    NOT NULL UNIQUE,
    display_name  VARCHAR(256)    NOT NULL DEFAULT '',
    role          VARCHAR(30)     NOT NULL DEFAULT 'reader',
    functions     LONGTEXT        NOT NULL DEFAULT ('[]'),
    password_hash VARCHAR(256)    NOT NULL,
    totp_secret   VARCHAR(256)    DEFAULT NULL,
    totp_enabled  TINYINT(1)      NOT NULL DEFAULT 0,
    created_at    VARCHAR(30)     NOT NULL,
    updated_at    VARCHAR(30)     NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Org Settings
  `CREATE TABLE IF NOT EXISTS org_settings (
    key_name  VARCHAR(120)    NOT NULL PRIMARY KEY,
    value     LONGTEXT        NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Audit Log
  `CREATE TABLE IF NOT EXISTS audit_log (
    id          INT             NOT NULL AUTO_INCREMENT PRIMARY KEY,
    ts          VARCHAR(30)     NOT NULL,
    user_email  VARCHAR(256),
    action      VARCHAR(80)     NOT NULL,
    resource    VARCHAR(80),
    resource_id VARCHAR(120),
    detail      LONGTEXT,
    INDEX idx_ts   (ts),
    INDEX idx_user (user_email),
    INDEX idx_res  (resource)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Goals (ISO 27001 Kap. 6.2)
  `CREATE TABLE IF NOT EXISTS goals (
    id                  VARCHAR(120)    NOT NULL PRIMARY KEY,
    title               VARCHAR(512)    NOT NULL DEFAULT '',
    description         LONGTEXT        NOT NULL,
    category            VARCHAR(80)     NOT NULL DEFAULT 'other',
    status              VARCHAR(30)     NOT NULL DEFAULT 'active',
    priority            VARCHAR(20)     NOT NULL DEFAULT 'medium',
    progress            INT             NOT NULL DEFAULT 0,
    due_date            VARCHAR(20)     DEFAULT NULL,
    review_date         VARCHAR(20)     DEFAULT NULL,
    owner               VARCHAR(120)    NOT NULL DEFAULT '',
    notes               LONGTEXT        NOT NULL,
    kpis                LONGTEXT        NOT NULL DEFAULT ('[]'),
    attachments         LONGTEXT        NOT NULL DEFAULT ('[]'),
    applicable_entities LONGTEXT        NOT NULL DEFAULT ('[]'),
    linked_controls     LONGTEXT        NOT NULL DEFAULT ('[]'),
    linked_policies     LONGTEXT        NOT NULL DEFAULT ('[]'),
    created_by          VARCHAR(120)    NOT NULL DEFAULT 'system',
    updated_by          VARCHAR(120)    DEFAULT NULL,
    deleted_by          VARCHAR(120)    DEFAULT NULL,
    created_at          VARCHAR(30)     NOT NULL,
    updated_at          VARCHAR(30)     NOT NULL,
    deleted_at          VARCHAR(30)     DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Assets
  `CREATE TABLE IF NOT EXISTS assets (
    id                  VARCHAR(120)    NOT NULL PRIMARY KEY,
    name                VARCHAR(512)    NOT NULL DEFAULT '',
    type                VARCHAR(50)     NOT NULL DEFAULT 'other',
    category            VARCHAR(80)     NOT NULL DEFAULT 'other',
    description         LONGTEXT        NOT NULL,
    owner               VARCHAR(120)    NOT NULL DEFAULT '',
    owner_email         VARCHAR(256)    NOT NULL DEFAULT '',
    custodian           VARCHAR(120)    NOT NULL DEFAULT '',
    entity_id           VARCHAR(120)    NOT NULL DEFAULT '',
    location            VARCHAR(256)    NOT NULL DEFAULT '',
    classification      VARCHAR(50)     NOT NULL DEFAULT 'internal',
    criticality         VARCHAR(30)     NOT NULL DEFAULT 'medium',
    status              VARCHAR(30)     NOT NULL DEFAULT 'active',
    vendor              VARCHAR(256)    NOT NULL DEFAULT '',
    version             VARCHAR(80)     NOT NULL DEFAULT '',
    serial_number       VARCHAR(120)    NOT NULL DEFAULT '',
    purchase_date       VARCHAR(20)     DEFAULT NULL,
    eol_date            VARCHAR(20)     DEFAULT NULL,
    notes               LONGTEXT        NOT NULL,
    tags                LONGTEXT        NOT NULL DEFAULT ('[]'),
    applicable_entities LONGTEXT        NOT NULL DEFAULT ('[]'),
    linked_controls     LONGTEXT        NOT NULL DEFAULT ('[]'),
    linked_policies     LONGTEXT        NOT NULL DEFAULT ('[]'),
    created_by          VARCHAR(120)    NOT NULL DEFAULT 'system',
    updated_by          VARCHAR(120)    DEFAULT NULL,
    created_at          VARCHAR(30)     NOT NULL,
    updated_at          VARCHAR(30)     NOT NULL,
    deleted_at          VARCHAR(30)     DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Suppliers
  `CREATE TABLE IF NOT EXISTS suppliers (
    id                    VARCHAR(120)    NOT NULL PRIMARY KEY,
    name                  VARCHAR(512)    NOT NULL DEFAULT '',
    type                  VARCHAR(80)     NOT NULL DEFAULT 'other',
    criticality           VARCHAR(30)     NOT NULL DEFAULT 'medium',
    status                VARCHAR(30)     NOT NULL DEFAULT 'active',
    country               VARCHAR(120)    NOT NULL DEFAULT '',
    contact_name          VARCHAR(256)    NOT NULL DEFAULT '',
    contact_email         VARCHAR(256)    NOT NULL DEFAULT '',
    website               VARCHAR(512)    NOT NULL DEFAULT '',
    description           LONGTEXT        NOT NULL,
    products              LONGTEXT        NOT NULL,
    data_access           TINYINT(1)      NOT NULL DEFAULT 0,
    data_categories       LONGTEXT        NOT NULL DEFAULT ('[]'),
    security_requirements LONGTEXT        NOT NULL DEFAULT ('[]'),
    last_audit_date       VARCHAR(20)     DEFAULT NULL,
    next_audit_date       VARCHAR(20)     DEFAULT NULL,
    audit_result          VARCHAR(40)     NOT NULL DEFAULT 'not_scheduled',
    contract_id           VARCHAR(120)    NOT NULL DEFAULT '',
    av_contract_id        VARCHAR(120)    NOT NULL DEFAULT '',
    risk_score            INT             NOT NULL DEFAULT 0,
    notes                 LONGTEXT        NOT NULL,
    linked_controls       LONGTEXT        NOT NULL DEFAULT ('[]'),
    linked_policies       LONGTEXT        NOT NULL DEFAULT ('[]'),
    created_by            VARCHAR(120)    NOT NULL DEFAULT 'system',
    updated_by            VARCHAR(120)    DEFAULT NULL,
    deleted_by            VARCHAR(120)    DEFAULT NULL,
    created_at            VARCHAR(30)     NOT NULL,
    updated_at            VARCHAR(30)     NOT NULL,
    deleted_at            VARCHAR(30)     DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // BCM (Business Continuity Management)
  `CREATE TABLE IF NOT EXISTS bcm_entries (
    id          VARCHAR(120)    NOT NULL PRIMARY KEY,
    bcm_type    VARCHAR(30)     NOT NULL DEFAULT 'bia',
    data        LONGTEXT        NOT NULL DEFAULT ('{}'),
    created_by  VARCHAR(120)    NOT NULL DEFAULT 'system',
    created_at  VARCHAR(30)     NOT NULL,
    updated_at  VARCHAR(30)     NOT NULL,
    deleted_at  VARCHAR(30)     DEFAULT NULL,
    INDEX idx_bcm_type (bcm_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Legal
  `CREATE TABLE IF NOT EXISTS legal_entries (
    id          VARCHAR(120)    NOT NULL PRIMARY KEY,
    legal_type  VARCHAR(30)     NOT NULL DEFAULT 'contract',
    data        LONGTEXT        NOT NULL DEFAULT ('{}'),
    created_by  VARCHAR(120)    NOT NULL DEFAULT 'system',
    created_at  VARCHAR(30)     NOT NULL,
    updated_at  VARCHAR(30)     NOT NULL,
    deleted_at  VARCHAR(30)     DEFAULT NULL,
    INDEX idx_legal_type (legal_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Public Incidents
  `CREATE TABLE IF NOT EXISTS public_incidents (
    id          VARCHAR(120)    NOT NULL PRIMARY KEY,
    ref         VARCHAR(30)     NOT NULL,
    data        LONGTEXT        NOT NULL DEFAULT ('{}'),
    submitted_at VARCHAR(30)    NOT NULL,
    deleted_at  VARCHAR(30)     DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Findings
  `CREATE TABLE IF NOT EXISTS findings (
    id          VARCHAR(120)    NOT NULL PRIMARY KEY,
    data        LONGTEXT        NOT NULL DEFAULT ('{}'),
    created_by  VARCHAR(120)    NOT NULL DEFAULT 'system',
    created_at  VARCHAR(30)     NOT NULL,
    updated_at  VARCHAR(30)     NOT NULL,
    deleted_at  VARCHAR(30)     DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Org Units
  `CREATE TABLE IF NOT EXISTS org_units (
    id          VARCHAR(120)    NOT NULL PRIMARY KEY,
    data        LONGTEXT        NOT NULL DEFAULT ('{}'),
    created_at  VARCHAR(30)     NOT NULL,
    updated_at  VARCHAR(30)     NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Governance – Management Reviews
  `CREATE TABLE IF NOT EXISTS governance_reviews (
    id                        VARCHAR(120)  NOT NULL PRIMARY KEY,
    title                     VARCHAR(512)  NOT NULL DEFAULT '',
    type                      VARCHAR(50)   NOT NULL DEFAULT 'annual',
    date                      VARCHAR(20)   NOT NULL DEFAULT '',
    next_review_date          VARCHAR(20)   NOT NULL DEFAULT '',
    status                    VARCHAR(30)   NOT NULL DEFAULT 'planned',
    chair                     VARCHAR(120)  NOT NULL DEFAULT '',
    participants              LONGTEXT      NOT NULL,
    input_audit_results       LONGTEXT      NOT NULL,
    input_stakeholder_feedback LONGTEXT     NOT NULL,
    input_performance         LONGTEXT      NOT NULL,
    input_nonconformities     LONGTEXT      NOT NULL,
    input_previous_actions    LONGTEXT      NOT NULL,
    input_risks_opportunities LONGTEXT      NOT NULL,
    input_external_changes    LONGTEXT      NOT NULL,
    decisions                 LONGTEXT      NOT NULL,
    improvements              LONGTEXT      NOT NULL,
    resource_needs            LONGTEXT      NOT NULL,
    notes                     LONGTEXT      NOT NULL,
    linked_controls           LONGTEXT      NOT NULL DEFAULT ('[]'),
    linked_policies           LONGTEXT      NOT NULL DEFAULT ('[]'),
    created_by                VARCHAR(120)  NOT NULL DEFAULT 'system',
    created_at                VARCHAR(30)   NOT NULL,
    updated_at                VARCHAR(30)   NOT NULL,
    deleted_at                VARCHAR(30)   DEFAULT NULL,
    INDEX idx_gov_rev_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Governance – Action Items
  `CREATE TABLE IF NOT EXISTS governance_actions (
    id           VARCHAR(120)  NOT NULL PRIMARY KEY,
    title        VARCHAR(512)  NOT NULL DEFAULT '',
    description  LONGTEXT      NOT NULL,
    status       VARCHAR(30)   NOT NULL DEFAULT 'open',
    priority     VARCHAR(20)   NOT NULL DEFAULT 'medium',
    due_date     VARCHAR(20)   DEFAULT NULL,
    responsible  VARCHAR(120)  NOT NULL DEFAULT '',
    linked_review VARCHAR(120) DEFAULT NULL,
    created_by   VARCHAR(120)  NOT NULL DEFAULT 'system',
    created_at   VARCHAR(30)   NOT NULL,
    updated_at   VARCHAR(30)   NOT NULL,
    deleted_at   VARCHAR(30)   DEFAULT NULL,
    INDEX idx_gov_act_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Governance – Meetings
  `CREATE TABLE IF NOT EXISTS governance_meetings (
    id           VARCHAR(120)  NOT NULL PRIMARY KEY,
    title        VARCHAR(512)  NOT NULL DEFAULT '',
    date         VARCHAR(20)   NOT NULL DEFAULT '',
    location     VARCHAR(256)  NOT NULL DEFAULT '',
    participants LONGTEXT      NOT NULL,
    agenda       LONGTEXT      NOT NULL,
    minutes      LONGTEXT      NOT NULL,
    status       VARCHAR(30)   NOT NULL DEFAULT 'planned',
    created_by   VARCHAR(120)  NOT NULL DEFAULT 'system',
    created_at   VARCHAR(30)   NOT NULL,
    updated_at   VARCHAR(30)   NOT NULL,
    deleted_at   VARCHAR(30)   DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Crossmap – Framework Control Groups
  `CREATE TABLE IF NOT EXISTS crossmap_groups (
    id          VARCHAR(120)  NOT NULL PRIMARY KEY,
    topic       VARCHAR(256)  NOT NULL DEFAULT '',
    description LONGTEXT      NOT NULL,
    controls    LONGTEXT      NOT NULL DEFAULT ('[]'),
    created_at  VARCHAR(30)   NOT NULL,
    updated_at  VARCHAR(30)   NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Custom Lists (editable dropdowns)
  `CREATE TABLE IF NOT EXISTS custom_lists (
    key_name  VARCHAR(120)  NOT NULL PRIMARY KEY,
    value     LONGTEXT      NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Policy Distributions (Verteilrunden)
  `CREATE TABLE IF NOT EXISTS policy_distributions (
    id                VARCHAR(120)  NOT NULL PRIMARY KEY,
    template_id       VARCHAR(120)  NOT NULL DEFAULT '',
    template_title    VARCHAR(512)  NOT NULL DEFAULT '',
    template_type     VARCHAR(80)   NOT NULL DEFAULT 'Policy',
    template_version  INT           NOT NULL DEFAULT 1,
    mode              VARCHAR(50)   NOT NULL DEFAULT 'manual',
    target_group      VARCHAR(256)  NOT NULL DEFAULT '',
    due_date          VARCHAR(20)   DEFAULT NULL,
    email_list        LONGTEXT      NOT NULL DEFAULT ('[]'),
    notes             LONGTEXT      NOT NULL,
    status            VARCHAR(30)   NOT NULL DEFAULT 'active',
    created_by        VARCHAR(120)  NOT NULL DEFAULT 'system',
    created_at        VARCHAR(30)   NOT NULL,
    updated_at        VARCHAR(30)   NOT NULL,
    deleted_at        VARCHAR(30)   DEFAULT NULL,
    INDEX idx_dist_template (template_id),
    INDEX idx_dist_status   (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Policy Acknowledgements (individuelle Bestätigungen)
  `CREATE TABLE IF NOT EXISTS policy_acks (
    id               VARCHAR(120)  NOT NULL PRIMARY KEY,
    distribution_id  VARCHAR(120)  NOT NULL DEFAULT '',
    recipient_email  VARCHAR(256)  NOT NULL DEFAULT '',
    recipient_name   VARCHAR(256)  NOT NULL DEFAULT '',
    token            VARCHAR(80)   NOT NULL UNIQUE,
    status           VARCHAR(30)   NOT NULL DEFAULT 'pending',
    acknowledged_at  VARCHAR(30)   DEFAULT NULL,
    ip_address       VARCHAR(60)   DEFAULT NULL,
    user_agent       LONGTEXT      DEFAULT NULL,
    created_at       VARCHAR(30)   NOT NULL,
    INDEX idx_ack_dist  (distribution_id),
    INDEX idx_ack_token (token)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Supplier Self-Assessments
  `CREATE TABLE IF NOT EXISTS assessments (
    id           VARCHAR(120)  NOT NULL PRIMARY KEY,
    supplier_id  VARCHAR(120)  NOT NULL DEFAULT '',
    title        VARCHAR(512)  NOT NULL DEFAULT '',
    language     VARCHAR(10)   NOT NULL DEFAULT 'de',
    status       VARCHAR(30)   NOT NULL DEFAULT 'pending',
    due_date     VARCHAR(20)   DEFAULT NULL,
    token        VARCHAR(80)   NOT NULL UNIQUE,
    questions    LONGTEXT      NOT NULL DEFAULT ('[]'),
    answers      LONGTEXT      NOT NULL DEFAULT ('[]'),
    score        FLOAT         DEFAULT NULL,
    submitted_at VARCHAR(30)   DEFAULT NULL,
    reviewed_by  VARCHAR(120)  DEFAULT NULL,
    reviewed_at  VARCHAR(30)   DEFAULT NULL,
    notes        LONGTEXT      NOT NULL DEFAULT '',
    created_by   VARCHAR(120)  NOT NULL DEFAULT 'system',
    created_at   VARCHAR(30)   NOT NULL,
    updated_at   VARCHAR(30)   NOT NULL,
    deleted_at   VARCHAR(30)   DEFAULT NULL,
    INDEX idx_ass_supplier (supplier_id),
    INDEX idx_ass_token    (token),
    INDEX idx_ass_status   (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
]

async function initSchema(pool) {
  const conn = await pool.getConnection()
  try {
    for (const sql of SCHEMA_SQL) {
      await conn.execute(sql)
    }
  } finally {
    conn.release()
  }
}

async function init() {
  const pool = getPool()
  await initSchema(pool)
  return pool
}

module.exports = { getPool, init }
