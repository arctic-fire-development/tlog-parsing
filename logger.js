#!/usr/bin/env node

/*
  Simple example that takes a command line provided serial port destination and routes the output to a file of the same name with .log appended to the port name.

  usage: node logger.js /dev/tty.usbserial <baudrate>

*/

var SerialPort = require("serialport"),
    fs = require("fs"),
    port = process.argv[2],
    baudrate = process.argv[3],
    active = false,
    MAVLink = require("mavlink_ardupilotmega_v1.0"),
    sprintf = require("sprintf-js").sprintf,
    stringify = require('node-stringify'),
    _ = require('underscore');


var uavSysId = 1;
var uavComponentId = 1;

var mavlinkParser = new MAVLink();

//var messages = fs.readFileSync(process.argv[2]);


// Example of doing cheap/fast log analysis here: we just want some values from mission items.
// mavlinkParser.on('MISSION_ITEM', function(message) {
//   console.log(sprintf('X %4.6f, Y %4.6f, Z %4.6f', message.x, message.y, message.z));
// });

// Example of converting the entire file at once
mavlinkParser.on('message', function(message) {
    var nonce = {};
    _.each(message.fieldnames, function(field) {
        nonce[field] = message[field]; // make a temp object with just the properties we want
    });
    console.log(message.name, ':', stringify(nonce));
});

//mavlinkParser.pushBuffer(messages);
//mavlinkParser.parseBuffer();


function attemptLogging(fd, port, baudrate) {
    if (!active) {
        fs.stat(port, function(err, stats) {
            if (!err) {
                active = true;

                var serialPort = new SerialPort.SerialPort(port, {
                    baudrate: baudrate
                });

                var requestDataStream = _.once(function() {
                    var request = new mavlink.messages.request_data_stream(
                        uavSysId, // target system
                        uavComponentId, // target component
                        mavlink.MAV_DATA_STREAM_ALL, // get all data streams
                        10, // rate, Hz
                        1 // start sending this stream (0=stop)
                    );
                    console.log('Requesting data streams at interval %d...', 10);
                    var buf = new Buffer(request.pack(1, 255, 1));
                    serialPort.write(buf);
                });


                serialPort.on("open", function(){
                    console.log("\n------------------------------------------------------------\nOpening SerialPort: " + target + " at " + Date.now() + "\n------------------------------------------------------------\n");
                    requestDataStream();
                });


                serialPort.on("data", function(data) {
                    fs.write(fd, data);
                    console.log(data);
                    mavlinkParser.parseBuffer(data);
                    console.log();
                });

                serialPort.on("close", function(data) {
                    active = false;
                    console.log("\n------------------------------------------------------------\nClosing SerialPort: " + target + " at " + Date.now() + "\n------------------------------------------------------------\n");
                });
            }
        });
    }
}

if (!port) {
    console.log("You must specify a serial port location.");
} else {
    var target = port.split("/");
    target = target[target.length - 1] + ".log";
    if (!baudrate) {
        baudrate = 57600;
    }
    fs.open("./" + target, 'w', function(err, fd) {
        setInterval(function() {
            if (!active) {
                try {
                    attemptLogging(fd, port, baudrate);
                } catch (e) {
                    // Error means port is not available for listening.
                    active = false;
                }
            }
        }, 500);
    });
}
