var inject = require('../../../lib/inject.js');

//inject the coded needed to fix visual problems
//needs to be injected so that it runs after the DOMs are created
inject('jobs/situational_awareness.js');
