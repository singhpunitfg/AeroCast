/**
 * File: frontend/js/icons.js
 * Purpose: Custom scalable SVG weather illustrations and dynamic weather
 *          ambient theme mappings based on OpenWeather condition codes.
 */

(function initAeroCastIcons(global) {
  'use strict';

  let instanceCounter = 0;

  /**
   * Maps an OpenWeather weather object ({ id, main, description, icon })
   * to an internal icon key, CSS ambient theme key, and accessible label.
   */
  function resolveWeatherVisuals(weather = {}) {
    const code = Number(weather.id) || 800;
    const iconCode = typeof weather.icon === 'string' ? weather.icon : '01d';
    const isNight = iconCode.endsWith('n');
    const description = weather.description || weather.main || 'Weather condition';

    // 2xx: Thunderstorm
    if (code >= 200 && code < 300) {
      return {
        iconKey: 'thunderstorm',
        themeKey: 'thunderstorm',
        label: `Thunderstorm (${description})`,
      };
    }

    // 3xx: Drizzle
    if (code >= 300 && code < 400) {
      return {
        iconKey: 'drizzle',
        themeKey: 'rain',
        label: `Light drizzle (${description})`,
      };
    }

    // 5xx: Rain
    if (code >= 500 && code < 600) {
      return {
        iconKey: 'rain',
        themeKey: 'rain',
        label: `Rain (${description})`,
      };
    }

    // 6xx: Snow
    if (code >= 600 && code < 700) {
      return {
        iconKey: 'snow',
        themeKey: 'snow',
        label: `Snow (${description})`,
      };
    }

    // 7xx: Atmosphere (Mist, Smoke, Haze, Fog, Dust, Sand, Squall, Tornado)
    if (code >= 700 && code < 800) {
      return {
        iconKey: 'mist',
        themeKey: 'mist',
        label: `Atmospheric mist or fog (${description})`,
      };
    }

    // 800: Clear Sky
    if (code === 800) {
      return {
        iconKey: isNight ? 'clear-night' : 'clear-day',
        themeKey: isNight ? 'clear-night' : 'clear-day',
        label: isNight ? 'Clear night sky' : 'Clear sunny sky',
      };
    }

    // 801 - 802: Few / Scattered Clouds
    if (code === 801 || code === 802) {
      return {
        iconKey: isNight ? 'partly-cloudy-night' : 'partly-cloudy-day',
        themeKey: 'clouds',
        label: isNight ? `Partly cloudy night (${description})` : `Partly cloudy day (${description})`,
      };
    }

    // 803 - 804: Broken / Overcast Clouds
    return {
      iconKey: code === 804 ? 'overcast' : 'clouds',
      themeKey: 'clouds',
      label: `Cloudy sky (${description})`,
    };
  }

  /**
   * Returns raw SVG markup with unique gradient IDs for the given iconKey.
   */
  function buildSvgMarkup(iconKey, uid) {
    const sunGradId = `ac-sun-${uid}`;
    const moonGradId = `ac-moon-${uid}`;
    const cloudGradId = `ac-cloud-${uid}`;
    const darkCloudGradId = `ac-dcloud-${uid}`;
    const rainGradId = `ac-rain-${uid}`;

    const sharedDefs = `
      <defs>
        <linearGradient id="${sunGradId}" x1="16" y1="12" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FDE047" />
          <stop offset="100%" stop-color="#F59E0B" />
        </linearGradient>
        <linearGradient id="${moonGradId}" x1="18" y1="14" x2="46" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#E0E7FF" />
          <stop offset="100%" stop-color="#818CF8" />
        </linearGradient>
        <linearGradient id="${cloudGradId}" x1="14" y1="20" x2="50" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FFFFFF" />
          <stop offset="100%" stop-color="#CBD5E1" />
        </linearGradient>
        <linearGradient id="${darkCloudGradId}" x1="12" y1="18" x2="52" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#94A3B8" />
          <stop offset="100%" stop-color="#475569" />
        </linearGradient>
        <linearGradient id="${rainGradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#38BDF8" />
          <stop offset="100%" stop-color="#2563EB" />
        </linearGradient>
      </defs>
    `;

    switch (iconKey) {
      case 'clear-day':
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
          ${sharedDefs}
          <circle cx="32" cy="32" r="14" fill="url(#${sunGradId})" />
          <g stroke="#FBBF24" stroke-width="3" stroke-linecap="round">
            <line x1="32" y1="8" x2="32" y2="13" />
            <line x1="32" y1="51" x2="32" y2="56" />
            <line x1="8" y1="32" x2="13" y2="32" />
            <line x1="51" y1="32" x2="56" y2="32" />
            <line x1="15.03" y1="15.03" x2="18.56" y2="18.56" />
            <line x1="45.44" y1="45.44" x2="48.97" y2="48.97" />
            <line x1="48.97" y1="15.03" x2="45.44" y2="18.56" />
            <line x1="18.56" y1="45.44" x2="15.03" y2="48.97" />
          </g>
        </svg>`;

      case 'clear-night':
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
          ${sharedDefs}
          <path d="M41.5 39.2A16.5 16.5 0 0 1 24.8 16.5a16.5 16.5 0 1 0 22.7 22.7 16.4 16.4 0 0 1-6 0z" fill="url(#${moonGradId})" />
          <circle cx="46" cy="18" r="1.8" fill="#FDE047" />
          <circle cx="52" cy="27" r="1.3" fill="#E0E7FF" />
          <circle cx="17" cy="20" r="1.2" fill="#E0E7FF" />
        </svg>`;

      case 'partly-cloudy-day':
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
          ${sharedDefs}
          <circle cx="24" cy="24" r="10" fill="url(#${sunGradId})" />
          <g stroke="#FBBF24" stroke-width="2.5" stroke-linecap="round">
            <line x1="24" y1="8" x2="24" y2="11" />
            <line x1="8" y1="24" x2="11" y2="24" />
            <line x1="12.7" y1="12.7" x2="14.8" y2="14.8" />
            <line x1="35.3" y1="12.7" x2="33.2" y2="14.8" />
          </g>
          <path d="M22 48h23a10 10 0 0 0 1.2-19.92A14 14 0 0 0 19.3 25a11 11 0 0 0-8.3 10.7A11.3 11.3 0 0 0 22 48z" fill="url(#${cloudGradId})" />
        </svg>`;

      case 'partly-cloudy-night':
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
          ${sharedDefs}
          <path d="M31 25.5A11 11 0 0 1 20 11a11 11 0 1 0 14.5 14.5A10.9 10.9 0 0 1 31 25.5z" fill="url(#${moonGradId})" />
          <circle cx="44" cy="14" r="1.5" fill="#FDE047" />
          <path d="M22 49h23a10 10 0 0 0 1.2-19.92A14 14 0 0 0 19.3 26a11 11 0 0 0-8.3 10.7A11.3 11.3 0 0 0 22 49z" fill="url(#${cloudGradId})" />
        </svg>`;

      case 'clouds':
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
          ${sharedDefs}
          <path d="M20 47h25a11 11 0 0 0 1.4-21.9A15 15 0 0 0 17.2 22a12 12 0 0 0-9.2 11.7A12.3 12.3 0 0 0 20 47z" fill="url(#${cloudGradId})" />
        </svg>`;

      case 'overcast':
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
          ${sharedDefs}
          <path d="M27 39h21a8.5 8.5 0 0 0 1-16.9A11.5 11.5 0 0 0 26.5 19a9 9 0 0 0-7 8.8A9.2 9.2 0 0 0 27 39z" fill="url(#${darkCloudGradId})" opacity="0.85" />
          <path d="M18 49h24a10.5 10.5 0 0 0 1.3-20.9A14.2 14.2 0 0 0 16.5 25a11.2 11.2 0 0 0-8.5 11A11.5 11.5 0 0 0 18 49z" fill="url(#${cloudGradId})" />
        </svg>`;

      case 'drizzle':
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
          ${sharedDefs}
          <path d="M19 42h25a10.5 10.5 0 0 0 1.3-20.9A14.5 14.5 0 0 0 17 18a11.5 11.5 0 0 0-8.8 11.2A11.8 11.8 0 0 0 19 42z" fill="url(#${cloudGradId})" />
          <g stroke="#38BDF8" stroke-width="2.5" stroke-linecap="round">
            <line x1="23" y1="47" x2="21" y2="53" />
            <line x1="32" y1="47" x2="30" y2="53" />
            <line x1="41" y1="47" x2="39" y2="53" />
          </g>
        </svg>`;

      case 'rain':
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
          ${sharedDefs}
          <path d="M19 41h25a10.5 10.5 0 0 0 1.3-20.9A14.5 14.5 0 0 0 17 17a11.5 11.5 0 0 0-8.8 11.2A11.8 11.8 0 0 0 19 41z" fill="url(#${darkCloudGradId})" />
          <g stroke="url(#${rainGradId})" stroke-width="3" stroke-linecap="round">
            <line x1="22" y1="45" x2="19" y2="55" />
            <line x1="32" y1="45" x2="29" y2="57" />
            <line x1="42" y1="45" x2="39" y2="55" />
          </g>
        </svg>`;

      case 'thunderstorm':
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
          ${sharedDefs}
          <path d="M19 40h25a10.5 10.5 0 0 0 1.3-20.9A14.5 14.5 0 0 0 17 16a11.5 11.5 0 0 0-8.8 11.2A11.8 11.8 0 0 0 19 40z" fill="url(#${darkCloudGradId})" />
          <polygon points="33 36 25 48 32 48 29 58 41 44 34 44 33 36" fill="#FBBF24" />
          <g stroke="#38BDF8" stroke-width="2.5" stroke-linecap="round">
            <line x1="20" y1="45" x2="18" y2="52" />
            <line x1="44" y1="45" x2="42" y2="52" />
          </g>
        </svg>`;

      case 'snow':
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
          ${sharedDefs}
          <path d="M19 41h25a10.5 10.5 0 0 0 1.3-20.9A14.5 14.5 0 0 0 17 17a11.5 11.5 0 0 0-8.8 11.2A11.8 11.8 0 0 0 19 41z" fill="url(#${cloudGradId})" />
          <g fill="#BAE6FD">
            <circle cx="22" cy="48" r="2.5" />
            <circle cx="32" cy="52" r="2.5" />
            <circle cx="42" cy="48" r="2.5" />
            <circle cx="27" cy="56" r="2" />
            <circle cx="37" cy="56" r="2" />
          </g>
        </svg>`;

      case 'mist':
      default:
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
          ${sharedDefs}
          <path d="M21 36h22a9 9 0 0 0 1.1-17.9A12.5 12.5 0 0 0 19.5 15a10 10 0 0 0-7.5 9.7A10.2 10.2 0 0 0 21 36z" fill="url(#${cloudGradId})" opacity="0.88" />
          <g stroke="#94A3B8" stroke-width="3" stroke-linecap="round">
            <line x1="14" y1="43" x2="50" y2="43" />
            <line x1="18" y1="50" x2="46" y2="50" />
            <line x1="24" y1="57" x2="40" y2="57" />
          </g>
        </svg>`;
    }
  }

  /**
   * Safely parses static internal SVG markup into an SVGElement with accessible labels.
   */
  function createIconElement(weather = {}, options = {}) {
    instanceCounter += 1;
    const { iconKey, label } = resolveWeatherVisuals(weather);
    const svgString = buildSvgMarkup(iconKey, instanceCounter);

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgEl = doc.documentElement;

    if (options.accessible !== false) {
      svgEl.setAttribute('role', 'img');
      svgEl.setAttribute('aria-label', label);
    } else {
      svgEl.setAttribute('aria-hidden', 'true');
    }

    return svgEl;
  }

  global.AeroCastIcons = Object.freeze({
    resolveWeatherVisuals,
    createIconElement,
  });
})(window);
