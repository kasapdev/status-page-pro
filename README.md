# Status Page Pro

[![CI](https://github.com/kasapdev/status-page-pro/actions/workflows/ci.yml/badge.svg)](https://github.com/kasapdev/status-page-pro/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) ![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-F7DF1E?logo=javascript&logoColor=black)

A beautiful, self-hosted service status dashboard — uptime, response times, and incident history with zero backend.

> Status Page Pro is a single-page, localStorage-only status dashboard inspired by statuspage.io, Instatus and Betterstack. Run it straight from `index.html` or host it on GitHub Pages. No servers, no databases, no tracking — your data never leaves the browser.

## Overview

Status Page Pro gives you a polished public status page and a PIN-gated admin panel in one static file bundle. The public view shows an overall-status banner, a grid of services with 90-day uptime strips and response-time sparklines, a threaded incident timeline, and an email subscribe box. The admin panel lets you manage services, post incidents and updates, simulate uptime history, view subscribers, and configure branding — all persisted to `localStorage`.

Everything is built with vanilla HTML, CSS and ES6+ JavaScript on top of a shared design system. There is no build step and no network access of any kind.

## Features

- **Overall status banner** derived from the worst-performing service (Operational / Maintenance / Degraded / Partial Outage / Major Outage) with a live pulse indicator.
- **Service cards** with category icon, semantic status badge, a 90-day uptime strip, a calculated uptime percentage, and a tiny SVG response-time sparkline.
- **Incident history timeline** with severity, lifecycle status (investigating → identified → monitoring → resolved), threaded updates, relative timestamps and resolved states.
- **Email subscribe box** that stores subscribers locally and confirms instantly.
- **PIN-gated admin panel** (default PIN `1234`) to add / edit / delete services, set status, and simulate 90-day uptime history.
- **Incident management**: create incidents with multi-select affected services, severity and status; append updates; or resolve in one click.
- **Subscriber management** with CSV export.
- **Branding settings**: site name, URL, logo text, contact email, and a configurable admin PIN.
- **Live "last updated" ticker** that refreshes relative times and re-renders the dashboard every 30 seconds to feel live.
- **Dark / light themes**, fully responsive down to 360px, smooth entrance animations, and accessible keyboard-operable UI.
- **Realistic sample data** seeded on first run, plus a one-click "Reset demo data" action.

## Installation

No dependencies, no build step.

```bash
git clone https://github.com/kasapdev/status-page-pro.git
cd status-page-pro
# then simply open index.html in your browser
```

Or just double-click `index.html` — it runs from `file://` directly.

**GitHub Pages:** push to a repo and enable Pages; the app is served at
`https://kasapdev.github.io/status-page-pro/`.

## Usage

1. Open the app — the **Status** dashboard loads with sample services and incidents.
2. Switch to the **Admin** tab (or press `A`) and enter the PIN (`1234`).
3. Add or edit services, set their current status, or click the dice icon to simulate a fresh 90-day history.
4. Click **New incident** to post one, choose affected services and severity, then append updates or resolve it.
5. Open **Settings** to rebrand the page and change the admin PIN. Use **Reset demo data** to restore the original sample content.
6. On the public page, enter an email in **Get notified** to subscribe; export the list as CSV from the admin panel.

All state lives in `localStorage` under the `wus.spp.*` namespace.

## Keyboard Shortcuts

| Shortcut | Action |
| -------- | ------ |
| `S` | Open the Status dashboard |
| `A` | Open the Admin panel (prompts for PIN) |
| `T` | Toggle dark / light theme |
| `?` | Show the keyboard shortcuts help |
| `Esc` | Close any open dialog |

## Screenshots

![screenshot](docs/screenshot-1.png)
![screenshot](docs/screenshot-2.png)

_Screenshots coming soon._

## Roadmap

- [ ] Per-service uptime over custom ranges (7 / 30 / 90 / 365 days)
- [ ] Import / export full configuration as JSON
- [ ] Scheduled maintenance windows with start/end times
- [ ] Optional webhook payload preview for notifications
- [ ] Multiple status pages / environments in one workspace

## License

MIT — see [LICENSE](LICENSE).

---

## Part of the kasapdev Tools Suite

One of 45+ zero-dependency vanilla JS tools, all free and open source — [see the full list](https://github.com/kasapdev/kasapdev).
