/* global $, vm, moment, urls, user */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
var DOM = require('jsx-dom-factory').default;
var sesAsbestosSearch = require('../../lib/sesasbestos.js');

console.log('jobs/create.js inject running');

$(document).ready(function () {
  //Code to allow the extension to talk back to the page to access the vm and apply the tag.
  window.addEventListener('message', function (event) {
    // We only accept messages from ourselves
    if (event.source != window) return;
    if (event.data.type && event.data.type == 'FROM_LH_SETASSIGNEDUNIT') {
      vm.EntityManager.GetEntityByCode(event.data.code, function (res) {
        if (res) {
          vm.entityAssignedTo(res);
        }
      });
    }
    if (event.data.type && event.data.type == 'FROM_LH_ASBESTOS') {
      if (event.data.result == true) {
        console.log('Applying Fibro/Asbestos tag');
        $.each(vm.availableJobTags.peek(), function (k, v) {
          if (v.Name == 'Fibro/Asbestos') {
            vm.jobTagClicked(v);
            return false;
          }
        });
      } else {
        console.log('Removing Fibro/Asbestos tag if present');
        $.each(vm.selectedJobTags.peek(), function (k, v) {
          if (v.Name == 'Fibro/Asbestos') {
            vm.jobTagClicked(v);
            return false;
          }
        });
      }
    }
  });

  whenWeAreReady(vm, function () {
    console.log('jobs create ready');

    let accreditations = undefined;

    vm.entityAssignedTo.subscribe(function (who) {
      if (who) {
        calculateMyAvailabilityResult({ unitAssigned: who });
        // toggle the nearest lhq buttons automagically
        $(
          `#contained-within-lhq-text a[data-unit!='${who.Code}'], #nearest-rescue-lhq-text a[data-unit!='${who.Code}'], #nearest-lhq-text a[data-unit!='${who.Code}'] `,
        ).removeClass('active');
        $(
          `#contained-within-lhq-text a[data-unit='${who.Code}'], #nearest-rescue-lhq-text a[data-unit='${who.Code}'], #nearest-lhq-text a[data-unit='${who.Code}']`,
        ).addClass('active');
      }
    });

    /**
     * Subscribe to assigned contact groups - Reprocess list on change
     */
    vm.contactGroupsForJob.subscribe(function (group) {
      calculateMyAvailabilityResult({ contactGroups: group });
      group.forEach(function (x) {
        $('#recipients > a').each(function (k, v) {
          if (v.href.split('/')[4] == x.Id) {
            if (x.ExportContactGroup) {
              $(v).html(
                `${v.text} <span><p style="margin-bottom:0px;font-size:11px;margin-top: 4px">Exported to myAvailability</p></span>`,
              );
            } else {
              $(v).html(
                `${v.text} <span><p style="margin-bottom:0px;font-size:11px;margin-top: 4px">Not Exported to myAvailability</p></span>`,
              );
            }
          }
        });
      });
    });

    // vm.sendMessage.subscribe(function(answer) {
    //   $('#myAvailability-message').remove()
    //   if (!answer) {
    //     if (vm.jobType.peek().ParentId != 5) { //rescues always send
    //     noMyAvailability($('#sendMessageOptions').parent(),'myAvailability-message', 'send message is disabled')
    //     }
    //   }
    // })

    function calculateMyAvailabilityResult({ unitAssigned, jobType, contactGroups, jobPriority }) {
      $('#myAvailabilityStatus').empty();
      let exportedGroups = [];

      if (contactGroups) {
        contactGroups.forEach(function (x) {
          if (x.ExportContactGroup) {
            exportedGroups.push(`'${x.Name}'`);
          }
        });

        if (contactGroups.length && exportedGroups.length == 0) {
          noMyAvailability(
            $('#myAvailabilityStatus'),
            'myAvailability-recipients',
            'the matched contact groups are not marked for export to myAvailability.',
          );
        }
        // if we have contact groups we have a lhq so reset this so we cant monitoring status
         if (!unitAssigned) {
          unitAssigned = vm.entityAssignedTo.peek()
         }

         if (!jobPriority) {
          jobPriority = vm.jobPriority.peek()
         }

      }

      if (unitAssigned) {
        if (unitAssigned.HeadquartersStatusTypeId == 1) {
          //2 = not mon, 1 = mon,
          if (vm.jobPriority.peek() && vm.jobPriority.peek().Id != 1 && vm.jobPriority.peek().Id != 2) {
            //not imediate or rescue
            noMyAvailability(
              $('#myAvailabilityStatus'),
              'myAvailability-monitoring',
              'the selected unit is monitoring and job response type is not immediate or rescue.',
            );
          }
        }
      }

      if (jobPriority) {
        if (vm.entityAssignedTo.peek() && vm.entityAssignedTo.peek() == 1) {
          //2 = not mon, 1 = mon,
          if (jobPriority.Id != 2 && jobPriority.Id != 1) { //immediate/rescue
            //not a rescue
            noMyAvailability(
              $('#myAvailabilityStatus'),
              'myAvailability-monitoring',
              'the selected unit is monitoring and job response type is not immediate or rescue.',
            );
          }
        }
      }

      if (jobType) {
        if (jobType.ParentId != 5) {
          if (vm.entityAssignedTo.peek() && vm.entityAssignedTo.peek().HeadquartersStatusTypeId == 1) {
            //not a rescue
            noMyAvailability(
              $('#myAvailabilityStatus'),
              'myAvailability-jobType',
              'the selected unit is monitoring and job response type is not immediate or rescue.',
            );
          }
        }
      }

      //no reasons why not?
      if ($('#myAvailabilityStatus').children().length == 0) {
        if (vm.contactGroupsForJob.peek().length == 0) {
          noMyAvailability(
            $('#myAvailabilityStatus'),
            'myAvailability-contactGroupsForJob',
            'no matching contact groups were found.',
          );
        } else {
          yesMyAvailability($('#myAvailabilityStatus'), 'myAvailability-recipients', exportedGroups.join(', '));
        }
      }
    }

    function noMyAvailability(dom, name, reason) {
      dom.append(
        <div id={name} class="form-group alert alert-warning" style="margin-bottom:0px;margin-top:0px">
          <strong>No</strong> availability request will be raised in <strong>myAvailability</strong> because {reason}
        </div>,
      );
    }

    function yesMyAvailability(dom, name, reason) {
      dom.append(
        <div id={name} class="form-group alert alert-info" style="margin-bottom:0px;margin-top:0px">
          Availability request <strong>will</strong> be raised in <strong>myAvailability</strong> and include the members of the{' '}
          {reason} contact group(s)
        </div>,
      );
    }

    vm.jobPriority.subscribe(function (jp) {
      if (jp) {
        calculateMyAvailabilityResult({ jobPriority: jp });
      }
    })

    vm.jobType.subscribe(function (jt) {
      if (jt) {
        //if defined
        calculateMyAvailabilityResult({ jobType: jt });

        if (jt.ParentId == 5) {
          //only if a rescue type
          window.postMessage({ type: 'FROM_PAGE_JOBTYPE', jType: jt.Name }, '*');
        } else {
          window.postMessage({ type: 'FROM_PAGE_JOBTYPE', jType: null }, '*');
        }
      }
      //push an update back in to upload distances for the new rescue type
      if (jt && vm.latitude.peek() && vm.longitude.peek()) {
        if (jt.ParentId == 5) {
          if (accreditations == undefined) {
            fetchAccreditations(function (res) {
              accreditations = res;
              window.postMessage(
                {
                  type: 'FROM_PAGE_LHQ_DISTANCE',
                  jType: jt ? jt.Name : null,
                  report: accreditations,
                  lat: vm.latitude.peek(),
                  lng: vm.longitude.peek(),
                },
                '*',
              );
            });
          } else {
            window.postMessage(
              {
                type: 'FROM_PAGE_LHQ_DISTANCE',
                jType: jt ? jt.Name : null,
                report: accreditations,
                lat: vm.latitude.peek(),
                lng: vm.longitude.peek(),
              },
              '*',
            );
          }
        } else {
          //dont send report
          window.postMessage(
            {
              type: 'FROM_PAGE_LHQ_DISTANCE',
              jType: jt ? jt.Name : null,
              report: null,
              lat: vm.latitude.peek(),
              lng: vm.longitude.peek(),
            },
            '*',
          );
        }
      }
    });

    vm.latitude.subscribe(function (latitude) {
      console.log('latitude changed');
      if (latitude) {
        if (vm.jobType.peek() && vm.jobType.peek().ParentId == 5) {
          if (accreditations == undefined) {
            fetchAccreditations(function (res) {
              accreditations = res;
              window.postMessage(
                {
                  type: 'FROM_PAGE_LHQ_DISTANCE',
                  jType: vm.jobType.peek().Name,
                  report: accreditations,
                  lat: vm.latitude.peek(),
                  lng: vm.longitude.peek(),
                },
                '*',
              );
            });
          } else {
            window.postMessage(
              {
                type: 'FROM_PAGE_LHQ_DISTANCE',
                jType: vm.jobType.peek().Name,
                report: accreditations,
                lat: vm.latitude.peek(),
                lng: vm.longitude.peek(),
              },
              '*',
            );
          }
        } else {
          //dont send report
          window.postMessage(
            {
              type: 'FROM_PAGE_LHQ_DISTANCE',
              jType: null,
              report: null,
              lat: vm.latitude.peek(),
              lng: vm.longitude.peek(),
            },
            '*',
          );
        }
      }
    });

    vm.longitude.subscribe(function (longitude) {
      console.log('longitude changed');

      if (longitude) {
        if (vm.jobType.peek() && vm.jobType.peek().ParentId == 5) {
          if (accreditations == undefined) {
            fetchAccreditations(function (res) {
              accreditations = res;
              window.postMessage(
                {
                  type: 'FROM_PAGE_LHQ_DISTANCE',
                  jType: vm.jobType.peek() ? vm.jobType.peek().Name : null,
                  report: accreditations,
                  lat: vm.latitude.peek(),
                  lng: vm.longitude.peek(),
                },
                '*',
              );
            });
          } else {
            window.postMessage(
              {
                type: 'FROM_PAGE_LHQ_DISTANCE',
                jType: vm.jobType.peek() ? vm.jobType.peek().Name : null,
                report: accreditations,
                lat: vm.latitude.peek(),
                lng: vm.longitude.peek(),
              },
              '*',
            );
          }
        } else {
          //dont send report
          window.postMessage(
            {
              type: 'FROM_PAGE_LHQ_DISTANCE',
              jType: null,
              report: null,
              lat: vm.latitude.peek(),
              lng: vm.longitude.peek(),
            },
            '*',
          );
        }
      }
    });

    vm.geocodedAddress.subscribe(function (newAddress) {
      if (newAddress) {
        $.ajax({
          type: 'GET',
          url: urls.Base + '/Api/v1/GeoServices/Unit/Containing',
          beforeSend: function (n) {
            n.setRequestHeader('Authorization', 'Bearer ' + user.accessToken);
          },
          data: {
            LighthouseFunction: 'UnitContains',
            userId: user.Id,
            latitude: newAddress.latitude,
            longitude: newAddress.longitude,
          },
          cache: false,
          dataType: 'json',
          complete: function (response, _textStatus) {
            vm.EntityManager.GetEntityByCode(response.responseJSON.unit_code, function (data) {
              let containedWithin = [];
              let newLHQDom = (
                <a type="button" style="margin-bottom:5px" class="btn btn-default btn-sm" data-unit={data.Code}>
                  {data.Name} Unit
                </a>
              );
              $(newLHQDom).click(function (e) {
                e.preventDefault();
                vm.entityAssignedTo(data);
              });
              containedWithin.push(newLHQDom);
              let newZoneDom = (
                <a
                  type="button"
                  style="margin-bottom:5px"
                  class="btn btn-default btn-sm"
                  data-unit={data.ParentEntity.Code}
                >
                  {data.ParentEntity.Name}
                </a>
              );
              $(newZoneDom).click(function (e) {
                e.preventDefault();
                vm.entityAssignedTo(data.ParentEntity);
              });
              containedWithin.push(newZoneDom);
              let newStateDom = (
                <a type="button" style="margin-bottom:5px" class="btn btn-default btn-sm" data-unit="SHQ">
                  State Headquarters
                </a>
              );
              $(newStateDom).click(function (e) {
                e.preventDefault();
                vm.entityAssignedTo({ Id: 1, Code: 'SHQ', Name: 'State Headquarters' });
              });
              containedWithin.push(newStateDom);

              $('#contained-within-lhq-text').empty();
              $('#contained-within-lhq-text').append(containedWithin);
            });
          },
        });

        $('#asbestos-register-text').text('Searching...');

        if (vm.jobType.peek() && vm.jobType.peek().ParentId == 5) {
          if (accreditations == undefined) {
            fetchAccreditations(function (res) {
              accreditations = res;
              window.postMessage(
                {
                  type: 'FROM_PAGE_LHQ_DISTANCE',
                  jType: vm.jobType.peek().Name,
                  report: accreditations,
                  lat: vm.geocodedAddress.peek().latitude,
                  lng: vm.geocodedAddress.peek().longitude,
                },
                '*',
              );
            });
          } else {
            window.postMessage(
              {
                type: 'FROM_PAGE_LHQ_DISTANCE',
                jType: vm.jobType.peek().Name,
                report: accreditations,
                lat: vm.geocodedAddress.peek().latitude,
                lng: vm.geocodedAddress.peek().longitude,
              },
              '*',
            );
          }
        } else {
          window.postMessage(
            {
              type: 'FROM_PAGE_LHQ_DISTANCE',
              jType: null,
              report: null,
              lat: vm.geocodedAddress.peek().latitude,
              lng: vm.geocodedAddress.peek().longitude,
            },
            '*',
          );
        }

        let address = vm.geocodedAddress.peek();
        if (address.street != '') {
          address.PrettyAddress = address.pretty_address;
          address.StreetNumber = address.number;
          address.Street = address.street;
          address.Locality = address.locality;
          address.Flat = address.flat;

          //reset the colors
          $('#asbestos-register-box')[0].style.color = 'black';
          $('#asbestos-register-box').css({
            background: '',
            'margin-left': '0px',
          });

          sesAsbestosSearch(vm.geocodedAddress.peek(), function (res) {
            if (res == true) {
              window.postMessage(
                {
                  type: 'FROM_PAGE_SESASBESTOS_RESULT',
                  address: address,
                  result: true,
                  color: 'red',
                },
                '*',
              );
            } else {
              window.postMessage(
                {
                  type: 'FROM_PAGE_FTASBESTOS_SEARCH',
                  address: address,
                },
                '*',
              );
            }
          });
        } else {
          $('#asbestos-register-flag').text('Not A Searchable Address');
        }
      } else {
        $('#asbestos-register-flag').text('Waiting For An Address');
      }
    });
  });
});

