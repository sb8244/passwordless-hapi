'use strict';

exports.register = function (server, options, next) {
  server.ext('onRequest', function(request, reply) {
    return handlePasswordlessAuth(request, reply, options);
  });

  server.route({
    method: 'POST',
    path: options.sendTokenPath || '/sendtoken',
    handler: sendTokenHandler(options)
  });

  next();
};

exports.register.attributes = {
  name: 'passwordless',
  version: '1.0.0'
};

/**
 * Adapt the acceptToken middleware
 *
 * Rather than writing to the session, a function point is provided which could be used
 */
function handlePasswordlessAuth(request, reply, options) {
  let reqAdapter = {
    query: request.query,
    session: {}
  };

  function finishRequest() {
    if (reqAdapter.session.passwordless) { // On successful validation, this is set
      options.onSuccessfulAuth(reqAdapter.session.passwordless);
    }
    reply.continue();
  };

  options.passwordless.acceptToken()(reqAdapter, {}, finishRequest);
}

/**
 * Adapt the requestToken middleware
 *
 * This uses the same delivery pipeline that passwordless provides
 */
function sendTokenHandler(options) {
  return function(request, reply) {
    var reqAdapter = {
      body: request.payload, // the body of the request is accessible via the payload
      method: request.method.toUpperCase() // hapi uses lower case methods
    };

    var response = {
      code: undefined,
      headers: {}
    };

    // Hapi does not support promise based middleware, so must build the request information and finish it
    function finishRequest() {
      if (reqAdapter.passwordless) {
        (options.sendTokenOnSuccess || function() {})(reqAdapter.passwordless);
      }

      const finalResponse = reply.response(); // only execute our request when "next" is called
      finalResponse.statusCode = response.code || resAdapter.statusCode;
      Object.keys(response.headers).forEach(function(header) {
        finalResponse.header(header, response.headers[header]);
      });
    }

    var resAdapter = {
      end: finishRequest,
      status: function(val) {
        response.code = val;

        return {
          send: finishRequest
        };
      },
      setHeader: function(key, value) {
        response.headers[key] = value;
      }
    };

    // Does not support
    // * failureRedirect
    // * allowGet
    // * next with an error
    options.passwordless.requestToken(options.getUserId)(reqAdapter, resAdapter, finishRequest);
  }
}
