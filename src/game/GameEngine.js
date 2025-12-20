const GameMap = require('./Map');
const Player = require('./Player');
const Bomb = require('./Bomb');
const GAME_CONFIG = require('../config/gameConfig');

class GameEngine {
  constructor(mapString, players, customSettings = {}) {
    console.log('GameEngine constructor - mapString type:', typeof mapString, 'length:', mapString ? mapString.length : 'N/A');
    this.map = new GameMap(mapString);
    this.players = new Map();
    this.bombs = new Map();
    this.explosions = [];
    this.gameOver = false;
    this.winner = null;
    this.bombIdCounter = 0;
    
    // Custom game settings
    this.settings = {
      playerSpeed: customSettings.playerSpeed || GAME_CONFIG.defaultPlayerSpeed,
      bombCount: customSettings.bombCount || GAME_CONFIG.defaultBombCount,
      explosionRange: customSettings.explosionRange || GAME_CONFIG.defaultExplosionRange,
      bombTimer: customSettings.bombTimer || GAME_CONFIG.bombTimer,
      upgradeSpawnChance: customSettings.upgradeSpawnChance || 0.3
    };
    
    // Pass settings to map for upgrade spawning
    this.map.upgradeSpawnChance = this.settings.upgradeSpawnChance;
    
    // Tick tracking for synchronization
    this.tick = 0;
    this.startTime = Date.now();
    
    // Initialize players at spawn points with custom settings
    players.forEach((playerData, index) => {
      const spawnPoint = this.map.getSpawnPoint(index);
      const player = new Player(playerData.id, playerData.username, spawnPoint, this.settings);
      this.players.set(player.id, player);
    });
    
    this.lastUpdate = Date.now();
  }
  
  update() {
    const now = Date.now();
    const deltaTime = (now - this.lastUpdate) / 1000; // Convert to seconds
    this.lastUpdate = now;
    this.tick++;
    
    const events = [];
    
    // Update player positions
    const allPlayers = Array.from(this.players.values());
    for (const player of allPlayers) {
      if (player.alive) {
        // Only run server physics if client didn't send authoritative position
        if (!player.clientAuthoritative) {
          player.updatePosition(deltaTime, this.map, allPlayers, this.bombs);
        }
        // Reset flag for next frame
        player.clientAuthoritative = false;
        
        // Check if player fell into a hole
        if (player.isOnHole(this.map)) {
          player.kill();
          events.push({
            type: 'PLAYER_FELL',
            playerId: player.id
          });
          console.log(`Player ${player.username} fell into a hole!`);
        }
        
        // Check for upgrade pickup
        const px = Math.floor(player.x);
        const py = Math.floor(player.y);
        const upgrade = this.map.getUpgradeAt(px, py);
        if (upgrade) {
          player.applyUpgrade(upgrade);
          events.push({
            type: 'UPGRADE_COLLECTED',
            playerId: player.id,
            upgrade: upgrade
          });
        }
      }
    }
    
    // Update bombs and handle chain reactions
    const bombsToExplode = [];
    
    for (const [bombId, bomb] of this.bombs.entries()) {
      if (bomb.update(deltaTime)) {
        bombsToExplode.push(bombId);
      }
    }
    
    // Process explosions (including chain reactions)
    const explodedThisFrame = new Set();
    
    while (bombsToExplode.length > 0) {
      const bombId = bombsToExplode.shift();
      const bomb = this.bombs.get(bombId);
      
      if (!bomb || explodedThisFrame.has(bombId)) continue;
      
      // Bomb exploded
      const result = bomb.explode(this.map, Array.from(this.players.values()), this.bombs);
      
      this.explosions.push({
        tiles: result.tiles,
        timestamp: now,
        duration: GAME_CONFIG.explosionDuration,
        propagationDelay: GAME_CONFIG.explosionPropagationDelay,
        originX: bomb.x,
        originY: bomb.y
      });
      
      events.push({
        type: 'EXPLOSION',
        bombId: bombId,
        tiles: result.tiles,
        killedPlayers: result.players,
        chainReaction: result.chainBombs.length > 0
      });
      
      // Add chain reaction bombs to explosion queue
      for (const chainBombId of result.chainBombs) {
        if (!explodedThisFrame.has(chainBombId)) {
          bombsToExplode.push(chainBombId);
          console.log(`Adding chain bomb ${chainBombId} to explosion queue`);
        }
      }
      
      // Decrement bomb count for player
      const player = this.players.get(bomb.playerId);
      if (player) {
        player.activeBombs--;
      }
      
      explodedThisFrame.add(bombId);
      this.bombs.delete(bombId);
    }
    
    // Clean up old explosions
    this.explosions = this.explosions.filter(exp => {
      return (now - exp.timestamp) < exp.duration;
    });
    
    // Check explosion propagation effects (players and chain reactions)
    const chainBombsToExplode = [];
    
    for (const explosion of this.explosions) {
      const age = now - explosion.timestamp;
      
      for (const tile of explosion.tiles) {
        // Check if this tile has been reached by propagation
        const tileActivationTime = tile.distance * explosion.propagationDelay;
        if (age < tileActivationTime) continue;
        
        // Mark tile as active if not already
        if (!tile.active) {
          tile.active = true;
          
          // Check for chain reaction - bombs hit by newly activated tile
          for (const [bombId, bomb] of this.bombs.entries()) {
            if (bomb.exploded) continue;
            if (bomb.x === tile.x && bomb.y === tile.y) {
              console.log(`Chain reaction! Bomb at (${tile.x}, ${tile.y}) hit by propagating explosion`);
              chainBombsToExplode.push(bombId);
            }
          }
        }
        
        // Check players standing in active tile
        for (const player of allPlayers) {
          if (!player.alive) continue;
          
          const px = Math.floor(player.x);
          const py = Math.floor(player.y);
          
          if (tile.x === px && tile.y === py) {
            player.kill();
            events.push({
              type: 'PLAYER_KILLED',
              playerId: player.id,
              cause: 'explosion'
            });
            console.log(`Player ${player.username} killed by explosion at (${px}, ${py})`);
          }
        }
      }
    }
    
    // Process chain reactions from propagation
    for (const bombId of chainBombsToExplode) {
      const bomb = this.bombs.get(bombId);
      if (!bomb || bomb.exploded) continue;
      
      const result = bomb.explode(this.map, allPlayers, this.bombs);
      
      this.explosions.push({
        tiles: result.tiles,
        timestamp: now,
        duration: GAME_CONFIG.explosionDuration,
        propagationDelay: GAME_CONFIG.explosionPropagationDelay,
        originX: bomb.x,
        originY: bomb.y
      });
      
      events.push({
        type: 'EXPLOSION',
        bombId: bombId,
        tiles: result.tiles,
        killedPlayers: result.players,
        chainReaction: true
      });
      
      const player = this.players.get(bomb.playerId);
      if (player) {
        player.activeBombs--;
      }
      
      this.bombs.delete(bombId);
    }
    
    // Check for game over
    if (!this.gameOver) {
      const alivePlayers = Array.from(this.players.values()).filter(p => p.alive);
      if (alivePlayers.length <= 1) {
        this.gameOver = true;
        this.winner = alivePlayers.length === 1 ? alivePlayers[0] : null;
        events.push({
          type: 'GAME_OVER',
          winner: this.winner ? this.winner.serialize() : null
        });
      }
    }
    
    return events;
  }
  
