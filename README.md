# AeroCast — Cloud-Hosted Weather Dashboard

**AeroCast** is a cloud-hosted, serverless weather intelligence dashboard built with semantic **HTML5**, glassmorphic **CSS3**, **Vanilla JavaScript (ES6+)**, and a serverless **AWS Lambda + Amazon API Gateway** backend powered by **Node.js 22.x**.

- **Live Frontend Demo (Netlify CDN):** https://sprightly-donut-c95ca9.netlify.app
- **Production Serverless API Endpoint (AWS API Gateway `ap-south-1`):** `https://nuxdtjo63k.execute-api.ap-south-1.amazonaws.com/weather`

---

## Key Features

- **Real-Time Weather & Multi-Day Forecasting:**
  - **Current Weather Hero Card:** Displays live temperature, weather condition label, custom SVG weather artwork, "feels like" temperature, daily high/low bounds, location badge, and timezone-accurate local clock.
  - **24-Hour Horizontal Forecast Strip:** 8 three-hour interval slots (`Now` + 7 upcoming intervals) with precipitation probability badges (`>= 10%`).
  - **5-Day Weather Outlook:** Timezone-adjusted daily minimum/maximum temperatures, representative daytime weather icons, and visual proportional temperature range bars.
- **6 Atmospheric Telemetry Cards:**
  - **Humidity:** Percentage display with dynamic progress bar and dew-point comfort commentary.
  - **Wind Speed & Direction:** Dual-unit speed (`km/h` or `mph`), gust speeds, cardinal direction readout, and a live CSS-rotated 360-degree compass needle.
  - **Barometric Pressure:** Atmospheric pressure in `hPa` with a normalized gauge (`980–1040 hPa`).
  - **Visibility:** Horizontal visibility distance in `km` or `mi` with clarity grading.
  - **Sunrise & Sunset:** Local sunrise/sunset timestamps, total daylight duration, and a sun-arc progress indicator.
  - **Cloudiness & Feels Like:** Cloud cover percentage and thermal comfort summary.
- **Dynamic Weather-Adaptive Glassmorphic UI:**
  - Apple Weather-inspired translucent glass cards (`backdrop-filter: blur()`).
  - Automatic ambient background theme shifting across 7 weather states (`clear`, `clouds`, `rain`, `thunderstorm`, `snow`, `mist`, and `night`).
  - **Dark / Light Theme Toggle** and **Celsius (`°C`) / Fahrenheit (`°F`) Unit Toggle** with `localStorage` persistence and zero redundant API calls on unit switch.
- **Location Discovery & Quick-Select Cities:**
  - Instant search for any global city, 5 quick-select city pills (*New Dehri, Tokyo, London, New York, Sydney*), and browser HTML5 Geolocation (`navigator.geolocation`) lookup.
- **Secure Serverless API Proxy:**
  - The OpenWeatherMap API key is stored strictly inside encrypted AWS Lambda environment variables (`OPENWEATHER_API_KEY`) and is never exposed to the browser client.

---

## Technologies Used

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Markup** | HTML5 | Semantic layout, ARIA live regions, accessible landmarks, and SVG graphic slots |
| **Frontend Styling** | CSS3 (`variables.css`, `style.css`) | Design tokens, Dark/Light themes, 7 weather ambient palettes, CSS Grid & Flexbox layout |
| **Frontend Logic** | Vanilla JavaScript (ES6+) | State management, dual-environment API detection, unit conversion, and safe DOM rendering |
| **Frontend Hosting** | Netlify Global HTTPS CDN | Edge-cached static asset hosting with automatic TLS/HTTPS |
| **API Ingress** | Amazon API Gateway (HTTP API) | Public HTTPS REST ingress (`GET /weather`) in `ap-south-1` (Mumbai) |
| **Serverless Compute** | AWS Lambda (`Node.js 22.x`) | Concurrent OpenWeatherMap querying, 5-day forecast aggregation, and secret isolation |
| **Cloud Storage** | Amazon S3 | Cloud static asset bucket provisioning |
| **External Data API** | OpenWeatherMap REST API v2.5 | Upstream `/data/2.5/weather` and `/data/2.5/forecast` meteorological data provider |

---

## Cloud Architecture & Request Flow

