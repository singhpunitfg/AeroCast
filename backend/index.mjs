/**
 * File: backend/index.mjs
 * Purpose: AWS Lambda handler function (Node.js 22 ES Module).
 *          Securely reads OPENWEATHER_API_KEY from environment variables,
 *          validates query parameters, fetches Current Weather and 5-Day/3-Hour
 *          Forecast concurrently via native fetch(), aggregates hourly & 5-day
 *          summaries, and returns a CORS-enabled JSON response.
 */

const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';
const VALID_UNITS = new Set(['metric', 'imperial', 'standard']);

/**
 * Standard CORS headers for Amazon API Gateway / local testing
 */
const CORS_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
  'Cache-Control': 'public, max-age=180', // Cache weather responses for 3 minutes
};

/**
 * Helper to build a standardized API Gateway HTTP response
 */
function buildResponse(statusCode, payload, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      ...CORS_HEADERS,
      ...extraHeaders,
    },
    body: JSON.stringify(payload),
  };
}

/**
 * Aggregates OpenWeather's 40 three-hour forecast slots into a 5-day daily summary
 * adjusted for the target city's timezone offset.
 */
function aggregateDailyForecast(forecastList, timezoneOffsetSeconds = 0) {
  if (!Array.isArray(forecastList) || forecastList.length === 0) {
    return [];
  }

  const daysMap = new Map();

  for (const item of forecastList) {
    // Shift UTC timestamp by city's timezone offset to group by local date
    const localDate = new Date((item.dt + timezoneOffsetSeconds) * 1000);
    const dateKey = localDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const localHour = localDate.getUTCHours();

    if (!daysMap.has(dateKey)) {
      daysMap.set(dateKey, {
        date: dateKey,
        dt: item.dt,
        tempMin: item.main.temp_min,
        tempMax: item.main.temp_max,
        humiditySum: item.main.humidity,
        windMax: item.wind?.speed ?? 0,
        popMax: item.pop ?? 0,
        count: 1,
        representativeWeather: item.weather?.[0] ?? null,
        closestHourDiffToNoon: Math.abs(localHour - 12),
      });
    } else {
      const entry = daysMap.get(dateKey);
      entry.tempMin = Math.min(entry.tempMin, item.main.temp_min);
      entry.tempMax = Math.max(entry.tempMax, item.main.temp_max);
      entry.humiditySum += item.main.humidity;
      entry.windMax = Math.max(entry.windMax, item.wind?.speed ?? 0);
      entry.popMax = Math.max(entry.popMax, item.pop ?? 0);
      entry.count += 1;

      // Pick the weather icon/condition closest to 12:00 PM local time for daytime representation
      const hourDiff = Math.abs(localHour - 12);
      if (hourDiff < entry.closestHourDiffToNoon && item.weather?.[0]) {
        // Force day icon ('d') if the slot is near midday so daily list looks consistent
        const rawIcon = item.weather[0].icon || '01d';
        entry.representativeWeather = {
          ...item.weather[0],
          icon: rawIcon.endsWith('n') && localHour >= 9 && localHour <= 16
            ? rawIcon.replace('n', 'd')
            : rawIcon,
        };
        entry.closestHourDiffToNoon = hourDiff;
      }
    }
  }

  const allDays = Array.from(daysMap.values()).map((day) => ({
    date: day.date,
    dt: day.dt,
    temp_min: Math.round(day.tempMin * 10) / 10,
    temp_max: Math.round(day.tempMax * 10) / 10,
    humidity: Math.round(day.humiditySum / day.count),
    wind_speed: Math.round(day.windMax * 10) / 10,
    pop: Math.round(day.popMax * 100), // Probability of precipitation in % (0 - 100)
    weather: day.representativeWeather,
  }));

  // Return up to 5 days
  return allDays.slice(0, 5);
}

/**
 * AWS Lambda Handler (compatible with Node.js 22.x and API Gateway v1/v2)
 */
