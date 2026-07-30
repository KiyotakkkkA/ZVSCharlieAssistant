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
