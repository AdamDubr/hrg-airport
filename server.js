const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Токен: сначала из переменной окружения, иначе дефолтный
const FR24_TOKEN = process.env.FR24_TOKEN || '019e12c9-e17d-7349-a70a-14ab2cc5b57f|kZIaWFPgGERatxPkPsD4xAyn1tNdvGQ4XJRhzdr69a8679e9';

app.use(cors());
app.use(express.static('public')); // положи hurghada-airport.html сюда как index.html

// Прокси: прилёты
app.get('/api/arrivals', async (req, res) => {
  try {
    const url = 'https://fr24api.flightradar24.com/v1/airport/HRG/arrivals?limit=30';
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${FR24_TOKEN}`,
        'Accept': 'application/json',
        'Accept-Version': 'v1'
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Прокси: вылеты
app.get('/api/departures', async (req, res) => {
  try {
    const url = 'https://fr24api.flightradar24.com/v1/airport/HRG/departures?limit=30';
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${FR24_TOKEN}`,
        'Accept': 'application/json',
        'Accept-Version': 'v1'
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✈ HRG Airport сервер запущен на порту ${PORT}`);
});
