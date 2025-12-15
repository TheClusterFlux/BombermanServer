# 🧪 Bomberman Local Testing Guide

Quick guide to test the Bomberman game locally using Docker Compose before deploying to Kubernetes.

## 🚀 Quick Start

### 1. Build and Start Services

From the `BombermanServer` directory:

```bash
# Build and start both server and client
docker-compose up --build

# Or run in detached mode (background)
docker-compose up --build -d
```

### 2. Access the Game

Open your browser and navigate to:

```
http://localhost:3000
```

**Important**: The WebSocket connection will automatically connect to `ws://localhost:8080` when running locally.

### 3. Test with Multiple Players

Open multiple browser tabs or windows at `http://localhost:3000` to simulate multiple players:

- Tab 1: Create a lobby and host
- Tab 2: Join the lobby as player 2
- Tab 3: Join as player 3 (optional)
- Tab 4: Join as player 4 (optional)

Then ready up and start the game!

## 🛑 Stop Services

```bash
# Stop and remove containers
docker-compose down

# Stop, remove containers, and clean up volumes
docker-compose down -v
```

## 📊 View Logs

```bash
# View all logs
docker-compose logs -f

# View server logs only
docker-compose logs -f bomberman-server

# View client logs only
docker-compose logs -f bomberman-client
```

## 🔍 Check Health

```bash
# Check server health
curl http://localhost:8080/health

# Expected response:
# {"status":"ok","lobbies":0}
```

## 🗺️ Editing Maps on the Fly

The local setup mounts the `maps/` directory, so you can edit maps without rebuilding:

1. Edit a map file in `BombermanServer/maps/`
2. Server automatically picks up changes on next lobby creation
3. No need to rebuild or restart!

Example - create a new map:

```bash
# Create a new map (from BombermanServer directory)
cat > maps/tiny.txt << 'EOF'
###########
#S.......S#
#.#.#.#.#.#
#.X.X.X.X.#
#.#.#.#.#.#
#S.......S#
###########
EOF

# Server will detect it immediately!
```

## 🐛 Troubleshooting

### Issue: "Cannot connect to server"

**Check if server is running:**
```bash
docker ps | grep bomberman-server
curl http://localhost:8080/health
```

**Check server logs:**
```bash
docker-compose logs bomberman-server
```

### Issue: "Port already in use"

If ports 8080 or 3000 are already in use:

**Option 1: Stop conflicting services**
```bash
# Find what's using the port
# Windows:
netstat -ano | findstr :8080
netstat -ano | findstr :3000

# Linux/Mac:
lsof -i :8080
lsof -i :3000
```

**Option 2: Change ports in docker-compose.yml**
```yaml
services:
  bomberman-server:
    ports:
      - "8081:8080"  # Change 8080 to 8081

  bomberman-client:
    ports:
      - "3001:8080"  # Change 3000 to 3001
```

Then access at `http://localhost:3001`

### Issue: "WebSocket connection failed"

1. Ensure server is running: `docker ps`
2. Check browser console for errors (F12)
3. Verify WebSocket URL in client (should be `ws://localhost:8080`)
4. Check server logs for connection attempts

### Issue: "Maps not loading"

1. Check if maps directory is mounted:
   ```bash
   docker exec bomberman-server ls -la /app/maps
   ```

2. Verify map file format (no syntax errors)

3. Check server logs for map loading messages:
   ```bash
   docker-compose logs bomberman-server | grep "Loaded map"
   ```

## 🧪 Testing Checklist

Use this checklist to ensure everything works before deploying to K8s:

- [ ] Server starts without errors
- [ ] Client loads at http://localhost:3000
- [ ] Can enter username and connect
- [ ] Maps list loads (default, arena, classic, maze)
- [ ] Can create a lobby
- [ ] Can join lobby in second browser tab
- [ ] Ready button works
- [ ] Start game button appears for host
- [ ] Game starts with all players ready
- [ ] Movement works (WASD/Arrows)
- [ ] Bomb placement works (Space)
- [ ] Bombs explode after 3 seconds
- [ ] Boxes destroyed by explosions
- [ ] Upgrades spawn from boxes
- [ ] Upgrades can be collected
- [ ] Players eliminated by explosions
- [ ] Game over screen appears
- [ ] Winner announced correctly
- [ ] Can return to lobby browser

## 🔄 Development Workflow

### Making Code Changes

**Server Changes:**
```bash
# 1. Make changes to server code
# 2. Rebuild and restart
docker-compose up --build bomberman-server
```

**Client Changes:**
```bash
# 1. Make changes to client code
# 2. Rebuild and restart
docker-compose up --build bomberman-client

# 3. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
```

**Quick Restart Without Rebuild:**
```bash
docker-compose restart
```

## 📦 Port Mappings

- **Server**: `localhost:8080` → Container port 8080 (WebSocket + HTTP)
- **Client**: `localhost:3000` → Container port 8080 (Nginx)

## 🌐 Network Architecture (Local)

```
Browser (localhost:3000)
    ↓
Client Container (Nginx)
    ↓ WebSocket connection
Server Container (localhost:8080)
    ↓
Maps Volume (/app/maps)
```

## 💡 Tips

1. **Use browser dev tools** (F12) to watch WebSocket messages
2. **Multiple tabs** simulate multiple players easily
3. **Edit maps live** - changes picked up automatically
4. **Check server health** frequently: `curl localhost:8080/health`
5. **Watch logs** for debugging: `docker-compose logs -f`

## ✅ Ready for Production?

Once local testing is successful:

1. ✅ All gameplay features work
2. ✅ No console errors in browser
3. ✅ WebSocket connections stable
4. ✅ Maps load correctly
5. ✅ Multiple players can play simultaneously

**You're ready to deploy to Kubernetes!**

Follow the `BOMBERMAN_DEPLOYMENT_GUIDE.md` for K8s deployment.

---

## 🎮 Example Test Session

```bash
# Terminal 1: Start services (from BombermanServer directory)
cd BombermanServer
docker-compose up --build

# Terminal 2: Watch server logs
docker-compose logs -f bomberman-server

# Terminal 3: Test health
curl http://localhost:8080/health

# Browser: Open http://localhost:3000
# Create lobby, join with multiple tabs, play!
```

Happy testing! 💣💥🎮


