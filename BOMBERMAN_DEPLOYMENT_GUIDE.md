# Bomberman - Kubernetes Deployment Guide

Complete guide for deploying the Bomberman multiplayer game to your Kubernetes cluster.

## 🎮 Overview

This is a complete Bomberman implementation with:
- **Server**: Node.js WebSocket server handling game logic and lobbies
- **Client**: Static web client with Canvas-based rendering
- **Maps**: Dynamically loaded from Kubernetes ConfigMaps
- **Upgrades**: Extensible system for power-ups

## 📁 Project Structure

```
BombermanServer/
├── Dockerfile
├── deployment.yaml          # K8s config (includes ConfigMap, Ingress)
├── package.json
├── maps/                    # Sample maps (for reference)
│   ├── default.txt
│   ├── arena.txt
│   ├── classic.txt
│   └── maze.txt
└── src/
    ├── server.js            # WebSocket server
    ├── config/
    │   └── gameConfig.js    # Game rules and upgrades
    └── game/                # Game engine classes

BombermanClient/
├── Dockerfile
├── deployment.yaml          # K8s config for client
├── nginx.conf
└── src/
    ├── index.html
    ├── css/
    │   └── style.css
    └── js/
        ├── main.js          # WebSocket client
        ├── renderer.js      # Canvas rendering
        ├── input.js         # Keyboard controls
        └── ui.js            # UI management
```

## 🚀 Deployment Steps

### 1. Build Docker Images

**Server:**
```bash
cd BombermanServer
docker build -t docker.io/keanuwatts/theclusterflux:bomberman-server .
docker push docker.io/keanuwatts/theclusterflux:bomberman-server
```

**Client:**
```bash
cd BombermanClient
docker build -t docker.io/keanuwatts/theclusterflux:bomberman-client .
docker push docker.io/keanuwatts/theclusterflux:bomberman-client
```

> **Note**: Replace `keanuwatts/theclusterflux` with your own Docker registry path in both `deployment.yaml` files.

### 2. Deploy to Kubernetes

**Deploy Server (includes ConfigMap and Ingress):**
```bash
cd BombermanServer
kubectl apply -f deployment.yaml
```

**Deploy Client:**
```bash
cd BombermanClient
kubectl apply -f deployment.yaml
```

### 3. Verify Deployment

```bash
# Check pods
kubectl get pods | grep bomberman

# Check services
kubectl get svc | grep bomberman

# Check ingress
kubectl get ingress bomberman

# Check ConfigMap
kubectl get configmap bomberman-maps
kubectl describe configmap bomberman-maps
```

### 4. Check Logs

```bash
# Server logs
kubectl logs -f deployment/bomberman-server

# Client logs
kubectl logs -f deployment/bomberman-client
```

## 🌐 Accessing the Game

Once deployed, access the game at:
```
https://bomberman.theclusterflux.com
```

The Ingress configuration handles:
- **`/`** → Client (static files)
- **`/ws`** → Server (WebSocket connections)
- **TLS**: Uses existing `theclusterflux` secret
- **WebSocket**: Proper timeout and upgrade headers configured

## 🗺️ Adding New Maps

### Option 1: Update ConfigMap Directly

```bash
kubectl edit configmap bomberman-maps
```

Add a new map in the `data` section:

```yaml
data:
  yourmap.txt: |
    ###########
    #S.......S#
    #.#.#.#.#.#
    #.X.X.X.X.#
    #S.......S#
    ###########
```

### Option 2: Update deployment.yaml

1. Edit `BombermanServer/deployment.yaml`
2. Add your map to the ConfigMap section
3. Reapply:
```bash
kubectl apply -f BombermanServer/deployment.yaml
```

Server automatically picks up new maps without restart!

## 🎨 Map Legend

When creating maps:
- `#` = Wall (indestructible, black)
- `X` = Box (destructible, brown, may drop upgrades)
- `.` = Empty space (walkable)
- `O` = Hole (impassable, black with visible border)
- `S` = Spawn point (player starting position)

**Important**: 
- Map should be rectangular
- Surround with walls (`#`) for boundaries
- Include 2-4 spawn points (`S`)
- Test dimensions - game auto-adjusts canvas size

## ⚙️ Configuration

### Server Configuration

Edit `BombermanServer/src/config/gameConfig.js`:

```javascript
{
  maxPlayersPerLobby: 4,
  minPlayersToStart: 2,
  bombTimer: 3000,           // ms
  explosionDuration: 500,    // ms
  tickRate: 60,              // game updates per second
  defaultPlayerSpeed: 3,     // tiles per second
  defaultBombCount: 1,
  defaultExplosionRange: 2
}
```

