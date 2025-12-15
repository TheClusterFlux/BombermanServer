const GameEngine = require('./GameEngine');
const GAME_CONFIG = require('../config/gameConfig');

class Lobby {
  constructor(id, name, hostId, mapString) {
    this.id = id;
    this.name = name;
    this.hostId = hostId;
    this.mapString = mapString;
    this.players = new Map(); // playerId -> {id, username, ready, client}
    this.gameEngine = null;
    this.gameStarted = false;
    this.gameInterval = null;
  }
  
  addPlayer(playerId, username, client) {
    if (this.players.size >= GAME_CONFIG.maxPlayersPerLobby) {
      return false;
    }
    
    if (this.gameStarted) {
      return false;
    }
    
    const isHost = playerId === this.hostId;
    console.log(`Adding player ${username} (${playerId}), isHost: ${isHost}, hostId: ${this.hostId}, ready: ${isHost}`);
    
    this.players.set(playerId, {
      id: playerId,
      username: username,
      ready: isHost, // Host is always ready
      client: client
    });
    
    return true;
  }
  
  removePlayer(playerId) {
    this.players.delete(playerId);
    
    // If host left, assign new host
    if (playerId === this.hostId && this.players.size > 0) {
      this.hostId = Array.from(this.players.keys())[0];
      const newHost = this.players.get(this.hostId);
      newHost.ready = true;
    }
    
    return this.players.size === 0; // Return true if lobby is empty
  }
  
  setPlayerReady(playerId, ready) {
    const player = this.players.get(playerId);
    console.log(`setPlayerReady called for ${playerId}, isHost: ${playerId === this.hostId}, ready: ${ready}`);
    if (player && playerId !== this.hostId) { // Host is always ready
      player.ready = ready;
      console.log(`Player ${playerId} ready state updated to: ${ready}`);
    } else if (playerId === this.hostId) {
      console.log(`Ignoring ready change for host - host is always ready`);
    }
  }
  
  canStartGame() {
    if (this.gameStarted) {
      console.log('Cannot start: game already started');
      return false;
    }
    if (this.players.size < GAME_CONFIG.minPlayersToStart) {
      console.log('Cannot start: not enough players', this.players.size, '/', GAME_CONFIG.minPlayersToStart);
      return false;
    }
    
    // Check if all players are ready
    for (const player of this.players.values()) {
      if (!player.ready) {
        console.log('Cannot start: player not ready:', player.username, player.id);
        return false;
      }
    }
    
    console.log('Can start game! All conditions met.');
    return true;
  }
  
  startGame() {
    if (!this.canStartGame()) {
      console.log('Cannot start game - conditions not met');
      return false;
    }
    
    try {
      this.gameStarted = true;
    
    // Create game engine
    const playerData = Array.from(this.players.values()).map(p => ({
      id: p.id,
      username: p.username
    }));
    
    console.log('Starting game with map string length:', this.mapString ? this.mapString.length : 'undefined');
    console.log('Map string type:', typeof this.mapString);
    console.log('Map string first 50 chars:', this.mapString ? this.mapString.substring(0, 50) : 'N/A');
    this.gameEngine = new GameEngine(this.mapString, playerData);
    
    // Start game loop
    this.gameInterval = setInterval(() => {
      const events = this.gameEngine.update();
      
      // Broadcast game state to all players
      this.broadcastGameState();
      
      // Broadcast events
      if (events.length > 0) {
        this.broadcast({
          type: 'GAME_EVENTS',
          events: events
        });
      }
      
      // Check if game is over
      if (this.gameEngine.gameOver) {
        this.endGame();
      }
    }, 1000 / GAME_CONFIG.tickRate);
    
      return true;
    } catch (error) {
      console.error('Error starting game:', error);
      this.gameStarted = false;
      this.gameEngine = null;
      if (this.gameInterval) {
        clearInterval(this.gameInterval);
        this.gameInterval = null;
      }
      return false;
    }
  }
  
  endGame() {
    if (this.gameInterval) {
      clearInterval(this.gameInterval);
      this.gameInterval = null;
    }
  }
  
  handlePlayerAction(playerId, action) {
    if (!this.gameStarted || !this.gameEngine) return;
    
    switch (action.type) {
      case 'MOVE':
        // Pass the entire action object (contains vx, vy)
        this.gameEngine.handlePlayerMove(playerId, action);
        break;
      case 'PLACE_BOMB':
        const bomb = this.gameEngine.handlePlaceBomb(playerId);
        if (bomb) {
          this.broadcast({
            type: 'BOMB_PLACED',
            bomb: bomb.serialize()
          });
        }
        break;
    }
  }
  
  broadcastGameState() {
    if (!this.gameEngine) return;
    
    const gameState = this.gameEngine.getGameState();
    this.broadcast({
      type: 'GAME_STATE',
      state: gameState
    });
  }
  
  broadcast(message) {
    const messageStr = JSON.stringify(message);
    for (const player of this.players.values()) {
      if (player.client && player.client.readyState === 1) { // WebSocket.OPEN
        player.client.send(messageStr);
      }
    }
  }
  
  sendToPlayer(playerId, message) {
    const player = this.players.get(playerId);
    if (player && player.client && player.client.readyState === 1) {
      player.client.send(JSON.stringify(message));
    }
  }
  
  getLobbyInfo() {
    return {
      id: this.id,
      name: this.name,
      hostId: this.hostId,
      playerCount: this.players.size,
      maxPlayers: GAME_CONFIG.maxPlayersPerLobby,
      gameStarted: this.gameStarted,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        username: p.username,
        ready: p.ready
      }))
    };
  }
  
  destroy() {
    this.endGame();
    this.players.clear();
  }
}

module.exports = Lobby;


