import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractBearerToken, hashRateKey, isValidEmail, isValidUuid, readJsonObject } from '../../supabase/functions/_shared/validation';

describe('Edge Function request validation helpers', () => {
  it('extracts bearer tokens case-insensitively and trims whitespace', () => {
    assert.equal(extractBearerToken('Bearer abc.def.ghi'), 'abc.def.ghi');
    assert.equal(extractBearerToken(' bearer   token-value  '), 'token-value');
    assert.equal(extractBearerToken(null), null);
    assert.equal(extractBearerToken('Basic token-value'), null);
    assert.equal(extractBearerToken('Bearer'), null);
  });

  it('accepts common valid email addresses and rejects malformed values', () => {
    assert.equal(isValidEmail('admin@example.com'), true);
    assert.equal(isValidEmail('owner.name+tag@example.co.uk'), true);
    assert.equal(isValidEmail('bad email@example.com'), false);
    assert.equal(isValidEmail('missing-at.example.com'), false);
    assert.equal(isValidEmail('missing-domain@'), false);
  });

  it('validates UUID structure', () => {
    assert.equal(isValidUuid('550e8400-e29b-41d4-a716-446655440000'), true);
    assert.equal(isValidUuid('not-a-uuid'), false);
    assert.equal(isValidUuid(null), false);
  });

  it('hashes rate-limit identities without exposing the original value', async () => {
    const first = await hashRateKey('business:phone:123456789');
    const second = await hashRateKey('business:phone:123456789');
    assert.equal(first, second);
    assert.match(first, /^[a-f0-9]{64}$/);
    assert.notEqual(first, 'business:phone:123456789');
  });

  it('accepts only bounded JSON objects', async () => {
    const valid = await readJsonObject(new Request('https://example.test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    }));
    assert.deepEqual(valid, { name: 'Test' });

    const array = await readJsonObject(new Request('https://example.test', {
      method: 'POST',
      body: '[]',
    }));
    assert.equal(array, null);

    const tooLarge = await readJsonObject(new Request('https://example.test', {
      method: 'POST',
      body: JSON.stringify({ data: 'x'.repeat(100) }),
    }), 32);
    assert.equal(tooLarge, null);
  });
});
