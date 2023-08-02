Before starting the game, make sure click the "API Enable" button in client that needs to get API data.
Run ob.js within a nodejs server to handle data stream into google sheet.

Please update ob.js first with your webhook (line 10) connected to your google sheet

Server collects the 3 set of data in each 2 seconds, and send to client in different route
After  client receives any update of category of data mentioned above, it will update the 'gettotalplayerlist' data and send to local http server via post request
'PlayerBaseInfo' is sent via route A, 'PlayerRealTimeAPI' and 'PlayerAfterMatchAPI' is sent via route B.
The 2 routes dont affect each other, even the 3 sets of data are changed while server collecting client may receive each set of data in different timing. 

And it will use multiple times of post request though client receives multiple sets of data
