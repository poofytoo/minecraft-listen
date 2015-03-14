// App that listens to when users join the minecraft server

var express = require('express');
var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var apn = require('apn');
var app = express();

// Push Notification settings

var options = { 
  gateway:"gateway.sandbox.push.apple.com"
};

var apnConnection = new apn.Connection(options);
var myDevice = new apn.Device("6e990cbedb33b90e228037a93b88449a055f045ffcb9ab4cd4171a89769f6b85");

var namesList = [];
var isDay = null;
var time = null;

app.get('/', function(req, res){
  res.send(namesList);
});

app.get('/players', function(req, res){
  res.json({ players: namesList });
});

app.get('/time', function(req, res){
  res.json({ time: time });
});


var url = 'http://nextcode.mit.edu:8123/up/world/world/1425315764073';
var pingServer = function() {
  request(url, function(error, response, json){
    if(!error){
      out = JSON.parse(json);

      msg = setTime(out.servertime) || '';

      playersList = out.players;
      joinedNames = [];
      namesListTemp = [];
      namesListCopy = namesList.slice(0);
      for (i in playersList) {
        playerName = playersList[i].name;
        namesListTemp.push(playerName)
        nameIndex = namesListCopy.indexOf(playerName);
        if (nameIndex == -1) {
          // player didn't exist before, joined player
          joinedNames.push(playerName); 
        } else {
          namesListCopy.splice(nameIndex, 1);
        }
      }
      leftNames = namesListCopy;
      namesList = namesListTemp.slice(0);
      if (joinedNames.length > 0) {
        msg += 'Joined: ' + joinedNames.join(', ');
        console.log(msg);
      }
      if (leftNames.length > 0) {
        msg = 'Left: ' + leftNames.join(', ');
        console.log(msg);
      }

      if (msg != '') {
        sendMessage(msg);
      }
    }
  });
}

var formatTime = function(time) {
  var formatDigits = function(n, digits) {
    var s = n.toString();
    while (s.length < digits) {
      s = '0' + s;
    }
    return s;
  }
  return formatDigits(time.hours, 2) + ':' + formatDigits(time.minutes, 2);
};

var timeout;

var setTime = function(servertime) {
  if (timeout != null) {
    clearTimeout(timeout);
    timeout = null;
  }
  if(servertime >= 0) {
    time = getMinecraftTime(servertime);
    if (time.day != isDay) {
      isDay = time.day
      if (isDay) {
        //sendMessage('Daytime!');
        return 'Daytime! ';

        console.log('Daytime!');
      } else {
        console.log('Nighttime!');
      }
    }

    //console.log(formatTime(time));
  }
  if ((timeout == null) && (time != null)) {
    timeout = setTimeout(function() {
      timeout = null;
      setTime(time.servertime+(1000/60));
    }, 700);
  }
};

function getMinecraftTime(servertime) {
  servertime = parseInt(servertime);
  var day = servertime >= 0 && servertime < 12500; 
  // not sure when sleeping actually begins

  return {
    servertime: servertime,
    days: parseInt((servertime+8000) / 24000),
    
    // Assuming it is day at 6:00
    hours: (parseInt(servertime / 1000)+6) % 24,
    minutes: parseInt(((servertime / 1000) % 1) * 60),
    seconds: parseInt(((((servertime / 1000) % 1) * 60) % 1) * 60),
    
    day: day,
    night: !day
  };
}

function sendMessage(message) {
  console.log('message sent')
  var note = new apn.Notification();

  note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
  note.badge = 1;
  note.sound = "default";
  note.alert = message;
  note.payload = {'messageFrom': 'S3 Alert Server'};
  apnConnection.pushNotification(note, myDevice);
}

setInterval(pingServer, 2000);

app.listen('8081')
console.log('Magic happens on port 8081');