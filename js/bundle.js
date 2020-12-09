(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function(window){
  window.extractData = function() {
    var ret = $.Deferred();

    function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    }

    function onReady(smart)  {
      if (smart.hasOwnProperty('patient')) {
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
          const pdfparse = require("pdf-parse")
          console.log(pdfparse)
          trueNotes = []
          var byCodes = smart.byCodes(obv, 'code');
          obv.forEach(reference => {            
            trueNotes.push(reference)    
            console.log(reference["content"][0]["attachment"])        
          })

          trueNotes.forEach(reference => {
            smart.fetchBinary(reference["content"][0]["attachment"]["url"]).then(newData => {
              newData.arrayBuffer().then(bitarray => {
                pdfparse(bitarray).then(function(pdfdata) {
                  console.log(pdfdata.text)
                })
              })
            })
          })
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
},{"pdf-parse":2}],2:[function(require,module,exports){
const Fs = require('fs');
const Pdf = require('./lib/pdf-parse.js');

module.exports = Pdf;

let isDebugMode = !module.parent; 

//process.env.AUTO_KENT_DEBUG


//for testing purpose
},{"./lib/pdf-parse.js":3,"fs":4}],3:[function(require,module,exports){
var PDFJS = null;

function render_page(pageData) {
    //check documents https://mozilla.github.io/pdf.js/
    //ret.text = ret.text ? ret.text : "";

    let render_options = {
        //replaces all occurrences of whitespace with standard spaces (0x20). The default value is `false`.
        normalizeWhitespace: false,
        //do not attempt to combine same line TextItem's. The default value is `false`.
        disableCombineTextItems: false
    }

    return pageData.getTextContent(render_options)
        .then(function(textContent) {
            let lastY, text = '';
            //https://github.com/mozilla/pdf.js/issues/8963
            //https://github.com/mozilla/pdf.js/issues/2140
            //https://gist.github.com/hubgit/600ec0c224481e910d2a0f883a7b98e3
            //https://gist.github.com/hubgit/600ec0c224481e910d2a0f883a7b98e3
            for (let item of textContent.items) {
                if (lastY == item.transform[5] || !lastY){
                    text += item.str;
                }  
                else{
                    text += '\n' + item.str;
                }    
                lastY = item.transform[5];
            }            
            //let strings = textContent.items.map(item => item.str);
            //let text = strings.join("\n");
            //text = text.replace(/[ ]+/ig," ");
            //ret.text = `${ret.text} ${text} \n\n`;
            return text;
        });
}

const DEFAULT_OPTIONS = {
    pagerender: render_page,
    max: 0,
    //check https://mozilla.github.io/pdf.js/getting_started/
    version: 'v1.10.100'
}

async function PDF(dataBuffer, options) {
    var isDebugMode = false;

    let ret = {
        numpages: 0,
        numrender: 0,
        info: null,
        metadata: null,
        text: "",
        version: null
    };

    if (typeof options == 'undefined') options = DEFAULT_OPTIONS;
    if (typeof options.pagerender != 'function') options.pagerender = DEFAULT_OPTIONS.pagerender;
    if (typeof options.max != 'number') options.max = DEFAULT_OPTIONS.max;
    if (typeof options.version != 'string') options.version = DEFAULT_OPTIONS.version;
    if (options.version == 'default') options.version = DEFAULT_OPTIONS.version;
    PDFJS = PDFJS ? PDFJS : require(`pdf.js/${options.version}/build/pdf.js`);

    ret.version = PDFJS.version;

    // Disable workers to avoid yet another cross-origin issue (workers need
    // the URL of the script to be loaded, and dynamically loading a cross-origin
    // script does not work).
    PDFJS.disableWorker = true;
    let doc = await PDFJS.getDocument(dataBuffer);
    ret.numpages = doc.numPages;

    let metaData = await doc.getMetadata().catch(function(err) {
        return null;
    });

    ret.info = metaData ? metaData.info : null;
    ret.metadata = metaData ? metaData.metadata : null;

    let counter = options.max <= 0 ? doc.numPages : options.max;
    counter = counter > doc.numPages ? doc.numPages : counter;

    ret.text = "";

    for (var i = 1; i <= counter; i++) {
        let pageText = await doc.getPage(i).then(pageData => options.pagerender(pageData)).catch((err)=>{
            // todo log err using debug
            debugger;
            return "";
        });

        ret.text = `${ret.text}\n\n${pageText}`;
    }

    ret.numrender = counter;
    doc.destroy();

    return ret;
}

module.exports = PDF;

},{}],4:[function(require,module,exports){

},{}]},{},[1]);
