const assume = require('assume');
/** @type {(url: string, options?: RequestInit) => Promise<Response>} */
const fetch = require('node-fetch');

const helpers = {
  assumeValidResponse: async function assumeValidResponse(url, expectedBody) {
    const res = await fetch(url);
    assume(res.status).equals(200);
    const body = await res.text();
    assume(body).includes(expectedBody);
  }
};

module.exports = helpers;
