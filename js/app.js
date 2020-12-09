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

          // trueNotes = []
          var byCodes = smart.byCodes(obv, 'code');
          // obv.forEach(reference => {            
          //   trueNotes.push(reference)    
          //   console.log(reference["content"][0]["attachment"])        
          // })

          // trueNotes.forEach(reference => {
          //   smart.fetchBinary(reference["content"][0]["attachment"]["url"]).then(newData => {
          //     newData.arrayBuffer().then(bitarray => {
          //       pdfjsLib.getDocument(bitarray).promise.then(function(pdf) {
          //         console.log(pdf.numPages)
          //         getAllText(pdf).then(function(text) {
          //           console.log(text)
          //         })
          //       })
          //     })
          //   })
          // })

          allNotes = []
          obv.forEach(reference => {
            allNotes.push(
              smart.fetchBinary(reference["content"][0]["attachment"]["url"]).then(newData => {
                newData.arrayBuffer().then(bitarray => {
                  pdfjsLib.getDocument(bitarray).promise.then(function(pdf) {
                    console.log(pdf.numPages)
                    console.log(allNotes)
                    return getAllText(pdf)
                  })
                })
              }, function(e) {return "error"})
            )
          })
          // Promise.all(allNotes).then(function(notes) {
          //   console.log(notes)
          // })
          console.log(allNotes.length)

          
          // getAllNotes(obv, smart).then(function(output) {
          //   console.log(output)
          // })
          var gender = patient.gender;

          var fname = '';
          var lname = '';

          if (typeof patient.name[0] !== 'undefined') {
            fname = patient.name[0].given.join(' ');
            lname = patient.name[0].family.join(' ');
          }
          console.log("BANANA")
          console.log("BANANA")
          var height = byCodes('8302-2');
          var systolicbp = getBloodPressureValue(byCodes('55284-4'),'8480-6');
          var diastolicbp = getBloodPressureValue(byCodes('55284-4'),'8462-4');
          var hdl = byCodes('2085-9');
          var ldl = byCodes('2089-1');

          var p = defaultPatient();
          p.birthdate = patient.birthDate;
          p.gender = gender;
          p.fname = fname;
          p.lname = lname;
          p.height = getQuantityValueAndUnit(height[0]);

          if (typeof systolicbp != 'undefined')  {
            p.systolicbp = systolicbp;
          }

          if (typeof diastolicbp != 'undefined') {
            p.diastolicbp = diastolicbp;
          }

          p.hdl = getQuantityValueAndUnit(hdl[0]);
          p.ldl = getQuantityValueAndUnit(ldl[0]);

          ret.resolve(p);
        });
      } else {
        onError();
      }
    }

    FHIR.oauth2.ready(onReady, onError);
    return ret.promise();

  };
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
  function defaultPatient(){
    return {
      fname: {value: ''},
      lname: {value: ''},
      gender: {value: ''},
      birthdate: {value: ''},
      height: {value: ''},
      systolicbp: {value: ''},
      diastolicbp: {value: ''},
      ldl: {value: ''},
      hdl: {value: ''},
    };
  }

  function getBloodPressureValue(BPObservations, typeOfPressure) {
    var formattedBPObservations = [];
    BPObservations.forEach(function(observation){
      var BP = observation.component.find(function(component){
        return component.code.coding.find(function(coding) {
          return coding.code == typeOfPressure;
        });
      });
      if (BP) {
        observation.valueQuantity = BP.valueQuantity;
        formattedBPObservations.push(observation);
      }
    });

    return getQuantityValueAndUnit(formattedBPObservations[0]);
  }

  function getQuantityValueAndUnit(ob) {
    if (typeof ob != 'undefined' &&
        typeof ob.valueQuantity != 'undefined' &&
        typeof ob.valueQuantity.value != 'undefined' &&
        typeof ob.valueQuantity.unit != 'undefined') {
          return ob.valueQuantity.value + ' ' + ob.valueQuantity.unit;
    } else {
      return undefined;
    }
  }

  window.drawVisualization = function(p) {
    $('#holder').show();
    $('#loading').hide();
    $('#fname').html(p.fname);
    $('#lname').html(p.lname);
    $('#gender').html(p.gender);
    $('#birthdate').html(p.birthdate);
    $('#height').html(p.height);
    $('#systolicbp').html(p.systolicbp);
    $('#diastolicbp').html(p.diastolicbp);
    $('#ldl').html(p.ldl);
    $('#hdl').html(p.hdl);
  };

})(window);