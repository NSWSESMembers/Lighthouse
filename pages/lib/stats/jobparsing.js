var $ = require('jquery');
global.jQuery = $;

function prepareData(jobs, unit, start, end) {

  // convert timestamps to Date()s


  var eventIdAndDescription = [];

  jobs.Results.forEach(function(d) {
    var thisJobisAck = false;
    var thisJobisComp = false;

    if (d.Event) {
      var words = d.Event.Identifier +" - "+ d.Event.Description;
      eventIdAndDescription[words] = (eventIdAndDescription[words] || 0) + 1;
    }

    if (d.LGA == null) {
      d.LGA = "N/A";
    }

    if (d.SituationOnScene == null) {
      d.SituationOnScene = "N/A";
    }

    if (d.Address.Locality == null) {
      d.Address.Locality = "N/A";
    }


    d.JobReceivedFixed = new Date(d.JobReceived)


    d.hazardTags = [];
    d.treeTags = [];
    d.propertyTags = [];
    d.jobtype = "";
    var jobtype = [];
    var JobTypeDict = {
      'Tree': ['Tree Down', 'Branch Down','Tree Threatening','Branch Threatening'],
      'Damage': ['Roof Damage', 'Ceiling Damage', 'Door Damage', 'Wall Damage', 'Window Damage','Threat of Collapse'],
      'Leak': ['Leaking Roof']
    }

    for (var key in JobTypeDict) { //for each key
      var value = JobTypeDict[key]

      $.each(value, function(d3){ //for each value
        if (FindTag(value[d3]))
        {
          jobtype.push(key)
        }
      })
    }

    jobtype = Array.from(new Set(jobtype)); // #=> ["foo", "bar"]


    jobtype.sort();

    d.jobtype = jobtype.join("+")


    if (d.jobtype == "")
    {
      d.jobtype = "N/A"
    }

    function FindTag(name) {
      var found = false;
      d.Tags.forEach(function(d2){
        if (d2.Name == name)
        {
          found = true;
        }
      })

      if (found == false)
      {
        return false
      } else
      {
        return true
      }
      
    }

    d.Tags.forEach(function(d2){
      switch (d2.TagGroupId) {
        case 5:
        d.treeTags.push(d2.Name);
        break;
        case 7: case 8: case 9:
        d.hazardTags.push(d2.Name);
        break
        case 10: case 11: case 13:
        d.propertyTags.push(d2.Name);
        break;
      }
    });


    if (d.ReferringAgency == null)
    {
      d.ReferringAgencyID = "N/A"
    } else {
      d.ReferringAgencyID = d.ReferringAgency
    }

    if (d.Event == null)
    {
      d.EventID = "N/A"
    } else {
      d.EventID = d.Event.Identifier
    }

    d.JobOpenFor=0;
    d.JobCompleted = new Date(0);
    for(var counter=0 ; counter < (d.JobStatusTypeHistory.length);counter++){
      switch (d.JobStatusTypeHistory[counter].Type) {
        case 1: // New
        break;
        case 2: // Acknowledged         
        break;
        case 3: case 6: case 7: case 8: //REJ, COMP+ // anything past completed is all we care about
        if (thisJobisComp == false) {
          thisJobisComp = true;
          d.JobCompleted = new Date(d.JobStatusTypeHistory[counter].Timelogged)
        }
        break;
      }

    }

    //console.log(d.Id +" - Opened "+d.JobReceivedFixed+" Closed "+ d.JobCompleted)


  });


var options = {
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "numeric",
  hour12: false
};

  if (unit.length == 0) { //whole nsw state
    document.title = "NSW Job Statistics";
    $('.stats header h2').text('Job statistics for NSW');
  } else { //multiple units
    if (Array.isArray(unit) == false) { //single unit
      document.title = unit.Name + " Job Statistics";
      $('.stats header h2').text('Job statistics for '+unit.Name);
    }
    if (unit.length > 1) { //more than one

      var unitParents = []
      unit.forEach(function(d2){
            unitParents[d2.ParentEntity.Code] = (unitParents[d2.ParentEntity.Code] || 0) + 1;
      })
      if (Object.keys(unitParents).length == 1) //if theres only 1 LHQ
      {
        $('.stats header h2').text('Job statistics for ('+unitParents[Object.keys(unitParents)[0]]+') '+Object.keys(unitParents)[0]+' units');
      } else {
              $('.stats header h2').text('Job statistics for Group');

      }

      document.title = "Group Job Statistics";
    }
  }

  $('.stats header h4').text(
    start.toLocaleTimeString("en-au", options) + " to " +
    end.toLocaleTimeString("en-au", options)
    );

  var banner = "";

  for (var i = 0; i < Object.keys(eventIdAndDescription).length; ++i) {
    banner = i == 0 ? banner + Object.keys(eventIdAndDescription)[i] : banner + " | " + Object.keys(eventIdAndDescription)[i] ;
  }


  $('#events').text(banner);

  return jobs

}


module.exports = {
  prepareData: prepareData,
}
