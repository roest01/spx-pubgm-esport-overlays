var http = require("http");
var url = require('url');
var fs = require('fs');
var util = require('util');
const httpTransport = require('https');
const responseEncoding = 'utf8';
const httpOptions = {
    hostname: 'script.google.com',
    port: '443',
    path: '/macros/s/XXXXXXXXXX/exec',
    method: 'POST',
    headers: {"Content-Type":"application/json; charset=utf-8"}
};


Date.prototype.yyyymmdd = function() {
    var mm = this.getMonth() + 1; // getMonth() is zero-based
    var dd = this.getDate();

    return [this.getFullYear(),
        (mm>9 ? '' : '0') + mm,
        (dd>9 ? '' : '0') + dd
    ].join('');
};

function Datetime(){
    return new Date().toISOString(). replace(/T/, ' ').replace(/\..+/, '');
};

var logDir = 'log/';
if (!fs.existsSync(logDir)){
    fs.mkdirSync(logDir);
}

var logDate = new Date().yyyymmdd();
var logFilePath = logDir + 'log-' + logDate + '.txt';
var logFile = fs.createWriteStream(logFilePath, {flags : 'a'});
// var logStdout = process.stdout;

console.log = function() {
    logFile.write(util.format.apply(null, arguments) + '\r\n');
    // logStdout.write(util.format.apply(null, arguments) + '\r\n');
}
console.error = console.log;

var app = {};
app.allInfo = {};
app.isInGame = false;
app.observingPlayer = {};
app.killInfo = [];
app.gameGlobalInfo = {};
app.circleInfo = [];
app.teamreportdata = {};
app.playerreportdata = {};
app.playerweaponinfo = {};
app.playerweapondetailinfo = [];
app.teambackpackinfo = {};
app.allplayerthrowinfo = {};

let sendTimeout;
let lastUpdateTimestamp = 0;


app.sendToGoogle = function(data) {
    //send appinfo to google sheet
    console.log("run sendToGoogle")
    console.log(data);
    const request = httpTransport.request(httpOptions, (res) => {
        let responseBufs = [];
        let responseStr = '';

        res.on('data', (chunk) => {
            if (Buffer.isBuffer(chunk)) {
                responseBufs.push(chunk);
            }
            else {
                responseStr = responseStr + chunk;
            }
        }).on('end', () => {
            responseStr = responseBufs.length > 0 ?
                Buffer.concat(responseBufs).toString(responseEncoding) : responseStr;

            console.info("status code: " + res.statusCode)
        });

    })
        .setTimeout(0)
        .on('error', (error) => {
            console.error("97 ...",error);
        });

    request.write(data); //send to google sheet
    request.end();
}


app.totalmessage = function(request, response) {
    if (request.method == 'POST') {
        let body = '';

        request.on('data', chunk => {
            body += chunk.toString();
        });

        request.on('end', () => {
            let obj = JSON.parse(body);
            app.allInfo = obj
            console.info("got new data from pubgm");

            const currentTimestamp = new Date().getTime();
            // check if more than 3 sec. are gone
            if (currentTimestamp - lastUpdateTimestamp >= 3000) {
                console.info("send via 110");
                clearTimeout(sendTimeout); // For security, to avoid running multiple timeouts
                app.sendToGoogle(body); // call the function when 3 seconds have passed since the last update
                lastUpdateTimestamp = currentTimestamp;
            } else {
                console.info("currentTimestamp", currentTimestamp - lastUpdateTimestamp)
                // Starten oder Zurücksetzen des Timeouts, wenn weniger als 3 Sekunden seit dem letzten Update vergangen sind
                clearTimeout(sendTimeout);
                sendTimeout = setTimeout(() => {
                    console.info("match seems to be finished");
                    app.sendToGoogle(body);
                    setTimeout(() => {
                        try {
                            app.sendToGoogle("{ matchFinished: true }");
                        } catch (e) {
                            console.info(e);
                        }
                    }, 3000);
                }, 10000);
            }

            response.write('ok');
            response.end();
        });
    } else {
        response.end();
    }
}

app.getallinfo = function(request, response) {
    let ret = {}

    if (app.allInfo) {
        ret.allinfo = app.allInfo;
    }

    let resStr = JSON.stringify(ret);
    console.log(resStr);

    response.write(resStr);
    response.end();
}

