Lighthouse (formally Beacon Enhancement Suite) aims to improve Beacon usability by speeding up work flows (like closing a job or tasking a job to a team) or display information in a more useful way (big summary screens for operations or pretty graphs for making it look like we do lots things). I have also included minor fixes that the Beacon team has failed to address (like the missing X button on the situational awareness map)

BES is completely client side, stores no user data and runs within the web browser. It can only access information that your browser can (meaning it adheres to beacon user permissions, security, and auditing)

the project now available for download and install from the google chrome store. Please give it a try and see if you can find any problems (bugs), or if you can think of anything I can add to it to make day to day or operational use of beacon easier.



Code will be pushed up the the chrome app store every milestone (I say that like I have milestones.... its more of a random event while im waiting for something else to happen)


###Tested:

- Change page title to job number when viewing a job
- Change page title to team name when viewing a team
- Fixed missing favicon on the login page
- Fix missing X button on popup on situational awareness map
- "Keep logged in" - hits a url in the back ground to keep user session alive
- Summary and Statistics page that feeds directly from beacon filters
- Quick Text on team completion and job finalisation
- Fixed message br text. acts like a line break in the message correctly now.
- added 200 and 500 to pagination choices

###In developement:

- Team summary screen


## To Do

- Prefill "Primary Action" on job completion based of job type (you know, because of all the RCR we do on landsearch jobs)
- Prefill "Contact" on send message screen to fill with users HQ
