# Externe HTTP-API

## Überblick

CyberSarah-21- stellt eine versionierte HTTP-API unter `/api/v1` bereit. Der Healthcheck ist öffentlich; alle Conversation-Endpunkte verlangen ein Bearer-Token. Die vollständige maschinenlesbare Beschreibung liegt in [`openapi.yaml`](openapi.yaml).

## Start

```bash
cp .env.example .env
# CYBERSARAH_API_TOKEN mit einem langen zufälligen Wert setzen
pnpm install
pnpm api
```

Der Standardport ist `3000`. Der API-Schlüssel für den KI-Provider und das Client-Bearer-Token sind unterschiedliche Geheimnisse und müssen getrennt verwaltet werden.

## Endpunkte

| Methode | Pfad | Authentifizierung | Zweck |
|---|---|---|---|
| `GET` | `/api/v1/health` | Keine | Dienststatus prüfen |
| `GET` | `/api/v1/conversations` | Bearer | Eigene Gespräche auflisten |
| `POST` | `/api/v1/conversations` | Bearer | Gespräch erstellen; optionales `title` |
| `GET` | `/api/v1/conversations/{id}/messages` | Bearer | Eigenen Verlauf laden |
| `POST` | `/api/v1/conversations/{id}/messages` | Bearer | Nachricht senden und KI-Antwort erzeugen |

Für die aktuelle MVP-Entwicklung kann ein Client mit `X-Client-User-Id` einen stabilen Nutzerkontext simulieren. Diese Header-basierte Identität ist ausschließlich für die Entwicklungsphase vorgesehen und muss vor einem produktiven Einsatz durch echte Client- oder OAuth-Authentifizierung ersetzt werden.

```bash
curl http://localhost:3000/api/v1/health

curl -X POST http://localhost:3000/api/v1/conversations \
  -H 'Authorization: Bearer <CYBERSARAH_API_TOKEN>' \
  -H 'X-Client-User-Id: client-a' \
  -H 'Content-Type: application/json' \
  -d '{"title":"Mein API-Gespräch"}'
```

Jede Antwort enthält eine `requestId`. Fehler folgen dem einheitlichen Format `{ "error": { "code": "...", "message": "..." }, "requestId": "..." }`. Request-Bodies sind auf 1 MB begrenzt; Nachrichten dürfen höchstens 8.000 Zeichen enthalten.

## Sicherheitsgrenzen

Das Bearer-Token wird serverseitig constant-time verglichen. API-Keys werden nicht geloggt oder an Clients zurückgegeben. Der Transport besitzt derzeit noch kein TLS-Terminierungsmodul und sollte deshalb hinter einem HTTPS-Reverse-Proxy oder einer verwalteten Plattform betrieben werden. Rate Limits, echte Nutzeridentität, CORS-Policy und Audit-Events sind vor einer öffentlichen Freigabe noch zu ergänzen.