app.gettotalplayerlist = function(request, response) {
    console.log("getTotalPlayerList");
    let ret = {}
    ret.playerInfoList = [];

    if (app.allInfo) {
        if (app.allInfo['TotalPlayerList']) {
            ret.playerInfoList = app.allInfo['TotalPlayerList']
        }
    }

    let resStr = JSON.stringify(ret);
    console.log(resStr);

    response.write(resStr);
    response.end();
}

app.getteaminfolist = function(request, response) {
    let ret = {}
    ret.teamInfoList = [];

    if (app.allInfo) {
        if (app.allInfo['TeamInfoList']) {
            ret.teamInfoList = app.allInfo['TeamInfoList']
        }
    }

    let resStr = JSON.stringify(ret);
    console.log(resStr);

    response.write(resStr);
    response.end();
}

app.setisingame = function(request, response) {
    if (request.method  == 'POST') {
        let body = '';

        request.on('data', chunk => {
            body += chunk.toString();
        });

        request.on('end', () => {
            app.isInGame = body == 'InGame'

            console.log(body);

            response.write('ok');
            response.end();
        });
    } else {
        response.end();
    }
}

app.isingame = function(request, response) {
    let ret = {}
    ret.isInGame = app.isInGame == true;

    let resStr = JSON.stringify(ret);
    console.log(resStr);

    response.write(resStr);
    response.end();
}

app.setobservingplayer = function(request, response) {
    if (request.method == 'POST') {
        let body = '';

        request.on('data', chunk => {
            body += chunk.toString();
        });

        request.on('end', () => {
            let obj = JSON.parse(body);
            app.observingPlayer = obj

            if (app.lastKnowObservingPlayer !== obj[0]){
                //update because it has changed
                try {
                    app.sendToGoogle(Buffer.from(JSON.stringify({observingPlayer:obj})));
                    console.info("updated observing player on google sheet", {observingPlayer:obj});
                    app.lastKnowObservingPlayer = obj[0];
                } catch (e) {
                    console.info("ERROR: observing player", e);
                }
            } else {
                // console.info("skip player because id " + obj[0] + " is the same like before: " + app.lastKnowObservingPlayer)
            }

            response.write('ok');
            response.end();
        });
    } else {
        response.end();
    }
}

app.getobservingplayer = function(request, response) {
    let ret = {}
    ret.observingPlayer = app.observingPlayer;

    let resStr = JSON.stringify(ret);
    console.log(resStr);

    response.write(resStr);
    response.end();
}

app.setkillinfo = function(request, response) {
    if (request.method == 'POST') {
        let body = '';

        request.on('data', chunk => {
            body += chunk.toString();
        });

        request.on('end', () => {
            let obj = JSON.parse(body);
            app.killInfo.unshift(obj);

            console.log(obj);

            response.write('ok');
            response.end();
        });
    } else {
        response.end();
    }
}

app.getkillinfo = function(request, response) {
    let ret = {}
    ret.killInfo = app.killInfo;

    let resStr = JSON.stringify(ret);
    console.log(resStr);

    response.write(resStr);
    response.end();
}

app.setgameglobalinfo = function(request, response) {
    if (request.method == 'POST') {
        let body = '';

        request.on('data', chunk => {
            body += chunk.toString();
        });

        request.on('end', () => {
            let obj = JSON.parse(body);
            app.gameGlobalInfo = obj;
            console.log(obj);

            response.write('ok');
            response.end();
        });
    } else {
        response.end();
    }
}

app.getgameglobalinfo = function(request, response) {
    let ret = {}
    ret.gameGlobalInfo = app.gameGlobalInfo;

    let resStr = JSON.stringify(ret);
    console.log(resStr);

    response.write(resStr);
    response.end();
}

app.setcircleinfo = function(request, response) {
    if (request.method == 'POST') {
        let body = '';

        request.on('data', chunk => {
            body += chunk.toString();
        });

        request.on('end', () => {
            let obj = JSON.parse(body);
            app.circleInfo = obj;
            console.log(obj);

            response.write('ok');
            response.end();
        });
    } else {
        response.end();
    }
}

app.getcircleinfo = function(request, response) {
    let ret = {}
    ret.circleInfo = app.circleInfo;

    let resStr = JSON.stringify(ret);
    console.log(resStr);

    response.write(resStr);
    response.end();
}

