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
  }
  let parsed;
  try {
    parsed = new URL(targetURL);
  } catch (e) {
    res.status(400).send({ error: 'Invalid Target-URL format' });
    return;
  }
  const hostname = parsed.hostname;
  if (!ALLOWED_HOSTNAMES.includes(hostname)) {
    res.status(403).send({ error: 'Target hostname is not allowed' });
    return;
  }
  // Only allow https protocol (could allow http if strictly necessary)
  if (parsed.protocol !== 'https:') {
    res.status(400).send({ error: 'Only HTTPS protocol is allowed' });
    return;
  }
  // Optionally, only allow default port
  if (parsed.port && parsed.port !== '443') {
    res.status(400).send({ error: 'Only default HTTPS port (443) is allowed' });
    return;
  }
  // Disallow path traversal in path
  if (parsed.pathname.includes('..')) {
    res.status(400).send({ error: 'Path traversal is not allowed in the URL path' });
    return;
  }
  // Optionally, reject URLs with userinfo
  if (parsed.username || parsed.password) {
    res.status(400).send({ error: 'User information in URL is not allowed' });
    return;
  }
  // Optionally, reject fragments
  if (parsed.hash && parsed.hash !== "") {
    res.status(400).send({ error: 'URL fragments are not allowed' });
    return;
  }
  // Apply any custom headers, if needed
  const headers = req.header('CustomHeaders') ? JSON.parse(req.header('CustomHeaders')) : {};

  // Prepare the request
  const requestConfig = {
    method: req.method,
    url: parsed.origin + parsed.pathname + parsed.search,
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
