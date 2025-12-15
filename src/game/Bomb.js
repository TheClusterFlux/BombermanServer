const GAME_CONFIG = require('../config/gameConfig');

class Bomb {
  constructor(id, x, y, range, playerId) {
    this.id = id;
    this.x = Math.floor(x);
    this.y = Math.floor(y);
    this.range = range;
    this.playerId = playerId;
    this.timer = GAME_CONFIG.bombTimer;
    this.exploded = false;
  }
  
  update(deltaTime) {
    this.timer -= deltaTime * 1000; // Convert to ms
    return this.timer <= 0;
  }
  
  explode(map, players, allBombs) {
    if (this.exploded) return { tiles: [], players: [], chainBombs: [] };
    
    this.exploded = true;
    const affectedTiles = [];
    const killedPlayers = [];
    const chainBombs = []; // Bombs hit by this explosion
    
    // Check all four directions
    const directions = [
      { dx: 1, dy: 0 },  // Right
      { dx: -1, dy: 0 }, // Left
      { dx: 0, dy: 1 },  // Down
      { dx: 0, dy: -1 }  // Up
    ];
    
    // Add bomb position itself
    affectedTiles.push({ x: this.x, y: this.y });
    
    for (const dir of directions) {
      for (let i = 1; i <= this.range; i++) {
        const x = this.x + dir.dx * i;
        const y = this.y + dir.dy * i;
        
        const tile = map.getTile(x, y);
        
        // Wall blocks explosion
        if (tile === GAME_CONFIG.tiles.WALL) {
          break;
        }
        
        // Hole blocks explosion
        if (tile === GAME_CONFIG.tiles.HOLE) {
          break;
        }
        
        affectedTiles.push({ x, y });
        
        // Box blocks further explosion but gets destroyed
        if (tile === GAME_CONFIG.tiles.BOX) {
          console.log(`Destroying box at (${x}, ${y}), tile was: '${tile}'`);
          map.destroyBox(x, y);
          break;
        }
      }
    }
    
    // Check if any bombs are caught in explosion (chain reaction!)
    if (allBombs) {
      for (const [bombId, bomb] of allBombs.entries()) {
        if (bomb.id === this.id || bomb.exploded) continue;
        
        if (affectedTiles.some(t => t.x === bomb.x && t.y === bomb.y)) {
          console.log(`Chain reaction! Bomb at (${bomb.x}, ${bomb.y}) hit by explosion`);
          chainBombs.push(bombId);
        }
      }
    }
    
    // Check if any players are caught in explosion
    for (const player of players) {
      if (!player.alive) continue;
      
      const px = Math.floor(player.x);
      const py = Math.floor(player.y);
      
      if (affectedTiles.some(t => t.x === px && t.y === py)) {
        player.kill();
        killedPlayers.push(player.id);
      }
    }
    
    return { tiles: affectedTiles, players: killedPlayers, chainBombs: chainBombs };
  }
  
  serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      range: this.range,
      playerId: this.playerId,
      timer: this.timer
    };
  }
}

module.exports = Bomb;


