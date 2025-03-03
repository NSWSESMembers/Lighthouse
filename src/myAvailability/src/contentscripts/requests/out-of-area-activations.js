// eslint-disable-next-line @typescript-eslint/no-unused-vars
var $ = require('jquery');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
var DOM = require('jsx-dom-factory').default;

const ExcelJS = require('exceljs');

const urlParts = window.location.href.split('/');
const apiHost = urlParts[2] == 'app.ses-mams-uat.net' ? 'api.ses-mams-uat.net' : 'api.ses-mams.net';
const requestId = urlParts[urlParts.length - 1];


require('../../../../pages/lib/shared_chrome_code.js');

whenPageIsReady(function () {
  let downloadApproveddom = return_downloadApprovedbutton();

  $(downloadApproveddom).on('click', function () {
    $('#lighthousedownloadapproved').text('Downloading...');
    downloadApproved();
  });

  //run every 1sec until we have loaded the page (dont hate me Sam)
  $(downloadApproveddom).insertBefore($("button:contains('Download Activated Members CSV')"));
});

function return_downloadApprovedbutton() {
  return (
    <button
      class="MuiButtonBase-root MuiButton-root MuiButton-contained MuiButton-containedPrimary MuiButton-sizeMedium MuiButton-containedSizeMedium MuiButton-colorPrimary MuiButton-disableElevation MuiButton-root MuiButton-contained MuiButton-containedPrimary MuiButton-sizeMedium MuiButton-containedSizeMedium MuiButton-colorPrimary MuiButton-disableElevation css-p0b27t"
      tabindex="0"
      type="button"
      aria-busy="false"
    >
      <div class="MuiStack-root css-1g9xann">
        <img
          width="14px"
          style="width:14px;vertical-align:top;margin-right:0px"
          src={chrome.runtime.getURL('') + 'icons/lh-black.png'}
        ></img>
        <a id="lighthousedownloadapproved">Download Approved Members XLSX</a>
      </div>
    </button>
  );
}

function downloadApproved() {
  $.ajax({
    type: 'POST',
    url: `https://${apiHost}/out-of-area-activation-requests/${requestId}/downloadMembers`,
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + localStorage.getItem('accessToken'));
    },
    cache: false,
    data: { status: 'approved' },
    dataType: 'json',
    complete: function (response, textStatus) {
      if (textStatus == 'success') {
        downloadCSVFromAWS(response.responseJSON.downloadUrl);
      }
    },
  });
}

