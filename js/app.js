(function(window){
  window.extractData = function() {
    var ret = $.Deferred();

    function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    }
    function sortedIndex(array, value) {
        var low = 0,
            high = array.length;

        while (low < high) {
            var mid = (low + high) >>> 1;
            if (array[mid] < value) high = mid;
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
                          console.log(currScore)
                          map.set(key, map.get(key) + currScore)
                          var indexToInsert = sortedIndex(topScores, currScore);
                          topScores.splice(indexToInsert, 0, key)
                          if(topScores.length < 10){
                            topScores.splice(-1, 1)
                          }
                      });
                      console.log(topScores)
                    })
                  })
                })
              })
            })
          })

          // var byCodes = smart.byCodes(obv, 'code');
          // allNotes = []
          // obv.forEach(reference => {
          //   allNotes.push(smart.fetchBinary(reference["content"][0]["attachment"]["url"]))
          // })
          // Promise.allSettled(allNotes).then(function(notes) {
          //   bitArrayPromises = []
          //   notes.forEach(note => {
          //     if(note.status === "fulfilled"){
          //       bitArrayPromises.push(note.value.arrayBuffer())
          //     }
          //   })
          //   Promise.all(bitArrayPromises).then(function(bitarrays) {
          //     console.log(bitarrays)
          //     pdfjsPromises = []
          //     bitarrays.forEach(bitarray => {
          //       pdfjsPromises.push(pdfjsLib.getDocument(bitarray).promise)
          //     })
          //     Promise.all(pdfjsPromises).then(function(pdfs) {
          //       console.log(pdfjsPromises)

          //       textPromises = []
          //       pdfs.forEach(pdf => {
          //         textPromises.push(getAllText(pdf))
          //       })
          //       Promise.all(textPromises).then(texts => {
          //         var notesInfo = texts.join(" ")
          //         console.log(notesInfo)
          //         $.getJSON("../sample.json", function(json) {
          //           console.log(json); 
          //           // icdScoring = []

          //           // json.forEach(icd => {
          //           //   icdScoring.push(new Promise((resolve, reject) => {
          //           //     icd["keywords"].forEach(keyword => {
          //           //       if notesInfo.includes(keyword)
          //           //     }
          //           //   }))
          //           // })
          //         });
          //         // var newObv = smart.patient.api.fetchAll({
          //         //   type: 'Observation'
          //         // });

          //         // newObv.then(finalObservations => {
          //         //   var obvicodes = smart.byCodes(finalObservations, 'code');
          //         //   var height = obvicodes('8302-2');
          //         //   var weight = obvicodes('67781-5')
          //         //   var notes =  obvicodes('28650-0')
          //         //   console.log(height)
          //         //   console.log(notes)
          //         //   console.log(weight)
          //         // })
          //       })
          //     })
          //   }, function(error) { console.log(error) })

          // }, function(error) { console.log(error) })
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