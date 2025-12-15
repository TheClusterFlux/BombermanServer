const GameMap = require('./Map');
const Player = require('./Player');
const Bomb = require('./Bomb');
const GAME_CONFIG = require('../config/gameConfig');

class GameEngine {
  constructor(mapString, players) {
    console.log('GameEngine constructor - mapString type:', typeof mapString, 'length:', mapString ? mapString.length : 'N/A');
    this.map = new GameMap(mapString);
    this.players = new Map();
    this.bombs = new Map();
    this.explosions = [];
    this.gameOver = false;
    this.winner = null;
    this.bombIdCounter = 0;
    
    // Initialize players at spawn points
    players.forEach((playerData, index) => {
      const spawnPoint = this.map.getSpawnPoint(index);
      const player = new Player(playerData.id, playerData.username, spawnPoint);
      this.players.set(player.id, player);
    });
    
    this.lastUpdate = Date.now();
  }
  
  update() {
    const now = Date.now();
    const deltaTime = (now - this.lastUpdate) / 1000; // Convert to seconds
    this.lastUpdate = now;
    
    const events = [];
    
    // Update player positions
    const allPlayers = Array.from(this.players.values());
    for (const player of allPlayers) {
      if (player.alive) {
        player.updatePosition(deltaTime, this.map, allPlayers, this.bombs);
        
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
        duration: GAME_CONFIG.explosionDuration
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
    
    let vx = 0;
    let vy = 0;
    
    // Use velocity values from client (supports diagonal movement)
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


