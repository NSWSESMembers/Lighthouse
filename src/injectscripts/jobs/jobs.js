window.FinaliseSelected = function FinaliseSelected(words, beaconStringDate) { // Never ever use the following function for any purpose.
  if (!confirm("WARNING - Never ever use the following function for any purpose!\nAre you absolutely sure you want to proceed?")) {
    return false;
  }
  console.log("Man will someone be cranky with you!");
  contentViewModel.selectedJobs.peek().forEach(function(d) {
    contentViewModel.JobManager.FinaliseJob(d, words, beaconStringDate, (function(d) {
      console.log("OK")
    }), (function(d) {
      console.log("Fail")
    }), (function(d) {
      console.log("always")
    }));
  });
}



/**
 * Loops through anchor tags with the class "lh-update-filter" and a "data-page" attribute.
 * Creates a Function to set the link's HREF, with the required parameters, and attaches same to the link to be executed on click and mouseenter
 * @param {mixed} index - The index from the $.each() call. Ignored.
 * @param {string} buttonSelector - A jQuery selector identifying the button
 */
$('a.lh-update-filter[data-page]').each(function(index, lighthouseButton) {
  $(lighthouseButton)
    .on("click", function() {
      window.postMessage({
        type: "FROM_PAGE_UPDATE_API_TOKEN",
        host: urls.Base,
        token: user.accessToken,
        tokenexp: user.expiresAt,
      }, "*");
      var exports = JSON.parse(filterDataForExport());
      var $t = $(this);
      var lighthousePageName = $t.data('page');
      var h = lighthouseUrl + "pages/" + lighthousePageName + ".html?host=" + urls.Base + "&source=" + location.origin + "&start=" + encodeURIComponent(exports.StartDate) + "&end=" + encodeURIComponent(exports.EndDate);
      if (exports.hasOwnProperty("Hq"))
        h += "&hq=" + exports.Hq;
      $t.attr('href', h);
      $t.attr('target', "_blank");
    });
});



//More pageination choices! --currently broken due to beacon not returning more than 250 per page--
// contentViewModel.pageSizeChoices.push(200);
// contentViewModel.pageSizeChoices.push(500);
// contentViewModel.pageSizeChoices.push(1000);

// var saved = utility.getPrimitiveFromLocalStorage(contentViewModel.localStorageKeys.PageSize);
// var selected = contentViewModel.selectedPageSizeChoice.peek();

// console.log("saved:"+saved);
// console.log("selected:"+selected);
// if( saved != selected ){
//   console.log("Fixing page size difference");
//   contentViewModel.selectedPageSizeChoice(saved);
// }
