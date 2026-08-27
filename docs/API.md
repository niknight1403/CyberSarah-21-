# Externe HTTP-API

## Überblick

CyberSarah-21- stellt eine versionierte HTTP-API unter `/api/v1` bereit. Der Healthcheck ist öffentlich; alle Conversation-Endpunkte verlangen ein signiertes JWT als Bearer-Token. Die vollständige maschinenlesbare Beschreibung liegt in [`openapi.yaml`](openapi.yaml).

## Start

```bash
cp .env.example .env
# JWT_SECRET, JWT_CLIENT_ID und JWT_CLIENT_SECRET setzen
pnpm install
pnpm api
```

Der Standardport ist `3000`. Der KI-Provider-Schlüssel, das JWT-Signaturgeheimnis und das Client-Geheimnis sind unterschiedliche Geheimnisse und müssen getrennt verwaltet werden. Das JWT-Signaturgeheimnis muss mindestens 32 Zeichen lang sein.

## Endpunkte

| Methode | Pfad | Authentifizierung | Zweck |
|---|---|---|---|
| `GET` | `/api/v1/health` | Keine | Dienststatus prüfen |
| `POST` | `/api/v1/auth/token` | Client-Credentials | Signiertes JWT ausstellen |
| `GET` | `/api/v1/conversations` | JWT Bearer | Eigene Gespräche auflisten |
| `POST` | `/api/v1/conversations` | Bearer | Gespräch erstellen; optionales `title` |
| `GET` | `/api/v1/conversations/{id}/messages` | Bearer | Eigenen Verlauf laden |
| `POST` | `/api/v1/conversations/{id}/messages` | Bearer | Nachricht senden und KI-Antwort erzeugen |

Externe Clients erhalten ihr JWT über den Token-Endpunkt. Der aktuelle MVP verwendet dafür einen vertraulichen `client_id`-/`client_secret`-Nachweis. Der `sub`-Claim des Tokens wird als Nutzerkontext verwendet; ein frei setzbarer Identitätsheader wird nicht mehr akzeptiert.

```bash
curl http://localhost:3000/api/v1/health

TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"grant_type":"client_credentials","client_id":"external-client","client_secret":"<JWT_CLIENT_SECRET>"}' \
  | jq -r .access_token)

curl -X POST http://localhost:3000/api/v1/conversations \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Mein API-Gespräch"}'
```

Jede Antwort enthält eine `requestId`. Fehler folgen dem einheitlichen Format `{ "error": { "code": "...", "message": "..." }, "requestId": "..." }`. Request-Bodies sind auf 1 MB begrenzt; Nachrichten dürfen höchstens 8.000 Zeichen enthalten.

## Rate Limiting und Browser-Schutz

Die API verwendet ein In-Memory-Sliding-Window pro Clientadresse. Das Standardlimit liegt bei 60 Requests pro 60 Sekunden; der Token-Endpunkt besitzt mit fünf Requests pro Fenster ein strengeres Limit. Bei Überschreitung antwortet die API mit `429`, `Retry-After` und den Headern `X-RateLimit-Limit`, `X-RateLimit-Remaining` und `X-RateLimit-Reset`. Die Werte können über `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` und `AUTH_RATE_LIMIT_MAX` angepasst werden.

Jede Antwort setzt restriktive Helmet-artige Header, darunter `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, eine JSON-kompatible Content-Security-Policy und `Cache-Control: no-store`. HSTS wird nur bei `FORCE_HTTPS=true` gesetzt.

CORS ist standardmäßig deaktiviert. Browser-Ursprünge müssen explizit als kommagetrennte Liste in `CORS_ORIGINS` eingetragen werden, beispielsweise `https://app.example,https://admin.example`. Nicht konfigurierte Ursprünge werden mit `403` abgewiesen. `TRUST_PROXY=true` darf nur gesetzt werden, wenn die Anwendung tatsächlich hinter einem vertrauenswürdigen Reverse Proxy läuft.

## Sicherheitsgrenzen

JWTs werden serverseitig mit HS256 signiert und verifiziert. Geprüft werden Algorithmus, Signatur, `exp`, `iat`, `iss` und `aud`. JWT-Signaturgeheimnis und Client-Secret werden nicht geloggt oder an Clients zurückgegeben. Der Transport besitzt derzeit noch kein TLS-Terminierungsmodul und sollte deshalb hinter einem HTTPS-Reverse-Proxy oder einer verwalteten Plattform betrieben werden. Für eine öffentliche Freigabe fehlen weiterhin Token-Rotation, echte OAuth-Clientverwaltung, verteiltes Rate Limiting bei mehreren Instanzen, CORS-Review, TLS und Audit-Events.
