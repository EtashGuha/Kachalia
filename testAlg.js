var pdfUtil = require('pdf-to-text');
var json = require("./sample.json")
var pdfpath = "/Users/etashguha/Downloads/kachalia.pdf"
var option = {from: 0, to: 10};
pdfUtil.pdfToText(pdfpath, option, function(err, text) {
  if (err) throw (err);
  var lower_text = text.toLowerCase()
  icdScoring = []
  var map = new Map()
  var topScores = []

  function sortedIndex(array, map, value) {
    var low = 0,
      high = array.length;

    while (low < high) {
      var mid = (low + high) >>> 1;
      if (map.get(array[mid]) < value) high = mid;
      else low = mid + 1;
    }
    return low

  }

  Object.keys(json).forEach(key => {
    map.set(key, 0)
  })
  var codeToTitle = new Map()
  Object.keys(json).forEach(key => {
    codeToTitle.set(key, json[key]["title"])
  })
  var codeToTitleKeywords = new Map()
  Object.keys(json).forEach(key => {
    codeToTitleKeywords.set(key, [])
  })
  Object.keys(json).forEach(function(key) {
    var value = json[key];
    var currScore = 0;
    var multiplier = 0
    var title = json[key]["title"]
    value["title_keywords"].forEach(title_keyword => {
      if (lower_text.includes(title_keyword)){
        multiplier += 1
        codeToTitleKeywords.get(key).push(title_keyword)
      }
    })
    if(multiplier == 0){
      return
    }
    value["keywords"].forEach(keyword => {
      if (lower_text.includes(keyword)) {
        currScore += 1
      }
    })


    map.set(key, map.get(key) + currScore)
    var indexToInsert = sortedIndex(topScores, map, currScore);
    topScores.splice(indexToInsert, 0, key)
    if (topScores.length > 10) {
      topScores.splice(-1, 1)
    }
  });
  console.log(topScores)
  var titles = []
  topScores.forEach(code => {
    titles.push(codeToTitle.get(code))
  })
  console.log(titles)
  keywordTITLE = []
  topScores.forEach(code => {
    keywordTITLE.push(codeToTitleKeywords.get(code))
  })
  console.log(keywordTITLE)
});