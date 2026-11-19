/**
 * File: frontend/js/config.js
 * Purpose: Central configuration for the AeroCast Cloud Weather Dashboard.
 *          Manages backend API endpoint resolution (Local Node proxy vs.
 *          Production AWS API Gateway URL) and non-sensitive app settings.
 * Security: NEVER store API keys or private credentials in this file.
 */

(function initAeroCastConfig(global) {
  'use strict';

  /**
   * Production AWS API Gateway URL (ap-south-1 Mumbai Region)
   */
  const PRODUCTION_API_URL =
    'https://nuxdtjo63k.execute-api.ap-south-1.amazonaws.com/weather';

  /**
   * Local development server endpoint (served by backend/local-server.mjs)
   */
  const LOCAL_API_URL = 'http://localhost:3000/weather';

  /**
   * Resolves the active backend weather endpoint based on where the frontend is running.
   * - Local development (localhost, 127.0.0.1, [::1], or file://) -> LOCAL_API_URL
   * - Deployed website (AWS S3, CloudFront, or custom domain) -> PRODUCTION_API_URL
   */
  function resolveApiEndpoint() {
    const hostname = (global.location?.hostname || '').toLowerCase();
    const protocol = (global.location?.protocol || '').toLowerCase();

    const isLocalEnvironment =
      protocol === 'file:' ||
      hostname === '' ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname.endsWith('.local');

    if (isLocalEnvironment) {
      return LOCAL_API_URL;
    }

    return PRODUCTION_API_URL;
  }

  const AeroCastConfig = Object.freeze({
    APP_NAME: 'AeroCast',
    DEFAULT_CITY: 'Jammu',
    DEFAULT_UNITS: 'metric', // 'metric' (°C, km/h) or 'imperial' (°F, mph)
    DEFAULT_THEME: 'dark',   // 'dark' or 'light'
    REQUEST_TIMEOUT_MS: 10000,

    API_ENDPOINT: resolveApiEndpoint(),
    LOCAL_API_URL,
    PRODUCTION_API_URL,

    STORAGE_KEYS: Object.freeze({
      THEME: 'aerocast_theme_preference',
      UNITS: 'aerocast_unit_preference',
      LAST_CITY: 'aerocast_last_city',
    }),
  });

  global.AeroCastConfig = AeroCastConfig;
})(window);
