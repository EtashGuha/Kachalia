(function(window){
  window.extractData = function() {
    var ret = $.Deferred();

    function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    }

    function getAllNotes(obv, smart) {
      allNotes = []
      obv.forEach(reference => {
        allNotes.push(
          smart.fetchBinary(reference["content"][0]["attachment"]).then(newData => {
            newData.arrayBuffer().then(bitarray => {
              pdfjsLib.getDocument(bitarray).promise.then(function(pdf) {
                console.log(pdf.numPages)
                return getAllText(pdf).then(function(text) {
                  return text
                })
              })
            })
          })
        )
      })
      return Promise.all(allNotes).then(function(notes) {
        return notes
      })
    }

    function onReady(smart)  {
      if (smart.hasOwnProperty('patient')) {
        var pdfjsLib = window['pdfjs-dist/build/pdf'];

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

          var byCodes = smart.byCodes(obv, 'code');

          allNotes = []
          obv.forEach(reference => {
            allNotes.push(smart.fetchBinary(reference["content"][0]["attachment"]["url"]))
          })
          Promise.allSettled(allNotes).then(function(notes) {
            bitArrayPromises = []
            notes.forEach(note => {
              console.log(note.status)
              bitArrayPromises.push(note.arrayBuffer())
            })
            Promise.all(bitArrayPromises).then(function(bitarrays) {
              pdfjsPromises = []
              bitarrays.forEach(bitarray => {
                pdfjsPromises.push(pdfjsLib.getDocument(bitarray).promise)
              })
              Promise.all(pdfjsPromises).then(function(pdfs) {
                textPromises = []
                pdfs.forEach(pdf => {
                  textPromises.push(getAllText(pdf))
                })
                Promise.all(textPromises).then(texts => {
                  console.log(texts)
                })
              })
            }, function(error) { console.log(error) })

          }, function(error) { console.log(error) })

          ret.resolve("Working");
        });
      } else {
        onError();
      }
    }

    FHIR.oauth2.ready(onReady, onError);
    return ret.promise();

  };
  function wordFreq(string) {
    var words = string.replace(/[.]/g, '').split(/\s/);
    var freqMap = {};
    words.forEach(function(w) {
        if (!freqMap[w]) {
            freqMap[w] = 0;
        }
        freqMap[w] += 1;
    });

    return freqMap;
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