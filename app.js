// App that listens to when users join the minecraft server

var express = require('express');
var fs = require('fs');
var request = require('request');
var _ = require('lodash');
var cheerio = require('cheerio');
var apn = require('apn');
var app = express();
var Q = require('q');

// Push Notification settings

var options = { 
  gateway:"gateway.sandbox.push.apple.com"
};

var apnConnection = new apn.Connection(options);
var myDevice = new apn.Device("6e990cbedb33b90e228037a93b88449a055f045ffcb9ab4cd4171a89769f6b85");

var minecraft = new Minecraft();

app.get('/', function(req, res){
  res.send(namesList);
});

app.get('/players', function(req, res){
  res.json({ players: namesList });
});

app.get('/time', function(req, res){
  res.json({ time: time });
});

app.get('/minecraft/:actions', function(req, res) {
  var actions = req.params.actions.split('-');
  var promises = [];
  _.each(actions, function(action) {
    if (!_.isUndefined(minecraft[action])) {
      promises.push(minecraft[action]());
    }
  });
  promises.push(minecraft.updatePlayers());
  Q.all(promises).fin(function() {
    var flag = _.reduce(_.pluck(_.take(promises, promises.length - 1), 'flag'), function(flag, f) {
      return flag || f;
    });
    var message;
    if (flag) {
      message = _.pluck(_.filter(promises, function(p) { return p.flag; }), 'message').join(', ');
      minecraft.messages[req.params.actions] = {message: message, flag: Math.random() * 1000000};
    } else if (_.isUndefined(minecraft.messages[req.params.actions])) {
      minecraft.messages[req.params.actions] = '';
    }
    res.json(minecraft.messages[req.params.actions]);
  })
});

function Minecraft() {
  this.url = 'http://nextcode.mit.edu:8123/up/world/world/1425315764073';
  this.namesList = [];
  this.isDay = null;
  this.time = null;
  this.joinedPlayers = [];
  this.leftPlayers = [];
  this.messages = {};
};

Minecraft.prototype.updatePlayers = function() {
  var defer = Q.defer();
  request(minecraft.url, function(error, response, json) {
    if(!error){
      out = JSON.parse(json);
      playersList = out.players;
      minecraft.namesList = _.pluck(playersList, 'name');
      defer.resolve(true);
    }
  });
  return defer.promise;
}

Minecraft.prototype.newUser = function() {
  var defer = Q.defer();
  request(minecraft.url, function(error, response, json) {
    if(!error){
      out = JSON.parse(json);
      playersList = out.players;
      var joinedPlayers = [];
      _.each(playersList, function(player) {
        if (!_.includes(minecraft.namesList, player.name)) {
          joinedPlayers.push(player.name);
        }
      });
      if (joinedPlayers.length > 0) {
        minecraft.joinedPlayers = joinedPlayers;
        defer.resolve({'message': 'Joined: ' + minecraft.joinedPlayers.join(','), 'flag': true});
      } else {
        defer.resolve({'message': 'Joined: ' + minecraft.joinedPlayers.join(','), 'flag': false});
      }
    }
  });
  return defer.promise;
};

Minecraft.prototype.leftUser = function() {
  var defer = Q.defer();
  request(minecraft.url, function(error, response, json) {
    if (!error) {
      out = JSON.parse(json);
      playersList = out.players;
      var leftPlayers = [];
      _.each(minecraft.namesList, function(player) {
        if (_.isUndefined(_.find(playersList, {'name': player}))) {
          leftPlayers.push(player);
        }
      });
      if (leftPlayers.length > 0) {
        minecraft.leftPlayers = leftPlayers;
        console.log('here');
        defer.resolve({'message': 'Left: ' + minecraft.leftPlayers.join(','), 'flag': true});
      } else {
        defer.resolve({'message': 'Left: ' + minecraft.leftPlayers.join(','), 'flag': false});
      }
    }
  });
  return defer.promise;
}

Minecraft.prototype.daytime = function() {
  var defer = Q.defer();
  request(minecraft.url, function(error, response, json) {
    if (!error) {
      out = JSON.parse(json);
      time = getMinecraftTime(out.servertime);
      if (time.day != minecraft.isDay) {
        minecraft.isDay = time.day
        if (time.day) {
          minecraft.time = 'Daytime!';
          defer.resolve({'message': 'Daytime!', 'flag': true});
        } else {
          minecraft.time = 'Nightime!';
          defer.resolve({'message': 'Daytime!', 'flag': false});
        }
      } else {
        defer.resolve({'message': 'Daytime!', 'flag': false});
      }
    }
  });
  return defer.promise;
}

Minecraft.prototype.nighttime = function() {
  var defer = Q.defer();
  request(minecraft.url, function(error, response, json) {
    if (!error) {
      out = JSON.parse(json);
      time = getMinecraftTime(out.servertime);
      if (time.day != minecraft.isDay) {
        minecraft.isDay = time.day
        if (time.day) {
          minecraft.time = 'Daytime!';
          defer.resolve({'message': 'Nightime!', 'flag': false});
        } else {
          minecraft.time = 'Nightime!';
          defer.resolve({'message': 'Nightime!', 'flag': true});
        }
      } else {
        defer.resolve({'message': 'Nightime!', 'flag': false});
      }
    }
  });
}

Minecraft.prototype.time = function() {
  var defer = Q.defer();
  request(minecraft.url, function(error, response, json) {
    if (!error) {
      out = JSON.parse(json);
      time = getMinecraftTime(out.servertime);
      if (time.day != minecraft.isDay) {
        minecraft.isDay = time.day
        if (time.day) {
          minecraft.time = 'Daytime!';
          defer.resolve({'message': 'Daytime!', 'flag': true});
        } else {
          minecraft.time = 'Nightime!';
          defer.resolve({'message': 'Nightime!', 'flag': true});
        }
      } else {
        defer.resolve({'message': minecraft.time, 'flag': false});
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

// setInterval(pingServer, 2000);

app.listen('8081')
console.log('Magic happens on port 8081');