# AKB School — Fee Collection App

A lightweight, offline‑capable web app that reproduces the fee‑collection functions of the
**AKB_ADMISSION_2026‑2027** workbook: student records, fee heads (Term, School Supplies,
Uniform, Transport, Summer Camp, App fees), payment collection with printable receipts,
daily/entity collection summaries, and outstanding‑dues reports.

It is a **single‑page app built with plain HTML/CSS/JavaScript** — no server, no build step,
no dependencies. All data is stored **locally in the browser** (IndexedDB), so it runs fully
offline and nothing is sent anywhere.

## Running it

**Option A — just open it**
Double‑click `index.html` (or open it in Chrome/Edge/Firefox). The app ships with the student
data embedded (`data/seed.js`) so it works straight from `file://`.

**Option B — local server (recommended, avoids browser file‑access quirks)**
```bash
cd akbschools
python3 -m http.server 8000
# then open http://localhost:8000
```

On first launch it loads the **428 students** and their fee balances from the workbook, and
creates the default users below.

## Logins & access control

The app opens with a **login screen**. Three users are created on first run:

| Username | Password | Role | Can do |
|----------|----------|------|--------|
| `admin` | `admin@123` | **Admin** | Everything — dashboards, per‑student Chairman Dashboard, collections, reports, user management, backup |
| `account1` | `account1@123` | Account | Sign in, **record payments**, view each student's **pending fees by category**, edit student inputs |
| `account2` | `account2@123` | Account | same as account1 |

**Change these passwords after first sign‑in** (sidebar → *Password*, or admin → *Users* → *Reset password*).
Admins can add more users, change roles, and delete users on the **Users** page.

> ⚠️ This login runs **in the browser**, so it's an access convenience for staff on shared
> devices — not server‑grade security. For a public deploy, also set the `APP_PASSWORD`
> environment variable (site‑wide gate, see below). For true per‑user security across devices,
> use a backend (see “Data notes”).

## Features

| Page | Who | What it does |
|------|-----|--------------|
| **Dashboard** | Admin | Total fees, collected, outstanding, today's collection; fee‑category summary (mirrors `SUMMARY`); collection by grade; recent payments. |
| **Students** | All | Searchable/filterable list (grade, status, name/ID/parent/phone); CSV export. |
| **Chairman Dashboard** (per student) | Admin | Business + fee categories with Total/Received/Balance, **Amount & Received** bar chart, personal info, academic info, exam marks, payment history — replicates the workbook's Chairman Dashboard. |
| **Student fee view** (per student) | Account | Student info + **pending fees by category** + collect + payment history. |
| **Edit student** | All | Update personal details, exam marks, and fee‑head totals/paid. |
| **Receive Payment** | All | Record a payment against one or more fee heads → date, mode (Cash/G.Pay/Bank/Cheque/Card), receiving account → auto‑numbered **printable receipt**. |
| **Collections** | Admin | Date/account/mode filters; daily cash‑vs‑bank summary, by‑account totals, transactions — mirrors `PAYMENT COLLECTION SUMMARY REPO`. |
| **Reports** | Admin | Fee‑category summary and outstanding‑dues (defaulters), filterable by grade/fee head; CSV export. |
| **Users** | Admin | Add/remove users, set roles, reset passwords. |
| **Data & Backup** | Admin | Full JSON backup/restore, students CSV, reset to workbook data. |

The 7 fee categories match the Chairman Dashboard: Terms Fees, School Supplies, App Fees Paid,
Uniform & Accessories, Transport Fees, Extra Curricular Fees, Evening Sports.

## Businesses & separate receipts

Every fee head belongs to one of four businesses. When a payment covers heads from more than one
business, the app generates a **separate, logo‑branded receipt per business** (each with its own
receipt‑number series), and **Print** outputs all of them:

| Business | Fee heads | Receipt prefix | Logo |
|----------|-----------|----------------|------|
| **AKB School of Excellence** | Terms Fees, App Fees, Extra Curricular | `AKB/…` | `assets/img/logo-school.svg` |
| **AKB & Co** | School Supplies, Uniform & Accessories | `CO/…` | `assets/img/logo-co.svg` |
| **Falcon Trading & Transport** | Transport Fees | `FTT/…` | `assets/img/logo-falcon.svg` |
| **AKB Sports Academy** | Evening Sports | `SA/…` | `assets/img/logo-sports.svg` |