```text
+-------------------------------------------------------------------------+
|                        CLIENT BROWSER (HTTPS)                           |
|   Hosted on Netlify CDN: https://sprightly-donut-c95ca9.netlify.app     |
|   [index.html]  [variables.css / style.css]  [config / icons / ui / app]|
+------------------------------------+------------------------------------+
                                     |
                                     | 1. HTTPS GET /weather?city=Tokyo&units=metric
                                     v
+-------------------------------------------------------------------------+
|               AMAZON API GATEWAY (HTTP API - ap-south-1)                |
|   API Name: weatherAPI                                                  |
|   Endpoint: https://nuxdtjo63k.execute-api.ap-south-1.amazonaws.com     |
+------------------------------------+------------------------------------+
                                     |
                                     | 2. AWS Proxy Event Invocation (payload v2.0)
                                     v
+-------------------------------------------------------------------------+
|                    AWS LAMBDA (Node.js 22.x ES Module)                  |
|   Function: aerocast-weather-api   |   Handler: index.handler           |
|   Env Var : OPENWEATHER_API_KEY (Encrypted at rest via AWS KMS)         |
|   - Validates query parameters (?city= or ?lat=&lon=, &units=)          |
|   - Executes concurrent Promise.all() upstream HTTPS requests           |
|   - Aggregates 40 x 3-hour slots into 8 hourly + 5 daily summaries      |
+------------------------------------+------------------------------------+
                                     |
                                     | 3. Concurrent HTTPS Fetch (Promise.all)
                                     v
+-------------------------------------------------------------------------+
|                     OPENWEATHERMAP REST API (v2.5)                      |
|   - GET /data/2.5/weather   (Current weather conditions)                |
|   - GET /data/2.5/forecast  (5-day / 3-hour forecast intervals)         |
+-------------------------------------------------------------------------+
```

### End-to-End Request Lifecycle

1. **Client Environment Detection:** On startup, [`frontend/js/config.js`](frontend/js/config.js) inspects `window.location.hostname`. When running on `localhost` or `127.0.0.1`, requests route to `http://localhost:3000/weather`; in production, requests route automatically to `https://nuxdtjo63k.execute-api.ap-south-1.amazonaws.com/weather`.
2. **API Gateway Ingress:** Amazon API Gateway receives the `GET /weather` request over TLS and forwards the query parameters (`city` or `lat`/`lon`, plus `units`) to AWS Lambda using payload format version `2.0`.
3. **Serverless Execution & Aggregation:** [`backend/index.mjs`](backend/index.mjs) validates the parameters, reads `process.env.OPENWEATHER_API_KEY`, fetches `/data/2.5/weather` and `/data/2.5/forecast` concurrently via native `fetch()` and `Promise.all()`, shifts timestamps by the target city's UTC offset, and returns a unified JSON payload (`location`, `current`, `hourly`, `daily`, `meta`) with CORS headers.
4. **Client DOM Rendering:** [`frontend/js/app.js`](frontend/js/app.js) caches the normalized response and invokes [`frontend/js/ui.js`](frontend/js/ui.js) and [`frontend/js/icons.js`](frontend/js/icons.js) to update all dashboard components using XSS-safe `textContent` bindings.

---

## AWS Services & Their Roles

| Service | Resource Name / Region | Role in AeroCast |
| :--- | :--- | :--- |
| **AWS Lambda** | `aerocast-weather-api` (`ap-south-1`) | Runs the zero-dependency Node.js 22.x handler (`index.handler`), secures `OPENWEATHER_API_KEY`, performs concurrent upstream fetches, and normalizes forecast telemetry. |
| **Amazon API Gateway** | `weatherAPI` (`ap-south-1`) | Exposes the public `GET /weather` HTTPS endpoint, handles TLS termination, and invokes the Lambda function via AWS proxy integration. |
| **Amazon CloudWatch** | `/aws/lambda/aerocast-weather-api` | Captures structured error logs, invocation metrics, and execution durations without logging secret values. |
| **Amazon S3** | Static asset bucket | Provisioned for cloud static website object storage. |
| **Netlify CDN** | `sprightly-donut-c95ca9.netlify.app` | Hosts the live production frontend over global HTTPS while connected to the AWS backend. |

---

## Project Folder Structure

