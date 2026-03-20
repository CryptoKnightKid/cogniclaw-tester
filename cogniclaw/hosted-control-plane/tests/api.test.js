const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const TEST_DATA_FILE = path.resolve(__dirname, '../src/data/test-control-plane.json');
try {
  fs.unlinkSync(TEST_DATA_FILE);
} catch (error) {
  // Ignore missing test database file.
}

process.env.APP_DATA_FILE = TEST_DATA_FILE;
process.env.APP_JWT_SECRET = 'test-secret';
process.env.APP_ENCRYPTION_KEY = 'test-encryption-key-012345678901234567890';
process.env.INTERNAL_API_KEY = 'test-internal-key';
process.env.OPENCLAW_CHANNEL_CAPABILITIES = 'discord,telegram,whatsapp';
process.env.S3_BUCKET = '';

const { createApp } = require('../src/app');

let server;
let baseUrl;

async function jsonRequest(path, options = {}) {
  const mergedHeaders = {
    'content-type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: mergedHeaders
  });

  const body = await response.json();
  return { response, body };
}

test.before(async () => {
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('signup -> login -> tenant endpoints work', async () => {
  const signup = await jsonRequest('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      organizationName: 'Alpha Org',
      email: 'owner@alpha.test',
      password: 'alpha-password-123'
    })
  });

  assert.equal(signup.response.status, 201);
  assert.ok(signup.body.token);

  const tenant = await jsonRequest('/tenant', {
    method: 'GET',
    headers: { authorization: `Bearer ${signup.body.token}` }
  });

  assert.equal(tenant.response.status, 200);
  assert.equal(tenant.body.tenant.slug, 'alpha-org');

  const login = await jsonRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'owner@alpha.test',
      password: 'alpha-password-123'
    })
  });

  assert.equal(login.response.status, 200);
  assert.ok(login.body.token);
});

test('tenant isolation prevents cross-tenant file access', async () => {
  const aSignup = await jsonRequest('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      organizationName: 'Tenant A',
      email: 'owner@a.test',
      password: 'tenant-a-password'
    })
  });

  const bSignup = await jsonRequest('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      organizationName: 'Tenant B',
      email: 'owner@b.test',
      password: 'tenant-b-password'
    })
  });

  const aUpload = await jsonRequest('/files/upload-url', {
    method: 'POST',
    headers: { authorization: `Bearer ${aSignup.body.token}` },
    body: JSON.stringify({
      fileName: 'contract.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024
    })
  });

  assert.equal(aUpload.response.status, 201);

  const bDownloadTry = await jsonRequest('/files/download-url', {
    method: 'POST',
    headers: { authorization: `Bearer ${bSignup.body.token}` },
    body: JSON.stringify({ fileId: aUpload.body.fileId })
  });

  assert.equal(bDownloadTry.response.status, 404);
  assert.match(bDownloadTry.body.error, /not found/i);
});

test('channel capability endpoint reflects configured capabilities', async () => {
  const signup = await jsonRequest('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      organizationName: 'Capabilities Inc',
      email: 'owner@cap.test',
      password: 'capabilities-password'
    })
  });

  const caps = await jsonRequest('/channels/capabilities', {
    method: 'GET',
    headers: { authorization: `Bearer ${signup.body.token}` }
  });

  assert.equal(caps.response.status, 200);
  assert.deepEqual(caps.body.capabilities.sort(), ['discord', 'telegram', 'whatsapp']);
});
