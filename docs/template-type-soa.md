# Template-Typ: SoA (Statement of Applicability)

> **Kurzdefinition:** Das SoA ist das Herzstück der ISO-27001-Zertifizierung — eine verbindliche Erklärung darüber, welche Sicherheitsmaßnahmen (Controls) angewendet werden, welche nicht, und warum.

---

## Was ist ein Statement of Applicability?

Das SoA ist kein normales Dokument wie eine Policy. Es ist eine **strukturierte Tabelle** — ein Verzeichnis aller Controls aus einem Sicherheitsrahmenwerk (z.B. ISO 27001 Annex A mit 93 Controls), in dem für jeden Control festgehalten wird:

- **Applicable?** Gilt dieser Control für uns?
- **Status:** Umgesetzt / Teilweise / In Planung / Nicht begonnen
- **Begründung:** Warum gilt er (oder warum nicht)?
- **Umsetzungsnachweis:** Welche Policy/Procedure deckt ihn ab?

**Wer braucht ein SoA zwingend?**
Jede Organisation die eine **ISO 27001-Zertifizierung** anstrebt. Ohne SoA keine Zertifizierung — es ist eine normative Anforderung aus Kapitel 6.1.3d.

---

## SoA im ISMS Builder

Das SoA-Modul ist **nicht** unter den Template-Typen in der Sidebar — es hat eine eigene Sektion in der oberen Navigation (→ **SoA**). Dort werden die Controls direkt bearbeitet.

Der Template-Typ **SoA** in der Sidebar dient für **ergänzende Dokumente** zum SoA-Prozess, z.B.:
- „SoA-Prozessbeschreibung" (Wie pflegen wir das SoA?)
- „SoA-Freigabeverfahren" (Wer genehmigt Änderungen?)
- „SoA-Review-Protokoll" (Nachweis der letzten Überprüfung)

---

## Unterstützte Frameworks im ISMS Builder

| Framework | Controls | Beschreibung |
|-----------|----------|--------------|
| **ISO 27001:2022** | 93 | Internationaler Standard für ISMS |
| **BSI IT-Grundschutz** | variabel | Deutsches Pendant, sehr detailliert |
| **NIS2** | ~30 | EU-Richtlinie für kritische Infrastrukturen |
| **EUCS** | variabel | EU Cloud Security Scheme |
| **EUAI Act** | variabel | KI-Verordnung der EU |
| **ISO 9001** | variabel | Qualitätsmanagement |
| **CRA** | variabel | Cyber Resilience Act |

---

## Konkretes Beispiel — ein SoA-Eintrag

> **Control:** ISO 27001 A.8.8 — Management of technical vulnerabilities
> **Applicable:** Ja
> **Status:** Teilweise umgesetzt
> **Begründung:** Wir betreiben eigene Server und müssen Schwachstellen systematisch managen.
> **Umsetzung:** Patch-Management-Procedure vorhanden; automatisches Scanning mit Greenbone läuft; Risiken werden über Scan-Import ins ISMS Builder übertragen.
> **Verknüpfte Templates:** „Patch-Management-Procedure v2.0", „Schwachstellenmanagement-Policy v1.1"
> **Verknüpfte Risiken:** „Ungepatchte Webserver-CVE-2024-1234"

---

## Workflow: SoA erstellen und pflegen

**Schritt 1 — Framework wählen**
In der SoA-Sektion das gewünschte Framework aktivieren (Admin → System-Konfiguration → Frameworks).

