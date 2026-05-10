const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Токены только из переменных окружения ───────────────────────────────────
const FR24_TOKEN   = process.env.FR24_TOKEN;
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN;

if (!FR24_TOKEN) {
  console.error('❌ FR24_TOKEN не задан. Установите переменную окружения FR24_TOKEN.');
  process.exit(1);
}

const HRG_ICAO = 'HEGN';

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ─── Утилита: запрос к FR24 API ──────────────────────────────────────────────
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
  if (response.status !== 200) console.error('FR24 error body:', text.substring(0, 300));
  try { return { status: response.status, data: JSON.parse(text) }; }
  catch(e) { return { status: response.status, data: { error: text } }; }
}

// ─── Кэш (60 сек) — один запрос вместо двух ──────────────────────────────────
let cache = { data: null, ts: 0 };
const CACHE_TTL = 60_000;

function splitFlights(flights) {
  return {
    arrivals:   flights.filter(f => f.dest_icao === HRG_ICAO),
    departures: flights.filter(f => f.orig_icao === HRG_ICAO),
  };
}

async function getFlights() {
  const now = Date.now();
  if (cache.data && now - cache.ts < CACHE_TTL) return cache.data;

  const result = await fr24fetch(
    `https://fr24api.flightradar24.com/api/live/flight-positions/light?airports=${HRG_ICAO}&limit=100`
  );

  if (result.status !== 200 || result.data.error) {
    throw new Error(result.data.error || `HTTP ${result.status}`);
  }

  const flights = result.data.data || (Array.isArray(result.data) ? result.data : []);
  cache = { data: splitFlights(flights), ts: now };
  return cache.data;
}

// ─── GET /api/arrivals ───────────────────────────────────────────────────────
app.get('/api/arrivals', async (req, res) => {
  try {
    const { arrivals } = await getFlights();
    res.json({ data: arrivals, count: arrivals.length, updated: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/departures ─────────────────────────────────────────────────────
app.get('/api/departures', async (req, res) => {
  try {
    const { departures } = await getFlights();
    res.json({ data: departures, count: departures.length, updated: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/test ───────────────────────────────────────────────────────────
app.get('/api/test', async (req, res) => {
  try {
    const f = await getFlights();
    res.json({
      arrivals_count:   f.arrivals.length,
      departures_count: f.departures.length,
      sample_arrival:   f.arrivals[0]   || null,
      sample_departure: f.departures[0] || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/subscribe ─────────────────────────────────────────────────────
app.post('/api/subscribe', async (req, res) => {
  const { name, phone, tg, flight } = req.body || {};

  if (!name || !phone || !tg || !flight) {
    return res.status(400).json({ error: 'Заполните все поля: name, phone, tg, flight' });
  }

  if (!TG_BOT_TOKEN) {
    console.warn('TG_BOT_TOKEN не задан — Telegram отключён');
    return res.json({ ok: true, tg_sent: false, message: 'Подписка сохранена (Telegram не настроен)' });
  }

  const tgUsername  = tg.replace('@', '');
  const adminChatId = process.env.TG_CHAT_ID;

  const adminText =
    `✈️ *Новая подписка на рейс*\n\n` +
    `👤 Имя: ${name}\n📱 Телефон: ${phone}\n💬 Telegram: @${tgUsername}\n🛫 Рейс: *${flight}* (HRG)`;

  const userText =
    `✅ Привет, ${name}!\n\n` +
    `Вы подписались на рейс *${flight}* (аэропорт Хургада).\n` +
    `Мы сообщим о задержке, посадке или смене выхода.\n\n_Hurghada Airport Info_`;

  try {
    if (adminChatId) {
      await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: adminChatId, text: adminText, parse_mode: 'Markdown' })
      });
    }

    const userResp = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: `@${tgUsername}`, text: userText, parse_mode: 'Markdown' })
    });
    const userResult = await userResp.json();

    res.json({ ok: true, tg_sent: userResult.ok, message: 'Подписка оформлена' });
  } catch (err) {
    console.error('Telegram error:', err.message);
    res.status(500).json({ error: 'Ошибка Telegram: ' + err.message });
  }
});

// ─── Запуск ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✈  HRG Airport сервер запущен: http://localhost:${PORT}`);
  console.log(`   FR24_TOKEN:   ${FR24_TOKEN   ? '✅ задан' : '❌ не задан'}`);
  console.log(`   TG_BOT_TOKEN: ${TG_BOT_TOKEN ? '✅ задан' : '⚠️  не задан (Telegram отключён)'}`);
});
