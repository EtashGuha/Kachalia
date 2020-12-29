(function(window){
  window.extractData = function() {
    var ret = $.Deferred();

    function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    }
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
    function onReady(smart)  {
      if (smart.hasOwnProperty('patient')) {
        var pdfjsLib = window['pdfjs-dist/build/pdf'];
        keywords = ["hemodynamic instability"]
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.6.347/pdf.worker.min.js';

        var patient = smart.patient;
        var pt = patient.read();
        var obv = smart.patient.api.fetchAll({
                    type: 'DocumentReference',
                    query: {
                      code: {
                        $or: ['http://loinc.org|68608-9']
                      }
                    }
                  });

        $.when(pt, obv).fail(onError);

        $.when(pt, obv).done(function(patient, obv) {
          $.getJSON("../sample.json", function(json) {
            var map = new Map()
            var topScores = []
            Object.keys(json).forEach(key => {
              map.set(key, 0)
            })
            var codeToTitle = new Map()
            Object.keys(json).forEach(key => {
              codeToTitle.set(key, json[key]["title"])
            })
            obv.forEach(reference => {
              smart.fetchBinary(reference["content"][0]["attachment"]["url"]).then(note => {
                note.arrayBuffer().then(bitarray => {
                  pdfjsLib.getDocument(bitarray).promise.then(pdf => {
                    getAllText(pdf).then(text => {
                      var lower_text = text.toLowerCase()
                      icdScoring = []
                      Object.keys(json).forEach(function(key) {
                          var value = json[key];
                          var currScore = 0;
                          value["keywords"].forEach(keyword => {
                            if(lower_text.includes(keyword)){
                              currScore += 1
                            }
                          })
                          map.set(key, map.get(key) + currScore)
                          var indexToInsert = sortedIndex(topScores, map, currScore);
                          topScores.splice(indexToInsert, 0, key)
                          if(topScores.length > 10){
                            topScores.splice(-1, 1)
                          }
                      });
                      console.log(topScores)
                      var titles = []
                      topScores.forEach(code => {
                        titles.push(codeToTitle.get(code))
                      })
                      console.log(titles)
                      var banana = document.getElementById('suggested');
                      banana.innerHTML = '';
                      for(var i = 0; i < topScores.length; i++){
                        var element = document.createElement("li")
                        element.className = "codelistitem"
                        var codespan  = document.createElement('span')
                        codespan.className = "codetext"
                        codespan.innerText = topScores[i]
                        var name = document.createTextNode(":    " + titles[i]);
                        element.append(codespan)
                        element.append(name)
                        banana.append(element)  
                      }
                    })
                  })
                })
              })
            })
          })
        });
      } else {
        onError();
      }
    }

    FHIR.oauth2.ready(onReady, onError);
    return ret.promise();

  };
  function occurrence(string, substring) {
    var counter = 0;
    var sub = substring.toLowerCase();
    var str = string.toLowerCase(); 
    var array = [];
    var index = -1;

    do {
        index = str.indexOf(sub, index + 1);
        if (index != -1) {
            array[counter++] = index;
            i = index;
        }
    } while (index != -1);

    return counter; // or return array; if you want the indexes
  }

  function freqPhrase(string, notes){
    often = []
    notes.forEach(note => {
      often.push(occurrence(string, note))
    })
  }

  function getAllText(pdf) {
    var maxPages = pdf.numPages;
    var countPromises = []; // collecting all page promises
    for (var j = 1; j <= maxPages; j++) {
      var page = pdf.getPage(j);

      var txt = "";
      countPromises.push(page.then(function(page) { // add page promise
        var textContent = page.getTextContent();
        return textContent.then(function(text){ // return content promise
          return text.items.map(function (s) { return s.str; }).join(''); // value page text 
        });
      }));
    }
    // Wait for all pages and join text
    return Promise.all(countPromises).then(function (texts) {
      return texts.join('');
    });
  }


})(window);