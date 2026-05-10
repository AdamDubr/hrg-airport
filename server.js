const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

const FR24_TOKEN = process.env.FR24_TOKEN || '019e12c9-e17d-7349-a70a-14ab2cc5b57f|kZIaWFPgGERatxPkPsD4xAyn1tNdvGQ4XJRhzdr69a8679e9';

app.use(cors());
app.use(express.static(__dirname));

function fr24date(d) {
  return d.toISOString().substring(0, 19);
}

async function fr24fetch(url) {
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${FR24_TOKEN}`,
      'Accept': 'application/json',
      'Accept-Version': 'v1'
    }
  });
  const text = await response.text();
  console.log(`FR24 [${response.status}] ${url}`);
  console.log('Response:', text.substring(0, 300));
  try { return JSON.parse(text); } catch(e) { return { error: text }; }
}

function getDateRange(offsetDays) {
  // Египет UTC+3
  const egyptOffset = 3 * 60 * 60 * 1000;
  const now = new Date();
  const egyptNow = new Date(now.getTime() + egyptOffset);
  const y = egyptNow.getUTCFullYear();
  const m = egyptNow.getUTCMonth();
  const d = egyptNow.getUTCDate() + offsetDays;
  const from = new Date(Date.UTC(y, m, d, 0, 0, 0) - egyptOffset);
  const to   = new Date(Date.UTC(y, m, d, 23, 59, 59) - egyptOffset);
  return { from: fr24date(from), to: fr24date(to) };
}

async function getFlights(direction) {
  const airport = direction === 'inbound' ? 'inbound:HRG' : 'outbound:HRG';

  // Сначала пробуем сегодня
  let { from, to } = getDateRange(0);
  let url = `https://fr24api.flightradar24.com/api/flight-summary/light?airports=${airport}&flight_datetime_from=${from}&flight_datetime_to=${to}&limit=50&sort=asc`;
  let data = await fr24fetch(url);
  let flights = data.data || [];

  // Если рейсов нет или все уже прилетели — берём завтра
  const pending = flights.filter(f => !f.flight_ended);
  if (flights.length === 0 || pending.length === 0) {
    console.log('No active flights today, loading tomorrow...');
    const next = getDateRange(1);
    url = `https://fr24api.flightradar24.com/api/flight-summary/light?airports=${airport}&flight_datetime_from=${next.from}&flight_datetime_to=${next.to}&limit=50&sort=asc`;
    data = await fr24fetch(url);
    flights = data.data || [];
  }

  return flights;
}

app.get('/api/arrivals', async (req, res) => {
  try {
    const flights = await getFlights('inbound');
    res.json({ data: flights });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/departures', async (req, res) => {
  try {
    const flights = await getFlights('outbound');
    res.json({ data: flights });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/test', async (req, res) => {
  try {
    const flights = await getFlights('inbound');
    res.json({ data: flights });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✈ HRG Airport сервер запущен на порту ${PORT}`);
});
