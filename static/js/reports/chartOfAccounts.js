(function(){
  window.ReportParsers = window.ReportParsers || {};

  function isHeaderLine(line){
    const headers = ['Page','CHART OF ACCOUNTS','Reports/Acct','Financial Statements','Sorted by Department','Pritchard','SCHICK','Dtl a/c Sort Post'];
    return headers.some(h => line.includes(h));
  }

  function combineAccount(line, nextLine){
    const accountMatch = line.match(/^(\d{4,6})\s+(.+)/);
    if(!accountMatch) return null;
    const accountNumber = accountMatch[1];
    const restOfLine = accountMatch[2];
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

  async function parse(lines){
    const accounts = [];
    for(let i=0; i<lines.length; i++){
      const line = lines[i];
      if(!line || isHeaderLine(line)) continue;
      const accountMatch = line.match(/^(\d{4,6})\s+(.+)/);
      if(accountMatch){
        const nextLine = lines[i+1] || '';
        const account = combineAccount(line, nextLine);
        if(account){
          accounts.push(account);
          if(nextLine.includes('Count MTD') || nextLine.includes('Beg Bal:')) i++;
        }
      }
    }
    return accounts;
  }

  window.ReportParsers['chart_of_accounts'] = {
    label: 'Chart of Accounts',
    sheetName: 'Chart of Accounts',
    columns: ['Account Number','Description','Ctrl','Fwd','ID','Dept','Typ','Sub Typ','Chain Ref','Chain','Srt1','Srt2','Fin1','Count MTD','Count YTD','Beg Bal','MTD Bal','YTD Bal'],
    parse
  };
})();


