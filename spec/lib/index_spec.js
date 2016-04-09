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
  onSuccessfulAuth: function() {}
};

function createServer() {
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

const server = createServer();

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
});

describe('GET a known route with ?pwdless', function() {
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

    it('fires off the onSuccessfulAuth function with the user id', function(done) {
      spyOn(serverOptions, "onSuccessfulAuth");
      server.inject(this.request, (response) => {
        expect(serverOptions.onSuccessfulAuth).toHaveBeenCalledWith('1');
        done();
      });
    });

    it('can not be used twice', function(done) {
      spyOn(serverOptions, "onSuccessfulAuth");
      server.inject(this.request, (response) => {
        expect(serverOptions.onSuccessfulAuth).toHaveBeenCalledWith('1');

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
