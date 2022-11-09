/* global urls, user, $ */


/* global contentViewModel, map */
window.addEventListener('load', pageFullyLoaded, false);

function pageFullyLoaded(e) {
  whenMapIsReady(function() {
    const MapManager = require('../../lib/map/InjectScriptMapManager.js').default;
    //hide the maximize button
    let max = document.getElementsByClassName('titleButton maximize');
    max[0].classList.add('hidden');

    let mapManager = new MapManager();
    mapManager.initialise(contentViewModel.filterViewModel);
    })
}



// wait for address to have loaded
function whenMapIsReady(cb) { //when external vars have loaded
  var waiting = setInterval(function() { //run every 1sec until we have loaded the page (dont hate me Sam)
      if (map.loaded)
      {
        console.log("map is ready");
      clearInterval(waiting); //stop timer
      cb(); //call back
  }
}, 200);
}


//To access bootstrap JS this needs to live here... I dont know why yet
window.addEventListener("message", function(event) {
  if (event.data.type) {
    if (event.data.type === "LH_ASSETFILTERMODALCALL") {

      //reset search boxes
  $('#assetListAllQuickSearch').val('')
  $('#assetListSelectedQuickSearch').val('')

  $('#teamFilterListAddSelected').unbind().click(function() {
    $("#assetFilterListAll").val().forEach(function(s) {

      let option = $(`<option value=${s}>${s}</option>`)

      //click handler for unselecting
      option.dblclick(function(x) {
        if (x.target.value.toUpperCase().indexOf($('#assetListAllQuickSearch')[0].value.toUpperCase()) != -1)
        {
          $('#assetFilterListAll').find(`option[value|="${x.target.value}"]`).show()
        }
        $(x.target).remove()
      });
      $("#assetFilterListSelected").append(option);



      $('#assetFilterListAll').find(`option[value|="${s}"]`).hide()
    })
  })

  $('#teamFilterListRemoveSelected').unbind().click(function() {
    $("#assetFilterListSelected").val().forEach(function(s) {
      if (s.toUpperCase().indexOf($('#assetListAllQuickSearch')[0].value.toUpperCase()) != -1)
      {
        $('#assetFilterListAll').find(`option[value|="${s}"]`).show()
      }
      $('#assetFilterListSelected').find(`option[value|="${s}"]`).remove()
    })
  })


  $("#LHAssetFilterModal").on("hidden.bs.modal", function () {
      // put your default event here


    let selectedAssets = []
     $("#assetFilterListSelected").children().each(function(r) {
      selectedAssets.push($(this)[0].value)
    })

  localStorage.setItem("LighthouseJobViewAssetFilter", JSON.stringify(selectedAssets));

  $('#LHAssetFilterModal').modal('hide');
  $('#LHAssetFilterModal').unbind();

  //trigger off a headless asset refresh, once to unselect and again to reselect
  $('#toggleSesFilteredAssetsBtn').trigger('click');
  $('#toggleSesFilteredAssetsBtn').trigger('click');


  })



  $('#assetListAllQuickSearch').keyup = null;


  $('#assetListAllQuickSearch').keyup(function (e) {
        $.each($('#assetFilterListAll').find('option'),function(k,v){
          if (($(v)[0].value).toUpperCase().indexOf(e.target.value.toUpperCase()) == -1)
          {
            $(v).hide()
          } else {
            if (!$('#assetFilterListSelected').find(`option[value|="${$(v)[0].value}"]`).length) { //stupid always truthy find function
              $(v).show()
            }
          }
        });
      })

      $('#assetListSelectedQuickSearch').keyup(function (e) {
            $.each($('#assetFilterListSelected').find('option'),function(k,v){
              if (($(v)[0].value).toUpperCase().indexOf(e.target.value.toUpperCase()) == -1)
              {
                $(v).hide()
              } else {
                  $(v).show()
              }
            });
          })



          $("#assetFilterListSelected").empty()
          let loadIn = JSON.parse(localStorage.getItem('LighthouseJobViewAssetFilter')) || []
          loadIn.forEach(function(i){
            $("#assetFilterListSelected").append(`<option value=${i}>${i}</option>`);
          })

          $("#assetFilterListAll").empty()

          $('#asset-map-filter-loading').css("visibility", "unset");




      $.ajax({
  type: 'GET'
  , url: urls.Base+'/Api/v1/ResourceLocations/Radio?resourceTypes='
  , beforeSend: function(n) {
  n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
  }
  , cache: false
  , dataType: 'json'
  , data: {LighthouseFunction: 'NearestAsset', userId: user.Id}
  , complete: function(response, textStatus) {
  if (textStatus == 'success')
  {
    let sorted = response.responseJSON.map(function(i) {
      return i.properties.name
    })
    sorted.sort()

    sorted.forEach(function(v){

        $("#assetFilterListAll").append(`<option ${$('#assetFilterListSelected').find(`option[value|="${v}"]`).toArray().length ? "style='display:none' " : ''}value=${v}>${v}</option>`);

    })

    $('#asset-map-filter-loading').css("visibility", "hidden");


    $('#assetFilterListAll option').unbind().dblclick(function(x) {

      let option = $(`<option value="${x.target.value}">${x.target.value}</option>`)
      //click handler for unselecting
      option.dblclick(function(x) {
        if (x.target.value.toUpperCase().indexOf($('#assetListAllQuickSearch')[0].value.toUpperCase()) != -1)
        {
          $('#assetFilterListAll').find(`option[value|="${x.target.value}"]`).show()
        }
        $(x.target).remove()
      });

      $(x.target).hide()
      $("#assetFilterListSelected").append(option);
    });

    $('#assetFilterListSelected option').unbind().dblclick(function(x) {

      if (x.target.value.toUpperCase().indexOf($('#assetListAllQuickSearch')[0].value.toUpperCase()) != -1)
      {
        $('#assetFilterListAll').find(`option[value|="${x.target.value}"]`).show()
      }
      $(x.target).remove()
    });


    // response.responseJSON.forEach(function(v){
    //     $("#assetFilterListSelected").append(`<option value=${v.properties.name}>${v.properties.name}</option>`);
    // })
  }
}
})
      $('#LHAssetFilterModal').modal();
    }
  }
})