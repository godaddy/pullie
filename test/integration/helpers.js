const assume = require('assume');
const request = require('request');

const helpers = {
  assumeValidResponse: function assumeValidResponse(url, expectedBody, done) {
    request(url, (err, res, body) => {
      assume(err).is.falsey();
      assume(res).hasOwn('statusCode', 200);
      assume(body).contains(expectedBody);

      done();
    });
  }
};

module.exports = helpers;
