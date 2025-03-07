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
  let downloadAlldom = return_downloadFullbutton();

  $(downloadApproveddom).on('click', function () {
    $('#lighthousedownloadapproved').text('Downloading...');
    downloadApproved();
  });

  $(downloadAlldom).on('click', function () {
    $('#lighthousedownloadall').text('Downloading...');
    exportLongList();
  });

  //run every 1sec until we have loaded the page (dont hate me Sam)
  $(downloadApproveddom).insertBefore($("button:contains('Download Activated Members CSV')"));
  $(downloadAlldom).insertBefore($("button:contains('Download Activated Members CSV')"));
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

function return_downloadFullbutton() {
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
        <a id="lighthousedownloadall">Download All Responses XLSX</a>
      </div>
    </button>
  );
}

function exportLongList() {
  function fetchAllPages(callback) {
    const baseUrl = `https://${apiHost}/out-of-area-activations/${requestId}/members`;

    const params = {
      activatedStatus: true,
      approvedStatus: true,
      rejectedStatus: false,
      zonePendingStatus: true,
      clusterPendingStatus: true,
      unitPendingStatus: true,
      awaitingStatus: false,
      skip: 0,
      take: 100,
    };

    let allResults = [];
    let totalCount = 0;
    let skip = 0;
    const take = 100;

    function fetchPage(skip) {
      $.ajax({
        url: `${baseUrl}?${$.param({ ...params, skip, take })}`,
        method: 'GET',
        dataType: 'json',
        beforeSend: function (n) {
          n.setRequestHeader('Authorization', 'Bearer ' + localStorage.getItem('accessToken'));
        },
        success: function (response) {
          if (response && response.items) {
            allResults.push(...response.items);
          }
          if (response && response.totalCount && totalCount === 0) {
            totalCount = response.totalCount;
          }
          if (allResults.length < totalCount) {
            fetchPage(skip + take);
          } else {
            console.log(`Fetched ${allResults.length} records.`);
            callback(null, allResults);
          }
        },
        error: function (xhr, status, error) {
          console.error('Error fetching data:', error);
          callback(error, null);
        },
      });
    }

    // Start fetching pages
    fetchPage(skip);
  }

  // Call for everything
  var finalList = [];
  fetchAllPages(function (error, results) {
    if (error) {
      console.error('Failed to fetch data:', error);
    } else {
      //console.log("Final Results:", results);
      results.forEach(function (resp) {
        const thisRow = {};
        thisRow.respondedAt = resp.request.createdAt;
        thisRow.memberName = resp.request.memberName;
        thisRow.memberId = resp.request.memberId;
        thisRow.units = resp.request.member.units
          .map(function (v, _i) {
            return `${v.name} (${v.code})`;
          })
          .join(', ');
        thisRow.clusters = ''; //TODO
        thisRow.zones = ''; //TODO
        thisRow.phoneNumbers = ''; //TODO
        thisRow.approvalStatus = resp.request.status;
        thisRow.approvedDates = resp.request.availabilityBlocks
          .map(function (v, _i) {
            if (v.availabilityStatus != 'Conditional') {
              return `${v.start} to ${v.end} with status: ${v.availabilityStatus}`;
            } else {
              return `${v.start} to ${v.end} with status: ${v.availabilityStatus} and reason: ${v.conditionalReason}`;
            }
          })
          .join(', ');
        thisRow.approvedRoles = resp.request.roles
          .map(function (v, _i) {
            return `${v.category}: ${v.name}`;
          })
          .join(', ');
        thisRow.capabilities = ''; //TODO

        finalList.push(thisRow);
      });

      const requests = finalList.map((line, index) => {
        return new Promise((resolve, reject) => {
          $.ajax({
            type: 'GET',
            url: `https://${apiHost}/members/${line.memberId}`,
            beforeSend: function (n) {
              n.setRequestHeader('Authorization', 'Bearer ' + localStorage.getItem('accessToken'));
            },
            cache: false,
            dataType: 'json',
            complete: function (response, textStatus) {
              if (textStatus === 'success') {
                finalList[index].phoneNumbers = response.responseJSON.phoneNumbers
                  .map((v) => {
                    return `${v.number}`;
                  })
                  .join(', ');
                finalList[index].capabilities = response.responseJSON.capabilities
                  .map((v) => {
                    return `${v.label}: ${v.name}`;
                  })
                  .join(', ');
                // Second AJAX call for org
                $.ajax({
                  type: 'GET',
                  url: `https://${apiHost}/members/${line.memberId}/orgHierarchy`,
                  beforeSend: function (n) {
                    n.setRequestHeader('Authorization', 'Bearer ' + localStorage.getItem('accessToken'));
                  },
                  cache: false,
                  dataType: 'json',
                  complete: function (orgResponse, orgTextStatus) {
                    if (orgTextStatus === 'success') {
                      finalList[index].zones = orgResponse.responseJSON.zones
                        .map((v) => {
                          finalList[index].clusters = v.clusters
                            .map((v) => {
                              return `${v.name}`;
                            })
                            .join(', ');
                          return `${v.name}`;
                        })
                        .join(', ');
                      resolve();
                    } else {
                      reject(`OrgHierarchy request failed for memberId: ${line.memberId}`);
                    }
                  },
                });
              } else {
                reject(`Request failed for memberId: ${line.memberId}`);
              }
            },
          });
        });
      });

      Promise.all(requests)
        .then(() => {
          console.log('All member data requests completed successfully');
          processAndSaveAll(finalList);
        })
        .catch((error) => {
          console.error('One or more member data requests failed:', error);
        });
    }
  });

  function processAndSaveAll(data) {
    const workbook = new ExcelJS.Workbook();

    const byZone = {};
    const byRole = {};
    const byApproval = {};
    const commonPeriods = [];
    let AllDateRangeBlocks = new Set();

    //find out out all the date ranges first before we split data up

    data.forEach(function (row) {
      let dateRanges = row.approvedDates.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/g);
      if (dateRanges) {
        for (let i = 0; i < dateRanges.length; i += 2) {
          let rangeDates = getDateRange(dateRanges[i] + ':00.000Z', dateRanges[i + 1] + ':00.000Z'); //timezones suck and we dont care
          rangeDates.forEach((date) => AllDateRangeBlocks.add(date));
        }
      }
    });

    AllDateRangeBlocks = Array.from(AllDateRangeBlocks).sort(); // Sort all unique dates

    data.forEach(function (row) {
      delete row.levelOfRequest;
      delete row.requestId;

      //date range stuff
      const regex = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}) to (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}) with status: (\w+)/g;

      let matches;
      while ((matches = regex.exec(row.approvedDates)) !== null) {
        let startDate = matches[1];
        let endDate = matches[2];
        let status = matches[3];

          //for every date column check if its in this range and use that status to fill out
        AllDateRangeBlocks.forEach(function (d) {
          if (isDateBetween(d, startDate, endDate)) {
            row[d] = status;
          }
        });
      }

      //catch any missing time blocks
      AllDateRangeBlocks.forEach(function (d) {
        if (typeof row[d] == 'undefined') {
           row[d] = '-'; //default value
        }
      })

      // eslint-disable-next-line no-prototype-builtins
      if (byApproval.hasOwnProperty(row.approvalStatus)) {
        byApproval[row.approvalStatus].push(row);
      } else {
        byApproval[row.approvalStatus] = [];
        byApproval[row.approvalStatus].push(row);
      }

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

      // DIM by Zone
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

    let dateHeaders = AllDateRangeBlocks.map(function (d) {
      return { header: d, key: d };
    });


    let rowHeading = [
      //{ header: 'Request Title', key: 'requestTitle' },
      { header: 'Member ID', key: 'memberId' },
      { header: 'Member Name', key: 'memberName' },
      { header: 'Units', key: 'units' },
      { header: 'Clusters', key: 'clusters' },
      { header: 'Zones', key: 'zones' },
      { header: 'Phone Numbers', key: 'phoneNumbers' },
      { header: 'Approved Dates', key: 'approvedDates' },
      { header: 'Approved Roles', key: 'approvedRoles' },
      { header: 'Approval Status', key: 'approvalStatus' },
      { header: 'Capabilities', key: 'capabilities' },
    ];

    rowHeading.splice(7, 0, ...dateHeaders);


    let zoneSummary = [];
    let roleSummary = [];
    let approvalSummary = [];

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

    for (const [key] of Object.entries(byApproval)) {
      approvalSummary.push({
        status: key,
        responses: byApproval[key].length,
      });
    }

    const worksheet = workbook.addWorksheet('Summary', { properties: { tabColor: { argb: 'FF00FF00' } } });

    worksheet.addRow(['Responses By Zone']);
    worksheet.addRow(['Zone', 'Responses']);
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

    //sub heading role
    worksheet.getCell('G1').value = 'Responses By Approval Status';
    worksheet.getCell('G1').font = { bold: true };
    worksheet.getCell('G1').alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.mergeCells(1, 7, 1, 8);

    worksheet.getCell('G2').value = 'Approval Status';
    worksheet.getCell('H2').value = 'Responses';

    worksheet.getCell('G2').font = { bold: true };
    worksheet.getCell('H2').font = { bold: true };

    //add the role summary next to the other stats.
    i = 3;
    approvalSummary.forEach(function (appr) {
      worksheet.getCell(`G${i}`).value = {
        text: appr.status,
        hyperlink: `#'${sanitizeString(appr.status)}'!A1`,
      };
      worksheet.getCell(`G${i}`).font = { underline: true, color: { theme: 10 } };
      worksheet.getCell(`H${i}`).value = appr.responses;
      i++;
    });

    worksheet.getCell(`G${i}`).value = 'Total Responses'
    worksheet.getCell(`G${i}`).font = { bold: true, italic: true };
    worksheet.getCell(`H${i}`).value = approvalSummary.reduce((sum, item) => sum + item.responses, 0)
    worksheet.getCell(`H${i}`).font = { bold: true, italic: true };



    setAutoWidth(worksheet);

    //By Zone Sheets
    for (const [key] of Object.entries(byZone)) {
      const worksheet = workbook.addWorksheet(key, { properties: { tabColor: { argb: '3361ff' } } });
      worksheet.columns = rowHeading;
      worksheet.addRows(byZone[key]);
      setHighlightImportantStuff(worksheet);
      setAutoWidth(worksheet);
      worksheet.autoFilter = `A1:${String.fromCharCode(64 + rowHeading.length)}1`;
    }

    //By Role Sheets
    for (const [key] of Object.entries(byRole)) {
      const worksheet = workbook.addWorksheet(sanitizeString(key), { properties: { tabColor: { argb: 'ffbb33' } } });
      worksheet.columns = rowHeading;
      worksheet.addRows(byRole[key]);
      setHighlightImportantStuff(worksheet);
      setAutoWidth(worksheet);
      worksheet.autoFilter = `A1:${String.fromCharCode(64 + rowHeading.length)}1`;
    }

    //By Approval Status Sheets
    for (const [key] of Object.entries(byApproval)) {
      const worksheet = workbook.addWorksheet(sanitizeString(key), { properties: { tabColor: { argb: '000000' } } });
      worksheet.columns = rowHeading;
      worksheet.addRows(byApproval[key]);
      setHighlightImportantStuff(worksheet);
      setAutoWidth(worksheet);
      worksheet.autoFilter = `A1:${String.fromCharCode(64 + rowHeading.length)}1`;
    }

    $('#lighthousedownloadall').text('Download All Responses XLSX');

    // Export the workbook as an Excel file
    // Download the file
    workbook.xlsx.writeBuffer().then(function (buffer) {
      const blob = new Blob([buffer], { type: 'application/vnd.ms-excel' });
      const blobURL = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobURL;
      link.download = `${Date.now().toString()}.xlsx`;
      link.click();
    });

    function setHighlightImportantStuff(ws) {
      //heads in bold
      ws.getRow(1).eachCell((cell) => {
        cell.font = { bold: true }; // Set first row to bold
      });

      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip the first row
        const cell = row.getCell(7); // Column H (Excel columns are 1-based)
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
        AllDateRangeBlocks.forEach(function (_x, i) {
          let dateCell = row.getCell(8 + i);

          //date block stuff
          if (dateCell.value == 'Available') {
            dateCell.fill = {
              // Set background color to light green
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'cbffc5' }, // Light green
            };
            dateCell.alignment = { vertical: 'middle', horizontal: 'center' };
          }
          if (dateCell.value == 'Conditional') {
            dateCell.fill = {
              // Set background color to light yellow
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'fcffc5' }, // Light yellow
            };
            dateCell.alignment = { vertical: 'middle', horizontal: 'center' };
          }
          if (dateCell.value == 'Unavailable' || dateCell.value == '-') {
            dateCell.fill = {
              // Set background color to light red
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'ffd7c5' }, // Light red (RGBA hex code)
            };
            dateCell.alignment = { vertical: 'middle', horizontal: 'center' };
          }
        });
      });
    }
  }
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
    let AllDateRangeBlocks = new Set();

    //find out out all the date ranges first before we split data up

    csvObj.forEach(function (row) {
      let dateRanges = row.approvedDates.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/g);
      if (dateRanges) {
        for (let i = 0; i < dateRanges.length; i += 2) {
          let rangeDates = getDateRange(dateRanges[i] + ':00.000Z', dateRanges[i + 1] + ':00.000Z'); //timezones suck and we dont care
          rangeDates.forEach((date) => AllDateRangeBlocks.add(date));
        }
      }
    });

    AllDateRangeBlocks = Array.from(AllDateRangeBlocks).sort(); // Sort all unique dates

    csvObj.forEach(function (row) {
      delete row.levelOfRequest;
      delete row.requestId;

      //date range stuff
      const regex = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}) to (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}) with status: (\w+)/g;

      let matches;
      while ((matches = regex.exec(row.approvedDates)) !== null) {
        let startDate = matches[1];
        let endDate = matches[2];
        let status = matches[3];

        AllDateRangeBlocks.forEach(function (d) {
          if (isDateBetween(d, startDate, endDate)) {
            row[d] = status;
          }
        });
      }

      //catch any missing time blocks
      AllDateRangeBlocks.forEach(function (d) {
        if (typeof row[d] == 'undefined') {
           row[d] = '-'; //default value
        }
      })


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

      // DIM by Zone
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

    let dateHeaders = AllDateRangeBlocks.map(function (d) {
      return { header: d, key: d };
    });

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

    rowHeading.splice(8, 0, ...dateHeaders);

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
      worksheet.autoFilter = `A1:${String.fromCharCode(64 + rowHeading.length)}1`;
    }

    //By Role Sheets
    for (const [key] of Object.entries(byRole)) {
      const worksheet = workbook.addWorksheet(sanitizeString(key), { properties: { tabColor: { argb: 'ffbb33' } } });
      worksheet.columns = rowHeading;
      worksheet.addRows(byRole[key]);
      setHighlightImportantStuff(worksheet);
      setAutoWidth(worksheet);
      worksheet.autoFilter = `A1:${String.fromCharCode(64 + rowHeading.length)}1`;
    }

    // Export the workbook as an Excel file
    // Download the file
    workbook.xlsx.writeBuffer().then(function (buffer) {
      const blob = new Blob([buffer], { type: 'application/vnd.ms-excel' });
      const blobURL = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobURL;
      link.download = `${sanitizeString(
        csvObj.length ? csvObj[0].requestTitle : 'OOAA',
      )}-${Date.now().toString()}.xlsx`;
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
            fgColor: { argb: 'FFD580' }, 
          };
        }

        AllDateRangeBlocks.forEach(function (_x, i) {
          let dateCell = row.getCell(9 + i);

          //date block stuff
          if (dateCell.value == 'Available') {
            dateCell.fill = {
              // Set background color to light green
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'cbffc5' },
            };
            dateCell.alignment = { vertical: 'middle', horizontal: 'center' };
          }
          if (dateCell.value == 'Conditional') {
            dateCell.fill = {
              // Set background color to light yellow
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'fcffc5' }, 
            };
            dateCell.alignment = { vertical: 'middle', horizontal: 'center' };
          }
          if (dateCell.value == 'Unavailable' || dateCell.value == '-') {
            dateCell.fill = {
              // Set background color to light red
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'ffd7c5' }, 
            };
            dateCell.alignment = { vertical: 'middle', horizontal: 'center' };
          }
        });
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

function setAutoWidth(ws, padding = 0) {
  padding = 3
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
    column.width = dataMax < 10 ? 10 + padding : dataMax + padding;
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

function getDateRange(start, end) {
  let dates = [];
  let currentDate = new Date(start);
  const endDate = new Date(end);

  while (currentDate <= endDate) {
    dates.push(currentDate.toISOString().split('T')[0]); // Format as YYYY-MM-DD
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
}

function isDateBetween(targetDate, startDate, endDate) {
  const target = new Date(targetDate);
  const start = new Date(startDate);
  const end = new Date(endDate);

  return target >= start && target <= end;
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
        console.log('Timeout: Stopping waiting whenPageIsReady after 5 seconds.');
      }
    }, 500);
  }
}
