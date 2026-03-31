# ⚡ SINKET HITTER v3.0

> **Ultimate Stripe Auto-Hitter** - All Card Types | Real Results | No Extension Needed

[![Version](https://img.shields.io/badge/Version-3.0-brightgreen.svg)](https://github.com/Sinket)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Termux](https://img.shields.io/badge/Termux-Supported-orange.svg)](https://termux.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 🎯 Features

| Feature | Description |
|---------|-------------|
| **💳 All Card Types** | Visa, Mastercard, Amex, Discover, JCB, Diners Club |
| **🎲 BIN Generator** | Generate valid cards from any BIN |
| **✅ Real Results** | Actual success/error detection (not fake!) |
| **📱 Mobile UI** | Beautiful dark theme, fully responsive |
| **🌐 Free Tunnel** | Cloudflare trycloudflare.com - No account needed |
| **⚡ Real-time** | Live WebSocket updates |
| **🔒 Stealth Mode** | Undetectable browser automation |
| **📥 Export** | Download results as CSV |

---

## 📱 TERMUX (Android) - QUICK START

### Step 1: Install Termux
- Download from **F-Droid**: https://f-droid.org/packages/com.termux/
- ⚠️ **NOT** from Play Store (outdated!)

### Step 2: Run Setup
```bash
# Grant storage permission
termux-setup-storage

# Clone repo
cd ~ && git clone https://github.com/Sinket/sinket-hitter.git

# Enter directory
cd sinket-hitter

# Run setup
bash scripts/termux-setup.sh
```

### Step 3: Start Server
```bash
./start.sh
```

### Step 4: Get Public URL (New Session)
1. **Swipe left** from screen edge
2. Tap **"New Session"**
3. Run:
```bash
cd ~/sinket-hitter && cloudflared tunnel --url http://localhost:3000
```

4. **Copy the URL** and open in browser! 🎉

---

## 🖥️ VPS (Linux) - QUICK START

```bash
# 1. Clone repo
git clone https://github.com/Sinket/sinket-hitter.git
cd sinket-hitter

# 2. Run setup
bash scripts/setup.sh

# 3. Start server
./start.sh

# 4. Get public URL (new terminal)
npm run tunnel
```

---

## 📋 Supported Cards

| Brand | Prefixes | Length | CVV |
|-------|----------|--------|-----|
| **Visa** | 4 | 13, 16, 19 | 3 |
| **Mastercard** | 51-55, 2221-2720 | 16 | 3 |
| **Amex** | 34, 37 | 15 | 4 |
| **Discover** | 6011, 644-649, 65 | 16, 19 | 3 |
| **JCB** | 3528-3589 | 16-19 | 3 |
| **Diners** | 36, 38, 39, 300-305 | 14, 16, 19 | 3 |

---

## 🛠️ Usage

### 1. Configure

| Field | Description | Example |
|-------|-------------|---------|
| **Payment Link** | Stripe checkout URL | `https://buy.stripe.com/...` |
| **BIN** | First 6+ digits | `424242` |
| **Card Type** | Auto or specific | `Visa`, `Mastercard`, etc. |
| **Quantity** | Cards to generate | `10` |
| **Delay** | Delay between cards (ms) | `3000` |

### 2. Start Hitting

Click **"🚀 START HITTING"**

### 3. Monitor Progress

- Real-time progress bar
- Live status logs
- Card-by-card results

### 4. Export Results

Click **"📥 Export"** to download CSV

---

## 📁 File Structure

```
sinket-hitter/
├── server.js              # Main server
├── package.json           # Dependencies
├── start.sh              # Quick start
├── README.md             # This file
│
├── src/
│   ├── card-engine.js    # Card generator (all types)
│   └── stripe-hitter.js  # Automation engine
│
├── public/               # Frontend
│   ├── index.html        # UI
│   └── app.js           # Frontend logic
│
└── scripts/
    ├── setup.sh         # VPS setup
    ├── termux-setup.sh  # Termux setup
    └── tunnel.sh        # Cloudflare tunnel
```

---

## 🔧 Common Commands

### Start Server
```bash
./start.sh
```

### Get Public URL
```bash
npm run tunnel
# OR
cloudflared tunnel --url http://localhost:3000
```

### Stop Server
```bash
pkill -f "node server.js"
```

### Restart
```bash
pkill -f "node server.js" && ./start.sh
```

---

## 🆘 Troubleshooting

### "Cannot find module"
```bash
rm -rf node_modules && npm install
```

### "Chrome not found" (Termux)
```bash
pkg reinstall chromium
export PUPPETEER_EXECUTABLE_PATH=$(which chromium)
```

### "Port in use"
```bash
pkill -f "node server.js"
# OR use different port
PORT=3001 node server.js
```

### "Out of memory"
```bash
# Clear cache
pkg clean
# Close other apps
```

---

## ⚠️ Disclaimer

This tool is for **educational and testing purposes only**. Use responsibly and in accordance with Stripe's terms of service.

---

## 📄 License

MIT License

---

**Made with ⚡ by Sinket**

⭐ Star the repo if this helped you!
