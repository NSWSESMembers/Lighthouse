#Lighthouse

(Formerly "*Beacon Enhancement Suite*", "*BES*".)

##Requirements

- [Google Chrome Browser](https://www.google.com/chrome/browser/desktop/index.html "Download Google Chrome")
- NSW SES Beacon Account

##Purpose

Lighthouse is intended to augment the functionality provided by Beacon. It streamlines some common workflows, such as closing a job or tasking a job to a team, it also provides customised displays for use on screens in an Operations Room.

Lighthouse also provides an opportunity to test functionality or fixes before those changes are put to the Beacon development team for incorporation into the core system.

##Operation

Lighthouse is completely client-side. It stores no user data and runs cmpletely within the Chrome web browser. It is bound by existing Beacon management systems, such as user permissions, security checks and logging of actions within Beacon for auditing purposes.

Lighthouse simply interfaces with the same information and functionality as normal Beacon, just in a different (and hopefully more effective and efficient) way.

##Usage

A compiled stable version of the Lighthouse system is available through the [Google Chrome Store](https://chrome.google.com/webstore/detail/lighthouse/eheijalihofgiaoeanmnjceefmcpajnb "Lighthouse in the Google Chrome Store").

This version is updated when major changes are committed through the GitHub repository, and/or it is convenient ans safe to distribute an updated version.


A compiled developer version of the Lighthouse system is available through the [Google Chrome Store](https://chrome.google.com/webstore/detail/lighthouse-development-pr/jcmiinngebdojjbcjlpjpdhiankmjbda "Lighthouse Development Preview in the Google Chrome Store").

This version is updated when minor changes are committed through the GitHub repository, and/or there is something in the pipeline that we want to test on a wider audience.


##Development

Install:

- NodeJS and npm
- Gulp (`npm install -g gulp-cli`)

Build:
Run `npm install` in the root of this repository. You then should be able to run `gulp`. The extension will be built into `build` and bundled into `dist`. Load the `build` directory as an unpacked Chrome extension and then execute `gulp watch` while developing to have gulp automatically rebuild JS/JSX as you edit the files.

Pull requests are welcome!

## Changes

###In development:

- Address history - display other jobs with same address.
- NITC exports


###To Do

- Prefill "Primary Action" on job completion based of job type (you know, because of all the RCR we do on landsearch jobs)
- Prefill "Contact" on send message screen to fill with users HQ

###Tested:

- Map overlay to prevent theft of mouse when scrolling.
- Quick Filters. Allows for fast access to complex filter groups when searching. eg, "All Open Jobs" selects all the job tags that mean open (New,Ack, Tasked, Refered)
- Idle session detection with popup to warn user.
- Time picker options of 'this year' and 'all time' added.
- Team summary screen.
- Change page title to job number when viewing a job.
- Change page title to team name when viewing a team.
- Fixed missing favicon on the login page.
- Fixed missing page title on the login page.
- Hide maximise  button on popup on situational awareness map
- Job summary and statistics page that feeds directly from beacon filters
- Quick Text on team completion and job finalisation
- Quick Task on team completion
- Fixed message line breaks. Instead of showing `<br>` an actual line break is inserted into the message correctly.
- Added more pagination choices to tasking and job list
- Christmas theme :p





