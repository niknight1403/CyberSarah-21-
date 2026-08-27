# Repository-Vergleich und Hauptprojektentscheidung

**Prüfdatum:** 27. August 2026
**Bewertete Repositories:** [`Ai-Studio-`](https://github.com/niknight1403/Ai-Studio-) und [`CyberSarah-21-`](https://github.com/niknight1403/CyberSarah-21-)
**Autor:** Manus AI

## Entscheidung

**CyberSarah-21- ist eindeutig das bessere Hauptprojekt.** Es besitzt inzwischen eine echte technische Basis mit API, JWT-Authentifizierung, SQLite-Persistenz, versionierten Migrationen, verwalteten API-Clients, Token-Rotation, RBAC, Rate Limiting, Security-Headern, CORS-Regeln, Tests, CI/CD-Workflow und ausführlicher Dokumentation. `Ai-Studio-` enthält weiterhin nur eine minimale README und keinen implementierten Projektbestand.

Damit wäre ein Wechsel zu `Ai-Studio-` kein technischer Fortschritt, sondern ein vollständiger Neustart. `Ai-Studio-` sollte vorerst als privates Archiv beziehungsweise als mögliche spätere Experimentierfläche behandelt werden. Neue produktive Funktionalität sollte ausschließlich in `CyberSarah-21-` entstehen.

## Vergleich des aktuellen GitHub-Stands

| Kriterium | Ai-Studio- | CyberSarah-21- | Bewertung |
|---|---:|---:|---|
| Repository-Sichtbarkeit | Privat | Öffentlich | Kein Qualitätskriterium; Sichtbarkeit muss bewusst entschieden werden |
| Standardbranch | `main` | `main` | Gleichstand |
| Commits | 1 | 14 | Klarer Vorteil für CyberSarah-21- |
| Versionierte Dateien | 1 | 41 | Klarer Vorteil für CyberSarah-21- |
| Quellcode | Nicht vorhanden | TypeScript-Kern, API und Infrastruktur | Klarer Vorteil für CyberSarah-21- |
| Persistenz | Nicht vorhanden | SQLite mit drei versionierten Migrationen | Klarer Vorteil für CyberSarah-21- |
| KI-Anbindung | Nicht vorhanden | OpenAI-kompatibler Provider mit Timeout und Fehlerbehandlung | Klarer Vorteil für CyberSarah-21- |
| Authentifizierung | Nicht vorhanden | JWT mit HS256, Claims, Ablauf-, Issuer- und Audience-Prüfung | Klarer Vorteil für CyberSarah-21- |
| Clientverwaltung | Nicht vorhanden | Erstellung, Auflistung, Rotation und Widerruf | Klarer Vorteil für CyberSarah-21- |
| Autorisierung | Nicht vorhanden | Rollen und granulare Scopes mit Admin-Endpunkten | Klarer Vorteil für CyberSarah-21- |
| API-Schutz | Nicht vorhanden | Rate Limiting, Security-Header und konfigurierbares CORS | Klarer Vorteil für CyberSarah-21- |
| Qualitätssicherung | Nicht vorhanden | 18 Tests, Typecheck, Formatcheck und GitHub Actions | Klarer Vorteil für CyberSarah-21- |
| Dokumentation | Eine Überschrift | Architektur, MVP-Plan, API, OpenAPI und Betriebsnotizen | Klarer Vorteil für CyberSarah-21- |

## Technische Reife

`Ai-Studio-` liefert derzeit keine technische Substanz, die bewertet, wiederverwendet oder sicher integriert werden könnte. Es fehlen Quellcode, Paketdefinitionen, Build- und Laufzeitkonfiguration, Tests, Datenmodell, CI/CD und Produktdokumentation. Der einzige Commit ist der Initial-Commit vom 21. August 2026.

`CyberSarah-21-` hat sich dagegen von einer leeren Ausgangsbasis zu einem nachvollziehbar versionierten MVP-Kern entwickelt. Die Architektur ist als modularer Monolith angelegt, die zentralen Verträge liegen hinter Ports, Datenbankänderungen werden über einen Migration Runner verwaltet und die API verfügt über dokumentierte Endpunkte. Die aktuell noch offenen Produktionsaufgaben sind Erweiterungen einer vorhandenen Basis, keine grundlegenden Rettungsmaßnahmen.

## Produktfit

Für das derzeit dokumentierte Produktziel – eine API-basierte CyberSarah-Plattform mit KI-Orchestrierung und administrierbarer Client-/Berechtigungsverwaltung – passt `CyberSarah-21-` direkt. Die vorhandenen Module bilden bereits die wesentlichen Begriffe des Produkts ab: Clients, Rollen, Scopes, Gespräche, KI-Provider, Migrationen und API-Sicherheit.

Der Name `Ai-Studio-` könnte zwar für ein eigenständiges KI-Produkt interessant sein, aber im Repository existiert noch keine Produktdefinition, kein UI, kein Modellworkflow und kein technischer Anker. Ein Wechsel wäre daher nur dann sinnvoll, wenn eine neue, klar getrennte Produktidee verfolgt werden soll, beispielsweise ein kreatives Studio ohne Bezug zur bestehenden CyberSarah-API. Für die aktuelle Produktlinie gibt es keinen sachlichen Grund für einen Wechsel.

## Integrationsentscheidung

Es wird **kein Code aus `Ai-Studio-` übernommen**, weil dort kein Code vorhanden ist. Ebenso werden keine Abhängigkeiten, Konfigurationen, Geheimnisse, Designs oder externen Dienste kopiert. Eine solche Übernahme würde keine Funktion liefern und könnte nur unbegründete Annahmen in das Hauptprojekt einführen.

Die sinnvolle Konsolidierung ist deshalb organisatorisch und dokumentarisch: `CyberSarah-21-` bleibt das alleinige Hauptprojekt; `Ai-Studio-` bleibt als private Referenz erhalten. Sollte `Ai-Studio-` künftig echte Implementierungen erhalten, ist vor einer möglichen Übernahme ein neuer Vergleich erforderlich, einschließlich Lizenzprüfung, Dependency-Audit, Testabdeckung, Sicherheitsprüfung und funktionaler Überschneidung.

## Empfohlene Reihenfolge für CyberSarah-21-

Als nächstes sollte die vorhandene API mit dem mobilen deutschen Dashboard verbunden werden. Danach sind produktionsreife Secret-Manager-Anbindung, asymmetrische JWT-Signaturen mit JWKS, verteiltes Rate Limiting, echte OAuth2-Clientverwaltung, Audit-Events und eine verwaltete relationale Datenbank die wichtigsten technischen Ausbaustufen. Erst wenn diese Produktbasis stabil ist, sollte eine separate `Ai-Studio-`-Produktlinie in Betracht gezogen werden.

> **Fazit:** Für die aktuelle Zielrichtung ist CyberSarah-21- nicht nur das bessere, sondern das einzige Repository mit einer belastbaren Ausgangsbasis für weitere Entwicklung.

## Prüfgrundlage

Die Bewertung basiert auf den Remote-Dateibäumen, Commit-Historien, Branches und sichtbaren Repository-Metadaten beider GitHub-Repositories. Zum Prüfzeitpunkt hatte `Ai-Studio-` einen Commit und eine versionierte Datei; `CyberSarah-21-` hatte 14 Commits, 41 versionierte Dateien, acht Testdateien, sechs Dokumentationsdateien und einen GitHub-Actions-Workflow.