```text
weatherReportCloud/
├── .env.example                                              # Safe environment variable template
├── .gitignore                                                # Git security ignore rules
├── README.md                                                 # Project documentation
├── backend/
│   ├── index.mjs                                             # AWS Lambda handler (Node.js 22.x ES Module)
│   └── local-server.mjs                                      # Zero-dependency local HTTP simulator for API Gateway
├── frontend/
│   ├── index.html                                            # Semantic HTML5 single-page dashboard structure
│   ├── css/
│   │   ├── variables.css                                     # CSS custom properties, Dark/Light & 7 weather themes
│   │   └── style.css                                         # Responsive glassmorphic layout, cards & animations
│   └── js/
│       ├── config.js                                         # Dual-environment API URL config & default settings
│       ├── icons.js                                          # Custom inline SVG weather icon generator & theme mapper
│       ├── ui.js                                             # DOM rendering engine, unit conversion & visual gauges
│       └── app.js                                            # Application controller, events, geolocation & fetch logic
└── reports/
    ├── AeroCast_Cloud_Computing_Project_Report.docx          # Final academic project report (editable DOCX)
    └── AeroCast_Cloud_Computing_Project_Report.pdf           # Final academic project report (print-ready PDF)
```

---

## Local Setup & Development Instructions

### Prerequisites

- **Node.js `>= 20.x` (Node.js `22.x` recommended)** — required for native `fetch()` and ES Module support.
- A free **OpenWeatherMap API Key** from https://openweathermap.org/api.

### 1. Clone the Repository

```bash
git clone <your-github-repo-url>
cd weatherReportCloud
```

### 2. Configure Environment Variables Using `.env.example`

Copy the template file [`.env.example`](.env.example) to `.env` in the project root:

```bash
cp .env.example .env
```

Open `.env` and replace `your_openweather_api_key_here` with your real 32-character OpenWeatherMap API key:

```dotenv
OPENWEATHER_API_KEY=your_openweather_api_key_here
PORT=3000
```

> **Security Note:** `.env` is ignored by [`.gitignore`](.gitignore) and must never be committed to version control.

### 3. Start the Local Backend Server

AeroCast includes a zero-dependency local API Gateway simulator ([`backend/local-server.mjs`](backend/local-server.mjs)) that invokes the exact AWS Lambda [`handler`](backend/index.mjs) locally:

```bash
node backend/local-server.mjs
```

Verify the backend is running on port `3000`:

```bash
curl -s "http://localhost:3000/weather?city=Tokyo&units=metric"
```

### 4. Launch the Frontend Dashboard

In a second terminal window, serve the [`frontend/`](frontend) directory using any static HTTP server (for example, Python's built-in HTTP server on port `8080`):

```bash
python3 -m http.server 8080 --directory frontend
```

Open `http://localhost:8080` in your browser. Because the hostname is `localhost`, [`frontend/js/config.js`](frontend/js/config.js) automatically connects to `http://localhost:3000/weather`.

---

## Deployment Details & Known Limitations

- **Hybrid Cloud Production Architecture:**
  - **Backend:** Deployed on **AWS Lambda** (`aerocast-weather-api`, Node.js 22.x) behind **Amazon API Gateway** (`weatherAPI`, HTTP API) in `ap-south-1` (Mumbai) at `https://nuxdtjo63k.execute-api.ap-south-1.amazonaws.com/weather`.
  - **Frontend:** Deployed live on **Netlify Global HTTPS CDN** at https://sprightly-donut-c95ca9.netlify.app.
- **Amazon CloudFront Limitation on Student AWS Account:**
  - An Amazon S3 bucket was provisioned for frontend storage, but creating an **Amazon CloudFront** distribution was blocked by an AWS account-level restriction on newly registered student accounts (`AccessDenied: Your account must be verified before you can add new CloudFront resources`). Netlify was therefore adopted as the active HTTPS CDN for the frontend while retaining AWS API Gateway and AWS Lambda for the serverless backend.
- **Forecast Horizon & Upstream Metrics:**
  - Uses the OpenWeatherMap free-tier v2.5 endpoints (`/data/2.5/weather` and `/data/2.5/forecast`), which provide current weather plus 5-day / 3-hour forecast data (40 intervals). UV Index and Air Quality Index (AQI) require separate endpoints and are planned for future enhancements.
