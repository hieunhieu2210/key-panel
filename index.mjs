import express from "express";
import fs from "fs-extra";
import bodyParser from "body-parser";
import { nanoid } from "nanoid";

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = './keys.json';

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

const loadData = async () => await fs.readJson(DATA_FILE).catch(() => ({ serverEnabled: true, keys: [] }));
const saveData = async (data) => await fs.writeJson(DATA_FILE, data, { spaces: 2 });

app.get('/', async (req, res) => {
  const data = await loadData();
  const keys = data.keys;
  let html = `
  <!DOCTYPE html>
  <html lang="vi">
  <head>
    <meta charset="UTF-8">
    <title>Key Panel</title>
    <style>
      body, html {
        margin: 0;
        padding: 0;
        height: 100%;
        font-family: 'Segoe UI', sans-serif;
        overflow: hidden;
      }
      video.bg-video {
        position: fixed;
        top: 0;
        left: 0;
        min-width: 100%;
        min-height: 100%;
        object-fit: cover;
        z-index: -1;
      }
      .content {
        position: relative;
        z-index: 1;
        padding: 20px;
        background: rgba(255,255,255,0.85);
        margin: 30px auto;
        max-width: 900px;
        border-radius: 12px;
        box-shadow: 0 0 15px rgba(0,0,0,0.2);
      }
      h2 {
        text-align: center;
        color: #333;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        background: #fff;
        margin-top: 20px;
      }
      th, td {
        padding: 10px;
        border: 1px solid #ccc;
        text-align: center;
      }
      th {
        background-color: #f0f0f0;
      }
      button {
        padding: 8px 14px;
        margin: 5px;
        background-color: #3498db;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
      }
      button:hover {
        background-color: #2980b9;
      }
      input[type="number"] {
        padding: 8px;
        width: 150px;
        border-radius: 5px;
        border: 1px solid #ccc;
      }
      form.inline {
        display: inline;
      }
    </style>
  </head>
 <video class="bg-video" autoplay muted loop playsinline>
  <source src="/background.mp4" type="video/mp4">
</video>
    <div class="content">
      <h2>Quản Lý Key By WADUxMEOUS</h2>

      <form method="POST" action="/toggle-server" style="text-align:center; margin-bottom: 20px;">
        <input type="hidden" name="enabled" value="${data.serverEnabled ? 'false' : 'true'}">
        <button type="submit" style="background-color: ${data.serverEnabled ? '#e74c3c' : '#2ecc71'}">
          ${data.serverEnabled ? '🔒 Đóng Server' : '🔓 Mở Server'}
        </button>
      </form>

      <table>
        <tr>
          <th>Key</th>
          <th>Hết hạn</th>
          <th>Thiết bị</th>
          <th>Hành động</th>
        </tr>`;

keys.forEach(k => {
  const deviceStatus = k.deviceId ? '1/1' : '0/1';
  html += `
      <tr>
        <td>${k.key}</td>
        <td>${new Date(k.expiresAt).toLocaleString()}</td>
        <td>${deviceStatus}</td>
        <td>
          <form class="inline" method="POST" action="/delete">
            <input type="hidden" name="key" value="${k.key}">
            <button type="submit">🗑 Xóa</button>
          </form>
          <form class="inline" method="POST" action="/reset">
            <input type="hidden" name="key" value="${k.key}">
            <button type="submit">♻️ Reset</button>
          </form>
        </td>
      </tr>`;
});

html += `
      </table>
      <form method="POST" action="/create" style="margin-top:20px;">
        <input type="number" name="days" placeholder="Hạn (ngày)" min="1" required>
        <button type="submit">➕ Tạo Key</button>
      </form>
    </div>
  </body>
  </html>`;

res.send(html);
});


app.post('/create', async (req, res) => {
  const data = await loadData();
  const days = parseInt(req.body.days) || 7;
  const newKey = {
    key: nanoid(10).toUpperCase(),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
    deviceId: null
  };
  data.keys.push(newKey);
  await saveData(data);
  res.redirect('/');
});

app.post('/delete', async (req, res) => {
  const { key } = req.body;
  const data = await loadData();
  data.keys = data.keys.filter(k => k.key !== key);
  await saveData(data);
  res.redirect('/');
});

app.post('/reset', async (req, res) => {
  const { key } = req.body;
  const data = await loadData();
  const found = data.keys.find(k => k.key === key);
  if (found) found.deviceId = null;
  await saveData(data);
  res.redirect('/');
});

app.post('/toggle-server', async (req, res) => {
  const data = await loadData();
  data.serverEnabled = req.body.enabled === 'true';
  await saveData(data);
  res.redirect('/');
});

app.get('/verify', async (req, res) => {
  const { key, deviceId } = req.query;
  const data = await loadData();

  if (!data.serverEnabled) {
    return res.json({ status: 'server_disabled', message: 'App đã bị tắt từ server. Vui lòng cập nhật phiên bản mới.' });
  }

  const keys = data.keys;
  const found = keys.find(k => k.key === key);

  if (!found) return res.json({ status: 'invalid' });
  if (new Date(found.expiresAt) < new Date()) return res.json({ status: 'expired' });
  if (found.deviceId && found.deviceId !== deviceId)
    return res.json({ status: 'used_on_another_device' });

  if (!found.deviceId && deviceId) {
    found.deviceId = deviceId;
    await saveData(data);
  }

  res.json({ status: 'valid' });
});

app.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại http://localhost:\${PORT}`);
});
