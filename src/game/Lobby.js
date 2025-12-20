const GameEngine = require('./GameEngine');
const GAME_CONFIG = require('../config/gameConfig');

// Default game settings
const DEFAULT_SETTINGS = {
  playerSpeed: GAME_CONFIG.defaultPlayerSpeed,
  bombCount: GAME_CONFIG.defaultBombCount,
  explosionRange: GAME_CONFIG.defaultExplosionRange,
  bombTimer: GAME_CONFIG.bombTimer,
  upgradeSpawnChance: 0.3, // 30% chance to spawn upgrade when box destroyed
};

class Lobby {
  constructor(id, name, hostId, mapString, mapName) {
    this.id = id;
    this.name = name;
    this.hostId = hostId;
    this.mapString = mapString;
    this.mapName = mapName || 'default';
    this.players = new Map(); // playerId -> {id, username, ready, client}
    this.gameEngine = null;
    this.gameStarted = false;
    this.gameInterval = null;
    
    // Custom game settings (host can modify)
    this.settings = { ...DEFAULT_SETTINGS };
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
    if (player && playerId !== this.hostId) { // Host is always ready
      player.ready = ready;
    }
  }
  
  // Reset all players' ready state (except host)
  resetReadyStates() {
    for (const [playerId, player] of this.players) {
      if (playerId !== this.hostId) {
        player.ready = false;
      }
    }
  }
  
  // Change map (host only) - resets ready states
  setMap(mapString, mapName) {
    this.mapString = mapString;
    this.mapName = mapName;
    this.resetReadyStates();
    return true;
  }
  
  // Update game settings (host only) - resets ready states
  updateSettings(newSettings) {
    let changed = false;
    
    // Validate and apply each setting
    if (newSettings.playerSpeed !== undefined) {
      const speed = parseFloat(newSettings.playerSpeed);
      if (speed >= 1 && speed <= 10) {
        this.settings.playerSpeed = speed;
        changed = true;
      }
    }
    
    if (newSettings.bombCount !== undefined) {
      const count = parseInt(newSettings.bombCount);
      if (count >= 1 && count <= 10) {
        this.settings.bombCount = count;
        changed = true;
      }
    }
    
    if (newSettings.explosionRange !== undefined) {
      const range = parseInt(newSettings.explosionRange);
      if (range >= 1 && range <= 10) {
        this.settings.explosionRange = range;
        changed = true;
      }
    }
    
    if (newSettings.bombTimer !== undefined) {
      const timer = parseInt(newSettings.bombTimer);
      if (timer >= 1000 && timer <= 10000) {
        this.settings.bombTimer = timer;
        changed = true;
      }
    }
    
    if (newSettings.upgradeSpawnChance !== undefined) {
      const chance = parseFloat(newSettings.upgradeSpawnChance);
      if (chance >= 0 && chance <= 1) {
        this.settings.upgradeSpawnChance = chance;
        changed = true;
      }
    }
    
    if (changed) {
      this.resetReadyStates();
    }
    
    return changed;
  }
  
  // Reset settings to defaults
  resetSettings() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.resetReadyStates();
  }
  
  canStartGame() {
    if (this.gameStarted) {
      return false;
    }
    if (this.players.size < GAME_CONFIG.minPlayersToStart) {
      return false;
    }
    
    // Check if all players are ready
    for (const player of this.players.values()) {
      if (!player.ready) {
        return false;
      }
    }
    
    return true;
  }
  
  startGame() {
    if (!this.canStartGame()) {
      console.log('Cannot start game - conditions not met');
      return false;
    }
    
    try {
      this.gameStarted = true;
    
      // Create game engine with custom settings
      const playerData = Array.from(this.players.values()).map(p => ({
        id: p.id,
        username: p.username
      }));
      
      this.gameEngine = new GameEngine(this.mapString, playerData, this.settings);
      
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
    
    // Reset game state but keep players in lobby
    this.gameStarted = false;
    this.gameEngine = null;
    
    // Reset all ready states
    this.resetReadyStates();
    
    // Notify all players to return to lobby
    this.broadcast({
      type: 'RETURN_TO_LOBBY',
      lobbyInfo: this.getLobbyInfo()
    });
  }
  
  handlePlayerAction(playerId, action) {
    if (!this.gameStarted || !this.gameEngine) return;
    
    switch (action.type) {
      case 'MOVE':
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
      mapName: this.mapName,
      settings: this.settings,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        username: p.username,
        ready: p.ready
      }))
    };
  }
  
  // Get default settings for UI
  static getDefaultSettings() {
    return { ...DEFAULT_SETTINGS };
  }
  
  destroy() {
    this.endGame();
    this.players.clear();
  }
}

module.exports = Lobby;
