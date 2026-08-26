# Echter KI-Provider und Datenbank – MVP-Release

## Implementierter Umfang

CyberSarah-21- verwendet nun einen **OpenAI-kompatiblen Chat-Completions-Provider** und eine dateibasierte **SQLite-Persistenz**. Beide Integrationen sind hinter den bestehenden Ports gekapselt. Der Provider wird ausschließlich serverseitig über `fetch` aufgerufen; der API-Schlüssel wird nicht an das Frontend weitergegeben.

Die SQLite-Datenbank wird beim Start unter `DATABASE_PATH` angelegt. Falls keine Variable gesetzt ist, wird `data/cybersarah.sqlite` verwendet. Tabellen und Indizes werden idempotent beim Start erzeugt. Für die nächste Stufe sollte diese Schema-Erzeugung in eine explizite Migrationsverwaltung überführt werden.

## Konfiguration

```bash
cp .env.example .env
# Danach OPENAI_API_KEY und gegebenenfalls OPENAI_MODEL setzen
pnpm install
pnpm typecheck
pnpm test
pnpm dev
```

| Variable | Pflicht | Zweck |
|---|---:|---|
| `OPENAI_API_KEY` | Für echten Provider | Serverseitiger API-Schlüssel |
| `OPENAI_API_BASE` oder `OPENAI_BASE_URL` | Nein | OpenAI-kompatible Basis-URL |
| `OPENAI_MODEL` | Nein | Modellkennung; Standard ist `gpt-4o-mini` |
| `AI_SYSTEM_PROMPT` | Nein | Optionaler Systemkontext |
| `DATABASE_PATH` | Nein | Pfad zur SQLite-Datei |
| `DEV_USER_ID` | Nein | Lokale Entwicklungsidentität |

Ohne `OPENAI_API_KEY` verwendet der Composition Root weiterhin den deterministischen `EchoProvider`, damit lokale Tests und Entwicklung ohne Netzwerkzugriff möglich bleiben. Für eine Produktionsumgebung sollte der Start ohne gültige Providerkonfiguration stattdessen ausdrücklich fehlschlagen.

## Sicherheitsverhalten

Der Provider verwendet einen Timeout von 30 Sekunden, begrenzt die Ausgabe über den Orchestrator und klassifiziert HTTP-, Netzwerk- und Inhaltsfehler als `PROVIDER_ERROR`. API-Antworten werden auf nutzbaren Text geprüft. Datenbankabfragen verwenden ausschließlich parametrisierte Statements. Die SQLite-Datei gehört nicht in das Repository und sollte durch `.gitignore` beziehungsweise eine geschützte Laufzeitumgebung abgesichert werden.

## Noch nicht enthalten

Der Release besitzt weiterhin keinen HTTP-/tRPC-Transport, keine echte Benutzeranmeldung, keine Streaming-Antworten, keine Rate-Limits, keine Audit-Tabelle und keine automatische Aufbewahrungs- oder Löschroutine. Diese Punkte sind Voraussetzung für einen produktiven extern erreichbaren Einsatz.
