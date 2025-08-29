/**
 * A simple CORS proxy, for accessing API services which aren't CORS-enabled.
 * Receives requests from frontend, applies correct access control headers,
 * makes request to endpoint, then responds to the frontend with the response
 */

const axios = require('axios');
const { URL } = require('url');

// Define allow-list of permitted hostnames
const ALLOWED_HOSTNAMES = [
  'api.example.com',
  'service.example.net',
  // Add more hostnames as needed
];
module.exports = (req, res) => {
  // Apply allow-all response headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, PUT, PATCH, POST, DELETE');
  if (req.header('access-control-request-headers')) {
    res.header('Access-Control-Allow-Headers', req.header('access-control-request-headers'));
  }

  // Pre-flight
  if (req.method === 'OPTIONS') {
    res.send();
    return;
  }

  // Get desired URL, from Target-URL header
  const targetURL = req.header('Target-URL');
  if (!targetURL) {
    res.status(400).send({ error: 'Missing Target-URL header in the request' });
    return;
  let hostname;
  try {
    const parsed = new URL(targetURL);
    hostname = parsed.hostname;
  } catch (e) {
    res.status(400).send({ error: 'Invalid Target-URL format' });
    return;
  }
  if (!ALLOWED_HOSTNAMES.includes(hostname)) {
    res.status(403).send({ error: 'Target hostname is not allowed' });
    return;
  }
  }
  // Apply any custom headers, if needed
  const headers = req.header('CustomHeaders') ? JSON.parse(req.header('CustomHeaders')) : {};

  // Prepare the request
  const requestConfig = {
    method: req.method,
    url: targetURL,
    json: req.body,
    headers,
  };

  // Make the request, and respond with result
  axios.request(requestConfig)
    .then((response) => {
      res.status(200).send(response.data);
    }).catch((error) => {
      res.status(500).send({ error });
    });
};
