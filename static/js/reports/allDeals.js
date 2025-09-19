(function(){
    window.ReportParsers = window.ReportParsers || {};
  
    function extractGlobalInfo(textContent) {
      const globalInfo = { 
        dealStatus: 'Processed',
        location: 'Unknown'
      };
      
      // Look for PROCESSED
      if (textContent.toUpperCase().includes('PROCESSED')) {
        globalInfo.dealStatus = 'Processed';
      }
      
      // Look for location pattern
      const locMatch = textContent.match(/LOCATION\s*#?\s*:?\s*(\d+)/i);
      if (locMatch) {
        globalInfo.location = `Location ${locMatch[1]}`;
      }
      
      return globalInfo;
    }
  
    async function parse(lines, ctx) {
      console.log('=== All Deals Parser (Emergency Mode) ===');
      
      try {
        // Get text from any possible source
        let textContent = '';
        
        if (ctx && ctx.pdfText) {
          textContent = ctx.pdfText;
        } else if (ctx && ctx.text) {
          textContent = ctx.text;
        } else if (lines) {
          if (Array.isArray(lines)) {
            textContent = lines.join(' ');
          } else {
            textContent = String(lines);
          }
        }
        
        console.log('Text length:', textContent.length);
        console.log('First 500 chars:', textContent.substring(0, 500));
        
        if (!textContent || textContent.length < 100) {
          console.error('No valid text content received!');
          console.log('Full content:', textContent);
          return [];
        }
        
        const globalInfo = extractGlobalInfo(textContent);
        const deals = [];
        
        // Method 1: Try to find deals with very flexible regex
        // Look for pattern: number - 7digits anything
        const veryLoosePattern = /(\d+)\s*[-–]\s*(\d{7})[^\n]*/g;
        let matches = textContent.matchAll(veryLoosePattern);
        
        for (let match of matches) {
          console.log('Found potential deal:', match[0].substring(0, 100));
          
          // Extract what we can from the match
          const fullMatch = match[0];
          const count = match[1];
          const dealNum = match[2];
          
          // Try to extract customer name - it's usually after the deal number
          let customerName = 'Unknown';
          const afterDealNum = fullMatch.substring(match.index + match[1].length + match[2].length + 3);
          const customerMatch = afterDealNum.match(/([A-Z][A-Z,.\s]+)/);
          if (customerMatch) {
            customerName = customerMatch[1].trim();
          }
          
          // Try to extract stock number - usually 4-6 alphanumeric after customer
          let stock = '';
          const stockMatch = afterDealNum.match(/\s([A-Z0-9]{4,10})\s/);
          if (stockMatch) {
            stock = stockMatch[1];
          }
          
          // Try to extract amounts - look for patterns like 1,234.56
          let amounts = [];
          const amountMatches = fullMatch.matchAll(/([-\d,]+\.\d{2})/g);
          for (let am of amountMatches) {
            amounts.push(am[1]);
          }
          
          const deal = {
            'Deal Status': globalInfo.dealStatus,
            'Location': globalInfo.location,
            'Count': count,
            'Deal #': dealNum,
            'Customer Name': customerName,
            'Stock': stock,
            'Veh. Gross': amounts[0] || '0.00',
            'Fin. Reserve': amounts[1] || '0.00',
            'Accounting Date': '',
            'Salesperson 1': '',
            'Salesperson 2': '',
            'N/U': '',
            'Type': '',
            'Days': '0',
            'Rebates to Dlr': '0.00',
            'Svc Conts': '0.00',
            'Sale Date': '',
            'Year': '',
            'Make': '',
            'Incentives': '0.00',
            'Credit Ins': '0.00',
            'Deal Type': '',
            'Sales Manager': '',
            'Model': '',
            'Holdback': '0.00',
            'ProPack+GAP+LSI': '0.00',
            'Accounting Keyed': '',
            'Finance Manager': '',
            'Sale Price': '0.00',
            'Sales Dept Grs': '0.00',
            'Finance Dept Grs': '0.00',
            'Grand Total': '0.00',
            'Sales Dept Running': '0.00',
            'Finance Dept Running': '0.00',
            'Trade Info': '',
            'Duebill': ''
          };
          
          // Try to find dates near this deal
          const searchArea = textContent.substring(match.index, Math.min(match.index + 500, textContent.length));
          const dateMatches = searchArea.matchAll(/(\d{2}\/\d{2}\/\d{2,4})/g);
          let dateCount = 0;
          for (let dm of dateMatches) {
            if (dateCount === 0) deal['Accounting Date'] = dm[1];
            if (dateCount === 1) deal['Sale Date'] = dm[1];
            dateCount++;
            if (dateCount >= 2) break;
          }
          
          // Try to find salesperson (name with comma)
          const salesMatch = searchArea.match(/([A-Z][a-z]+,[A-Z][a-z]+)/);
          if (salesMatch) {
            deal['Salesperson 1'] = salesMatch[1];
          }
          
          // Try to find New/Used
          if (searchArea.includes('New ')) deal['N/U'] = 'New';
          else if (searchArea.includes('Used ')) deal['N/U'] = 'Used';
          
          // Try to find deal type
          if (searchArea.includes('Finance')) deal['Deal Type'] = 'Finance';
          else if (searchArea.includes('Cash')) deal['Deal Type'] = 'Cash';
          else if (searchArea.includes('Lease')) deal['Deal Type'] = 'Lease';
          
          // Try to find year and make
          const yearMatch = searchArea.match(/\s(20\d{2})\s/);
          if (yearMatch) deal['Year'] = yearMatch[1];
          
          const makeMatch = searchArea.match(/\s(Ford|Chevrolet|Chevy|Toyota|Honda|Nissan|Dodge|Ram|Jeep|Chrysler|ISUZU|Peterbilt)/i);
          if (makeMatch) deal['Make'] = makeMatch[1];
          
          // Try to find Y/N for accounting keyed
          const ynMatch = searchArea.match(/\s([YN])\s/);
          if (ynMatch) deal['Accounting Keyed'] = ynMatch[1];
          
          deals.push(deal);
          console.log(`Added deal: ${count} - ${dealNum} - ${customerName}`);
        }
        
        // Method 2: If no deals found with loose pattern, try space-separated approach
        if (deals.length === 0) {
          console.log('Trying space-separated approach...');
          
          // Split by spaces and look for 7-digit numbers
          const tokens = textContent.split(/\s+/);
          for (let i = 0; i < tokens.length; i++) {
            if (tokens[i].match(/^\d{7}$/)) {
              // Found a 7-digit number, check if there's a count before it
              let count = '';
              if (i > 0 && tokens[i-1].match(/^\d+$/)) {
                count = tokens[i-1];
              } else if (i > 1 && tokens[i-2].match(/^\d+$/)) {
                count = tokens[i-2];
              }
              
              if (count) {
                const deal = {
                  'Deal Status': globalInfo.dealStatus,
                  'Location': globalInfo.location,
                  'Count': count,
                  'Deal #': tokens[i],
                  'Customer Name': tokens[i+1] || 'Unknown',
                  'Stock': tokens[i+2] || '',
                  'Veh. Gross': '0.00',
                  'Fin. Reserve': '0.00',
                  'Accounting Date': '',
                  'Salesperson 1': '',
                  'Salesperson 2': '',
                  'N/U': '',
                  'Type': '',
                  'Days': '0',
                  'Rebates to Dlr': '0.00',
                  'Svc Conts': '0.00',
                  'Sale Date': '',
                  'Year': '',
                  'Make': '',
                  'Incentives': '0.00',
                  'Credit Ins': '0.00',
                  'Deal Type': '',
                  'Sales Manager': '',
                  'Model': '',
                  'Holdback': '0.00',
                  'ProPack+GAP+LSI': '0.00',
                  'Accounting Keyed': '',
                  'Finance Manager': '',
                  'Sale Price': '0.00',
                  'Sales Dept Grs': '0.00',
                  'Finance Dept Grs': '0.00',
                  'Grand Total': '0.00',
                  'Sales Dept Running': '0.00',
                  'Finance Dept Running': '0.00',
                  'Trade Info': '',
                  'Duebill': ''
                };
                
                deals.push(deal);
                console.log(`Added basic deal: ${count} - ${tokens[i]}`);
              }
            }
          }
        }
        
        console.log(`=== Parse Complete: Found ${deals.length} deals ===`);
        
        if (deals.length === 0) {
          console.error('Could not extract any deals from the PDF.');
          console.log('The PDF text may be in an incompatible format.');
          console.log('Try saving the PDF as text first, or use a different PDF.');
          return [];
        }
        
        return deals;
        
      } catch (error) {
        console.error('Fatal error:', error);
        return [];
      }
    }
  
    const columns = [
      'Deal Status',
      'Location', 
      'Count',
      'Deal #',
      'Customer Name',
      'Stock',
      'Veh. Gross',
      'Fin. Reserve',
      'Accounting Date',
      'Salesperson 1',
      'Salesperson 2',
      'N/U',
      'Type',
      'Days',
      'Rebates to Dlr',
      'Svc Conts',
      'Sale Date',
      'Year',
      'Make',
      'Incentives',
      'Credit Ins',
      'Deal Type',
      'Sales Manager',
      'Model',
      'Holdback',
      'ProPack+GAP+LSI',
      'Accounting Keyed',
      'Finance Manager',
      'Sale Price',
      'Sales Dept Grs',
      'Finance Dept Grs',
      'Grand Total',
      'Sales Dept Running',
      'Finance Dept Running',
      'Trade Info',
      'Duebill'
    ];
  
    window.ReportParsers['all_deals'] = {
      label: 'All Deals',
      sheetName: 'All Deals',
      columns: columns,
      parse: parse
    };
    
    console.log('All Deals parser loaded (Emergency extraction mode)');
  })();