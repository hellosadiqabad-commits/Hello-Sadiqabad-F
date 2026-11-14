import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePublicRuntimeConfig } from './runtimeConfig';

describe('resolvePublicRuntimeConfig', () => {
  it('uses safe defaults when no environment values are provided', () => {
    const config = resolvePublicRuntimeConfig({});
    assert.equal(config.isConfigured, false);
    assert.equal(config.defaultCitySlug, 'sadiqabad');
    assert.equal(config.siteUrl, 'https://hello-sadiqabad-2bs.pages.dev');
    assert.deepEqual(config.issues, []);
  });

  it('accepts a valid HTTPS Supabase URL and publishable key', () => {
    const config = resolvePublicRuntimeConfig({
      VITE_SUPABASE_URL: ' https://example.supabase.co/ ',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'public-key',
      VITE_SITE_URL: 'https://example.com/',
      VITE_DEFAULT_CITY: 'rahim-yar-khan',
      PROD: true,
    });
    assert.equal(config.isConfigured, true);
    assert.equal(config.supabaseUrl, 'https://example.supabase.co');
    assert.equal(config.siteUrl, 'https://example.com');
    assert.equal(config.defaultCitySlug, 'rahim-yar-khan');
    assert.deepEqual(config.issues, []);
  });

  it('rejects insecure non-local Supabase URLs in production', () => {
    const config = resolvePublicRuntimeConfig({
      VITE_SUPABASE_URL: 'http://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'public-key',
      MODE: 'production',
    });
    assert.equal(config.isConfigured, false);
    assert.equal(config.supabaseUrl, '');
    assert.ok(config.issues.some((issue) => issue.includes('VITE_SUPABASE_URL')));
  });

  it('allows localhost HTTP only outside production', () => {
    const dev = resolvePublicRuntimeConfig({
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'local-key',
      MODE: 'development',
    });
    const prod = resolvePublicRuntimeConfig({
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'local-key',
      MODE: 'production',
    });
    assert.equal(dev.isConfigured, true);
    assert.equal(prod.isConfigured, false);
  });

  it('reports missing publishable key without treating the client as configured', () => {
    const config = resolvePublicRuntimeConfig({ VITE_SUPABASE_URL: 'https://example.supabase.co' });
    assert.equal(config.isConfigured, false);
    assert.ok(config.issues.some((issue) => issue.includes('PUBLISHABLE_KEY')));
  });

  it('falls back from malformed site URL and city slug', () => {
    const config = resolvePublicRuntimeConfig({
      VITE_SITE_URL: 'javascript:alert(1)',
      VITE_DEFAULT_CITY: '../admin',
    });
    assert.equal(config.siteUrl, 'https://hello-sadiqabad-2bs.pages.dev');
    assert.equal(config.defaultCitySlug, 'sadiqabad');
    assert.equal(config.issues.length, 2);
  });
});