function whenWeAreReady(varToCheck, cb) {
  //when external vars have loaded
  var waiting = setInterval(function () {
    if (typeof varToCheck != 'undefined') {
      clearInterval(waiting); //stop timer
      cb(); //call back
    }
  }, 200);
}

function fetchAccreditations(cb) {
  $.ajax({
    type: 'GET',
    url: urls.Reports + '/Headquarters',
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + user.accessToken);
    },
    data: {
      LighthouseFunction: 'fetchAccreditations',
      userId: user.Id,
      StartDate: moment().format('Y-MM-DD HH:mm:ss'),
      EndDate: moment().format('Y-MM-DD HH:mm:ss'),
      ReportId: 22,
      EquipmentLeftOnly: false,
    },
    cache: false,
    dataType: 'html',
    complete: function (response, _textStatus) {
      let page = $.parseHTML(response.responseText);
      let table = $(page).find('#reportTable');
      cb && cb(tableToObj(table[0]));
    },
  });
}

function tableToObj(table) {
  var rows = table.rows;
  var propCells = rows[0].cells;
  var propNames = [];
  var results = {};
  var obj, cells;

  // Use the first row for the property names
  // Could use a header section but result is the same if
  // there is only one header row
  for (var i = 0, iLen = propCells.length; i < iLen; i++) {
    propNames.push(propCells[i].textContent || propCells[i].innerText);
  }

  // Use the rows for data
  // Could use tbody rows here to exclude header & footer
  // but starting from 1 gives required result
  for (var j = 1, jLen = rows.length; j < jLen; j++) {
    cells = rows[j].cells;
    obj = {};

    for (var k = 0; k < iLen; k++) {
      obj[propNames[k]] = cells[k].textContent || cells[k].innerText;
    }
    // return as a key value pair on obj.Code
    results[obj.Code] = obj;
  }
  return results;
}
