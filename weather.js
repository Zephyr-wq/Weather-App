// Replace with your OpenWeatherMap API key
const API_KEY = "9efecffb46e7e68680740d2cf0950b7a";

// DOM elements
const searchBtn = document.getElementById("searchBtn");
const stateSelect = document.getElementById("stateSelect");
const spinner = document.getElementById("loadingSpinner");
const resultDiv = document.getElementById("weatherResult");
const cityNameEl = document.getElementById("cityName");
const iconEl = document.getElementById("icon");
const tempEl = document.getElementById("temp");
const descEl = document.getElementById("desc");
const humidityEl = document.getElementById("humidity");
const forecastContainer = document.getElementById("forecastContainer");
const unitSwitch = document.getElementById("unitSwitch");
const unitLabel = document.getElementById("unitLabel");
const themeToggle = document.getElementById("themeToggle");
const appCard = document.getElementById("appCard");
const permissionHint = document.getElementById("permissionHint");

// mapping states to major cities
const stateToCity = {
  "Abia": "Umuahia",
  "Adamawa": "Yola",
  "Akwa Ibom": "Uyo",
  "Anambra": "Awka",
  "Bauchi": "Bauchi",
  "Bayelsa": "Yenagoa",
  "Benue": "Makurdi",
  "Borno": "Maiduguri",
  "Cross River": "Calabar",
  "Delta": "Asaba",
  "Ebonyi": "Abakaliki",
  "Edo": "Benin City",
  "Ekiti": "Ado Ekiti",
  "Enugu": "Enugu",
  "Gombe": "Gombe",
  "Imo": "Owerri",
  "Jigawa": "Dutse",
  "Kaduna": "Kaduna",
  "Kano": "Kano",
  "Katsina": "Katsina",
  "Kebbi": "Birnin Kebbi",
  "Kogi": "Lokoja",
  "Kwara": "Ilorin",
  "Lagos": "Ikeja",
  "Nasarawa": "Lafia",
  "Niger": "Minna",
  "Ogun": "Abeokuta",
  "Ondo": "Akure",
  "Osun": "Osogbo",
  "Oyo": "Ibadan",
  "Plateau": "Jos",
  "Rivers": "Port Harcourt",
  "Sokoto": "Sokoto",
  "Taraba": "Jalingo",
  "Yobe": "Damaturu",
  "Zamfara": "Gusau",
  "FCT": "Abuja"
};

// state
let currentUnit = localStorage.getItem("unit") || "metric"; // metric = °C, imperial = °F
let currentTheme = localStorage.getItem("theme") || "dark";

// init UI according to saved values
function initSettings() {
  unitSwitch.checked = (currentUnit === "imperial");
  unitLabel.textContent = currentUnit === "metric" ? "°C" : "°F";
  document.body.classList.toggle("light-theme", currentTheme === "light");
  themeToggle.textContent = currentTheme === "light" ? "☀️" : "🌙";
}
initSettings();

// Event listeners
searchBtn.addEventListener("click", () => {
  const state = stateSelect.value;
  if (!state || state === "-- Select a State --") {
    alert("Please select a Nigerian state!");
    return;
  }
  const city = stateToCity[state] || state;
  fetchByCity(city, state);
});

unitSwitch.addEventListener("change", () => {
  currentUnit = unitSwitch.checked ? "imperial" : "metric";
  localStorage.setItem("unit", currentUnit);
  unitLabel.textContent = currentUnit === "metric" ? "°C" : "°F";
  // if weather is already shown, re-fetch it for current coords or city label
  const shownCity = cityNameEl.textContent;
  if (shownCity) {
    // extract state/name from shown label "State, Nigeria"
    const stateName = shownCity.split(",")[0];
    const city = stateToCity[stateName] || stateName;
    if (lastCoords) {
      // we have coords (auto-located), use them
      fetchByCoords(lastCoords.lat, lastCoords.lon, stateName);
    } else {
      fetchByCity(city, stateName);
    }
  }
});

document.documentElement.classList.toggle("light-theme", currentTheme === "light");

// Theme toggle
themeToggle.addEventListener("click", () => {
  currentTheme = currentTheme === "light" ? "dark" : "light";
  localStorage.setItem("theme", currentTheme);
  document.documentElement.classList.toggle("light-theme", currentTheme === "light");
  themeToggle.textContent = currentTheme === "light" ? "☀️" : "🌙";
});

// track last coords if auto-located
let lastCoords = null;

// Auto-location on load
window.addEventListener("load", () => {
  // try geolocation, but don't block if denied
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        lastCoords = { lat: latitude, lon: longitude };
        // reverse geocode using OpenWeatherMap (we can use weather endpoint to find city)
        fetchByCoords(latitude, longitude);
      },
      err => {
        console.warn("Geolocation denied or failed:", err.message);
        permissionHint.textContent = "Location not allowed — choose a state or allow location.";
      },
      { timeout: 8000 }
    );
  } else {
    permissionHint.textContent = "Geolocation not supported. Choose a state.";
  }
});

// helper: show/hide spinner
function showLoading(show = true) {
  spinner.style.display = show ? "inline-block" : "none";
}

