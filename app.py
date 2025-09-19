

#!/usr/bin/env python3
from flask import Flask, render_template_string
import time

app = Flask(__name__)

PAGE = """
<!doctype html>
<html>
<head>
  <meta charset=\"utf-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
  <title>PDF → Excel</title>
  <meta name=\"theme-color\" content=\"#1F4993\"> 
  <link rel=\"icon\" href=\"/static/favicon.ico?v={{ v }}\" type=\"image/x-icon\">
  <link rel=\"shortcut icon\" href=\"/static/favicon.ico?v={{ v }}\" type=\"image/x-icon\">
  <style>
    :root { --pc-navy:#1F4993; --pc-gold:#c8a857; --pc-bg:#f6f8fb; --pc-text:#231F20; --pc-muted:#414042; }
    body { font-family: Segoe UI, -apple-system, Roboto, Arial, sans-serif; background:var(--pc-bg); margin:0; min-height:100vh; display:flex; flex-direction:column; }
    .wrap { width:100%; max-width: 820px; margin:40px auto; background:#fff; padding:24px; border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,.08); box-sizing:border-box; }
    .brand { display:flex; align-items:center; gap:14px; margin-bottom:8px; }
    .brand img { height:40px; width:auto; object-fit:contain; }
    h1 { margin:0 0 4px; color:var(--pc-navy); letter-spacing:.2px; }
    .subtitle { color:var(--pc-muted); margin:0 0 24px; }
    .field { margin:16px 0; }
    label { display:block; font-weight:600; margin-bottom:8px; color:var(--pc-text); }
    select, input[type=file] { width:100%; padding:12px; border:1px solid #e5e7eb; border-radius:8px; background:#fff; box-sizing:border-box; display:block; }
    button { background:var(--pc-navy); color:#fff; border:0; padding:12px 18px; border-radius:8px; font-weight:600; cursor:pointer; }
    button:disabled { opacity:.6; cursor:not-allowed; }
    .row { display:flex; gap:12px; align-items:center; }
    .row > * { flex:1; }
    .note { font-size:12px; color:var(--pc-muted); margin-top:6px; }
    .error { background:#fee2e2; color:#b91c1c; padding:10px; border-radius:8px; margin:12px 0; }
    .ok { background:#ecfdf5; color:#065f46; padding:10px; border-radius:8px; margin:12px 0; }
    .badge { display:inline-block; background:var(--pc-gold); color:#1b1b1b; font-weight:600; padding:4px 8px; border-radius:999px; font-size:12px; }
  </style>
  <!-- PDF.js and SheetJS -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
  
</head>
<body>
  <div class=\"topbar\" style=\"background:#ffffff; border-bottom:1px solid #e5e7eb; padding:10px 16px; display:flex; align-items:center; gap:10px;\">
    <img src=\"/static/pritchard-logo.png?v={{ v }}\" alt=\"Pritchard Companies\" style=\"height:32px; width:auto; object-fit:contain;\" onerror=\"this.style.display='none'\">
  </div>

  <div class=\"wrap\"> 
    <div class=\"brand\" style=\"margin-top:4px;\">
      <div>
        <h1>PDF → Excel</h1>
      </div>
    </div>
    

      <div class=\"field\">
      <label for=\"reportType\">Report type</label> 
      <select id=\"reportType\" required> 
          <option value=\"chart_of_accounts\" selected>Chart of Accounts</option>
          <option value=\"all_deals\">All Deals</option>
        </select>
        <div class=\"note\">More report types can be added later.</div>
      </div>

      <div class=\"field\">
      <label for=\"pdfFile\">PDF file</label> 
      <input id=\"pdfFile\" type=\"file\" accept=\"application/pdf\" required /> 
      </div>

      <div class=\"row\"> 
      <button id=\"convertBtn\" type=\"button\">Convert to Excel</button> 
    </div>

    <div style=\"height:10px; background:#eef2f7; border-radius:6px; overflow:hidden; margin-top:12px;\"> 
      <div class=\"progress-bar\" style=\"height:10px; width:0%; background:#414042; transition:width .2s;\"></div>
      </div>
  </div>
  <div class=\"footer\" style=\"text-align:center; color:var(--pc-muted); font-size:12px; margin:auto 0 24px;\"> 
    <div style=\"display:inline-flex; align-items:center; gap:4px;\"> 
      <span>Powered by</span> 
      <img src=\"/static/SHAED%20Logo.png?v={{ v }}\" alt=\"SHAED\" style=\"height:20px; width:auto; object-fit:contain;\" onerror=\"this.style.display='none'\"> 
    </div>
  </div>
</body>
</html>
"""

# Load modular client-side scripts (report parsers + orchestrator)
PAGE = PAGE.replace('</body>', '''
  <script src="/static/js/reports/chartOfAccounts.js?v={{ v }}"></script>
  <script src="/static/js/reports/allDeals.js?v={{ v }}"></script>
  <script src="/static/js/app.js?v={{ v }}"></script>
</body>
''')

@app.route('/', methods=['GET'])
def index():
    # version param to bust cache for static assets
    return render_template_string(PAGE, v=int(time.time()))


if __name__ == '__main__':
    print('Starting Lightyear PDF to Excel | Pritchard Companies on http://localhost:5003')
    app.run(host='0.0.0.0', port=5003, debug=True)