### Adding Upgrades

In `gameConfig.js`:

```javascript
upgrades: {
  NEW_UPGRADE: {
    id: 'NEW_UPGRADE',
    name: 'Display Name',
    icon: 'N',  // Shows on upgrade pickup
    color: '#00FF00',
    effect: (player) => {
      // Modify player stats
      player.speed += 1;
      player.maxBombs += 1;
      // etc.
    }
  }
}
```

After changes, rebuild and redeploy server image.

## 🎮 Gameplay

1. **Enter Name**: Choose your username
2. **Create/Join Lobby**: Browse games or create new one
3. **Select Map**: Host selects from available maps
4. **Ready Up**: All players click "Ready"
5. **Start Game**: Host starts when all ready
6. **Play**: 
   - Move with WASD or Arrow Keys
   - Place bombs with Spacebar
   - Collect upgrades from destroyed boxes
   - Last player standing wins!

## 🔧 Troubleshooting

### Pods not starting
```bash
kubectl describe pod <pod-name>
kubectl logs <pod-name>
```

### WebSocket connection fails
- Check Ingress annotations for WebSocket support
- Verify service names match in Ingress
- Check DNS resolution: `kubectl get ingress`
- Ensure TLS secret exists: `kubectl get secret theclusterflux`

### Maps not loading
```bash
# Check if ConfigMap exists
kubectl get configmap bomberman-maps

# View ConfigMap contents
kubectl describe configmap bomberman-maps

# Check server can read maps
kubectl logs deployment/bomberman-server | grep "Loaded map"
```

### Client can't connect to server
- Check browser console for WebSocket errors
- Verify Ingress path `/ws` routes to `bomberman-server:8080`
- Test server health: `kubectl port-forward svc/bomberman-server 8080:8080`
  Then visit `http://localhost:8080/health`

## 📊 Monitoring

### Health Checks

Server includes health endpoint:
```bash
kubectl port-forward svc/bomberman-server 8080:8080
curl http://localhost:8080/health
```

Returns:
```json
{"status":"ok","lobbies":2}
```

### Resource Usage

```bash
kubectl top pods | grep bomberman
```

## 🔄 Updates

### Updating Server Code

1. Make changes to server code
2. Rebuild image with new tag or `:latest`
3. Push to registry
4. Restart deployment:
```bash
kubectl rollout restart deployment/bomberman-server
```

### Updating Client

1. Make changes to client files
2. Rebuild image
3. Push to registry
4. Restart deployment:
```bash
kubectl rollout restart deployment/bomberman-client
```

## 🔐 Security Notes

- Server uses ClusterIP (not exposed directly)
- Client uses ClusterIP (not exposed directly)
- Only Ingress is public-facing
- WebSocket connections via secure WSS in production
- No authentication currently (add if needed)

## 📈 Scaling

Currently configured for:
- **Server**: 1 replica (single game instance)
- **Client**: 1 replica (static files)

**Note**: Game server maintains state in memory. Multiple replicas would require:
- Session affinity in Ingress
- Or shared state (Redis, etc.)
- Current design is for single-pod simplicity

## 🎯 Future Enhancements

- [ ] Persistent player stats (add MongoDB)
- [ ] Spectator mode
- [ ] Tournament brackets
- [ ] More upgrade types
- [ ] Sound effects
- [ ] Mobile-friendly controls
- [ ] Replay system
- [ ] Leaderboards

## 📝 License

ISC

---

## Quick Reference

### Important Files
- Server K8s: `BombermanServer/deployment.yaml`
- Client K8s: `BombermanClient/deployment.yaml`
- Game Config: `BombermanServer/src/config/gameConfig.js`
- Maps ConfigMap: In server `deployment.yaml`

### Important Commands
```bash
# Deploy everything
kubectl apply -f BombermanServer/deployment.yaml
kubectl apply -f BombermanClient/deployment.yaml

# Check status
kubectl get pods,svc,ingress | grep bomberman

# View logs
kubectl logs -f deployment/bomberman-server
kubectl logs -f deployment/bomberman-client

# Restart after changes
kubectl rollout restart deployment/bomberman-server
kubectl rollout restart deployment/bomberman-client

# Delete everything
kubectl delete -f BombermanServer/deployment.yaml
kubectl delete -f BombermanClient/deployment.yaml
```

Enjoy your Bomberman game! 💣💥🎮


