# passwordless-hapi

passwordless-hapi is a very thin adapter over top of the passwordless express middleware.
It tries to use the base passwordless code and only change the way it interacts with
requests, replies, and session. Because of the difference in middleware between Express
and Hapi, some functionality feels slightly more awkward.

## Dependencies

The only dependency is passwordless. This library currently only aims to support 1.1.1, but
it may also work with previous versions. It technically is not constrainted by your Hapi version,
although it may not work with really old Hapi versions.

## Getting you started

The following should provide a quick-start in using Passwordless and Hapi. If you need more details check out the [example](https://github.com/florianheinemann/passwordless/tree/master/examples/simple-mail), the [deep dive](https://passwordless.net/deepdive), or the [documentation](https://passwordless.net/docs/Passwordless.html). Also, don't hesitate to raise comments and questions on [GitHub](https://github.com/florianheinemann/passwordless/issues).

### 1. Install the module:

Follow instructions on the [passwordless repo](https://github.com/florianheinemann/passwordless/blob/master/README.md#1-install-the-module)

`$ npm install passwordless-hapi --save`

### 2. Require the needed modules

Follow instructions on the [passwordless repo](https://github.com/florianheinemann/passwordless/blob/master/README.md#2-require-the-needed-modules)

### 3. Setup your delivery

Follow instructions on the [passwordless repo](https://github.com/florianheinemann/passwordless/blob/master/README.md#3-setup-your-delivery)

### 4. Initialize Passwordless

Follow instructions on the [passwordless repo](https://github.com/florianheinemann/passwordless/blob/master/README.md#4-initialize-passwordless)

### 5. Tell Passwordless how to deliver a token

Follow instructions on the [passwordless repo](https://github.com/florianheinemann/passwordless/blob/master/README.md#5-tell-passwordless-how-to-deliver-a-token)

### 6. Setup the hapi plugin

```
// This code is placed at your hapi server definition.
server.register({
  register: require('passwordless-hapi'),
  // All options are listed here
  options: {
    passwordless: passwordless, // your passwordless instance is required
    onSuccessfulAuth: function(reply, userId) { // anytime a successful validation occurs, this fires
      // perform operations with the user id, like persisting to session
      reply.continue(); // must be called if you want to pass through, otherwise handle the reply
    },
    getUserId: function(user, delivery, callback, req) { // the function that passwordless uses to validate users
      // usually you would want something like:
      User.find({email: user}, callback(ret) {
         if(ret)
            callback(null, ret.id)
         else
            callback(null, null)
      })
      // but you could also do the following
      // if you want to allow anyone:
      // callback(null, user);
    },
    sendTokenSuccessHandler: function(request, reply) {
      // Called after a successful call to sendToken. Advised is to redirect
      reply.response().redirect('/check-your-email');
    },
    sendTokenPath: '/sendtoken' // this is optional if you want to have a custom send token path
  }
});

```

### 7. The router

There is a bit of divergence here between the express and hapi version. Rather than
setting up middleware for you, the core functionality is handled by Hapi, and you don't
need to define custom routes.

### 8. Login page
All you need is a form where users enter their email address, for example:
```html
<html>
	<body>
		<h1>Login</h1>
		<form action="/sendtoken" method="POST">
			Email:
			<br><input name="user" type="text">
			<br><input type="submit" value="Login">
		</form>
	</body>
</html>
```
passwordless-hapi will look for a field called `user` submitted via POST.

### 9. Protect your pages

passwordless-hapi does not provide middleware to protect your pages. Instead, you can
write a server extension that uses session to check for a valid user id.

### 10. Who is logged in?

passwordless-hapi does not provide middleware on top of the request. You can access the
user via your preferred session management code.
