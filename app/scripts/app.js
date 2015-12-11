/*global fetch*/
/*global way*/
/*global google*/
(function(window, $, way, undefined) {
  'use strict';
  var appContext = $('[data-app-name="araport-athaliana-master-accession-app"]');
  var curationAlert = $('#curationStatus',appContext);
  $('#collectionDatepicker',appContext).datetimepicker({format:'YYYY-MM-DD'});
  
  /* Generate Agave API docs */
  window.addEventListener('Agave::ready', function() {
    var Agave = window.Agave;
    var curationMap = {1:{'name':'test'}};
    var data,map,geoChartData,curMap,originalAccInfo,currentAccInfo,ix;
    
    /* setup databinding */
    way.registerBindings();
    way.watch('curationForm',function(value) {
        var changeRecord = getChangeRecord(originalAccInfo,value);
        $('.form-group',appContext).removeClass('has-success');
        $('.help-block',appContext).hide();
        var count = 0;
        for (var key in changeRecord) {
          if (key !== 'comment' && key !== 'curator') {
            count++;
          }
          var selector = '#'+key+'-group'; 
          $(selector,appContext).addClass('has-success');
          $(selector + ' .help-block',appContext).show();
        }
        $('#savebutton',appContext).prop('disabled',(count === 0 || originalAccInfo.id in curationMap));
        marker.setPosition({lat:parseFloat(value.latitude),lng:parseFloat(value.longitude)});
        curMap.setCenter(marker.getPosition());
    });
    
    /* setup map in popup */
    curMap = new google.maps.Map(document.getElementById('curMap'),{
      zoom: 4,
      center: {lat:-34.397, lng:150.644},
      mapTypeId: google.maps.MapTypeId.MAP
    });
    
    /* setup marker */
    var marker = new google.maps.Marker({
      position: {lat:-34.397, lng:150.644},
      map: curMap,
      draggable:true,
      title: 'Drag to new position'
    });
    marker.addListener('dragend', function() {
      var position = marker.getPosition();
      way.set('curationForm.latitude',position.lat());
      way.set('curationForm.longitude',position.lng());
    });
    
    
    /* initialise popup */
    $('#curationPopup',appContext).on('show.bs.modal', function (event) {
      curationAlert.attr('hidden');
      var button = $(event.relatedTarget);
      ix = button.data('data');
      var id = data.rows[ix][0];
      currentAccInfo = getRecordFromRow(data.columns,data.rows[ix]);
      originalAccInfo = getRecordFromRow(data.columns,data.rows[ix]);
      if (id in curationMap) {
        for (var key in curationMap[id]) {
          currentAccInfo[key] = curationMap[id][key];
        }
        $('#curationForm :input').prop('disabled', true);
        curationAlert.removeClass('alert-success alert-danger')
          .addClass('alert-warning')
          .text('Curation request already exists')
          .prop('hidden',false);
      } else {
        $('#curationForm :input').prop('disabled', false);
        curationAlert.prop('hidden',true);
      }
      way.set('curationForm',currentAccInfo);
      way.set('originalForm',originalAccInfo);
      marker.setPosition({lat:currentAccInfo.latitude,lng:currentAccInfo.longitude});  
    });
    
    
    /* correct map positioning */
    $('#curationPopup',appContext).on('shown.bs.modal', function () {
      google.maps.event.trigger(curMap, 'resize');
      curMap.setCenter(marker.getPosition());
    });
    
    /* handle tab change */
    $('a[data-toggle="tab"]',appContext).on('shown.bs.tab', function (e) {
      if (e.target.text==='Map') {
        var lastCenter=map.getCenter(); 
        google.maps.event.trigger(map, 'resize');
        map.setCenter(lastCenter);
      }
      else if (e.target.text ==='Geochart') {
        drawRegionsMap();
      }
    });
    
   
    /* save button clicked */
    $('#savebutton',appContext).click(function() {
      //validate
      var params = {'id':originalAccInfo.id};
      var curateService = {namespace:'gmi',service:'curate_master_accession_list_v0.1.0','queryParams':params};
      var changedRecord = getChangeRecord(originalAccInfo,currentAccInfo);
      for (var key in changedRecord) {
        params[key] = currentAccInfo[key];
      }
      Agave.api.adama.search(curateService,function(response) {
        curationAlert.prop('hidden',false);
        if (response.status === 'OK') {
          curationAlert.removeClass('alert-success').addClass('alert-danger').text('Curation request successfully submitted');
        } else {
          curationAlert.removeClass('alert-success').addClass('alert-danger').text('Curation request failed');
        }
        // display ok message and close popup and update record
      }, function(error) {
        // display error emssage
        console.log(error);
        curationAlert.removeClass('alert-success').addClass('alert-danger').text('Curation request failed');
      });
    });
    
   /* return which fields were changed */ 
   var getChangeRecord = function(original,changed) {
      var changeRecord = {};
      for (var key in changed) {
        if (changed[key] !== original[key]) {
          changeRecord[key] = true;
        } 
      }
      return changeRecord;
    };
    
    /* create key value pair to display in popup */
    var getRecordFromRow = function(columns,row) {
      var record = {};
      for (var i=0;i<columns.length;i++) {
        record[columns[i]] = row[i];
      }
      return record;
    };
    
    /* initialize fusion map */
    var initMap = function() {
      map = new google.maps.Map(document.getElementById('map'), {
        center: {lat: 51.47, lng: 15.8596804},
        zoom: 2
      });
    
      var layer = new google.maps.FusionTablesLayer({
        query: {
          select: '\'latitude\'',
          from: '16I6HWZd8PrvjlzvcKsCWShHii8RaMA_vux8sTQPI'
        }
      });
      layer.setMap(map);
    };
    
    /* initialize geochart */
    var drawRegionsMap = function() {
        var options = {};
        var chart = new google.visualization.GeoChart(document.getElementById('geochart'));
        chart.draw(google.visualization.arrayToDataTable(geoChartData), options);
    };
    
    /* create key/value map for geochart */
    var calculateGeoChart = function(data) {
      var freq = {};
      data.rows.map( function (a) { 
        if (a[2] in freq) {
          freq[a[2]] ++;
        } else {
          freq[a[2]] = 1;
        } 
      });
      geoChartData = [['Country','Frequency']];
      for(var country in freq) {
        geoChartData.push([country,freq[country]]);
      }
      google.load('visualization', '1.0', {'packages':['geochart'],callback:drawRegionsMap});
    };
    
    /* display the table */
    var showResults = function(json) {
      // show error message for invalid object
      if ( ! ( json && json.obj ) ) {
        $( '.results', appContext ).html( '<div class="alert alert-danger">Invalid response!</div>' );
        return;
      }
      data = json.obj.result[0];
      /* convert id to int */
      data.rows.forEach(function(part, index, theArray) {
        theArray[index][0] = parseInt(part[0]);
      });
      
      $('#table',appContext).DataTable({
        dom: 'Bfrtip',
        data: data.rows,
         buttons: ['pageLength','copy', 'csv','excel'],
         columns: [
           { type: 'numeric'},
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            {
              data: null,
              render: function(data, type, full, meta)  {
                var btnType = 'btn-default';
                var icon = 'pencil';
                if (data[0] in curationMap) {
                  type = 'btn-primary';
                  icon = 'info';
                }
                return '<button style="width:35.7188px;" class="btn btn-sm '+btnType+'" data-toggle="modal" data-target="#curationPopup" data-data="'+meta.row+'"><i style="font-size:16px" class="fa fa-'+icon+'" aria-hidden="true"></i></button>';
              },
              orderable:false
            }
           ]
      });
      initMap();
    };
    fetch('https://cdn.rawgit.com/Gregor-Mendel-Institute/araport-athaliana-master-accession-app/master/app/data.json').then(function(response) {
       return response.json();
    }).then(function(json) {
      showResults({obj:{result:[json]}});
      calculateGeoChart(data);
    });
    /*Agave.api.adama.list({namespace:'gmi',service:'master_accession_list_v0.1.0'},function(response) {
      showResults(response);
      calculateGeoChart(data);
    });*/
  });
  
  

})(window, jQuery,way);
