## PDF → Excel Converter (Pritchard Companies)

Lightweight web app to convert specific PDF reports into Excel workbooks entirely in the browser. It uses PDF.js to read PDF text and SheetJS (XLSX) to generate .xlsx files. A tiny Flask server is included for local development and optional hosting.

### Features

- **Client-side conversion**: No uploads; parsing happens in the browser
- **Parsers included**:
  - Chart of Accounts
  - All Deals (best-effort/emergency extraction)
- **Excel output**: Data sheet + Summary sheet
- **Accessible UI**: Progress bar with live text updates

### Repository layout

- `index.html` – Static, deployable single-page app
- `static/js/app.js` – Browser orchestrator and conversion logic
- `static/js/reports/` – Report-specific parsers
  - `chartOfAccounts.js`
  - `allDeals.js`
- `app.py` – Minimal Flask server for local dev (renders same UI with cache-busting)
- `requirements.txt` – Python deps (Flask for local dev server)
- `vercel.json` – Static hosting config (optional)

### Requirements

- Modern browser (Chrome, Edge, Firefox, Safari)
- Python 3.9+ only if you want to run the local Flask server

### Quick start (static)

You can open `index.html` directly. Some browsers restrict worker loading from file://, so using a tiny static server is recommended:

```bash
# In this folder
python -m http.server 5003
# then open http://localhost:5003
```

Or deploy the static files (see Deployment).

### Quick start (Flask dev server)

Install Python deps:

```bash
pip install -r requirements.txt
```

Run the dev server:

```bash
python app.py
# App runs at http://localhost:5003
```

This renders the same UI but injects a cache-busting version param for static assets.

### Usage

1. Choose a report type
2. Select the source PDF
3. Click Convert to Excel
4. Your browser downloads an .xlsx with parsed data and a Summary sheet

Notes:
- Parsing quality depends on the PDF layout. The All Deals parser includes a tolerant extraction mode to maximize capture.
- PDFs remain on-device; nothing is uploaded to a server.

### Add a new report parser

Create `static/js/reports/yourReport.js` that registers a parser on `window.ReportParsers`:

```javascript
(function(){
  window.ReportParsers = window.ReportParsers || {};

  async function parse(lines, ctx){
    // lines: array of text lines by y-axis rows
    // ctx.pdfText: full document text if you need it
    return [ /* array of row objects */ ];
  }

  window.ReportParsers['your_report_key'] = {
    label: 'Your Report',
    sheetName: 'Your Report',
    columns: ['ColA','ColB','ColC'],
    parse
  };
})();
```

Then ensure the script is loaded (mirroring how `chartOfAccounts.js` and `allDeals.js` are included):
- In dynamic mode (`app.py`), it is injected via the HTML template assembly
- For `index.html`, reference your script similarly to other parsers

### Deployment

- **Static hosting (recommended)**:
  - Deploy `index.html` and the `static/` folder
  - On Vercel, the provided `vercel.json` serves `/static/*` and routes all other paths to `index.html`
- **Flask hosting (optional)**:
  - Run `python app.py` on your server/container and reverse-proxy via Nginx if exposing publicly

### Troubleshooting

- **Blank page or missing parser**: Verify your parser file is loaded and registered under `window.ReportParsers`. Clear the browser cache.
- **PDF fails to parse**: Try a different PDF export that preserves text (avoid scans). Adjust regex/heuristics in the parser.
- **Excel download blocked**: Allow downloads/popups for the site.

### Security & privacy

- All processing happens in the browser; PDFs are not uploaded to a server.

### License

Proprietary – internal use at Pritchard Companies / Shaed AI unless otherwise specified.
