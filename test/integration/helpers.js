import assume from 'assume';
/** @type {(url: string, options?: RequestInit) => Promise<Response>} */
import fetch from 'node-fetch';

export async function assumeValidResponse(url, expectedBody) {
  const res = await fetch(url);
  assume(res.status).equals(200);
  const body = await res.text();
  assume(body).includes(expectedBody);
}
