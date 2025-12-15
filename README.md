# Bomberman Server

WebSocket-based game server for multiplayer Bomberman game running on Kubernetes.

## Features

- **Real-time multiplayer**: WebSocket-based communication for low-latency gameplay
- **Lobby system**: Create and join game lobbies with up to 4 players
- **Dynamic maps**: Maps loaded from Kubernetes ConfigMaps, easy to add new ones
- **Extensible upgrades**: Plugin-based upgrade system configurable via code
- **Game engine**: Full physics, collision detection, bomb explosions, player movement

## Architecture

```
src/
├── server.js           # Main WebSocket server
├── config/
│   └── gameConfig.js   # Game rules and upgrade definitions
└── game/
    ├── GameEngine.js   # Core game loop and state management
    ├── Lobby.js        # Individual game lobby
    ├── LobbyManager.js # Manages all lobbies
    ├── Player.js       # Player state and movement
    ├── Bomb.js         # Bomb logic and explosions
    └── Map.js          # Map parsing and tile management
```

## Map Format

Maps are defined as text files with single characters representing each tile:

- `#` - Wall (indestructible)
- `X` - Box (destructible, may drop upgrades)
- `O` - Hole (impassable gap)
- `.` - Empty space
- `S` - Spawn point (converted to empty after recording)

Example map:
```
#################
#S.X.X.X.X.X.X.S#
#.#.#.#.#.#.#.#.#
#X.X.X.X.X.X.X.X#
#.#.#.#.#.#.#.#.#
#S.X.X.X.X.X.X.S#
#################
```

## Adding New Maps

1. Create a new `.txt` file in the `maps/` directory
2. Define your map using the character format above
3. Rebuild the Docker image, or add to the ConfigMap in `deployment.yaml`
4. Deploy to Kubernetes

To add to ConfigMap:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: bomberman-maps
data:
  yourmap.txt: |
    ###########
    #S.......S#
    #.#.#.#.#.#
    #S.......S#
    ###########
```

## Adding New Upgrades

Edit `src/config/gameConfig.js`:

```javascript
upgrades: {
  YOUR_UPGRADE: {
    id: 'YOUR_UPGRADE',
    name: 'Display Name',
    icon: 'Y', // Single character
    color: '#FF0000',
    effect: (player) => {
      // Modify player properties
      player.speed += 2;
    }
  }
}
```

## WebSocket Protocol

### Client → Server

**SET_USERNAME**
```json
{ "type": "SET_USERNAME", "username": "Player1" }
```

**GET_LOBBIES**
```json
{ "type": "GET_LOBBIES" }
```

**CREATE_LOBBY**
```json
{ 
  "type": "CREATE_LOBBY",
  "lobbyName": "My Game",
  "mapName": "default"
}
```

**JOIN_LOBBY**
```json
{ "type": "JOIN_LOBBY", "lobbyId": "lobby_123" }
```

**LEAVE_LOBBY**
```json
{ "type": "LEAVE_LOBBY" }
```

**SET_READY**
```json
{ "type": "SET_READY", "ready": true }
```

**START_GAME**
```json
{ "type": "START_GAME" }
```

**PLAYER_ACTION**
```json
{
  "type": "PLAYER_ACTION",
  "action": {
    "type": "MOVE",
    "direction": "UP" // UP, DOWN, LEFT, RIGHT
  }
}
```

```json
{
  "type": "PLAYER_ACTION",
  "action": { "type": "PLACE_BOMB" }
}
```

### Server → Client

**CONNECTED**
```json
{ "type": "CONNECTED", "playerId": "player_123" }
```

**LOBBY_LIST**
```json
{
  "type": "LOBBY_LIST",
  "lobbies": [
    {
      "id": "lobby_1",
      "name": "Game 1",
      "playerCount": 2,
      "maxPlayers": 4,
      "gameStarted": false
    }
  ]
}
```

**GAME_STATE**
```json
{
  "type": "GAME_STATE",
  "state": {
    "map": { "width": 15, "height": 15, "tiles": [[...]], "upgrades": [...] },
    "players": [...],
    "bombs": [...],
    "explosions": [...],
    "gameOver": false,
    "winner": null
  }
}
```

## Environment Variables

- `PORT` - Server port (default: 8080)
- `MAPS_DIR` - Directory containing map files (default: `./maps`)

## Development

```bash
# Install dependencies
npm install

# Run locally
npm start

# Run with auto-reload
npm run dev
```

## Deployment

```bash
# Build Docker image
docker build -t your-registry/bomberman-server:latest .

# Push to registry
docker push your-registry/bomberman-server:latest

# Deploy to Kubernetes
kubectl apply -f deployment.yaml
```

## Game Configuration

Edit `src/config/gameConfig.js` to adjust:

- Max players per lobby
- Bomb timer duration
- Explosion duration
- Player speeds
- Default stats
- Upgrade definitions

## License

ISC


