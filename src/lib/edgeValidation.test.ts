import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractBearerToken, isValidEmail, isValidUuid } from '../../supabase/functions/_shared/validation';

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
});
