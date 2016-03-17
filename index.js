/* eslint-disable no-console */

var Promise = require('bluebird');
var request = require('request-promise');

var ROOT_URL = 'http://challenge.shopcurbside.com';
var SESSION_URL = ROOT_URL + '/get-session';

// bfsAsync :: (String) -> Promise(Null)
var bfsAsync = Promise.coroutine(function* (seed) {
  var fetch = client(ROOT_URL, SESSION_URL);

  var queue = [].concat(seed);
  var visited = [];
  var nodeCount = 0;

  var nodeId;
  
  while ((nodeId = queue.shift())) {
    if (nodeId === undefined) continue;
    visited.push(nodeId);
    var node = yield fetch(nodeId);

    // you sneakies...
    var normalized = Object.keys(node)
                     .map(function normalizeKeys (k) {
                       return [k.toLowerCase(), node[k]];
                     })
                     .reduce(function newObject (obj, kv) {
                       var key = kv[0],
                           val = kv[1];
                       obj[key] = val;
                       return obj;
                     }, {});
    

    if (normalized.next) {
      var children = [].concat(normalized.next);
      children.filter(child => ((child) && visited.indexOf(child) === -1))
      .forEach(child => queue.push(child));
    }

    if (normalized.secret) {
      process.stdout.write(normalized.secret);
    }
    
    nodeCount++;
  }

  console.log('\n\nFound %d total nodes', nodeCount);
});

var requestCount = 0;

// client :: (String, String) -> (String) -> Promise(Object)
function client (rootUrl, refreshUrl) {
  var currentSession;
  return function fetchAThing (id) {
    function makeHttpRequest (host, nodeId, sessionId) {
      requestCount += 1;
      return request({
        url: host + '/' + nodeId,
        transform: function (body, res) {
          if (/json/i.test(res.headers['content-type'])) {
            return JSON.parse(body);
          } else return body;
        },
        headers: {
          session: sessionId
        }
      })
      .catch(function refreshSession () {
        requestCount +=1;
        return request(refreshUrl)
               .then(function withNewSession (sessionId) {
                 currentSession = sessionId;
                 return request({
                   url: host + '/' + nodeId,
                   transform: function (body, res) {
                     if (/json/i.test(res.headers['content-type'])) {
                       return JSON.parse(body);
                     } else return body;
                   },
                   headers: {
                     session: currentSession
                   }
                 });
               });
      });
    }

    return makeHttpRequest(rootUrl, id, currentSession);
  };
}

// -- Main --
var t = 0;
('Printing one secret at a time, bfs...\n').split('').forEach(function (c) {
  setTimeout( () => process.stdout.write(c), 40 * (++t));
});

var start = process.hrtime();
bfsAsync('start').then(() => {
  var stop = process.hrtime(start);
  var time = stop[0] + stop[1] / 1e9;
  console.log('Made %d total http requests in %d seconds', requestCount, time);
})
.catch(console.error);