  handlePlayerMove(playerId, action) {
    const player = this.players.get(playerId);
    if (!player || !player.alive) return false;
    
    // If client sends position directly, validate and accept it
    // This is the client-authoritative position, so we skip server physics for this player
    if (action.x !== undefined && action.y !== undefined) {
      const newX = action.x;
      const newY = action.y;
      
      // Validate the position is reasonable (not teleporting, not in walls)
      const dx = newX - player.x;
      const dy = newY - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Max distance per network update (generous to account for latency)
      const maxDistance = 2.0;
      
      if (distance <= maxDistance) {
        // Check if new position is valid (not in walls, not in other players)
        if (player.canMoveTo(newX, newY, this.map, Array.from(this.players.values()), this.bombs)) {
          player.x = newX;
          player.y = newY;
          // Mark that we accepted client position - skip server physics this frame
          player.clientAuthoritative = true;
        }
        // If position invalid (e.g., collision with other player), keep old position
      }
      // If teleporting, ignore
    }
    
    // Handle velocity for server physics (only used when client doesn't send position)
    let vx = 0;
    let vy = 0;
    
    if (action.vx !== undefined && action.vy !== undefined) {
      vx = action.vx;
      vy = action.vy;
    }
    
    player.setVelocity(vx, vy);
    return true;
  }
  
  handlePlaceBomb(playerId) {
    const player = this.players.get(playerId);
    if (!player || !player.canPlaceBomb()) {
      return null;
    }
    
    const bombX = Math.floor(player.x);
    const bombY = Math.floor(player.y);
    
    // Check if there's already a bomb here
    for (const bomb of this.bombs.values()) {
      if (bomb.x === bombX && bomb.y === bombY) {
        return null;
      }
    }
    
    const bombId = `bomb_${this.bombIdCounter++}`;
    const bomb = new Bomb(bombId, bombX, bombY, player.explosionRange, playerId);
    this.bombs.set(bombId, bomb);
    player.activeBombs++;
    
    return bomb;
  }
  
  getGameState() {
    return {
      tick: this.tick,
      serverTime: Date.now(),
      map: this.map.serialize(),
      players: Array.from(this.players.values()).map(p => p.serialize()),
      bombs: Array.from(this.bombs.values()).map(b => b.serialize()),
      explosions: this.explosions,
      gameOver: this.gameOver,
      winner: this.winner ? this.winner.serialize() : null
    };
  }
}

module.exports = GameEngine;