function downloadCSVFromAWS(url) {
    //ask background to get the file then work on the returned result
  chrome.runtime.sendMessage({ type: 'myAvailabilityOOAACSV', url: url }, function (response) {

    //   const description = {
    //     levelOfRequest: { type: 'string' },
    //     requestId: { type: 'string' },
    //     requestTitle: { type: 'string' },
    //     memberId: { type: 'string', group: 1 },
    //     memberName: { type: 'string'},
    //     phoneNumbers: { type: 'string' },
    //     approvedDates: { type: 'string' },
    //     approvedRoles: { type: 'string' },
    //     capabilities: { type: 'string' },
    //     units: { type: 'string' },
    //     clusters: { type: 'string' },
    //     zones: { type: 'string' },
    //   };

    let csvObj = parseCSV(response);

    const byZone = {};
    const byRole = {};
    const commonPeriods = [];

    // DIM by Zone
    csvObj.forEach(function (row) {
      delete row.levelOfRequest;
      delete row.requestId;
      if (row.zones == '') {
        //if theres no zone the unit is the zone (catch staff)
        row.zones = row.units;
      }
      let zones = row.zones.split(', ');
      if (zones.length == 0) {
        zones = [row.zones];
      }
      if (zones == '') {
        zones = ['No Zone'];
      }
      zones.forEach(function (z) {
        // eslint-disable-next-line no-prototype-builtins
        if (byZone.hasOwnProperty(z)) {
          byZone[z].push(row);
        } else {
          byZone[z] = [];
          byZone[z].push(row);
        }
      });

      //by role DIM

      let roles = row.approvedRoles.split(', ');
      if (roles.length == 0) {
        roles = [row.approvedRoles]; //if theres only one put it back
      }
      if (roles == '') {
        roles = ['Unspecified'];
      }
      roles.forEach(function (r) {
        // eslint-disable-next-line no-prototype-builtins
        if (byRole.hasOwnProperty(r)) {
          byRole[r].push(row);
        } else {
          byRole[r] = [];
          byRole[r].push(row);
        }
      });

      // work out which period was the default by counting them all
      commonPeriods.push(row.approvedDates);
    });

    const workbook = new ExcelJS.Workbook();

    let rowHeading = [
      { header: 'Request Title', key: 'requestTitle' },
      { header: 'Member ID', key: 'memberId' },
      { header: 'Member Name', key: 'memberName' },
      { header: 'Units', key: 'units' },
      { header: 'Clusters', key: 'clusters' },
      { header: 'Zones', key: 'zones' },
      { header: 'Phone Numbers', key: 'phoneNumbers' },
      { header: 'Approved Dates', key: 'approvedDates' },
      { header: 'Approved Roles', key: 'approvedRoles' },
      { header: 'Capabilities', key: 'capabilities' },
    ];

    let zoneSummary = [];
    let roleSummary = [];

    for (const [key] of Object.entries(byZone)) {
      zoneSummary.push({
        zone: key,
        responses: byZone[key].length,
      });
    }

    zoneSummary.sort((a, b) => b.responses - a.responses);

    for (const [key] of Object.entries(byRole)) {
      roleSummary.push({
        role: key,
        responses: byRole[key].length,
      });
    }

    roleSummary.sort((a, b) => b.responses - a.responses);

    const worksheet = workbook.addWorksheet('Summary', { properties: { tabColor: { argb: 'FF00FF00' } } });

    worksheet.addRow(['Responses By Zone']);
    worksheet.addRow(['Zone', 'Approved For Activation']);
    //add the role summary next to the other stats.
    let a = 3;
    zoneSummary.forEach(function (zone) {
      worksheet.getCell(`A${a}`).value = {
        text: zone.zone,
        hyperlink: `#'${zone.zone}'!A1`,
      };
      worksheet.getCell(`A${a}`).font = { underline: true, color: { theme: 10 } };
      worksheet.getCell(`B${a}`).value = zone.responses;
      a++;
    });

    worksheet.getCell(`A20`).value = 'Periods different from the normal in Red';
    worksheet.getCell(`A20`).fill = {
      // Set background color to light red
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFCCCC' }, // Light red (RGBA hex code)
    };
    worksheet.getCell(`A21`).value = 'Periods with conditions in Orange';
    worksheet.getCell(`A21`).fill = {
      // Set background color to light red
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD580' }, // Light red (RGBA hex code)
    };
    worksheet.mergeCells(20, 1, 20, 2);
    worksheet.mergeCells(21, 1, 21, 2);

    //sub heading zone
    worksheet.getCell('A1').font = { bold: true };
    worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.mergeCells(1, 1, 1, 2);

    worksheet.getCell('A2').font = { bold: true };
    worksheet.getCell('B2').font = { bold: true };

    //sub heading role
    worksheet.getCell('D1').value = 'Responses By Role';
    worksheet.getCell('D1').font = { bold: true };
    worksheet.getCell('D1').alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.mergeCells(1, 4, 1, 5);

    worksheet.getCell('D2').value = 'Role';
    worksheet.getCell('E2').value = 'Responses';

    worksheet.getCell('D2').font = { bold: true };
    worksheet.getCell('E2').font = { bold: true };

    //add the role summary next to the other stats.
    let i = 3;
    roleSummary.forEach(function (role) {
      worksheet.getCell(`D${i}`).value = {
        text: role.role,
        hyperlink: `#'${sanitizeString(role.role)}'!A1`,
      };
      worksheet.getCell(`D${i}`).font = { underline: true, color: { theme: 10 } };
      worksheet.getCell(`E${i}`).value = role.responses;
      i++;
    });

    setAutoWidth(worksheet);
    //By Zone Sheets
    for (const [key] of Object.entries(byZone)) {
      const worksheet = workbook.addWorksheet(key, { properties: { tabColor: { argb: '3361ff' } } });
      worksheet.columns = rowHeading;
      worksheet.addRows(byZone[key]);
      setHighlightImportantStuff(worksheet);
      setAutoWidth(worksheet);
    }

    //By Role Sheets
    for (const [key] of Object.entries(byRole)) {
      const worksheet = workbook.addWorksheet(sanitizeString(key), { properties: { tabColor: { argb: 'ffbb33' } } });
      worksheet.columns = rowHeading;
      worksheet.addRows(byRole[key]);
      setHighlightImportantStuff(worksheet);
      setAutoWidth(worksheet);
    }

    // Export the workbook as an Excel file
    // Download the file
    workbook.xlsx.writeBuffer().then(function (buffer) {
      const blob = new Blob([buffer], { type: 'application/vnd.ms-excel' });
      const blobURL = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobURL;
      link.download = `${sanitizeString(csvObj.length ? csvObj[0].requestTitle : 'OOAA')}-${Date.now().toString()}.xlsx`;
      link.click();
    });

    $('#lighthousedownloadapproved').text('Download Approved Members XLSX');

    function setHighlightImportantStuff(ws) {
      //heads in bold
      ws.getRow(1).eachCell((cell) => {
        cell.font = { bold: true }; // Set first row to bold
      });

      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip the first row
        const cell = row.getCell(8); // Column H (Excel columns are 1-based)
        if (cell.value !== mostCommonValue(commonPeriods)) {
          cell.fill = {
            // Set background color to light red
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFCCCC' }, // Light red (RGBA hex code)
          };
        }
        if (cell.value.includes('Conditional and reason')) {
          cell.fill = {
            // Set background color to light red
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD580' }, // Light red (RGBA hex code)
          };
        }
      });
    }
  });
}

