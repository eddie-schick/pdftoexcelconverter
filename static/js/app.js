(function(){
  window.ReportParsers = window.ReportParsers || {};

  class Converter {
    constructor() {
      if (window.pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
    }

    async convert(file, reportType) {
      this.updateProgress('Reading PDF...', 10);
      const arrayBuffer = await this.fileToArrayBuffer(file);
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      const lines = await this.extractTextFromPDF(pdf);
      const pdfText = (lines || []).join('\n');

      this.updateProgress('Parsing data...', 50);
      const cfg = window.ReportParsers[reportType];
      if (!cfg || typeof cfg.parse !== 'function') {
        throw new Error('Unsupported report type');
      }
      const data = await cfg.parse(lines, { pdfText });

      this.updateProgress('Creating Excel file...', 80);
      this.createAndDownloadExcel(data, reportType, cfg, file && file.name);
      this.updateProgress('Complete!', 100);
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

    createAndDownloadExcel(data, reportType, cfg, originalFileName){
      const wb = XLSX.utils.book_new();
      const headers = (cfg && cfg.columns && cfg.columns.length) ? cfg.columns : (data && data.length ? Object.keys(data[0]) : []);
      const ws = headers.length ? XLSX.utils.json_to_sheet(data, { header: headers }) : XLSX.utils.json_to_sheet(data);
      if (headers.length) {
        ws['!cols'] = headers.map(h => ({ wch: Math.max(12, String(h).length + 2) }));
      }
      const sheetName = (cfg && cfg.sheetName) ? cfg.sheetName : (reportType || 'Report');
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      const summary = [
        ['Summary Statistics',''],
        ['Total Rows', data.length],
        ['Report Type', sheetName.toUpperCase()],
        ['Generated Date', new Date().toLocaleDateString()],
        ['Generated Time', new Date().toLocaleTimeString()]
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(summary); ws2['!cols'] = [{wch:20},{wch:30}];
      XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

      const baseName = (originalFileName || '').replace(/\.[^/.]+$/, '');
      const safeBase = baseName && baseName.trim().length ? baseName.trim() : (reportType || 'Report');
      XLSX.writeFile(wb, `${safeBase}.xlsx`);
    }

    updateProgress(message, percentage){
      const progressBar = document.querySelector('.progress-bar');
      if(progressBar){
        progressBar.style.width = `${percentage}%`;
      }
      const progressContainer = document.querySelector('.progress-container');
      if(progressContainer){
        progressContainer.setAttribute('aria-valuenow', String(Math.round(percentage)));
      }
      const progressText = document.querySelector('.progress-text');
      if(progressText){
        progressText.textContent = `${message} (${Math.round(percentage)}%)`;
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    // Ensure the Report type dropdown contains all available parsers
    const reportSelect = document.getElementById('reportType');
    if (reportSelect && window.ReportParsers) {
      const existingValues = new Set(Array.from(reportSelect.options).map(o => o.value));
      Object.keys(window.ReportParsers).forEach(key => {
        if (!existingValues.has(key)) {
          const opt = document.createElement('option');
          opt.value = key;
          const meta = window.ReportParsers[key];
          opt.text = (meta && meta.label) ? meta.label : key.replace(/_/g, ' ');
          reportSelect.appendChild(opt);
        }
      });
    }

    const btn = document.getElementById('convertBtn');
    if (!btn) return;
    const converter = new Converter();
    btn.addEventListener('click', async () => {
      const fileInput = document.getElementById('pdfFile');
      const reportType = document.getElementById('reportType').value;
      const file = fileInput && fileInput.files ? fileInput.files[0] : null;
      if(!file){ alert('Please select a PDF file'); return; }
      btn.disabled = true; const original = btn.textContent; btn.textContent = 'Converting...';
      try {
        await converter.convert(file, reportType);
      } catch(e) { console.error(e); }
      finally { btn.disabled = false; btn.textContent = original; }
    });
  });
})();


