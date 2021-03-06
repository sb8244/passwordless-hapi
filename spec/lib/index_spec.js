const Hapi = require('hapi');
const passwordlessPlugin = require('../../lib/index');
const passwordless = require('passwordless');
const MemoryStore = require('passwordless-memorystore');

passwordless.init(new MemoryStore());
passwordless.addDelivery((tokenToSend, uidToSend, recipient, callback) => {
  callback();
});

const serverOptions = {
  passwordless: passwordless,
  onSuccessfulAuth: function(reply) {
    reply.continue();
  },
  getUserId: function(user, delivery, callback, req) {
    callback(null, user);
  }
};

function createServer(serverOptions) {
  const server = new Hapi.Server();

  server.connection({
    host: 'localhost'
  });

  server.register({
    register: passwordlessPlugin,
    options: serverOptions
  });

  return server;
}

const server = createServer(serverOptions);

describe('POST /sendtoken', function() {
  beforeEach(function() {
    this.request = {
      method: 'POST',
      url: '/sendtoken',
      payload: {
        user: 'test@test.com',
        delivery: 'test'
      }
    };

    spyOn(passwordless._defaultDelivery, 'sendToken').and.callFake((tokenToSend, uidToSend, recipient, callback) => {
      this.deliveryArgs = { tokenToSend, uidToSend, recipient, callback };
      callback();
    });
    passwordless._defaultDelivery.sendToken.calls.reset();
  });

  it('is successful', function(done) {
    server.inject(this.request, function(response) {
      expect(response.statusCode).toEqual(200);
      done();
    });
  });

  it('queues the email delivery', function(done) {
    server.inject(this.request, (response) => {
      expect(passwordless._defaultDelivery.sendToken).toHaveBeenCalled();
      expect(this.deliveryArgs.recipient).toEqual("test@test.com");
      done();
    });
  });

  it('executes options.sendTokenSuccessHandler with passwordless', function(done) {
    function sendTokenSuccessHandler(request, reply) {
      reply.response().redirect('/' + request.passwordless.uidToAuth);
    }

    var optionedServer = createServer(Object.assign({}, serverOptions, { sendTokenSuccessHandler: sendTokenSuccessHandler }));

    optionedServer.inject(this.request, (response) => {
      expect(response.statusCode).toEqual(302);
      expect(response.headers.location).toEqual('/test@test.com');
      done();
    });
  });

  it('serves a 401 without a user', function(done) {
    this.request.payload.user = '';
    server.inject(this.request, (response) => {
      expect(response.statusCode).toEqual(401);
      expect(response.headers['www-authenticate']).toEqual('Provide a valid user');
      done();
    });
  });

  it('serves a 400 when user is false', function(done) {
    this.request.payload.user = false;
    server.inject(this.request, (response) => {
      expect(response.statusCode).toEqual(400);
      done();
    });
  });

  it('allows for sendTokenPath option', function(done) {
    var optionedServer = createServer(Object.assign({}, serverOptions, { sendTokenPath: '/newpath' }));
    this.request.url = '/newpath';
    optionedServer.inject(this.request, function(response) {
      expect(response.statusCode).toEqual(200);
      done();
    });
  });
});

describe('GET a known route with ?token&uid', function() {
  describe('with a valid token', function() {
    beforeEach(function(done) {
      this.request = {
        method: 'GET',
        url: '/404notfound?token=token&uid=1'
      };

      passwordless._tokenStore.storeOrUpdate("token", "1", 60 * 60 * 1000, undefined, done);
    });

    it('passes through to the hapi handler', function(done) {
      server.inject(this.request, (response) => {
        expect(response.statusCode).toEqual(404);
        done();
      });
    });

    it('can override the reply handler', function(done) {
      var optionedServer = createServer(Object.assign({}, serverOptions, { onSuccessfulAuth: function(reply) {
        reply.response().redirect("/test");
      }}));
      optionedServer.inject(this.request, (response) => {
        expect(response.statusCode).toEqual(302);
        done();
      });
    });

    it('fires off the onSuccessfulAuth function with the user id', function(done) {
      spyOn(serverOptions, "onSuccessfulAuth").and.callThrough();
      server.inject(this.request, (response) => {
        expect(serverOptions.onSuccessfulAuth).toHaveBeenCalled();
        expect(serverOptions.onSuccessfulAuth.calls.mostRecent().args[1]).toEqual('1');
        done();
      });
    });

    it('can not be used twice', function(done) {
      spyOn(serverOptions, "onSuccessfulAuth").and.callThrough();
      server.inject(this.request, (response) => {
        expect(serverOptions.onSuccessfulAuth).toHaveBeenCalled();
        expect(serverOptions.onSuccessfulAuth.calls.mostRecent().args[1]).toEqual('1');

        serverOptions.onSuccessfulAuth.calls.reset();
        server.inject(this.request, (response) => {
          expect(serverOptions.onSuccessfulAuth).not.toHaveBeenCalled();
          done();
        });
      });
    });
  });

  describe("with an invalid token", function() {
    beforeEach(function(done) {
      this.request = {
        method: 'GET',
        url: '/404notfound?token=invalid&uid=1'
      };

      passwordless._tokenStore.storeOrUpdate("token", "1", 60 * 60 * 1000, undefined, done);
    });

    it('passes through to the hapi handler', function(done) {
      server.inject(this.request, (response) => {
        expect(response.statusCode).toEqual(404);
        done();
      });
    });

    it('does not fire off the onSuccessfulAuth function', function(done) {
      spyOn(serverOptions, "onSuccessfulAuth");
      server.inject(this.request, (response) => {
        expect(serverOptions.onSuccessfulAuth).not.toHaveBeenCalled();
        done();
      });
    });
  });
});
