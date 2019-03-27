whenVmIsReady(function() {

  var totalhrs = 0;
  vm.participants.peek().forEach(function(v) {
    // console.log(v);
    var start = new Date(v.StartDate)
    var end = new Date(v.EndDate)
    var diff = Math.abs(end - start) / 36e5;
    totalhrs = totalhrs + diff
  })
  console.log("Total Hrs:" + totalhrs)

  var hrDisplay = $('#content > div:nth-child(2) > div.col-xs-7 > div > div.widget-header > div:nth-child(2) > span')

  var current = hrDisplay.text()
  totalhrs = totalhrs.toFixed(2) + ""
  hrDisplay.append(" (" + totalhrs + " summed hrs)")
})

// wait for view to have loaded
function whenVmIsReady(cb) { //when external vars have loaded
  var waiting = setInterval(function() { //run every 1sec until we have loaded the page (dont hate me Sam)
    if (typeof vm != "undefined" & vm.participants != "undefined") {
      console.log("vm is ready");
      clearInterval(waiting); //stop timer
      cb(); //call back
    }
  }, 1000);
}
