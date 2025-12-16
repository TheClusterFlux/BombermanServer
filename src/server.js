const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const LobbyManager = require('./game/LobbyManager');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const lobbyManager = new LobbyManager();
const clients = new Map(); // ws -> {id, username}

// Load maps from config directory or environment
const MAPS_DIR = process.env.MAPS_DIR || path.join(__dirname, '../maps');
const availableMaps = new Map();

function loadMaps() {
  try {
    const files = fs.readdirSync(MAPS_DIR);
    for (const file of files) {
      if (file.endsWith('.txt')) {
        const mapName = file.replace('.txt', '');
        const mapContent = fs.readFileSync(path.join(MAPS_DIR, file), 'utf-8');
        availableMaps.set(mapName, mapContent);
        console.log(`Loaded map: ${mapName}`);
      }
    }
  } catch (err) {
    console.log('No maps directory found, using default map');
    // Default map if no maps directory exists
    availableMaps.set('default', `
#################
#S.X.X.X.X.X.X.S#
#.#.#.#.#.#.#.#.#
#X.X.X.X.X.X.X.X#
#.#.#.#O#.#.#.#.#
#X.X.X.X.X.X.X.X#
#.#.#.#.#.#.#.#.#
#X.X.X.X.X.X.X.X#
#.#.#.#O#.#.#.#.#
#X.X.X.X.X.X.X.X#
#.#.#.#.#.#.#.#.#
#X.X.X.X.X.X.X.X#
#.#.#.#.#.#.#.#.#
#S.X.X.X.X.X.X.S#
#################
`.trim());
  }
}

loadMaps();

// Generate unique player ID
function generatePlayerId() {
  return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', lobbies: lobbyManager.lobbies.size });
});

// Root endpoint for WebSocket info
app.get('/', (req, res) => {
  res.json({ 
    service: 'Bomberman WebSocket Server',
    status: 'ok',
    lobbies: lobbyManager.lobbies.size,
    info: 'Use WebSocket connection to connect'
  });
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  const playerId = generatePlayerId();
  console.log(`Player connected: ${playerId}`);
  
  clients.set(ws, { id: playerId, username: 'Player' });
  
  // Send player their ID
  ws.send(JSON.stringify({
    type: 'CONNECTED',
    playerId: playerId
  }));
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleMessage(ws, message);
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  });
  
  ws.on('close', () => {
    const client = clients.get(ws);
    if (client) {
      console.log(`Player disconnected: ${client.id}`);
      
      // Remove player from their lobby
      const lobby = lobbyManager.findPlayerLobby(client.id);
      if (lobby) {
        lobbyManager.leaveLobby(lobby.id, client.id);
        
        // Notify other players
        lobby.broadcast({
          type: 'PLAYER_LEFT',
          playerId: client.id,
          lobbyInfo: lobby.getLobbyInfo()
        });
      }
      
      clients.delete(ws);
    }
  });
});

function handleMessage(ws, message) {
  const client = clients.get(ws);
  if (!client) return;
  
  switch (message.type) {
    case 'SET_USERNAME':
      client.username = message.username || 'Player';
      ws.send(JSON.stringify({
        type: 'USERNAME_SET',
        username: client.username
      }));
      break;
      
    case 'GET_LOBBIES':
      ws.send(JSON.stringify({
        type: 'LOBBY_LIST',
        lobbies: lobbyManager.getAllLobbies()
      }));
      break;
      
    case 'GET_MAPS':
      ws.send(JSON.stringify({
        type: 'MAP_LIST',
        maps: Array.from(availableMaps.keys())
      }));
      break;
      
    case 'CREATE_LOBBY':
      const mapName = message.mapName || 'default';
      const mapString = availableMaps.get(mapName) || availableMaps.get('default');
      const lobby = lobbyManager.createLobby(
        message.lobbyName || 'New Game',
        client.id,
        client.username,
        ws,
        mapString
      );
      
      ws.send(JSON.stringify({
        type: 'LOBBY_JOINED',
        lobby: lobby.getLobbyInfo()
      }));
      break;
      
    case 'JOIN_LOBBY':
      const joinedLobby = lobbyManager.joinLobby(message.lobbyId, client.id, client.username, ws);
      if (joinedLobby) {
        // Send LOBBY_JOINED to the joining player
        ws.send(JSON.stringify({
          type: 'LOBBY_JOINED',
          lobby: joinedLobby.getLobbyInfo()
        }));
        
        // Notify all other players in lobby
        joinedLobby.broadcast({
          type: 'PLAYER_JOINED',
          lobbyInfo: joinedLobby.getLobbyInfo()
        });
      } else {
        ws.send(JSON.stringify({
          type: 'ERROR',
          message: 'Could not join lobby'
        }));
      }
      break;
      
    case 'LEAVE_LOBBY':
      const currentLobby = lobbyManager.findPlayerLobby(client.id);
      if (currentLobby) {
        lobbyManager.leaveLobby(currentLobby.id, client.id);
        currentLobby.broadcast({
          type: 'PLAYER_LEFT',
          playerId: client.id,
          lobbyInfo: currentLobby.getLobbyInfo()
        });
        
        ws.send(JSON.stringify({
          type: 'LEFT_LOBBY'
        }));
      }
      break;
      
    case 'SET_READY':
      const readyLobby = lobbyManager.findPlayerLobby(client.id);
      if (readyLobby) {
        readyLobby.setPlayerReady(client.id, message.ready);
        readyLobby.broadcast({
          type: 'LOBBY_UPDATED',
          lobbyInfo: readyLobby.getLobbyInfo()
        });
      }
      break;
      
    case 'START_GAME':
      const startLobby = lobbyManager.findPlayerLobby(client.id);
      if (startLobby && startLobby.hostId === client.id) {
        if (startLobby.startGame()) {
          startLobby.broadcast({
            type: 'GAME_STARTED',
            lobbyInfo: startLobby.getLobbyInfo()
          });
          
          // Send initial game state
          startLobby.broadcastGameState();
        } else {
          ws.send(JSON.stringify({
            type: 'ERROR',
            message: 'Cannot start game - not all players ready'
          }));
        }
      }
      break;
      
    case 'PLAYER_ACTION':
      const gameLobby = lobbyManager.findPlayerLobby(client.id);
      if (gameLobby && gameLobby.gameStarted) {
        // Pass the entire action object (may contain vx/vy for diagonal movement)
        gameLobby.handlePlayerAction(client.id, message.action);
      }
      break;
  }
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Bomberman server running on port ${PORT}`);
  console.log(`Available maps: ${Array.from(availableMaps.keys()).join(', ')}`);
});