export const handler = async (event = {}) => {
  try {
    // 1. Determine HTTP method (supports API Gateway REST v1, HTTP v2, and Function URLs)
    const httpMethod = (
      event.httpMethod ||
      event.requestContext?.http?.method ||
      'GET'
    ).toUpperCase();

    // Handle CORS Preflight requests immediately
    if (httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: CORS_HEADERS,
        body: '',
      };
    }

    if (httpMethod !== 'GET') {
      return buildResponse(405, {
        error: `Method ${httpMethod} not allowed. Use GET.`,
        code: 'METHOD_NOT_ALLOWED',
      }, { 'Cache-Control': 'no-store' });
    }

    // 2. Verify OpenWeather API Key in Environment Variables
    const apiKey = (process.env.OPENWEATHER_API_KEY || '').trim();
    if (!apiKey || apiKey === 'your_openweather_api_key_here') {
      return buildResponse(500, {
        error: 'Server configuration error: OPENWEATHER_API_KEY is not configured.',
        code: 'MISSING_API_KEY',
      }, { 'Cache-Control': 'no-store' });
    }

    // 3. Extract and validate query parameters
    const query = event.queryStringParameters || {};
    const rawCity = typeof query.city === 'string' ? query.city.trim() : '';
    const rawLat = query.lat !== undefined ? String(query.lat).trim() : '';
    const rawLon = query.lon !== undefined ? String(query.lon).trim() : '';
    const units = typeof query.units === 'string' && query.units.trim()
      ? query.units.trim().toLowerCase()
      : 'metric';

    if (!VALID_UNITS.has(units)) {
      return buildResponse(400, {
        error: "Invalid 'units' parameter. Allowed values: metric, imperial, standard.",
        code: 'INVALID_UNITS',
      }, { 'Cache-Control': 'no-store' });
    }

    let searchParams;

    if (rawCity) {
      if (rawCity.length > 100) {
        return buildResponse(400, {
          error: 'City name is too long (maximum 100 characters).',
          code: 'INVALID_CITY',
        }, { 'Cache-Control': 'no-store' });
      }
      searchParams = new URLSearchParams({
        q: rawCity,
        units,
        appid: apiKey,
      });
    } else if (rawLat !== '' && rawLon !== '') {
      const lat = Number(rawLat);
      const lon = Number(rawLon);
      if (
        Number.isNaN(lat) ||
        Number.isNaN(lon) ||
        lat < -90 ||
        lat > 90 ||
        lon < -180 ||
        lon > 180
      ) {
        return buildResponse(400, {
          error: 'Invalid coordinates. Latitude must be [-90, 90] and Longitude [-180, 180].',
          code: 'INVALID_COORDINATES',
        }, { 'Cache-Control': 'no-store' });
      }
      searchParams = new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
        units,
        appid: apiKey,
      });
    } else {
      return buildResponse(400, {
        error: "Missing location parameter. Provide either '?city=CityName' or '?lat=XX&lon=YY'.",
        code: 'MISSING_PARAMETERS',
      }, { 'Cache-Control': 'no-store' });
    }

    // 4. Fetch Current Weather and 5-Day/3-Hour Forecast concurrently
    const currentUrl = `${OPENWEATHER_BASE_URL}/weather?${searchParams.toString()}`;
    const forecastUrl = `${OPENWEATHER_BASE_URL}/forecast?${searchParams.toString()}`;

    const [currentResponse, forecastResponse] = await Promise.all([
      fetch(currentUrl, { signal: AbortSignal.timeout(8000) }),
      fetch(forecastUrl, { signal: AbortSignal.timeout(8000) }),
    ]);

    // 5. Handle upstream OpenWeather errors gracefully
    if (!currentResponse.ok) {
      let errorDetail = 'Failed to retrieve current weather data.';
      try {
        const errJson = await currentResponse.json();
        if (errJson?.message) {
          errorDetail = errJson.message;
        }
      } catch {
        // Ignore JSON parse fallback
      }

      if (currentResponse.status === 404) {
        return buildResponse(404, {
          error: `City "${rawCity || `${rawLat}, ${rawLon}`}" not found. Please check the spelling and try again.`,
          code: 'CITY_NOT_FOUND',
        }, { 'Cache-Control': 'no-store' });
      }

      if (currentResponse.status === 401) {
        return buildResponse(401, {
          error: 'OpenWeather API key is invalid or still activating (new keys can take up to 30-60 minutes to activate).',
          upstreamMessage: errorDetail,
          code: 'UNAUTHORIZED_API_KEY',
        }, { 'Cache-Control': 'no-store' });
      }

      if (currentResponse.status === 429) {
        return buildResponse(429, {
          error: 'Weather API rate limit exceeded. Please try again in a moment.',
          code: 'RATE_LIMITED',
        }, { 'Cache-Control': 'no-store' });
      }

      return buildResponse(502, {
        error: `Upstream weather service error: ${errorDetail}`,
        code: 'UPSTREAM_ERROR',
      }, { 'Cache-Control': 'no-store' });
    }

    const [currentData, forecastData] = await Promise.all([
      currentResponse.json(),
      forecastResponse.ok ? forecastResponse.json() : Promise.resolve({ list: [] }),
    ]);

    const timezoneOffset = currentData.timezone ?? forecastData?.city?.timezone ?? 0;
    const forecastList = Array.isArray(forecastData.list) ? forecastData.list : [];

    // 6. Build Hourly Forecast (Next 8 intervals = 24 hours)
    const hourly = forecastList.slice(0, 8).map((slot) => ({
      dt: slot.dt,
      dt_txt: slot.dt_txt,
      temp: slot.main?.temp,
      feels_like: slot.main?.feels_like,
      humidity: slot.main?.humidity,
      pressure: slot.main?.pressure,
      wind_speed: slot.wind?.speed ?? 0,
      wind_deg: slot.wind?.deg ?? 0,
      pop: Math.round((slot.pop ?? 0) * 100), // % probability of precipitation
      weather: slot.weather?.[0] ?? null,
    }));

    // 7. Build 5-Day Forecast Summary
    const daily = aggregateDailyForecast(forecastList, timezoneOffset);

    // 8. Construct unified payload for the frontend
    const payload = {
      location: {
        name: currentData.name,
        country: currentData.sys?.country || forecastData?.city?.country || '',
        coord: currentData.coord || forecastData?.city?.coord || { lat: 0, lon: 0 },
        timezone: timezoneOffset,
      },
      units,
      current: {
        dt: currentData.dt,
        temp: currentData.main?.temp,
        feels_like: currentData.main?.feels_like,
        temp_min: currentData.main?.temp_min,
        temp_max: currentData.main?.temp_max,
        pressure: currentData.main?.pressure,
        humidity: currentData.main?.humidity,
        sea_level: currentData.main?.sea_level,
        grnd_level: currentData.main?.grnd_level,
        visibility: currentData.visibility ?? 10000,
        wind_speed: currentData.wind?.speed ?? 0,
        wind_deg: currentData.wind?.deg ?? 0,
        wind_gust: currentData.wind?.gust ?? null,
        clouds: currentData.clouds?.all ?? 0,
        rain_1h: currentData.rain?.['1h'] ?? 0,
        snow_1h: currentData.snow?.['1h'] ?? 0,
        sunrise: currentData.sys?.sunrise,
        sunset: currentData.sys?.sunset,
        weather: currentData.weather?.[0] || {
          id: 800,
          main: 'Clear',
          description: 'clear sky',
          icon: '01d',
        },
      },
      hourly,
      daily,
      fetchedAt: new Date().toISOString(),
    };

    return buildResponse(200, payload);
  } catch (error) {
    const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return buildResponse(
      isTimeout ? 504 : 500,
      {
        error: isTimeout
          ? 'Request to weather provider timed out. Please try again.'
          : 'Internal server error while fetching weather data.',
        code: isTimeout ? 'UPSTREAM_TIMEOUT' : 'INTERNAL_ERROR',
      },
      { 'Cache-Control': 'no-store' }
    );
  }
};
