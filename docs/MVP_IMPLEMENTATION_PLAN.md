# MVP-Umsetzungsplan für CyberSarah-21-

**Version:** 0.1  
**Status:** Umsetzungsentwurf  
**Architekturbasis:** [`ARCHITECTURE.md`](ARCHITECTURE.md)

## 1. MVP-Ziel

Das MVP soll einen sicheren, nachvollziehbaren Kernfluss liefern: Ein Nutzer meldet sich an, erstellt ein Gespräch, sendet eine Nachricht und erhält eine KI-Antwort. Der Verlauf bleibt persistent, externe Modellanbieter sind hinter einem Adapter gekapselt und kritische Vorgänge sind autorisiert sowie auditierbar.

Dokument-Uploads, semantische Suche, komplexe Administration, Multi-Tenant-Arbeitsbereiche, Streaming und mobile Clients gehören nicht zum ersten MVP. Sie werden erst nach erfolgreicher Validierung des Kernflusses ergänzt.

## 2. Technologieentscheidung für das Skelett

Für das erste Skelett wird **TypeScript auf Node.js** als serverseitige Basis verwendet. Der Dienst wird zunächst als modularer Monolith organisiert. Die später vorgesehene Weboberfläche kann über eine typisierte API angebunden werden; die fachlichen Module bleiben unabhängig von Transport und konkreter Provider-SDK.

Die Startimplementierung verwendet bewusst In-Memory-Adapter, damit die Domänen- und Anwendungsschnittstellen ohne Datenbankkonto oder externe KI-Zugangsdaten getestet werden können. In der nächsten Implementierungsstufe werden diese Adapter durch relationale Persistenz und einen echten KI-Provider ersetzt.

## 3. MVP-Scope

| Priorität | Fähigkeit | Im MVP | Abnahmekriterium |
|---|---|---:|---|
| P0 | Identität und Nutzerkontext | Ja | Jede Operation besitzt einen Nutzerkontext |
| P0 | Gespräch erstellen und lesen | Ja | Nutzer sehen ausschließlich eigene Gespräche |
| P0 | Nachricht senden | Ja | Validierte Nachricht wird gespeichert |
| P0 | KI-Antwort über Adapter | Ja | Provider kann durch Test-Double ersetzt werden |
| P0 | Autorisierung und Validierung | Ja | Fremde IDs und ungültige Eingaben werden abgewiesen |
| P0 | Fehler- und Korrelationsmodell | Ja | Fehler sind klassifiziert und Requests korrelierbar |
| P1 | Relationale Persistenz | Als nächstes | Migrationen und Transaktionen vorhanden |
| P1 | Authentifizierter HTTP-/tRPC-Transport | Als nächstes | Endpunkte nutzen dieselben Use Cases |
| P1 | Web-Chat-Oberfläche | Als nächstes | Kernfluss im Browser testbar |
| P1 | Audit-Ereignisse | Als nächstes | Sicherheitsrelevante Aktionen sind nachvollziehbar |
| P2 | Jobs und Benachrichtigungen | Später | Lange Aufgaben blockieren keine Requests |
| P2 | Dokumente und Wissenssuche | Später | Upload, Indexierung und Berechtigungen geprüft |

## 4. Meilensteine

### M0 – Produkt- und Sicherheitsgrundlage

Ziel ist die Bestätigung der Produktannahmen aus dem Architekturentwurf. Festgelegt werden Zielgruppe, erlaubte Anwendungsfälle, Datenschutz- und Aufbewahrungsregeln, Rollen, Datenregion, Modellanbieter und Kostenbudget. Ohne diese Entscheidungen bleibt das System ein Entwicklungsprototyp.

### M1 – Technisches Fundament

Angelegt werden TypeScript-Projekt, Formatierung, Linting, Testlauf, Konfigurationsschema, einheitliches Fehlerformat und Request-Korrelation. Die CI muss Installation, Typprüfung und Tests in einer sauberen Umgebung ausführen.

### M2 – Conversation Core

Implementiert werden `Conversation` und `Message` mit Repository-Ports, Use Cases und In-Memory-Adapter. Der Kernfluss wird ohne externe KI vollständig testbar: Gespräch anlegen, Nachricht speichern, Verlauf laden und Nutzergrenzen erzwingen.

### M3 – KI-Orchestrierung

Der KI-Orchestrator erhält ein eigenes Port-Interface. Er baut einen begrenzten Kontext, wendet Modell- und Kostenlimits an und speichert technische Metadaten. Im Test wird ein deterministisches Provider-Double verwendet; echte Provider werden nur serverseitig und nach Sicherheitsprüfung konfiguriert.

### M4 – Persistenz und Transport

Die In-Memory-Adapter werden durch relationale Tabellen und Transaktionen ersetzt. Danach wird ein typisierter HTTP- oder tRPC-Transport angeschlossen. Transport-Handler bleiben dünn und delegieren an dieselben Use Cases, die bereits in Unit-Tests geprüft sind.

### M5 – Browser-MVP und Betriebsfähigkeit

Die Weboberfläche erhält Login, Gesprächsliste, Verlauf, Composer, Lade-/Fehlerzustände und erreichbare Tastaturbedienung. Ergänzt werden strukturierte Logs, Metriken, Rate Limits, Audit-Events, Secret-Management und ein reproduzierbarer Deployment-Prozess.

## 5. Empfohlene Modulreihenfolge

```text
shared errors/config
        ↓
identity/context ──→ authorization
        ↓
conversations ────→ ai-orchestration
        ↓                    ↓
persistence ports      provider adapters
        ↓
transport (HTTP/tRPC) ─→ web client
```

Die Pfeile beschreiben erlaubte Abhängigkeiten. Insbesondere dürfen Domänenmodule nicht direkt von Provider-SDKs, HTTP-Frameworks oder konkreten Datenbanktreibern abhängen.

## 6. Definition of Done für das MVP

Das MVP ist erst abgeschlossen, wenn der Kernfluss mit authentifiziertem Nutzer im Browser funktioniert, Daten pro Nutzer getrennt sind, ungültige und fremde IDs sicher abgewiesen werden, externe Modellaufrufe zeitlich und kostenbezogen begrenzt sind, Fehler verständlich erscheinen und keine Geheimnisse im Quelltext liegen.

Zusätzlich müssen Unit-, Integrations- und mindestens ein End-to-End-Test vorhanden sein. Migrationen müssen reproduzierbar sein, Logs dürfen standardmäßig keine vollständigen Gesprächsinhalte enthalten, Löschung und Datenexport müssen fachlich spezifiziert sein und ein Rollback des Deployments muss dokumentiert werden.

## 7. Risiken und Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|---|---|
| Unklarer Produktnutzen | M0 vor umfangreicher UI- oder Providerarbeit abschließen |
| Providerbindung | KI-Port und Adapter von Beginn an trennen |
| Unkontrollierte Modellkosten | Timeout, Tokenlimit, Budgetlimit und Rate Limit |
| Datenleck zwischen Nutzern | Autorisierung im Use Case, nicht nur in der UI |
| Prompt-Injection über Dokumente | Dokumentfunktion erst nach Bedrohungsmodellierung |
| Zu frühe technische Komplexität | Modularer Monolith statt Microservices im MVP |
| Nicht reproduzierbare Entwicklung | Lockfile, CI, Migrationen und lokale Test-Adapter |