app.setteamreportdata = function(request, response) {
    if(request.method == "POST") {
        let body = '';

        request.on('data', chunk => {
            body += chunk.toString();
        });

        request.on('end', () => {
            let obj = JSON.parse(body);
            app.teamreportdata = obj;
            console.log(obj);

            response.write('ok');
            response.end();
        });
    } else {
        response.end();
    }
}

app.getteamreportdata = function(request, response) {
    let ret = {}
    ret.teamreportdata = app.teamreportdata;

    let resStr = JSON.stringify(ret);
    console.log(resStr);

    response.write(resStr);
    response.end();
}

app.setplayerreportdata = function(request, response) {
    if(request.method == "POST") {
        let body = '';

        request.on('data', chunk => {
            body += chunk.toString();
        });

        request.on('end', () => {
            let obj = JSON.parse(body);
            app.playerreportdata = obj;
            console.log(obj);

            response.write('ok');
            response.end();
        });
    } else {
        response.end();
    }
}

app.getplayerreportdata = function(request, response) {
    let ret = {}
    ret.playerreportdata = app.playerreportdata;

    let resStr = JSON.stringify(ret);
    console.log(resStr);

    response.write(resStr);
    response.end();
}

app.setplayerweaponinfo = function(request, response) {
    if(request.method == "POST") {
        let body = '';

        request.on('data', chunk => {
            body += chunk.toString();
        });

        request.on('end', () => {
            let obj = JSON.parse(body);
            app.playerweaponinfo = obj;
            console.log(obj);

            response.write('ok');
            response.end();
        });
    } else {
        response.end();
    }
}

app.getplayerweaponinfo = function(request, response) {
    let ret = {}
    ret.playerweaponinfo = app.playerweaponinfo;

    let resStr = JSON.stringify(ret);
    console.log(resStr);

    response.write(resStr);
    response.end();
}

app.setplayerweapondetailinfo = function(request, response) {
    if(request.method == "POST") {
        let body = '';
        request.on('data', chunk => {
            body += chunk.toString();
        });

        request.on('end', () => {
            let obj = JSON.parse(body);
            app.playerweapondetailinfo.unshift(obj);
            console.log(obj);

            response.write('ok');
            response.end();
        });
    } else {
        response.end();
    }
}

app.getplayerweapondetailinfo = function(request, response) {
    let ret = {}
    ret.playerweapondetailinfo = app.playerweapondetailinfo;

    let resStr = JSON.stringify(ret);
    console.log(resStr);

    response.write(resStr);
    response.end();
}

app.setteambackpackinfo = function(request, response) {
    if(request.method == "POST") {
        let body = '';

        request.on('data', chunk => {
            body += chunk.toString();
        });

        request.on('end', () => {
            let obj = JSON.parse(body);
            app.teambackpackinfo = obj;
            console.log(obj);

            response.write('ok');
            response.end();
        });
    } else {
        response.end();
    }
}

app.getteambackpackinfo = function(request, response) {
    let ret = {}
    ret.teambackpackinfo = app.teambackpackinfo;

    let resStr = JSON.stringify(ret);
    console.log(resStr);

    response.write(resStr);
    response.end();
}

app.setallplayerthrowinfo = function(request, response) {
    if(request.method == "POST") {
        let body = '';

        request.on('data', chunk => {
            body += chunk.toString();
        });

        request.on('end', () => {
            let obj = JSON.parse(body);
            app.allplayerthrowinfo = obj;
            console.log(obj);

            response.write('ok');
            response.end();
        });
    } else {
        response.end();
    }
}

app.getallplayerthrowinfo = function(request, response) {
    let ret = {}
    ret.allplayerthrowinfo = app.allplayerthrowinfo;

    let resStr = JSON.stringify(ret);
    console.log(resStr);

    response.write(resStr);
    response.end();
}

var httpserver = http.createServer(
    function(request,response){
        let clientRequestPath = url.parse(request.url).pathname;
        console.log(util.format('[%s] %s %s', Datetime(), request.method, clientRequestPath));

        let handle = app[clientRequestPath.substring(1, clientRequestPath.length)];
        if (handle) {
            handle(request, response);
        } else {
            console.log('[Error]: handle not found');
        }
    }
);

httpserver.listen(10086);

