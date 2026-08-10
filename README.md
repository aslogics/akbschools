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

On first launch it loads the **428 students** and their fee balances from the workbook.

## Features

| Page | What it does |
|------|--------------|
| **Dashboard** | Total fees, collected, outstanding, today's collection; fee‑category summary (mirrors the workbook's `SUMMARY` sheet); collection by grade; recent payments. |
| **Students** | Searchable/filterable list (by grade, status, name/ID/parent/phone); export to CSV. |
| **Student detail** | Full profile + fee breakdown per head with paid/balance and progress; payment history; reprint/delete receipts. |
| **Receive Payment** | Search a student → record a payment against one or more fee heads → choose date, mode (Cash/G.Pay/Bank/Cheque/Card) and receiving account → auto‑numbered **printable receipt** (Print / Save as PDF). |
| **Collections** | Filter by date range / account / mode; daily summary (cash vs bank‑online), by‑account totals, transaction list — mirrors `PAYMENT COLLECTION SUMMARY REPO`. |
| **Reports** | Fee‑category summary and outstanding‑dues (defaulter) list, filterable by grade and fee head; CSV export. |
| **Data & Backup** | Download a full JSON backup, restore from backup, export students CSV, and reset to the original workbook data. |

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

## Project structure

```
index.html            App shell + navigation
assets/css/styles.css Styles (incl. print/receipt styles)
assets/js/utils.js    Currency (₹, Indian format), dates, CSV, words, helpers
assets/js/store.js    IndexedDB storage + in‑memory cache + seeding
assets/js/receipt.js  Printable receipt rendering
assets/js/views.js    All pages (dashboard, students, detail, collect, collections, reports, data)
assets/js/app.js      Hash router + global search + bootstrap
data/seed.js          Embedded student+fee seed (used by the app)
data/students.seed.json  Same data as JSON (source)
scripts/extract_seed.py  Regenerates the seed from the Excel workbook
```

## Reconciliation

The embedded data reconciles exactly with the workbook's `SUMMARY` sheet
(Term ₹1,22,77,284 / ₹59,44,469 received; School Supplies ₹77,03,000 / ₹75,50,925;
Uniform ₹14,15,535 / ₹14,09,335; Transport ₹23,33,000 / ₹4,91,800), for a total of
**₹2,38,62,319 billed / ₹1,55,30,029 collected / ₹83,32,290 outstanding**.