// fetch by city name (city, NG)
async function fetchByCity(city, stateNameFallback) {
  showLoading(true);
  resultDiv.style.display = "none";
  forecastContainer.innerHTML = "";

  try {
    // First get current weather (gives coords we can reuse)
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)},NG&appid=${API_KEY}&units=${currentUnit}`;
    const weatherResp = await fetch(weatherUrl);
    const weatherData = await weatherResp.json();

    if (!weatherResp.ok) {
      showLoading(false);
      alert(`Weather not found for ${stateNameFallback || city}.`);
      return;
    }

    const { coord } = weatherData;
    lastCoords = { lat: coord.lat, lon: coord.lon };

    // Get forecast by coords (5 day / 3 hour)
    await fetchForecastAndDisplay(weatherData, coord.lat, coord.lon, stateNameFallback || city);
  } catch (err) {
    console.error(err);
    showLoading(false);
    alert("Unable to fetch weather. Check your API key and internet.");
  }
}

// fetch by coordinates (lat, lon)
async function fetchByCoords(lat, lon, stateNameFallback) {
  showLoading(true);
  resultDiv.style.display = "none";
  forecastContainer.innerHTML = "";

  try {
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${currentUnit}`;
    const weatherResp = await fetch(weatherUrl);
    const weatherData = await weatherResp.json();

    if (!weatherResp.ok) {
      showLoading(false);
      alert("Weather not found for your location.");
      return;
    }

    // Attempt to resolve the state name from weatherData.name if inside Nigeria, otherwise use fallback
    let stateName = stateNameFallback || (weatherData.sys && weatherData.sys.country === "NG" ? weatherData.name : "Your Location");
    lastCoords = { lat, lon };

    await fetchForecastAndDisplay(weatherData, lat, lon, stateName);
  } catch (err) {
    console.error(err);
    showLoading(false);
    alert("Unable to fetch weather data.");
  }
}

// Get forecast by lat/lon and display both current & 5-day
async function fetchForecastAndDisplay(currentWeatherData, lat, lon, labelName) {
  try {
    // Fetch forecast 5-day / 3-hour
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${currentUnit}`;
    const fResp = await fetch(forecastUrl);
    const fData = await fResp.json();

    if (!fResp.ok) {
      showLoading(false);
      alert("Forecast not found.");
      return;
    }

    // Display current weather
    displayCurrent(currentWeatherData, labelName);

    // Process forecast into 5 daily summaries
    const daily = extractDailyForecasts(fData.list);
    displayForecast(daily);

    showLoading(false);
    resultDiv.style.display = "block";
    resultDiv.classList.add("fade-in");
  } catch (err) {
    console.error(err);
    showLoading(false);
    alert("Error fetching forecast.");
  }
}

// Display current weather
function displayCurrent(data, displayLabel) {
  const temp = Math.round(data.main.temp);
  const desc = data.weather[0].description;
  const humidity = data.main.humidity;
  const icon = data.weather[0].icon;

  cityNameEl.textContent = `${displayLabel}, Nigeria`;
  tempEl.textContent = temp;
  descEl.textContent = desc;
  humidityEl.textContent = humidity;
  iconEl.src = `https://openweathermap.org/img/wn/${icon}@2x.png`;
  unitLabel.textContent = currentUnit === "metric" ? "°C" : "°F";
}

// Convert list of 3-hour forecasts into one entry per day (choose midday or compute min/max)
function extractDailyForecasts(list) {
  // group by date (YYYY-MM-DD)
  const byDate = {};
  list.forEach(item => {
    const date = item.dt_txt.split(" ")[0];
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(item);
  });

  const days = Object.keys(byDate).slice(0, 6); // include today + next 4 (take up to 5 future days)
  const daily = [];

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const entries = byDate[day];

    // compute min/max temps
    let min = Infinity, max = -Infinity;
    let mainEntry = entries[Math.floor(entries.length / 2)]; // pick middle as representative
    entries.forEach(e => {
      min = Math.min(min, e.main.temp_min);
      max = Math.max(max, e.main.temp_max);
    });

    // prefer an entry near 12:00 if exists
    const midday = entries.find(e => e.dt_txt.includes("12:00:00"));
    if (midday) mainEntry = midday;

    daily.push({
      date: day,
      dayLabel: formatDayLabel(day),
      icon: mainEntry.weather[0].icon,
      desc: mainEntry.weather[0].description,
      tempMin: Math.round(min),
      tempMax: Math.round(max)
    });

    if (daily.length >= 5) break; // we only want 5 days
  }

  return daily;
}

// format YYYY-MM-DD => Mon, Tue etc.
function formatDayLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00"); // safe parse
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

// display forecast cards
function displayForecast(daily) {
  forecastContainer.innerHTML = "";
  daily.forEach(day => {
    const card = document.createElement("div");
    card.className = "forecast-card";

    card.innerHTML = `
      <div class="day">${day.dayLabel}</div>
      <img src="https://openweathermap.org/img/wn/${day.icon}@2x.png" alt="${day.desc}" />
      <div class="temps">${day.tempMax}${currentUnit === "metric" ? "°C" : "°F"} / ${day.tempMin}${currentUnit === "metric" ? "°C" : "°F"}</div>
      <div class="small mt-1" style="text-transform:capitalize;">${day.desc}</div>
    `;
    forecastContainer.appendChild(card);
  });
}

// initial call to apply settings
initSettings();
