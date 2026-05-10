const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

const FR24_TOKEN = process.env.FR24_TOKEN || '019e12c9-e17d-7349-a70a-14ab2cc5b57f|kZIaWFPgGERatxPkPsD4xAyn1tNdvGQ4XJRhzdr69a8679e9';

app.use(cors());
app.use(express.static(__dirname));

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
  console.log('Response:', text.substring(0, 500));
  try { return JSON.parse(text); } catch(e) { return { error: text }; }
}

app.get('/api/arrivals', async (req, res) => {
  try {
    const data = await fr24fetch('https://fr24api.flightradar24.com/api/live/flight-positions/light?airports=HRG&limit=50');
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/departures', async (req, res) => {
  try {
    const data = await fr24fetch('https://fr24api.flightradar24.com/api/live/flight-positions/light?airports=HRG&limit=50');
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/test', async (req, res) => {
  try {
    const data = await fr24fetch('https://fr24api.flightradar24.com/api/live/flight-positions/light?airports=HRG&limit=10');
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => {
  console.log(`✈ HRG Airport сервер запущен на порту ${PORT}`);
});