function parseCSV(csvString) {
  const lines = [];
  let currentLine = '';
  let insideQuotes = false;

  // Manually process lines to handle newlines inside quoted fields
  for (let i = 0; i < csvString.length; i++) {
    const char = csvString[i];

    if (char === '"') {
      insideQuotes = !insideQuotes; // Toggle state
    }

    if (char === '\n' && !insideQuotes) {
      // If we encounter a newline and we're not inside quotes, finalize the line
      lines.push(currentLine);
      currentLine = '';
    } else {
      currentLine += char;
    }
  }

  if (currentLine) {
    lines.push(currentLine); // Push last line if any
  }

  const headers = parseCSVLine(lines[0]); // Extract headers

  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    return headers.reduce((obj, key, index) => {
      obj[key] = values[index] || ''; // Assign values to corresponding headers
      return obj;
    }, {});
  });
}

function parseCSVLine(line) {
  const values = [];
  let insideQuotes = false;
  let value = '';

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      // Handle escaped double quotes inside quoted fields
      value += '"';
      i++; // Skip the next quote
    } else if (char === '"') {
      // Toggle insideQuotes state
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      // If we reach a comma and we're not inside quotes, push the value
      values.push(value.trim());
      value = '';
    } else {
      value += char;
    }
  }
  values.push(value.trim()); // Push the last value
  return values;
}

function sanitizeString(str) {
  return str.replace(/[^a-zA-Z0-9]/g, ''); // Remove all non-alphanumeric characters
}

function setAutoWidth(ws) {
  ws.columns.forEach(function (column) {
    var dataMax = 0;
    column.eachCell({ includeEmpty: true }, function (cell) {
      var txt = cell.value;
      if (cell.value && typeof cell.value == 'object') {
        txt = cell.value.text;
      }
      var columnLength = txt ? txt.length : 0;
      if (columnLength > dataMax) {
        dataMax = columnLength;
      }
    });
    column.width = dataMax < 10 ? 10 : dataMax;
  });
}

function mostCommonValue(arr) {
  const frequency = {};
  let maxCount = 0;
  let mostCommon = null;

  for (let item of arr) {
    frequency[item] = (frequency[item] || 0) + 1;
    if (frequency[item] > maxCount) {
      maxCount = frequency[item];
      mostCommon = item;
    }
  }

  return mostCommon;
}


function whenPageIsReady(cb) {
  let startTime = Date.now();
  if ($("div.MuiStack-root:contains('Download Activated Members CSV')").length > 0) {
    cb(); // Call back immediately
  } else {
    let waiting = setInterval(function () {
      if ($("div.MuiStack-root:contains('Download Activated Members CSV')").length > 0) {
        clearInterval(waiting); // Stop timer
        cb(); // Call back
      } else if (Date.now() - startTime >= 5000) {
        clearInterval(waiting); // Stop after 5 seconds
        console.log("Timeout: Stopping waiting whenPageIsReady after 5 seconds.");
      }
    }, 500);
  }
}
