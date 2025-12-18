/**
 * A simple CORS proxy, for accessing API services which aren't CORS-enabled.
 * Receives requests from frontend, applies correct access control headers,
 * makes request to endpoint, then responds to the frontend with the response
 */

const axios = require('axios');
const { URL } = require('url');
const punycode = require('punycode/'); // Punycode for IDN normalization
const dns = require('dns').promises;
const net = require('net');

// Define allow-list of permitted hostnames, normalized to lower-case punycode
const RAW_ALLOWED_HOSTNAMES = [
  'api.example.com',
  'service.example.net',
  // Add more hostnames as needed
];
const ALLOWED_HOSTNAMES = RAW_ALLOWED_HOSTNAMES.map(h =>
  punycode.toASCII(h.toLowerCase().replace(/\.+$/, '')) // Normalize and trim trailing dots
);
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
  let hostname = parsed.hostname || '';
  // Canonicalize for comparison: lower-case, punycode, remove trailing dots
  hostname = punycode.toASCII(hostname.toLowerCase().replace(/\.+$/, ''));
  if (!ALLOWED_HOSTNAMES.includes(hostname)) {
    res.status(403).send({ error: 'Target hostname is not allowed' });
    return;
  }

  // Prevent SSRF bypass via DNS: Block if hostname resolves to private/local IP
  function isPrivateAddress(ip) {
    // IPv4
    if (net.isIPv4(ip)) {
      if (ip.startsWith('10.') ||
          ip.startsWith('127.') ||
          ip.startsWith('169.254.') ||
          ip.startsWith('172.16.') || ip.startsWith('172.17.') || ip.startsWith('172.18.') || ip.startsWith('172.19.') ||
          ip.startsWith('172.2') || // covers 172.20-172.31. care: doesn't match 172.2[0-9].*
          ip.startsWith('192.168.') ) {
        return true;
      }
    }
    // IPv6
    if (net.isIPv6(ip)) {
      if (ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80')) {
        return true;
      }
    }
    return false;
  }

  // Do async DNS validation before proceeding
  return dns.lookup(hostname, { all: true }).then((addrs) => {
    if (addrs.some(a => isPrivateAddress(a.address))) {
      res.status(403).send({ error: 'Target hostname resolves to private/internal IP (not allowed)' });
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
    // Disallow path traversal in path (also catch URL-encoded traversal)
    const decodePath = decodeURIComponent(parsed.pathname);
    if (parsed.pathname.includes('..') || decodePath.includes('..')) {
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
    // Apply any custom headers, if needed; fail on parse error
    let headers = {};
    if (req.header('CustomHeaders')) {
      try {
        headers = JSON.parse(req.header('CustomHeaders'));
      } catch (e) {
        res.status(400).send({ error: 'Malformed CustomHeaders JSON' });
        return;
      }
    }

    // Prepare the request
    const requestConfig = {
      method: req.method,
      url: parsed.origin + parsed.pathname + parsed.search,
      data: req.body,
      headers,
    };

    // Make the request, and respond with result
    axios.request(requestConfig)
      .then((response) => {
        res.status(200).send(response.data);
      }).catch((error) => {
        res.status(500).send({ error });
      });
  }).catch((err) => {
    res.status(500).send({ error: 'DNS resolution failed' });
  });
  // Optionally, only allow default port
  if (parsed.port && parsed.port !== '443') {
    res.status(400).send({ error: 'Only default HTTPS port (443) is allowed' });
    return;
  }
  // Disallow path traversal in path (also catch URL-encoded traversal)
  const decodePath = decodeURIComponent(parsed.pathname);
  if (parsed.pathname.includes('..') || decodePath.includes('..')) {
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
  // Apply any custom headers, if needed; fail on parse error
  let headers = {};
  if (req.header('CustomHeaders')) {
    try {
      headers = JSON.parse(req.header('CustomHeaders'));
    } catch (e) {
      res.status(400).send({ error: 'Malformed CustomHeaders JSON' });
      return;
    }
  }

  // Prepare the request
  const requestConfig = {
    method: req.method,
    url: parsed.origin + parsed.pathname + parsed.search,
    data: req.body,
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
