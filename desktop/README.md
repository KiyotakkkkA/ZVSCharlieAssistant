# ZVS Assistant — desktop client

Electron application built with Vite, React, TypeScript and Tailwind CSS 4,
targeting Node.js 26+. It connects to ZVS ID so the assistant can act on
behalf of a signed-in account.

## Contents

- [Architecture](#architecture)
- [Commands](#commands)
- [Connecting ZVS ID](#connecting-zvs-id)
- [Registering the client in ZVS ID](#registering-the-client-in-zvs-id)
- [Environment variables](#environment-variables)
- [Packaging](#packaging)

## Architecture

| Path                        | Contents                                              |
| --------------------------- | ----------------------------------------------------- |
| `src/host`                  | Electron main process and application lifecycle       |
| `src/ipc`                   | Shared contracts, main handlers, preload adapter      |
| `src/renderer`              | Isolated React UI                                     |
| `src/renderer/components`   | Atomic Design: atoms, molecules, organisms, templates |

The renderer talks to the host only through the typed `window.desktop` bridge.
`nodeIntegration` is off; `contextIsolation` and the sandbox are on.

The application does not register a URL scheme with the operating system. It
launches like any other program, and the ZVS ID connection starts from inside
it — see [ADR-0004](../docs/adr/0004-drop-the-zvsdesk-scheme.md). The website
only hands out the installer.

## Commands

```sh
npm install
npm run dev
npm run typecheck
npm run test
npm run build
```

## Connecting ZVS ID

**Settings → Account → Connect.** The sign-in page opens in the system
browser, the authorization code comes back to a temporary
`http://127.0.0.1:<port>/callback`, and the tokens are encrypted with
`safeStorage` and stored in `userData/zvs-id.json`. The reasoning, and the
options rejected, are in
[ADR-0001](../docs/adr/0001-zvs-id-desktop-authentication.md).

The binary contains no `client_id`. At startup it asks the server for one at
`ZVS_ID_CLIENT_CONFIG_URL` and caches the answer in
`userData/zvs-id-client.json`. If the server is unreachable the cached value
is used, so an offline launch still works. Rotating the `client_id` on the
server is picked up automatically — no rebuild, no reinstall.

The response is only trusted so far: if it names an issuer other than the one
compiled into the binary, it is rejected. A hijacked API cannot point users at
a different identity provider.

Dynamic client registration (RFC 7591) would have avoided this exchange
entirely, but Zitadel advertises no `registration_endpoint`, so a client
cannot register itself.

## Registering the client in ZVS ID

One-time setup, done in the ZVS ID web app rather than the Zitadel console:

1. Open `hub.zvsd.ru` → **Integrations** → **Applications** → create an OIDC
   application.
2. Application type **Native**, client authentication **None (PKCE)** — a
   public client holds no secret.
3. Grant types **Authorization Code** and **Refresh Token**. Without the
   refresh grant, signing in appears to work but the connection is lost on the
   next launch.
4. Redirect URI: a concrete loopback address such as
   `http://127.0.0.1:8123/callback`.
5. Put the resulting **Client ID** — not the App ID, which looks confusingly
   similar — into `ZVS_ASSISTANT_CLIENT_ID` in `docker/.env.*`, then restart
   the backend.

The loopback server binds port `0`, so the real port differs on every run.
Zitadel ignores the port when matching loopback redirect URIs, as RFC 8252
§7.3 recommends, so the port registered above does not matter.

Check that the server hands out the configuration:

```sh
curl https://api.zvsd.ru/library/apps/zvs-assistant/oauth-client
```

While the variable is empty this returns `503` with an explanation, and the
settings screen shows a warning instead of letting **Connect** be pressed.

To verify the Zitadel side, run from `ZVSMain/backend`:

```sh
npm run check:desktop-app -- <clientId>
```

## Environment variables

All optional — they exist to override the defaults, typically to point a build
at a local stack.

| Variable                   | Default                                                       | Purpose                                |
| -------------------------- | ------------------------------------------------------------- | -------------------------------------- |
| `ZVS_ID_CLIENT_CONFIG_URL` | `https://api.zvsd.ru/library/apps/zvs-assistant/oauth-client` | Where the `client_id` comes from       |
| `ZVS_ID_CLIENT_ID`         | —                                                             | Pin a `client_id`, skipping the server |
| `ZVS_ID_ISSUER`            | `https://id.zvsd.ru`                                          | Issuer used for discovery              |
| `ZVS_ID_AUTHORIZE_URL`     | `https://hub.zvsd.ru/oauth/authorize`                         | ZVS ID consent screen                  |
| `ZVS_ID_SCOPES`            | `openid profile email offline_access`                         | Requested scopes                       |

`ZVS_ID_CLIENT_ID` takes precedence over the server.

These are read from the environment **at runtime**, on the user's machine —
`electron-vite` does not inline `process.env` into the main bundle. Setting one
at build time has no effect on the shipped application.

## Packaging

`npm run dist:win` produces an NSIS installer in `release/`. Configuration
lives in `electron-builder.yml`; the full procedure, including the release
manifest and publishing, is in
[`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).

Auto-updates stay disabled until the installer is code-signed — an update
channel is a code-execution channel.
