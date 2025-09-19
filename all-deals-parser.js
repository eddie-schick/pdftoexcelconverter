/*
 All Deals Report Parser
 - Supports browser and Node.js (UMD-style export)
 - Implements parseAllDealsReportEnhanced, parseAllDealsReport, extractGlobalInfo,
   createDealObject, parseLine2..5, validateAndFixCounts, convertToCSV
*/

(function(root, factory){
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AllDealsParser = factory();
  }
})(typeof self !== 'undefined' ? self : this, function(){
  'use strict';

  const HEADERS = [
    'Deal Status','Location','Count','Deal #','Customer Name','Stock','Veh. Gross','Fin. Reserve',
    'Accounting Date','Salesperson 1','Salesperson 2','N/U','Type','Days','Rebates to Dlr','Svc Conts',
    'Sale Date','Year','Make','Incentives','Credit Ins','Deal Type','Sales Manager','Model','Holdback','ProPack+GAP+LSI',
    'Accounting Keyed','Finance Manager','Sale Price','Sales Dept Grs','Finance Dept Grs','Grand Total',
    'Sales Dept Running','Finance Dept Running','Trade Info','Duebill'
  ];

  const AMOUNT_RE = /^-?[\d,]+\.\d{2}$/;
  const DATE_RE = /^\d{2}\/\d{2}\/\d{2}$/;
  const YEAR_RE = /^\d{4}$/;
  const DEALTYPE_RE = /^(Finance|Cash|Lease)$/i;
  const HEADER_RE = /^(\d+)\s*-\s*(\d{7})\s+(.+?)\s+([A-Z0-9]+)\s+([-\d,]+\.\d{2})\s+([-\d,]+\.\d{2})(.*)$/;

  function formatAmount(value){
    if (value == null) return '0.00';
    const s = String(value).replace(/[^0-9.-]/g,'');
    if (s === '' || s === '-' || isNaN(Number(s))) return '0.00';
    const num = Number(s);
    const sign = num < 0 ? '-' : '';
    const abs = Math.abs(num);
    const fixed = abs.toFixed(2);
    const parts = fixed.split('.');
    const intWithCommas = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return sign + intWithCommas + '.' + parts[1];
  }

  function firstMatch(lines, re, start=0, end=Math.min(lines.length, 20)){
    for (let i=start; i<end; i++){
      if (re.test(lines[i])) return i;
    }
    return -1;
  }

  function extractGlobalInfo(lines){
    const headerSlice = lines.slice(0, Math.min(20, lines.length)).join(' ');
    let dealStatus = '';
    const statusMatch = headerSlice.match(/\b(Processed|Pending|Completed)\b/i);
    if (statusMatch) dealStatus = capitalize(statusMatch[1]);

    let location = '';
    let totalsIdx = lines.findIndex(l => /Totals\s+and\s+Averages/i.test(l));
    if (totalsIdx !== -1){
      for (let i=totalsIdx+1; i<Math.min(lines.length, totalsIdx+8); i++){
        const line = (lines[i]||'').trim();
        if (!line) continue;
        if (/Totals|Averages|Count|Total|Average|Grand|\d/.test(line)) continue;
        // pick the first meaningful, mostly alpha line
        if (/[A-Za-z]{3,}/.test(line)) { location = line; break; }
      }
    }
    return { dealStatus, location };
  }

  function createDealObject(headerMatch, fullLine, globalInfo){
    const deal = {};
    // Initialize
    HEADERS.forEach(h => { deal[h] = ''; });
    deal['Veh. Gross'] = '0.00';
    deal['Fin. Reserve'] = '0.00';
    deal['Rebates to Dlr'] = '0.00';
    deal['Svc Conts'] = '0.00';
    deal['Incentives'] = '0.00';
    deal['Credit Ins'] = '0.00';
    deal['Holdback'] = '0.00';
    deal['ProPack+GAP+LSI'] = '0.00';
    deal['Sale Price'] = '0.00';
    deal['Sales Dept Grs'] = '0.00';
    deal['Finance Dept Grs'] = '0.00';
    deal['Grand Total'] = '0.00';
    deal['Sales Dept Running'] = '0.00';
    deal['Finance Dept Running'] = '0.00';

    deal['Deal Status'] = globalInfo.dealStatus || '';
    deal['Location'] = globalInfo.location || '';

    deal['Count'] = headerMatch[1] || '';
    deal['Deal #'] = headerMatch[2] || '';
    deal['Customer Name'] = headerMatch[3] ? headerMatch[3].trim() : '';
    deal['Stock'] = headerMatch[4] || '';
    deal['Veh. Gross'] = formatAmount(headerMatch[5] || '0.00');
    deal['Fin. Reserve'] = formatAmount(headerMatch[6] || '0.00');

    // Extract running totals from the tail of the header line (last two amounts)
    const tail = (headerMatch[7] || '').trim();
    const amounts = (fullLine.match(/-?[\d,]+\.\d{2}/g) || []);
    if (amounts.length >= 4){
      // Assume last two are running totals
      deal['Sales Dept Running'] = formatAmount(amounts[amounts.length-2]);
      deal['Finance Dept Running'] = formatAmount(amounts[amounts.length-1]);
    }
    return deal;
  }

  function parseLine2(line, deal){
    if (!line) return;
    const tokens = line.trim().split(/\s+/);
    // Accounting Date
    if (tokens.length && DATE_RE.test(tokens[0])){
      deal['Accounting Date'] = tokens[0];
      tokens.shift();
    }
    // Salespersons until New/Used
    const sales = [];
    while (tokens.length && !/^(New|Used)$/i.test(tokens[0])){
      const t = tokens.shift();
      if (t.includes(',')) sales.push(t);
    }
    deal['Salesperson 1'] = sales[0] || '';
    deal['Salesperson 2'] = sales[1] || '';
    // N/U, Type, Days
    if (tokens.length) deal['N/U'] = capitalize(tokens.shift() || '');
    if (tokens.length) deal['Type'] = capitalize(tokens.shift() || '');
    if (tokens.length && /^\d+$/.test(tokens[0])) deal['Days'] = tokens.shift();
    // Amounts
    if (tokens.length) deal['Rebates to Dlr'] = formatAmount(tokens.shift());
    if (tokens.length) deal['Svc Conts'] = formatAmount(tokens.shift());
  }

  function parseLine3(line, deal){
    if (!line) return;
    const tokens = line.trim().split(/\s+/);
    if (tokens.length && DATE_RE.test(tokens[0])){
      deal['Sale Date'] = tokens.shift();
    }
    if (tokens.length && YEAR_RE.test(tokens[0])){
      deal['Year'] = tokens.shift();
    }
    // Remainder until first amount are Make (manufacturer) tokens
    const makeTokens = [];
    while (tokens.length && !AMOUNT_RE.test(tokens[0])){
      makeTokens.push(tokens.shift());
    }
    deal['Make'] = makeTokens.join(' ').trim();
    if (tokens.length) deal['Incentives'] = formatAmount(tokens.shift());
    if (tokens.length) deal['Credit Ins'] = formatAmount(tokens.shift());
  }

  function parseLine4(line, deal){
    if (!line) return;
    const tokens = line.trim().split(/\s+/);
    if (tokens.length && DEALTYPE_RE.test(tokens[0])){
      deal['Deal Type'] = capitalize(tokens.shift());
    }
    // Sales Manager (token containing comma)
    if (tokens.length && tokens[0].includes(',')){
      deal['Sales Manager'] = tokens.shift();
    }
    // Model until first amount
    const modelTokens = [];
    while (tokens.length && !AMOUNT_RE.test(tokens[0])){
      modelTokens.push(tokens.shift());
    }
    deal['Model'] = modelTokens.join(' ').trim();
    if (tokens.length) deal['Holdback'] = formatAmount(tokens.shift());
    if (tokens.length) deal['ProPack+GAP+LSI'] = formatAmount(tokens.shift());
  }

  function parseLine5(line, deal){
    if (!line) return;
    const tokens = line.trim().split(/\s+/);
    if (tokens.length){
      const t = tokens.shift();
      if (/^[YyNn]$/.test(t)) deal['Accounting Keyed'] = t.toUpperCase();
      else tokens.unshift(t);
    }
    if (tokens.length && tokens[0].includes(',')){
      deal['Finance Manager'] = tokens.shift();
    }
    if (tokens.length) deal['Sale Price'] = formatAmount(tokens.shift());
    if (tokens.length) deal['Sales Dept Grs'] = formatAmount(tokens.shift());
    if (tokens.length) deal['Finance Dept Grs'] = formatAmount(tokens.shift());
    if (tokens.length) deal['Grand Total'] = formatAmount(tokens.shift());
  }

  function parseAllDealsReport(pdfText){
    const text = Array.isArray(pdfText) ? pdfText.join('\n') : String(pdfText||'');
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const globalInfo = extractGlobalInfo(lines);
    const deals = [];

    for (let i=0; i<lines.length; i++){
      const line = lines[i];
      if (/Totals\s+and\s+Averages/i.test(line)) break;
      const m = line.match(HEADER_RE);
      if (!m) continue;
      const deal = createDealObject(m, line, globalInfo);
      // Expect next 4 lines as structured content; also capture optional Trade / Duebill
      const l2 = lines[i+1] || '';
      const l3 = lines[i+2] || '';
      const l4 = lines[i+3] || '';
      const l5 = lines[i+4] || '';
      parseLine2(l2, deal);
      parseLine3(l3, deal);
      parseLine4(l4, deal);
      parseLine5(l5, deal);

      // Optional: Trade and Duebill on subsequent lines
      let cursor = i + 5;
      while (cursor < lines.length){
        const opt = lines[cursor];
        if (/Totals\s+and\s+Averages/i.test(opt)) break;
        if (/^\d+\s*-\s*\d{7}\b/.test(opt)) break; // next deal header
        if (/^Trade:/i.test(opt)) deal['Trade Info'] = opt;
        else if (/^Duebill/i.test(opt)) deal['Duebill'] = opt;
        else break; // stop if an unrelated line appears
        cursor++;
      }
      deals.push(deal);
      // Jump i to before cursor
      i = cursor - 1;
    }
    return deals;
  }

  function validateAndFixCounts(deals){
    let seq = 1;
    for (const d of deals){
      const count = String(d['Count']||'');
      if (!/^\d+$/.test(count)) d['Count'] = String(seq);
      seq++;
    }
    return deals;
  }

  function parseAllDealsReportEnhanced(pdfText){
    const deals = parseAllDealsReport(pdfText);
    return validateAndFixCounts(deals);
  }

  function convertToCSV(deals){
    const escape = (v) => {
      if (v == null) return '';
      const s = String(v);
      if (s.includes('"') || s.includes(',') || /\s/.test(s)){
        return '"' + s.replace(/"/g,'""') + '"';
      }
      return s;
    };
    const rows = [];
    rows.push(HEADERS.join(','));
    for (const d of deals){
      rows.push(HEADERS.map(h => escape(d[h] != null ? d[h] : '')).join(','));
    }
    return rows.join('\n');
  }

  function capitalize(s){
    if (!s) return '';
    const lower = String(s).toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }

  return {
    parseAllDealsReportEnhanced,
    parseAllDealsReport,
    extractGlobalInfo,
    createDealObject,
    parseLine2,
    parseLine3,
    parseLine4,
    parseLine5,
    validateAndFixCounts,
    convertToCSV,
    HEADERS
  };
});


