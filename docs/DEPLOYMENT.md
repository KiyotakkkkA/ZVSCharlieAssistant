# Сборка и распространение desktop-клиента

Автообновление намеренно **не включено** — см. [ADR-0002](adr/0002-desktop-update-distribution.md).
До появления подписи кода установщик распространяется вручную.

## Сборка установщика

```bash
cd desktop
npm ci
npm run dist:win     # NSIS-установщик под Windows x64
npm run dist         # текущая платформа
npm run dist:dir     # распакованная сборка, без установщика — для отладки
```

Результат в `desktop/release/`:

```
ZVS-Assistant-Setup-<версия>.exe
```

Конфигурация — `desktop/electron-builder.yml`. Важные места:

- `appId: dev.zvs.assistant` — менять нельзя, иначе Windows посчитает сборку
  другим приложением и поставит рядом со старой.
- `extraResources` кладёт нативный модуль из `native/` рядом с asar.
- `win.icon` указывает на `assets/app_logo.png` (1254×1254), а не на
  `assets/app_icon.ico`: последний всего 32×32, а установщику нужен минимум
  256×256. Многоразмерный `.ico` electron-builder собирает из PNG сам;
  `app_icon.ico` остаётся для трея.
- `publish: null` — сборка ничего никуда не выгружает.

Перед сборкой native-модуль должен быть собран (`npm run build:native`
выполняется автоматически внутри `npm run build`).

## Changelog

Правки копятся в разделе `[Unreleased]` файла `desktop/CHANGELOG.md`.
При выпуске:

1. переименовать `[Unreleased]` в `[<версия>] — ГГГГ-ММ-ДД`;
2. поднять `version` в `desktop/package.json` до той же версии;
3. `npm run release:manifest` — соберёт `release/RELEASES.json`.

Скрипт падает, если версия в package.json и верхняя запись changelog
разошлись. `RELEASES.json` — источник для страницы обновлений и будущего окна
«Что нового».

## Раздача файлов

Установщики раздаются по пути `/downloads/` на основном домене
(`hub.zvsd.ru/downloads/…`) — отдельный поддомен под это заводить не нужно.
В prod за путь отвечает сервис `downloads` (nginx, алиас `zvs-downloads` в
сети `caddy-edge`) с томом `zvs_prod_downloads` в `/srv/downloads`; в dev —
блок `handle_path /downloads/*` в `docker/caddy/Caddyfile.dev`. Разметка
каталога:

```
/srv/downloads/desktop/stable/
  ZVS-Assistant-Setup-1.2.0.exe
  RELEASES.json
```

Выложить файлы:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod cp \
  ../desktop/release/ZVS-Assistant-Setup-1.2.0.exe \
  caddy:/srv/downloads/desktop/stable/
```

Манифесты (`*.json`, `*.yml`) отдаются с `no-cache`, установщики — с годовым
`immutable`, поэтому имя файла обязано содержать версию.

Пропишите адрес каталога в `ZVS_DOWNLOADS_URL` — кнопка «Скачать» на
карточке в `hub.zvsd.ru/library` ведёт именно туда. Пока переменная пуста,
карточка честно говорит, что ссылка не настроена.

## Чего пока нет и почему

- **Подпись кода.** Без неё Windows SmartScreen будет ругаться на установщик,
  а автообновление включать нельзя в принципе: канал раздачи превращается в
  канал доставки произвольного кода.
- **electron-updater.** Ждёт подписи (шаг 4 в плане ADR-0002).
- **CI.** Сборка и выкладка делаются руками — так и задумано на этом этапе.
