/**
 * File: frontend/js/ui.js
 * Purpose: Pure DOM rendering, unit conversions, theme switching, and visual
 *          telemetry updates for the AeroCast Weather Dashboard.
 * Security: Uses textContent, setAttribute, and replaceChildren — never unsafe innerHTML.
 */

(function initAeroCastUI(global) {
  'use strict';

  const Icons = global.AeroCastIcons;

  const WEEKDAYS_LONG = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS_SHORT = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const CARDINAL_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  /**
   * Cache DOM references by ID on first lookup
   */
  const dom = {};

  function getEl(id) {
    if (!dom[id]) {
      dom[id] = document.getElementById(id);
    }
    return dom[id];
  }

  /**
   * Converts a temperature between 'metric' (°C) and 'imperial' (°F)
   */
  function convertTemp(value, fromUnit = 'metric', toUnit = 'metric') {
    const num = Number(value);
    if (Number.isNaN(num)) {
      return 0;
    }
    if (fromUnit === toUnit) {
      return num;
    }
    if (fromUnit === 'metric' && toUnit === 'imperial') {
      return (num * 9) / 5 + 32;
    }
    if (fromUnit === 'imperial' && toUnit === 'metric') {
      return ((num - 32) * 5) / 9;
    }
    return num;
  }

  /**
   * Formats temperature rounded to integer
   */
  function formatTempValue(value, fromUnit, toUnit) {
    return String(Math.round(convertTemp(value, fromUnit, toUnit)));
  }

  /**
   * Converts wind speed from OpenWeather source unit ('metric' = m/s, 'imperial' = mph)
   * into display speed ('metric' -> km/h, 'imperial' -> mph).
   */
  function convertWindSpeed(speed, fromUnit = 'metric', toUnit = 'metric') {
    const val = Number(speed) || 0;
    const speedInMps = fromUnit === 'imperial' ? val / 2.236936 : val;
    if (toUnit === 'imperial') {
      return Math.round(speedInMps * 2.236936);
    }
    return Math.round(speedInMps * 3.6);
  }

  /**
   * Formats a UTC timestamp (seconds) into 12-hour local time at the target city
   */
  function formatCityTime(utcSeconds, timezoneOffsetSeconds = 0, includeMinutes = true) {
    if (!utcSeconds && utcSeconds !== 0) {
      return '--:--';
    }
    const localDate = new Date((Number(utcSeconds) + Number(timezoneOffsetSeconds)) * 1000);
    const hours24 = localDate.getUTCHours();
    const minutes = localDate.getUTCMinutes();
    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 || 12;

    if (!includeMinutes) {
      return `${hours12} ${period}`;
    }
    const paddedMin = String(minutes).padStart(2, '0');
    return `${hours12}:${paddedMin} ${period}`;
  }

  /**
   * Formats a full weekday + date + local time string for the hero section
   */
  function formatCityDateTime(utcSeconds, timezoneOffsetSeconds = 0) {
    const baseSeconds = utcSeconds || Math.floor(Date.now() / 1000);
    const localDate = new Date((Number(baseSeconds) + Number(timezoneOffsetSeconds)) * 1000);
    const weekday = WEEKDAYS_LONG[localDate.getUTCDay()];
    const month = MONTHS_SHORT[localDate.getUTCMonth()];
    const dayNum = localDate.getUTCDate();
    const timeStr = formatCityTime(baseSeconds, timezoneOffsetSeconds, true);
    return `${weekday}, ${month} ${dayNum} • ${timeStr}`;
  }

  /**
   * Formats latitude and longitude with N/S and E/W hemispheres
   */
  function formatCoordinates(coord = {}) {
    const lat = Number(coord.lat);
    const lon = Number(coord.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return '';
    }
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lon).toFixed(2)}°${lonDir}`;
  }

  /**
   * Converts wind degrees (0 - 360) into an 8-point cardinal direction
   */
  function degreesToCardinal(deg = 0) {
    const normalized = ((Number(deg) % 360) + 360) % 360;
    const index = Math.round(normalized / 45) % 8;
    return CARDINAL_DIRECTIONS[index];
  }

  /**
   * Applies Dark or Light theme to <html> and updates the meta theme-color
   */
  function applyTheme(theme = 'dark') {
    const normalized = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', normalized);

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', normalized === 'light' ? '#eef4fc' : '#070b16');
    }

    const themeBtn = getEl('theme-toggle-btn');
    if (themeBtn) {
      const nextThemeLabel = normalized === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
      themeBtn.setAttribute('aria-label', nextThemeLabel);
      themeBtn.setAttribute('title', nextThemeLabel);
    }
  }

  /**
   * Updates the °C / °F toggle button active indicator
   */
  function updateUnitToggleUI(unit = 'metric') {
    const unitBtn = getEl('unit-toggle-btn');
    const unitC = getEl('unit-c');
    const unitF = getEl('unit-f');

    if (unitBtn) {
      unitBtn.setAttribute('data-unit', unit);
    }
    if (unitC && unitF) {
      unitC.classList.toggle('is-active', unit === 'metric');
      unitF.classList.toggle('is-active', unit === 'imperial');
    }
  }

  /**
   * Highlights the matching quick-select city pill if applicable
   */
  function updateQuickCityPills(activeCityName = '') {
    const normalizedActive = activeCityName.trim().toLowerCase();
    const pills = document.querySelectorAll('.city-pill');
    pills.forEach((pill) => {
      const pillCity = (pill.getAttribute('data-city') || '').trim().toLowerCase();
      pill.classList.toggle('is-active', Boolean(normalizedActive && pillCity === normalizedActive));
    });
  }

  /**
   * Manages visibility of Loading, Error, Empty, and Main Dashboard sections
   */
  function showLoadingState(titleText = 'Fetching live weather telemetry...', subtitleText = '') {
    const loadingEl = getEl('loading-state');
    const loadingTitle = getEl('loading-title');
    const loadingSub = getEl('loading-subtitle');
    const errorEl = getEl('error-state');
    const emptyEl = getEl('empty-state');

    if (loadingTitle && titleText) {
      loadingTitle.textContent = titleText;
    }
    if (loadingSub) {
      loadingSub.textContent =
        subtitleText || 'Connecting to OpenWeather via Serverless API Gateway & Lambda';
    }
    if (loadingEl) {
      loadingEl.hidden = false;
    }
    if (errorEl) {
      errorEl.hidden = true;
    }
    if (emptyEl) {
      emptyEl.hidden = true;
    }
    document.body.classList.add('is-loading');
  }

  function showErrorState(titleText, messageText) {
    const loadingEl = getEl('loading-state');
    const errorEl = getEl('error-state');
    const errorTitle = getEl('error-title');
    const errorMsg = getEl('error-message');
    const emptyEl = getEl('empty-state');

    if (loadingEl) {
      loadingEl.hidden = true;
    }
    if (emptyEl) {
      emptyEl.hidden = true;
    }
    if (errorTitle) {
      errorTitle.textContent = titleText || 'Unable to load weather data';
    }
    if (errorMsg) {
      errorMsg.textContent =
        messageText || 'Please check the city name or verify your network connection.';
    }
    if (errorEl) {
      errorEl.hidden = false;
    }
    document.body.classList.remove('is-loading');
    updateFooterStatus(false, 'Weather request failed • Check city name or connection');
  }

  function showEmptyState() {
    const loadingEl = getEl('loading-state');
    const errorEl = getEl('error-state');
    const emptyEl = getEl('empty-state');
    const dashboardEl = getEl('dashboard-content');

    if (loadingEl) {
      loadingEl.hidden = true;
    }
    if (errorEl) {
      errorEl.hidden = true;
    }
    if (emptyEl) {
      emptyEl.hidden = false;
    }
    if (dashboardEl) {
      dashboardEl.hidden = true;
    }
    document.body.classList.remove('is-loading');
  }

  function showDashboardContent() {
    const loadingEl = getEl('loading-state');
    const errorEl = getEl('error-state');
    const emptyEl = getEl('empty-state');
    const dashboardEl = getEl('dashboard-content');

    if (loadingEl) {
      loadingEl.hidden = true;
    }
    if (errorEl) {
      errorEl.hidden = true;
    }
    if (emptyEl) {
      emptyEl.hidden = true;
    }
    if (dashboardEl) {
      dashboardEl.hidden = false;
    }
    document.body.classList.remove('is-loading');
  }

  /**
   * Updates footer status indicator
   */
  function updateFooterStatus(isOnline, statusMessage) {
    const dot = getEl('api-status-dot');
    const text = getEl('api-status-text');

    if (dot) {
      dot.classList.toggle('is-online', Boolean(isOnline));
      dot.classList.toggle('is-offline', !isOnline);
    }
    if (text && statusMessage) {
      text.textContent = statusMessage;
    }
  }

  /**
   * Renders the Main Weather Hero Card
   */
  function renderHeroSection(data, displayUnit) {
    const { location = {}, current = {}, daily = [], units: sourceUnit = 'metric' } = data;
    const unitSymbol = displayUnit === 'imperial' ? '°F' : '°C';
    const timezone = Number(location.timezone) || 0;

    // Location & Time
    const cityNameEl = getEl('city-name');
    const countryEl = getEl('country-code');
    const datetimeEl = getEl('local-datetime');
    const coordsEl = getEl('coordinates-label');

    if (cityNameEl) {
      cityNameEl.textContent = location.name || 'Unknown Location';
    }
    if (countryEl) {
      countryEl.textContent = location.country || '--';
      countryEl.hidden = !location.country;
    }
    if (datetimeEl) {
      datetimeEl.textContent = formatCityDateTime(current.dt, timezone);
    }
    if (coordsEl) {
      coordsEl.textContent = formatCoordinates(location.coord);
    }

    // Temperature & Weather Condition
    const currentTempEl = getEl('current-temp');
    const currentUnitEl = getEl('current-temp-unit');
    const conditionEl = getEl('weather-condition');
    const descriptionEl = getEl('weather-description');

    if (currentTempEl) {
      currentTempEl.textContent = formatTempValue(current.temp, sourceUnit, displayUnit);
    }
    if (currentUnitEl) {
      currentUnitEl.textContent = unitSymbol;
    }
    if (conditionEl) {
      conditionEl.textContent = current.weather?.main || 'Clear';
    }
    if (descriptionEl) {
      descriptionEl.textContent = current.weather?.description || 'Clear sky';
    }

    // High / Low / Feels-like / Clouds Pills
    const todayForecast = daily[0] || {};
    const rawHigh =
      todayForecast.temp_max !== undefined
        ? Math.max(Number(current.temp_max ?? current.temp), Number(todayForecast.temp_max))
        : current.temp_max ?? current.temp;
    const rawLow =
      todayForecast.temp_min !== undefined
        ? Math.min(Number(current.temp_min ?? current.temp), Number(todayForecast.temp_min))
        : current.temp_min ?? current.temp;

    const highEl = getEl('temp-high');
    const lowEl = getEl('temp-low');
    const heroFeelsEl = getEl('hero-feels-like');
    const heroCloudsEl = getEl('hero-cloud-cover');

    if (highEl) {
      highEl.textContent = `${formatTempValue(rawHigh, sourceUnit, displayUnit)}°`;
    }
    if (lowEl) {
      lowEl.textContent = `${formatTempValue(rawLow, sourceUnit, displayUnit)}°`;
    }
    if (heroFeelsEl) {
      heroFeelsEl.textContent = `${formatTempValue(current.feels_like, sourceUnit, displayUnit)}${unitSymbol}`;
    }
    if (heroCloudsEl) {
      heroCloudsEl.textContent = `${Math.round(Number(current.clouds) || 0)}%`;
    }

    // Hero Weather SVG Illustration & Dynamic Ambient Theme
    const heroIconContainer = getEl('hero-weather-icon');
    if (heroIconContainer && Icons) {
      const visuals = Icons.resolveWeatherVisuals(current.weather);
      document.documentElement.setAttribute('data-weather-theme', visuals.themeKey);
      heroIconContainer.setAttribute('aria-label', visuals.label);

      const svgEl = Icons.createIconElement(current.weather, { accessible: false });
      heroIconContainer.replaceChildren(svgEl);
    }

    // Last Updated Label
    const updatedEl = getEl('last-updated');
    if (updatedEl) {
      const fetchedDate = data.fetchedAt ? new Date(data.fetchedAt) : new Date();
      const timeFormatted = fetchedDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      updatedEl.textContent = `Updated at ${timeFormatted}`;
    }
  }

  /**
   * Renders the 8 Hourly Forecast Slots
   */
  function renderHourlyForecast(data, displayUnit) {
    const listEl = getEl('hourly-forecast-list');
    if (!listEl) {
      return;
    }

    const { hourly = [], location = {}, current = {}, units: sourceUnit = 'metric' } = data;
    const timezone = Number(location.timezone) || 0;
    const slotElements = listEl.querySelectorAll('.hourly-slot');

    slotElements.forEach((slotEl, index) => {
      const item = hourly[index];
      const timeEl = slotEl.querySelector('.hourly-time');
      const iconEl = slotEl.querySelector('.hourly-icon');
      const popEl = slotEl.querySelector('.hourly-pop');
      const tempEl = slotEl.querySelector('.hourly-temp');

      if (!item) {
        // Fallback if fewer than 8 slots are returned
        if (timeEl) timeEl.textContent = '--:--';
        if (tempEl) tempEl.textContent = '--°';
        if (popEl) popEl.hidden = true;
        if (iconEl && Icons) {
          iconEl.replaceChildren(Icons.createIconElement(current.weather, { accessible: false }));
        }
        return;
      }

      if (timeEl) {
        timeEl.textContent =
          index === 0 ? 'Now' : formatCityTime(item.dt, timezone, false);
      }

      if (iconEl && Icons) {
        const svgIcon = Icons.createIconElement(item.weather, { accessible: true });
        iconEl.replaceChildren(svgIcon);
      }

      if (popEl) {
        const popVal = Math.round(Number(item.pop) || 0);
        if (popVal > 0) {
          popEl.textContent = `${popVal}%`;
          popEl.hidden = false;
        } else {
          popEl.textContent = '0%';
          popEl.hidden = true;
        }
      }

      if (tempEl) {
        tempEl.textContent = `${formatTempValue(item.temp, sourceUnit, displayUnit)}°`;
      }
    });
  }

  /**
   * Renders the 5-Day Forecast Rows with relative temperature range bars
   */
  function renderDailyForecast(data, displayUnit) {
    const listEl = getEl('daily-forecast-list');
    if (!listEl) {
      return;
    }

    const { daily = [], units: sourceUnit = 'metric' } = data;
    const rowElements = listEl.querySelectorAll('.daily-row');

    // Compute overall 5-day min and max to scale the range bars accurately
    let overallMin = Infinity;
    let overallMax = -Infinity;

    daily.forEach((day) => {
      const minVal = convertTemp(day.temp_min, sourceUnit, displayUnit);
      const maxVal = convertTemp(day.temp_max, sourceUnit, displayUnit);
      if (minVal < overallMin) overallMin = minVal;
      if (maxVal > overallMax) overallMax = maxVal;
    });

    const totalSpan = Math.max(overallMax - overallMin, 1);

    rowElements.forEach((rowEl, index) => {
      const dayData = daily[index];
      const dayLabelEl = rowEl.querySelector('.daily-day');
      const iconEl = rowEl.querySelector('.daily-icon');
      const popEl = rowEl.querySelector('.daily-pop');
      const minEl = rowEl.querySelector('.daily-min');
      const maxEl = rowEl.querySelector('.daily-max');
      const fillEl = rowEl.querySelector('.range-fill');

      if (!dayData) {
        if (dayLabelEl) dayLabelEl.textContent = '---';
        if (minEl) minEl.textContent = '--°';
        if (maxEl) maxEl.textContent = '--°';
        if (popEl) popEl.hidden = true;
        return;
      }

      if (dayLabelEl) {
        if (index === 0) {
          dayLabelEl.textContent = 'Today';
        } else if (dayData.date) {
          const parts = dayData.date.split('-').map(Number);
          const dateObj = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
          dayLabelEl.textContent = WEEKDAYS_SHORT[dateObj.getUTCDay()] || dayData.date;
        } else {
          dayLabelEl.textContent = `Day ${index + 1}`;
        }
      }

      if (iconEl && Icons) {
        const svgIcon = Icons.createIconElement(dayData.weather, { accessible: true });
        iconEl.replaceChildren(svgIcon);
      }

      if (popEl) {
        const popVal = Math.round(Number(dayData.pop) || 0);
        if (popVal > 0) {
          popEl.textContent = `${popVal}%`;
          popEl.hidden = false;
        } else {
          popEl.textContent = '0%';
          popEl.hidden = true;
        }
      }

      const dayMin = convertTemp(dayData.temp_min, sourceUnit, displayUnit);
      const dayMax = convertTemp(dayData.temp_max, sourceUnit, displayUnit);

      if (minEl) {
        minEl.textContent = `${Math.round(dayMin)}°`;
      }
      if (maxEl) {
        maxEl.textContent = `${Math.round(dayMax)}°`;
      }

      if (fillEl) {
        const leftPct = Math.max(0, Math.min(90, ((dayMin - overallMin) / totalSpan) * 100));
        const widthPct = Math.max(8, Math.min(100 - leftPct, ((dayMax - dayMin) / totalSpan) * 100));
        fillEl.style.left = `${leftPct.toFixed(1)}%`;
        fillEl.style.width = `${widthPct.toFixed(1)}%`;
      }
    });
  }

  /**
   * Populates all 6 Telemetry Metric Cards
   */
  function renderMetricCards(data, displayUnit) {
    const { current = {}, location = {}, units: sourceUnit = 'metric' } = data;
    const unitSymbol = displayUnit === 'imperial' ? '°F' : '°C';
    const timezone = Number(location.timezone) || 0;

    // -----------------------------------------------------------------------
    // 1. Feels Like Card
    // -----------------------------------------------------------------------
    const feelsValueEl = getEl('feels-like-value');
    const feelsUnitEl = getEl('feels-like-unit');
    const feelsNoteEl = getEl('feels-like-note');

    const actualTempC = convertTemp(current.temp, sourceUnit, 'metric');
    const feelsTempC = convertTemp(current.feels_like, sourceUnit, 'metric');
    const diffC = feelsTempC - actualTempC;

    if (feelsValueEl) {
      feelsValueEl.textContent = formatTempValue(current.feels_like, sourceUnit, displayUnit);
    }
    if (feelsUnitEl) {
      feelsUnitEl.textContent = unitSymbol;
    }
    if (feelsNoteEl) {
      if (diffC >= 2) {
        feelsNoteEl.textContent = 'Humidity is making it feel warmer than the actual temperature.';
      } else if (diffC <= -2) {
        feelsNoteEl.textContent = 'Wind chill is making it feel cooler than the actual temperature.';
      } else {
        feelsNoteEl.textContent = 'Similar to the actual ambient temperature.';
      }
    }

    // -----------------------------------------------------------------------
    // 2. Humidity Card
    // -----------------------------------------------------------------------
    const humidityVal = Math.max(0, Math.min(100, Math.round(Number(current.humidity) || 0)));
    const humidityValueEl = getEl('humidity-value');
    const humidityBarEl = getEl('humidity-bar');
    const humidityNoteEl = getEl('humidity-note');

    if (humidityValueEl) {
      humidityValueEl.textContent = String(humidityVal);
    }
    if (humidityBarEl) {
      humidityBarEl.style.width = `${humidityVal}%`;
    }
    if (humidityNoteEl) {
      // Magnus approximation for dew point in °C
      const dewPointC = actualTempC - (100 - humidityVal) / 5;
      const dewPointDisplay = Math.round(convertTemp(dewPointC, 'metric', displayUnit));
      let comfortText = 'Comfortable moisture level';
      if (humidityVal >= 80) {
        comfortText = 'High humidity & moisture';
      } else if (humidityVal < 30) {
        comfortText = 'Dry air conditions';
      }
      humidityNoteEl.textContent = `${comfortText}. Dew point is ${dewPointDisplay}${unitSymbol}.`;
    }

    // -----------------------------------------------------------------------
    // 3. Wind Speed & Compass Card
    // -----------------------------------------------------------------------
    const windSpeedDisplay = convertWindSpeed(current.wind_speed, sourceUnit, displayUnit);
    const windUnitStr = displayUnit === 'imperial' ? 'mph' : 'km/h';
    const windDeg = Math.round(Number(current.wind_deg) || 0);
    const cardinal = degreesToCardinal(windDeg);

    const windValueEl = getEl('wind-speed-value');
    const windUnitEl = getEl('wind-speed-unit');
    const windDirEl = getEl('wind-direction-label');
    const windArrowEl = getEl('wind-compass-arrow');
    const windNoteEl = getEl('wind-note');

    if (windValueEl) {
      windValueEl.textContent = String(windSpeedDisplay);
    }
    if (windUnitEl) {
      windUnitEl.textContent = windUnitStr;
    }
    if (windDirEl) {
      windDirEl.textContent = `${cardinal} (${windDeg}°)`;
    }
    if (windArrowEl) {
      windArrowEl.style.transform = `rotate(${windDeg}deg)`;
    }
    if (windNoteEl) {
      if (current.wind_gust) {
        const gustDisplay = convertWindSpeed(current.wind_gust, sourceUnit, displayUnit);
        windNoteEl.textContent = `From ${cardinal} with gusts up to ${gustDisplay} ${windUnitStr}.`;
      } else if (windSpeedDisplay < 8) {
        windNoteEl.textContent = 'Calm to light surface air movement.';
      } else if (windSpeedDisplay < 25) {
        windNoteEl.textContent = `Gentle breeze blowing from the ${cardinal}.`;
      } else {
        windNoteEl.textContent = `Strong winds blowing from the ${cardinal}.`;
      }
    }

    // -----------------------------------------------------------------------
    // 4. Atmospheric Pressure Card
    // -----------------------------------------------------------------------
    const pressureHpa = Math.round(Number(current.pressure) || 1013);
    // Normalize 975 hPa - 1045 hPa onto 8% - 95% bar width
    const pressurePct = Math.max(8, Math.min(95, ((pressureHpa - 975) / 70) * 100));

    const pressureValueEl = getEl('pressure-value');
    const pressureBarEl = getEl('pressure-bar');
    const pressureNoteEl = getEl('pressure-note');

    if (pressureValueEl) {
      pressureValueEl.textContent = String(pressureHpa);
    }
    if (pressureBarEl) {
      pressureBarEl.style.width = `${pressurePct.toFixed(0)}%`;
    }
    if (pressureNoteEl) {
      let pressureDesc = 'Normal atmospheric pressure (1013 hPa std).';
      if (pressureHpa < 1005) {
        pressureDesc = 'Low pressure system (often associated with clouds or rain).';
      } else if (pressureHpa > 1022) {
        pressureDesc = 'High pressure system (stable, settled weather).';
      }
      pressureNoteEl.textContent = pressureDesc;
    }

    // -----------------------------------------------------------------------
    // 5. Visibility Card
    // -----------------------------------------------------------------------
    const rawVisibilityMeters = Number(current.visibility) || 10000;
    const visibilityValueEl = getEl('visibility-value');
    const visibilityUnitEl = getEl('visibility-unit');
    const visibilityNoteEl = getEl('visibility-note');

    if (displayUnit === 'imperial') {
      const miles = rawVisibilityMeters / 1609.34;
      if (visibilityValueEl) {
        visibilityValueEl.textContent = miles >= 6 ? String(Math.round(miles)) : miles.toFixed(1);
      }
      if (visibilityUnitEl) {
        visibilityUnitEl.textContent = 'mi';
      }
    } else {
      const km = rawVisibilityMeters / 1000;
      if (visibilityValueEl) {
        visibilityValueEl.textContent = Number.isInteger(km) ? String(km) : km.toFixed(1);
      }
      if (visibilityUnitEl) {
        visibilityUnitEl.textContent = 'km';
      }
    }

    if (visibilityNoteEl) {
      if (rawVisibilityMeters >= 9000) {
        visibilityNoteEl.textContent = 'Perfectly clear horizontal line of sight.';
      } else if (rawVisibilityMeters >= 4000) {
        visibilityNoteEl.textContent = 'Moderate visibility due to light haze or mist.';
      } else {
        visibilityNoteEl.textContent = 'Low visibility affected by mist, fog, or precipitation.';
      }
    }

    // -----------------------------------------------------------------------
    // 6. Sunrise & Sunset Solar Arc Card
    // -----------------------------------------------------------------------
    const sunriseSec = Number(current.sunrise) || 0;
    const sunsetSec = Number(current.sunset) || 0;
    const nowSec = Number(current.dt) || Math.floor(Date.now() / 1000);

    const sunriseEl = getEl('sunrise-time');
    const sunsetEl = getEl('sunset-time');
    const sunDotEl = getEl('sun-position-dot');
    const daylightNoteEl = getEl('daylight-note');

    if (sunriseEl) {
      sunriseEl.textContent = sunriseSec ? formatCityTime(sunriseSec, timezone, true) : '--:-- AM';
    }
    if (sunsetEl) {
      sunsetEl.textContent = sunsetSec ? formatCityTime(sunsetSec, timezone, true) : '--:-- PM';
    }

    if (sunDotEl && sunriseSec && sunsetSec && sunsetSec > sunriseSec) {
      // Compute progress t in [0, 1] along Quadratic Bézier curve M 20 56 Q 100 -10 180 56
      const rawProgress = (nowSec - sunriseSec) / (sunsetSec - sunriseSec);
      const t = Math.max(0, Math.min(1, rawProgress));
      const oneMinusT = 1 - t;

      // B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
      const cx = oneMinusT * oneMinusT * 20 + 2 * oneMinusT * t * 100 + t * t * 180;
      const cy = oneMinusT * oneMinusT * 56 + 2 * oneMinusT * t * -10 + t * t * 56;

      sunDotEl.setAttribute('cx', cx.toFixed(1));
      sunDotEl.setAttribute('cy', cy.toFixed(1));

      const isDaytime = nowSec >= sunriseSec && nowSec <= sunsetSec;
      sunDotEl.setAttribute('fill', isDaytime ? '#FBBF24' : '#818CF8');
    }

    if (daylightNoteEl && sunriseSec && sunsetSec && sunsetSec > sunriseSec) {
      const daylightSeconds = sunsetSec - sunriseSec;
      const hours = Math.floor(daylightSeconds / 3600);
      const mins = Math.round((daylightSeconds % 3600) / 60);
      const isDay = nowSec >= sunriseSec && nowSec <= sunsetSec;
      daylightNoteEl.textContent = `${isDay ? 'Daylight active' : 'Nighttime'} • ${hours}h ${mins}m total daylight today.`;
    }
  }

  /**
   * Master render function that updates the entire dashboard
   */
  function renderWeatherDashboard(data, displayUnit = 'metric') {
    if (!data || !data.current) {
      showErrorState('Invalid weather payload', 'Received an incomplete response from the server.');
      return;
    }

    showDashboardContent();
    updateUnitToggleUI(displayUnit);
    updateQuickCityPills(data.location?.name || '');

    renderHeroSection(data, displayUnit);
    renderHourlyForecast(data, displayUnit);
    renderDailyForecast(data, displayUnit);
    renderMetricCards(data, displayUnit);

    updateFooterStatus(
      true,
      `Serverless API Proxy Active • Live telemetry for ${data.location?.name || 'Location'}`
    );
  }

  global.AeroCastUI = Object.freeze({
    applyTheme,
    updateUnitToggleUI,
    updateQuickCityPills,
    showLoadingState,
    showErrorState,
    showEmptyState,
    showDashboardContent,
    updateFooterStatus,
    renderWeatherDashboard,
    convertTemp,
    convertWindSpeed,
  });
})(window);
