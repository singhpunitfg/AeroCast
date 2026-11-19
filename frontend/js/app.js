/**
 * File: frontend/js/app.js
 * Purpose: Main application controller for AeroCast Cloud Weather Dashboard.
 *          Manages state, backend API communication, race-condition prevention,
 *          city search, geolocation, unit conversion, and theme persistence.
 */

(function initAeroCastApp(global) {
  'use strict';

  const Config = global.AeroCastConfig;
  const UI = global.AeroCastUI;

  /**
   * Application State
   */
  const state = {
    theme: Config.DEFAULT_THEME,
    units: Config.DEFAULT_UNITS,
    weatherData: null,
    lastQuery: { type: 'city', city: Config.DEFAULT_CITY },
    activeAbortController: null,
    requestSequence: 0,
  };

  /**
   * Safe localStorage read/write helpers
   */
  function getStoredValue(key, fallback) {
    try {
      const val = global.localStorage.getItem(key);
      return val !== null ? val : fallback;
    } catch {
      return fallback;
    }
  }

  function setStoredValue(key, value) {
    try {
      global.localStorage.setItem(key, value);
    } catch {
      // Ignore storage quota or privacy mode errors
    }
  }

  /**
   * Fetches weather telemetry from our backend endpoint with AbortController
   * race-condition protection.
   */
  async function fetchWeather(queryParams = {}, loadingLabel = '') {
    // Cancel any previous in-flight request to prevent race conditions
    if (state.activeAbortController) {
      state.activeAbortController.abort();
    }

    const abortController = new AbortController();
    state.activeAbortController = abortController;
    state.requestSequence += 1;
    const currentSeq = state.requestSequence;

    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, Config.REQUEST_TIMEOUT_MS);

    UI.showLoadingState(
      loadingLabel || 'Fetching live weather telemetry...',
      'Connecting to OpenWeather via Serverless API Gateway & Lambda'
    );

    try {
      const url = new URL(Config.API_ENDPOINT, global.location.origin);
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value).trim() !== '') {
          url.searchParams.set(key, String(value).trim());
        }
      });
      url.searchParams.set('units', state.units);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      // Ignore if a newer request was started after this one
      if (currentSeq !== state.requestSequence) {
        return null;
      }

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        throw new Error('Received an invalid JSON response from the weather server.');
      }

      if (!response.ok) {
        const serverError =
          payload?.error || `Weather service returned HTTP ${response.status}.`;
        const errorTitle =
          response.status === 404
            ? 'City Not Found'
            : response.status === 429
            ? 'Rate Limit Reached'
            : 'Unable to Load Weather Data';
        UI.showErrorState(errorTitle, serverError);
        return null;
      }

      state.weatherData = payload;
      if (payload?.location?.name) {
        setStoredValue(Config.STORAGE_KEYS.LAST_CITY, payload.location.name);
      }

      UI.renderWeatherDashboard(payload, state.units);
      return payload;
    } catch (error) {
      clearTimeout(timeoutId);

      // If aborted because a newer search was triggered, exit silently
      if (error?.name === 'AbortError' && currentSeq !== state.requestSequence) {
        return null;
      }

      if (error?.name === 'AbortError') {
        UI.showErrorState(
          'Request Timed Out',
          'The weather server took too long to respond. Please try again.'
        );
      } else {
        UI.showErrorState(
          'Connection Error',
          error?.message ||
            'Could not reach the backend weather server. Ensure local-server.mjs is running.'
        );
      }
      return null;
    } finally {
      if (currentSeq === state.requestSequence) {
        state.activeAbortController = null;
      }
    }
  }

  /**
   * Searches weather by city name
   */
  async function searchByCity(cityName) {
    const trimmed = typeof cityName === 'string' ? cityName.trim() : '';
    if (!trimmed) {
      UI.showErrorState('Empty Search', 'Please enter a valid city name to search.');
      return null;
    }

    state.lastQuery = { type: 'city', city: trimmed };
    return fetchWeather(
      { city: trimmed },
      `Fetching live weather for ${trimmed}...`
    );
  }

  /**
   * Searches weather by geographic coordinates (latitude & longitude)
   */
  async function searchByCoordinates(lat, lon) {
    state.lastQuery = { type: 'coords', lat, lon };
    return fetchWeather(
      { lat, lon },
      'Fetching weather for your current coordinates...'
    );
  }

  /**
   * Handles browser Geolocation API request
   */
  function handleGeolocationRequest() {
    const locateBtn = document.getElementById('location-btn');

    if (!global.navigator || !global.navigator.geolocation) {
      UI.showErrorState(
        'Geolocation Unsupported',
        'Your browser does not support geolocation. Please search by city name instead.'
      );
      return;
    }

    if (locateBtn) {
      locateBtn.classList.add('is-locating');
      locateBtn.disabled = true;
    }

    UI.showLoadingState(
      'Detecting your location...',
      'Requesting GPS coordinates from browser geolocation'
    );

    global.navigator.geolocation.getCurrentPosition(
      (position) => {
        if (locateBtn) {
          locateBtn.classList.remove('is-locating');
          locateBtn.disabled = false;
        }
        const lat = position.coords.latitude.toFixed(4);
        const lon = position.coords.longitude.toFixed(4);
        searchByCoordinates(lat, lon);
      },
      (geoError) => {
        if (locateBtn) {
          locateBtn.classList.remove('is-locating');
          locateBtn.disabled = false;
        }

        let message = 'Unable to retrieve your location. Please search for a city manually.';
        if (geoError.code === 1) {
          message =
            'Location permission was denied. Please allow location access in your browser settings or search by city.';
        } else if (geoError.code === 2) {
          message = 'Your current position is unavailable. Please search by city name.';
        } else if (geoError.code === 3) {
          message = 'Location request timed out. Please try again or search by city name.';
        }

        UI.showErrorState('Location Access Issue', message);
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 300000,
      }
    );
  }

  /**
   * Toggles temperature unit between Celsius ('metric') and Fahrenheit ('imperial')
   */
  function handleUnitToggle() {
    state.units = state.units === 'metric' ? 'imperial' : 'metric';
    setStoredValue(Config.STORAGE_KEYS.UNITS, state.units);
    UI.updateUnitToggleUI(state.units);

    if (state.weatherData) {
      UI.renderWeatherDashboard(state.weatherData, state.units);
    }
  }

  /**
   * Toggles theme between Dark ('dark') and Light ('light')
   */
  function handleThemeToggle() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    setStoredValue(Config.STORAGE_KEYS.THEME, state.theme);
    UI.applyTheme(state.theme);
  }

  /**
   * Retries the last attempted weather search
   */
  function handleRetry() {
    if (state.lastQuery?.type === 'coords') {
      searchByCoordinates(state.lastQuery.lat, state.lastQuery.lon);
    } else {
      const city = state.lastQuery?.city || Config.DEFAULT_CITY;
      searchByCity(city);
    }
  }

  /**
   * Binds all DOM event listeners
   */
  function bindEventListeners() {
    const searchForm = document.getElementById('search-form');
    const cityInput = document.getElementById('city-input');
    const clearBtn = document.getElementById('clear-search-btn');
    const locationBtn = document.getElementById('location-btn');
    const unitToggleBtn = document.getElementById('unit-toggle-btn');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const retryBtn = document.getElementById('error-retry-btn');
    const cityPills = document.querySelectorAll('.city-pill');

    if (searchForm && cityInput) {
      searchForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const query = cityInput.value.trim();
        if (query) {
          searchByCity(query);
          cityInput.blur();
        }
      });

      cityInput.addEventListener('input', () => {
        if (clearBtn) {
          clearBtn.hidden = cityInput.value.length === 0;
        }
      });
    }

    if (clearBtn && cityInput) {
      clearBtn.addEventListener('click', () => {
        cityInput.value = '';
        clearBtn.hidden = true;
        cityInput.focus();
      });
    }

    cityPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        const targetCity = pill.getAttribute('data-city');
        if (targetCity) {
          if (cityInput) {
            cityInput.value = targetCity;
          }
          if (clearBtn) {
            clearBtn.hidden = false;
          }
          searchByCity(targetCity);
        }
      });
    });

    if (locationBtn) {
      locationBtn.addEventListener('click', handleGeolocationRequest);
    }

    if (unitToggleBtn) {
      unitToggleBtn.addEventListener('click', handleUnitToggle);
    }

    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', handleThemeToggle);
    }

    if (retryBtn) {
      retryBtn.addEventListener('click', handleRetry);
    }
  }

  /**
   * Initializes preferences and loads Jammu as the initial default city
   */
  function init() {
    const savedTheme = getStoredValue(Config.STORAGE_KEYS.THEME, Config.DEFAULT_THEME);
    state.theme = savedTheme === 'light' ? 'light' : 'dark';
    UI.applyTheme(state.theme);

    const savedUnits = getStoredValue(Config.STORAGE_KEYS.UNITS, Config.DEFAULT_UNITS);
    state.units = savedUnits === 'imperial' ? 'imperial' : 'metric';
    UI.updateUnitToggleUI(state.units);

    bindEventListeners();

    // Load Jammu as the initial default city
    searchByCity(Config.DEFAULT_CITY);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.AeroCastApp = Object.freeze({
    searchByCity,
    searchByCoordinates,
    handleUnitToggle,
    handleThemeToggle,
    handleRetry,
    getState: () => ({ ...state }),
  });
})(window);