**Schritt 2 — Applicability festlegen**
Für jeden Control entscheiden: Gilt er? Falls nein → Begründung eintragen (z.B. „nicht applicable, da kein Rechenzentrum betrieben").

**Schritt 3 — Status pflegen**
Für applicable Controls den Umsetzungsstand erfassen: `not_started` → `partial` → `implemented` → `optimized`.

**Schritt 4 — Verknüpfen**
Jeden Control mit den umsetzenden Policies und Procedures verknüpfen.
Jeden Control mit den relevanten Risiken verknüpfen.

**Schritt 5 — Review und Export**
Reports → Compliance: automatische Berechnung der Implementierungsrate.
Reports → Gap Analysis: welche Controls haben noch keine verknüpfte Policy?
JSON-Export des SoA für externe Tools.

---

## SoA und Audit

Der ISO-27001-Auditor prüft das SoA als erstes Dokument. Er erwartet:

1. **Vollständigkeit:** Alle Controls des Annex A müssen bewertet sein.
2. **Konsistenz:** Applicable Controls müssen einen Umsetzungsnachweis haben.
3. **Nachvollziehbarkeit:** Ausschlüsse müssen begründet sein.
4. **Aktualität:** Das SoA muss regelmäßig reviewed werden.

```
Audit-Frage: "Zeigen Sie mir Ihr SoA."
  ↓
SoA-Sektion → Framework ISO 27001 → alle 93 Controls sichtbar
  ↓
Audit-Frage: "Warum ist A.11 (Physical Security) als 'not applicable' markiert?"
  ↓
Begründung im SoA: "Alle Systeme in der Cloud, kein eigenes Rechenzentrum."
  ↓
Audit-Frage: "Und A.8.8 (Vulnerability Management)?"
  ↓
SoA zeigt: Status 'partial', verknüpft mit Procedure + 3 Risiken aus Greenbone-Scan.
```

---

## Eigene Controls (CUSTOM-Framework)

Neben den integrierten Frameworks (ISO 27001, BSI, NIS2 etc.) bietet das SoA-Modul ein
**CUSTOM-Framework** für organisationsspezifische Controls — also Maßnahmen, die in keinem
Standardrahmenwerk enthalten sind, aber trotzdem nachweispflichtig sein sollen.

**Typische Anwendungsfälle:**
- Interne Sicherheitsrichtlinien die über ISO Annex A hinausgehen
- Branchenspezifische Anforderungen (z.B. Bankaufsicht, Medizinprodukte)
- Vertragliche Verpflichtungen gegenüber Kunden oder Lieferanten
- Eigene Best Practices die dauerhaft im ISMS verankert werden sollen

**Voraussetzung:** Rolle `contentowner` oder höher.

**Workflow:**

**Schritt 1 — CUSTOM-Tab öffnen**
In der SoA-Sektion den Tab **„CUSTOM"** anklicken. Dieser Tab ist immer vorhanden,
unabhängig von den aktivierten Frameworks.

**Schritt 2 — Eigenen Control anlegen**
Über die Schaltfläche **„+ Add Custom Control"** (nur für `contentowner`/`admin` sichtbar)
öffnet sich ein Formular mit:
- **Control-ID** — frei wählbar (z.B. `ORG-01`, `BANK-12`)
- **Titel** — kurze Bezeichnung
- **Beschreibung** — was der Control fordert
- **Domäne** — thematische Einordnung

**Schritt 3 — Wie Standard-Controls behandeln**
Eigene Controls verhalten sich identisch zu integrierten Controls:
- Applicable / Not Applicable markieren
- Umsetzungsstatus pflegen (`not_started` → `partial` → `implemented` → `optimized`)
- Mit Policies, Procedures und Risiken verknüpfen
- Erscheinen im Compliance-Report und in der Gap Analysis

**Schritt 4 — Löschen**
Eigene Controls können über den Löschen-Button entfernt werden — sofern **keine Templates
verknüpft** sind. Integrierte Controls (ISO, BSI etc.) können nicht gelöscht werden.

> **Hinweis für den Audit:** Der Auditor sieht CUSTOM-Controls im JSON-Export des SoA.
> Eine kurze Notiz in der Beschreibung warum dieser Control existiert (z.B. „vertragliche
> Anforderung Kunde XYZ") macht die Nachvollziehbarkeit im Audit deutlich einfacher.

---

## Abgrenzung: SoA-Modul vs. SoA-Template-Typ

| | SoA-Modul (obere Navigation) | SoA-Template (Sidebar) |
|---|---|---|
| **Was** | Interaktive Control-Datenbank | Begleitdokument zum Prozess |
| **Inhalt** | 93+ Controls mit Status, Verknüpfungen | Freitext: Prozessbeschreibung, Protokolle |
| **Export** | JSON, Compliance-Report | PDF-Druck |
| **Beispiel** | „ISO A.8.8 — partial — verknüpft mit 2 Policies" | „SoA-Freigabeverfahren v1.0" |
