export interface PublicRuntimeConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
  defaultCitySlug: string;
  siteUrl: string;
  isConfigured: boolean;
  isProductionBuild: boolean;
  issues: string[];
}

const DEFAULT_SITE_URL = 'https://hello-sadiqabad-2bs.pages.dev';
const DEFAULT_CITY_SLUG = 'sadiqabad';

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidHttpUrl(value: string, allowLocalHttp: boolean): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return Boolean(url.hostname);
    return allowLocalHttp && url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

/**
 * Resolves only public browser configuration. Never pass service-role or secret
 * credentials to this function or expose them through VITE_* variables.
 */
export function resolvePublicRuntimeConfig(
  values: Record<string, unknown>
): PublicRuntimeConfig {
  const isProductionBuild = values.PROD === true || values.MODE === 'production';
  const allowLocalHttp = !isProductionBuild;
  const issues: string[] = [];

  const supabaseUrl = readString(values.VITE_SUPABASE_URL).replace(/\/+$/, '');
  const supabasePublishableKey = readString(values.VITE_SUPABASE_PUBLISHABLE_KEY);
  if (supabaseUrl && !isValidHttpUrl(supabaseUrl, allowLocalHttp)) {
    issues.push('VITE_SUPABASE_URL must be a valid HTTPS URL (localhost HTTP is allowed in development).');
  }
  if (supabaseUrl && !supabasePublishableKey) {
    issues.push('VITE_SUPABASE_PUBLISHABLE_KEY is required when Supabase URL is configured.');
  }

  const configuredUrlIsValid = Boolean(supabaseUrl && isValidHttpUrl(supabaseUrl, allowLocalHttp));
  const siteUrlInput = readString(values.VITE_SITE_URL);
  const siteUrl = siteUrlInput && isValidHttpUrl(siteUrlInput, allowLocalHttp)
    ? siteUrlInput.replace(/\/+$/, '')
    : DEFAULT_SITE_URL;
  if (siteUrlInput && !isValidHttpUrl(siteUrlInput, allowLocalHttp)) {
    issues.push('VITE_SITE_URL must be a valid HTTPS URL.');
  }

  const cityInput = readString(values.VITE_DEFAULT_CITY);
  const defaultCitySlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cityInput)
    ? cityInput
    : DEFAULT_CITY_SLUG;
  if (cityInput && defaultCitySlug !== cityInput) {
    issues.push('VITE_DEFAULT_CITY must be a lowercase URL slug.');
  }

  return {
    supabaseUrl: configuredUrlIsValid ? supabaseUrl : '',
    supabasePublishableKey: configuredUrlIsValid ? supabasePublishableKey : '',
    defaultCitySlug,
    siteUrl,
    isConfigured: configuredUrlIsValid && Boolean(supabasePublishableKey),
    isProductionBuild,
    issues,
  };
}