KPI cards appear on every tab and are clickable (they jump to the related page); the Dashboard and
Collections pages compile **business‑wise** totals; Reports has multi‑filters (search, grade,
business, fee head, status, sort).

### Replacing the logos with your exact artwork

The four logos in `assets/img/` are clean on‑brand SVGs. To use your **exact** logo files, drop your
images in `assets/img/` and point each business to them by editing the `logo:` paths in the
`BUSINESSES` object at the top of `assets/js/store.js` (PNG/JPG/SVG all work), e.g.
`logo: 'assets/img/my-school-logo.png'`. The head→business mapping (`HEAD_BUSINESS`) is right below
it if you ever need to move a fee head to a different business.

## How payments work

- The seeded `paid` amounts are treated as **opening balances** (what was already collected per
  the workbook).
- New payments recorded in the app **increase the paid amount / reduce the balance** and create a
  receipt. The **Collections** page reports these app‑recorded payments going forward.
- Deleting a payment adds the amount back to the balance.

## ⚠️ Data & backup notes

- **All data lives in the browser it was entered in.** Use **Data & Backup → Download Full Backup**
  regularly, and restore it on another device. Clearing browser data will erase entries.
- `data/seed.js` / `data/students.seed.json` contain **real student personal information** (names,
  parents, contacts, DOB). Keep this repository private. To rebuild the seed from an updated
  workbook, run:
  ```bash
  python3 scripts/extract_seed.py            # writes data/students.seed.json
  # then regenerate data/seed.js from it (see script header)
  ```

## Deploying to Railway

The repo includes a tiny zero‑dependency Node static server (`server.js`) that binds to
`$PORT`, plus `package.json` and `railway.json`, so Railway can build and run it as‑is.

**Recommended — deploy from GitHub (no CLI):**
1. Go to <https://railway.app> → **New Project** → **Deploy from GitHub repo**.
2. Pick `mdabdulkasim1/akbschools` and the branch `claude/fee-collection-app-ewi29a`
   (or merge it to your default branch first and deploy that).
3. Railway auto‑detects Node, runs `npm start` (`node server.js`). No build config needed.
4. Under **Settings → Networking → Generate Domain** to get a public URL.

**Or with the Railway CLI:**
```bash
npm i -g @railway/cli
railway login
railway init          # in the repo folder
railway up            # deploys current directory
railway domain        # generate a public URL
```

### 🔐 Protect it with a password (do this before sharing the URL)

The app has **no built‑in login** and contains **student personal data**. A public Railway URL
would otherwise be readable by anyone who has the link. The server supports optional HTTP Basic
Auth — enable it by setting environment variables in Railway
(**Variables** tab, or `railway variables set …`):

| Variable | Value |
|----------|-------|
| `APP_PASSWORD` | a strong password (required to turn auth on) |
| `APP_USER` | username (optional, default `admin`) |

When `APP_PASSWORD` is set, the whole site prompts for username/password. Without it, the site is
open to anyone with the URL.

> This Basic‑Auth gate is a simple guard for a small deployment, not a full user‑management
> system. For multiple staff accounts / roles, we'd add a proper backend + login.

## Project structure

```
index.html            App shell + navigation
assets/css/styles.css Styles (incl. print/receipt styles)
assets/js/utils.js    Currency (₹, Indian format), dates, CSV, words, helpers
assets/js/store.js    IndexedDB storage + in‑memory cache + seeding + users/auth
assets/js/auth.js     Login screen & session
assets/js/receipt.js  Printable receipt rendering
assets/js/views.js    All pages (dashboard, students, Chairman Dashboard, collect, collections, reports, users, data)
assets/js/app.js      Hash router + role gating + global search + bootstrap
server.js             Zero-dependency static server (binds $PORT, optional Basic Auth)
package.json          npm start -> node server.js  (for Railway/Nixpacks)
railway.json          Railway build/deploy config
data/seed.js          Embedded student+fee seed (used by the app)
data/students.seed.json  Same data as JSON (source)
scripts/extract_seed.py  Regenerates the seed from the Excel workbook
```

## Reconciliation

The embedded data reconciles exactly with the workbook's `SUMMARY` sheet
(Term ₹1,22,77,284 / ₹59,44,469 received; School Supplies ₹77,03,000 / ₹75,50,925;
Uniform ₹14,15,535 / ₹14,09,335; Transport ₹23,33,000 / ₹4,91,800), for a total of
**₹2,38,62,319 billed / ₹1,55,30,029 collected / ₹83,32,290 outstanding**.
