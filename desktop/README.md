# ZVS Desktop

Electron-приложение на Vite, React, TypeScript и Tailwind CSS 4 для Node.js 26+.

## Архитектура

- `src/host` — Electron main process и прикладной жизненный цикл.
- `src/ipc` — общие контракты, main-handlers и preload-адаптер.
- `src/renderer` — изолированный React UI.
- `src/renderer/components` — Atomic Design: atoms, molecules, organisms,
  templates; страницы находятся в `pages`.

Renderer работает с host только через типизированный `window.desktop`.
`nodeIntegration` отключён, `contextIsolation` и sandbox включены.

## Команды

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

## Подключение ZVS ID

Настройки → «ZVS ID» → «Подключить». Вход открывается в системном браузере,
код возвращается на временный `http://127.0.0.1:<порт>/callback`, токены
шифруются через `safeStorage` и лежат в `userData/zvs-id.json`.
Решение и отвергнутые варианты — [ADR-0001](../docs/adr/0001-zvs-id-desktop-authentication.md).

Приложение не хранит client_id внутри себя. При старте оно спрашивает его у
сервера по адресу из `ZVS_ID_CLIENT_CONFIG_URL` и кладёт ответ в
`userData/zvs-id-client.json`. Если сервер недоступен, берётся последнее
сохранённое значение, поэтому офлайн-запуск работает. Смена client_id на
сервере подхватывается сама, пересобирать приложение не нужно.

Что настроить один раз со стороны ZVS ID:

1. `hub.zvsd.ru` → «Интеграции» → «Приложения» → создать OIDC-приложение.
2. Тип приложения — **native**, метод аутентификации — **none** (публичный
   клиент, `client_secret` не используется).
3. Redirect URI — `http://127.0.0.1:*/callback`, порт эфемерный.
4. Grant types — `authorization_code` и `refresh_token`.
5. Полученный client_id положить в `ZVS_ASSISTANT_CLIENT_ID` в `docker/.env.*`
   и перезапустить backend.

Проверить, что сервер отдаёт настройки:

```bash
curl https://api.zvsd.ru/library/apps/zvs-assistant/oauth-client
```

Пока переменная пуста, эндпоинт отвечает 503 с пояснением, а форма в
настройках показывает предупреждение и не даёт нажать «Подключить».

Переменные окружения самого приложения нужны только чтобы что-то переопределить:

| Переменная                 | По умолчанию                                                  | Назначение                            |
| -------------------------- | ------------------------------------------------------------- | ------------------------------------- |
| `ZVS_ID_CLIENT_CONFIG_URL` | `https://api.zvsd.ru/library/apps/zvs-assistant/oauth-client` | откуда брать client_id                |
| `ZVS_ID_CLIENT_ID`         | —                                                             | жёстко задать client_id, минуя сервер |
| `ZVS_ID_ISSUER`            | `https://id.zvsd.ru`                                          | issuer для discovery                  |
| `ZVS_ID_AUTHORIZE_URL`     | `https://hub.zvsd.ru/oauth/authorize`                         | экран согласия ZVS ID                 |
| `ZVS_ID_SCOPES`            | `openid profile email offline_access`                         | запрашиваемые права                   |

`ZVS_ID_CLIENT_ID` имеет приоритет над сервером — удобно, когда нужно
проверить приложение против локального стенда.

Динамическая регистрация клиента (RFC 7591) тут не подошла бы: Zitadel не
объявляет `registration_endpoint` в discovery, так что зарегистрировать себя
сам клиент не может.

## Запуск и подключение

Приложение не регистрирует собственную схему в системе — см.
[ADR-0004](../docs/adr/0004-drop-the-zvsdesk-scheme.md). Запускается оно
как обычная программа, а подключение ZVS ID начинается изнутри: настройки
→ «Аккаунт» → «Подключить». Сайт на `hub.zvsd.ru/library` только раздаёт
установщик.
