const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const LobbyManager = require('./game/LobbyManager');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

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
      const createMapName = message.mapName || 'default';
      const createMapString = availableMaps.get(createMapName) || availableMaps.get('default');
      const lobby = lobbyManager.createLobby(
        message.lobbyName || 'New Game',
        client.id,
        client.username,
        ws,
        createMapString,
        createMapName
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
      
    case 'CHANGE_MAP':
      const mapChangeLobby = lobbyManager.findPlayerLobby(client.id);
      if (mapChangeLobby && mapChangeLobby.hostId === client.id && !mapChangeLobby.gameStarted) {
        const newMapName = message.mapName || 'default';
        const newMapString = availableMaps.get(newMapName) || availableMaps.get('default');
        mapChangeLobby.setMap(newMapString, newMapName);
        mapChangeLobby.broadcast({
          type: 'LOBBY_UPDATED',
          lobbyInfo: mapChangeLobby.getLobbyInfo()
        });
      }
      break;
      
    case 'UPDATE_SETTINGS':
      const settingsLobby = lobbyManager.findPlayerLobby(client.id);
      if (settingsLobby && settingsLobby.hostId === client.id && !settingsLobby.gameStarted) {
        if (settingsLobby.updateSettings(message.settings)) {
          settingsLobby.broadcast({
            type: 'LOBBY_UPDATED',
            lobbyInfo: settingsLobby.getLobbyInfo()
          });
        }
      }
      break;
      
    case 'RESET_SETTINGS':
      const resetLobby = lobbyManager.findPlayerLobby(client.id);
      if (resetLobby && resetLobby.hostId === client.id && !resetLobby.gameStarted) {
        resetLobby.resetSettings();
        resetLobby.broadcast({
          type: 'LOBBY_UPDATED',
          lobbyInfo: resetLobby.getLobbyInfo()
        });
      }
      break;
      
    case 'RETURN_TO_LOBBY_REQUEST':
      const returnLobby = lobbyManager.findPlayerLobby(client.id);
      if (returnLobby) {
        returnLobby.playerReturnToLobby(client.id);
        // Notify others that player returned
        returnLobby.broadcast({
          type: 'LOBBY_UPDATED',
          lobbyInfo: returnLobby.getLobbyInfo()
        });
      }
      break;
      
    case 'KICK_PLAYER':
      const kickLobby = lobbyManager.findPlayerLobby(client.id);
      if (kickLobby && kickLobby.hostId === client.id && !kickLobby.gameStarted) {
        const targetId = message.playerId;
        if (targetId && targetId !== client.id) {
          if (kickLobby.kickPlayer(targetId)) {
            kickLobby.broadcast({
              type: 'PLAYER_LEFT',
              playerId: targetId,
              kicked: true,
              lobbyInfo: kickLobby.getLobbyInfo()
            });
          }
        }
      }
      break;
  }
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Bomberman server running on port ${PORT}`);
  console.log(`Available maps: ${Array.from(availableMaps.keys()).join(', ')}`);
});


