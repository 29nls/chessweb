const BODY_TIMEOUT_MS = 5000;

/**
 * Parses the request body as JSON.
 * Vercel serverless functions receive a raw Node.js req object;
 * this helper collects the stream and parses it.
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<unknown>}
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    const timeout = setTimeout(() => {
      reject(new Error('Request body timeout'));
    }, BODY_TIMEOUT_MS);

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      clearTimeout(timeout);
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });

    req.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

module.exports = { parseJsonBody };
