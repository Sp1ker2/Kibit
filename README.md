# LiveKit Stream Application 🎬

## 🚀 Quick Start

### First time setup:
```bash
chmod +x *.sh
./setup.sh
```

### Start project:
```bash
./start.sh
```

### If ports are busy or permission errors:
```bash
./cleanup.sh
./start.sh
```

## 👤 Default accounts

**Admin:**
- Login: `Admin`
- Password: `Admin`

**User:**
- Login: `User`
- Password: `User`

## 📋 Requirements

- Node.js 14+ (18+ recommended)
- LiveKit server (`brew install livekit` or check https://livekit.io)
- Modern browser with WebRTC support

## 🔧 Troubleshooting

**"Permission denied" error:**
```bash
./cleanup.sh
```

**"Port already in use":**
```bash
./cleanup.sh
./start.sh
```

**Can't access from other devices:**
1. Check both devices are on same Wi-Fi network
2. Run `./show-ip.sh` to get your IP address
3. Open `http://YOUR_IP:5173` on other device
4. Check firewall settings
