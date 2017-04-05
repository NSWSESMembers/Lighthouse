var $ = require('jquery');
global.jQuery = $;
var stopwords = require('stopwords').english;
require('jqcloud-npm');



function makeSituationOnSceneCloud(jobs,element) {

  calculateSituationOnSceneCloud(walkSituationOnSceneWords(jobs));

  function calculateSituationOnSceneCloud(wordCount) {
    var purdyColor = tinygradient('black', 'red', 'orange', 'blue', 'LightBlue');

    setTimeout(function(){

      $(element).jQCloud(wordCount, {
        width: 500,
        height: 350,
        colors: purdyColor.rgb(10)
      });

    },2000);
    console.log("Total word count: "+wordCount.length);
  };
}

function walkSituationOnSceneWords(jobs){ //take array and make word:frequency array

  var wordCount = {};

  jobs.Results.forEach(function(d) {

    // strip stringified objects and punctuations from the string
    var words = d.SituationOnScene
    .toLowerCase()
    .replace(/object Object/g, '')
    .replace(/\//g,' ')
    .replace(/[\+\.,\/#!$%\^&\*{}=_`~]/g,'')
    .replace(/[0-9]/g, '');

    // this returns an array of words pre-split
    words = removeStopwords(words);

    // Count frequency of word occurance
    for(var i = 0; i < words.length; i++) {
      if(!wordCount[words[i]])
        wordCount[words[i]] = 0;
      wordCount[words[i]]++; // {'hi': 12, 'foo': 2 ...}
    }
  });

  var wordCountArr = [];

  for(var prop in wordCount) {
    wordCountArr.push({text: prop, weight: wordCount[prop]});
  }

  return wordCountArr;

}

function removeStopwords(string) {
  var filteredWords = [];
  var words = string.split(/\s+/);
  var length = words.length;
  for (var i = 0; i < length; i++) {
    var word = words[i].trim();
    var word = word.replace(/[.,-\/#!$%\^&\*;:{}=\-_`~()]/g,"");
    if(word != "" && stopwords.indexOf(word) == -1) {
      filteredWords.push(word);
    }
  }
  return filteredWords;
}

module.exports = {
  makeSituationOnSceneCloud: makeSituationOnSceneCloud,
}
