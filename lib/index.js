'use strict';

exports.register = function (server, options, next) {
  server.ext('onRequest', function(request, reply) {
    return handlePasswordlessAuth(request, reply, options);
  });

  server.route({
    method: 'POST',
    path: '/sendtoken',
    handler: sendTokenHandler(options)
  });

  next();
};

exports.register.attributes = {
  name: 'passwordless',
  version: '1.0.0'
};

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
    options.passwordless.requestToken(function(user, delivery, callback, req) {
      callback(null, user);
    })(reqAdapter, resAdapter, finishRequest);
  }
}
