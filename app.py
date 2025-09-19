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
  <title>Lightyear PDF → Excel | Pritchard Companies</title>
  <meta name=\"theme-color\" content=\"#0a2e5c\">
  <link rel=\"icon\" href=\"/static/favicon.ico?v={{ v }}\" type=\"image/x-icon\">
  <link rel=\"shortcut icon\" href=\"/static/favicon.ico?v={{ v }}\" type=\"image/x-icon\">
  <style>
    :root { --pc-navy:#0a2e5c; --pc-gold:#c8a857; --pc-bg:#f6f8fb; --pc-text:#1f2937; --pc-muted:#6b7280; }
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
        <h1>Lightyear PDF → Excel</h1>
        <div class=\"subtitle\">Pritchard Companies Portal</div>
      </div>
    </div>
    <p class=\"subtitle\">Client-side conversion. No file upload required.</p>

      <div class=\"field\">
      <label for=\"reportType\">Report type</label> 
      <select id=\"reportType\" required> 
          <option value=\"chart_of_accounts\" selected>Chart of Accounts</option>
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
      <div class=\"progress-bar\" style=\"height:10px; width:0%; background:var(--pc-gold); transition:width .2s;\"></div>
      </div>
  </div>
  <div class=\"footer\" style=\"text-align:center; color:var(--pc-muted); font-size:12px; margin:auto 0 24px;\">
    <div style=\"display:inline-flex; align-items:center; gap:8px;\">
      <span>Powered by</span>
      <img src=\"/static/SHAED%20Logo.png?v={{ v }}\" alt=\"SHAED\" style=\"height:16px; width:auto; object-fit:contain;\" onerror=\"this.style.display='none'\">
    </div>
  </div>
</body>
</html>
"""

# Inline client-side converter script (attached at end of HTML)
PAGE = PAGE.replace('</body>', '''
  <script>
  // lightyear-converter.js (client-side)
  class LightyearConverter {
      constructor() {
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          this.columns = [
              'Account Number','Description','Ctrl','Fwd','ID','Dept','Typ','Sub Typ','Chain Ref','Chain','Srt1','Srt2','Fin1','Count MTD','Count YTD','Beg Bal','MTD Bal','YTD Bal'
          ];
      }
      async convertToExcel(file, reportType) {
          try {
              this.updateProgress('Reading PDF...', 10);
              const arrayBuffer = await this.fileToArrayBuffer(file);
              const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
              const allText = await this.extractTextFromPDF(pdf);
              this.updateProgress('Parsing data...', 50);
              let data;
              switch(reportType){
                  case 'chart_of_accounts':
                      data = this.parseChartOfAccounts(allText);
                      break;
                  default:
                      throw new Error('Unsupported report type');
              }
              this.updateProgress('Creating Excel file...', 80);
              this.createAndDownloadExcel(data, reportType);
              this.updateProgress('Complete!', 100);
          } catch (err) {
              console.error('Conversion error:', err);
              alert('Conversion error: ' + err.message);
              throw err;
          }
      }
      fileToArrayBuffer(file){
          return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = e => resolve(e.target.result);
              reader.onerror = reject;
              reader.readAsArrayBuffer(file);
          });
      }
      async extractTextFromPDF(pdf){
          const allText = [];
          const numPages = pdf.numPages;
          for(let pageNum=1; pageNum<=numPages; pageNum++){
              const page = await pdf.getPage(pageNum);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map(item => ({
                  text:item.str, x:item.transform[4], y:item.transform[5], width:item.width, height:item.height
              }));
              const lines = this.groupTextIntoLines(pageText);
              allText.push(...lines);
              const progress = 10 + (40 * pageNum / numPages);
              this.updateProgress(`Processing page ${pageNum}/${numPages}...`, progress);
          }
          return allText;
      }
      groupTextIntoLines(textItems){
          const lines = {}; const threshold = 2;
          textItems.forEach(item => {
              const y = Math.round(item.y / threshold) * threshold;
              if(!lines[y]) lines[y] = [];
              lines[y].push(item);
          });
          return Object.keys(lines).sort((a,b)=>b-a).map(y => {
              const lineItems = lines[y].sort((a,b)=>a.x-b.x);
              return this.combineLineItems(lineItems);
          });
      }
      combineLineItems(items){
          let lineText = ''; let lastX = 0;
          items.forEach(item => {
              const gap = item.x - lastX;
              if(gap > 10 && lineText.length > 0){
                  const spaces = Math.floor(gap / 5);
                  lineText += ' '.repeat(Math.min(spaces, 5));
              }
              lineText += item.text;
              lastX = item.x + (item.width || 0);
          });
          return lineText.trim();
      }
      parseChartOfAccounts(lines){
          const accounts = [];
          for(let i=0; i<lines.length; i++){
              const line = lines[i];
              if(!line || this.isHeaderLine(line)) continue;
              const accountMatch = line.match(/^(\d{4,6})\s+(.+)/);
              if(accountMatch){
                  const nextLine = lines[i+1] || '';
                  const account = this.parseAccountLine(line, nextLine);
                  if(account){
                      accounts.push(account);
                      if(nextLine.includes('Count MTD') || nextLine.includes('Beg Bal:')) i++;
                  }
              }
          }
          return accounts;
      }
      parseAccountLine(line, nextLine){
          const accountMatch = line.match(/^(\d{4,6})\s+(.+)/); if(!accountMatch) return null;
          const accountNumber = accountMatch[1]; const restOfLine = accountMatch[2];
          const dataPattern = /\s{2,}([0-3])\s+([0-3])\s+([A-Z]?)\s*(\d)\s+([A-Z])\s+([A-Z])/;
          const dataMatch = restOfLine.match(dataPattern);
          let account = { 'Account Number':accountNumber,'Description':'','Ctrl':'0','Fwd':'0','ID':'','Dept':'0','Typ':'','Sub Typ':'','Chain Ref':'','Chain':'N','Srt1':'','Srt2':'','Fin1':'','Count MTD':'0','Count YTD':'0','Beg Bal':'0.00','MTD Bal':'0.00','YTD Bal':'0.00' };
          if(dataMatch){
              account['Description'] = restOfLine.substring(0, dataMatch.index).trim();
              account['Ctrl'] = dataMatch[1]; account['Fwd'] = dataMatch[2]; account['ID'] = dataMatch[3] || '';
              account['Dept'] = dataMatch[4]; account['Typ'] = dataMatch[5]; account['Sub Typ'] = dataMatch[6];
              const remaining = restOfLine.substring(dataMatch.index + dataMatch[0].length).trim();
              const remainingParts = remaining.split(/\s+/);
              account['Chain'] = remainingParts[0] || 'N'; account['Srt1'] = remainingParts[1] || '';
              account['Srt2'] = remainingParts[2] || ''; account['Fin1'] = remainingParts[3] || '';
              remainingParts.forEach(part => { if(/^\d{5}$/.test(part)) account['Chain Ref'] = part; });
          } else {
              const parts = restOfLine.split(/\s+/); let descEnd = 0;
              for(let i=0;i<parts.length;i++){ if(/^[0-3]$/.test(parts[i])) { descEnd = i; break; } }
              account['Description'] = parts.slice(0, descEnd || 1).join(' ');
              const dataParts = parts.slice(descEnd);
              if(dataParts.length>0) account['Ctrl']=dataParts[0]; if(dataParts.length>1) account['Fwd']=dataParts[1];
              let deptOffset = 2; if(dataParts.length>2 && /^[A-Z]$/.test(dataParts[2])) { account['ID']=dataParts[2]; deptOffset=3; }
              if(dataParts.length>deptOffset) account['Dept']=dataParts[deptOffset];
              if(dataParts.length>deptOffset+1) account['Typ']=dataParts[deptOffset+1];
              if(dataParts.length>deptOffset+2) account['Sub Typ']=dataParts[deptOffset+2];
              if(dataParts.length>deptOffset+3) account['Chain']=dataParts[deptOffset+3];
              if(dataParts.length>deptOffset+4) account['Srt1']=dataParts[deptOffset+4];
              if(dataParts.length>deptOffset+5) account['Srt2']=dataParts[deptOffset+5];
          }
          if(nextLine){
              const countMatch = nextLine.match(/Count MTD\s+(\d+)\s+YTD\s+(\d+)/);
              if(countMatch){ account['Count MTD']=countMatch[1]; account['Count YTD']=countMatch[2]; }
              const balMatch = nextLine.match(/Beg Bal:\s*([\d.]+).*?MTD Bal:\s*([\d.]+).*?YTD Bal:\s*([\d.]+)/);
              if(balMatch){ account['Beg Bal']=balMatch[1]; account['MTD Bal']=balMatch[2]; account['YTD Bal']=balMatch[3]; }
          }
          return account;
      }
      isHeaderLine(line){
          const headers = ['Page','CHART OF ACCOUNTS','Reports/Acct','Financial Statements','Sorted by Department','Pritchard','SCHICK','Dtl a/c Sort Post'];
          return headers.some(h => line.includes(h));
      }
      createAndDownloadExcel(data, reportType){
          const wb = XLSX.utils.book_new();
          const ws = XLSX.utils.json_to_sheet(data);
          ws['!cols'] = [ {wch:15},{wch:40},{wch:6},{wch:6},{wch:8},{wch:8},{wch:8},{wch:10},{wch:12},{wch:8},{wch:8},{wch:10},{wch:8},{wch:10},{wch:10},{wch:12},{wch:12},{wch:12} ];
          XLSX.utils.book_append_sheet(wb, ws, 'Chart of Accounts');
          const summary = [['Summary Statistics',''],['Total Accounts', data.length],['Report Type', reportType.replace('_',' ').toUpperCase()],['Generated Date', new Date().toLocaleDateString()],['Generated Time', new Date().toLocaleTimeString()]];
          const ws2 = XLSX.utils.aoa_to_sheet(summary); ws2['!cols'] = [{wch:20},{wch:30}];
          XLSX.utils.book_append_sheet(wb, ws2, 'Summary');
          const timestamp = new Date().toISOString().slice(0,10);
          const filename = `${reportType}_${timestamp}.xlsx`;
          XLSX.writeFile(wb, filename);
      }
      updateProgress(message, percentage){
          const progressBar = document.querySelector('.progress-bar');
          if(progressBar){ progressBar.style.width = `${percentage}%`; progressBar.textContent = message; }
      }
  }
  const converter = new LightyearConverter();
  document.addEventListener('DOMContentLoaded', function(){
      const btn = document.getElementById('convertBtn');
      btn.addEventListener('click', async () => {
          const fileInput = document.getElementById('pdfFile');
          const reportType = document.getElementById('reportType').value;
          const file = fileInput.files[0];
          if(!file){ alert('Please select a PDF file'); return; }
          btn.disabled = true; const original = btn.textContent; btn.textContent = 'Converting...';
          try {
              await converter.convertToExcel(file, reportType);
          } catch(e) { /* error surfaced via alert */ }
          finally { btn.disabled = false; btn.textContent = original; }
      });
  });
  </script>
</body>
''')

@app.route('/', methods=['GET'])
def index():
    # version param to bust cache for static assets
    return render_template_string(PAGE, v=int(time.time()))


if __name__ == '__main__':
    print('Starting Lightyear PDF to Excel | Pritchard Companies on http://localhost:5003')
    app.run(host='0.0.0.0', port=5003, debug=True)


