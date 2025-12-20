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
    
    // Add bomb position itself (distance 0)
    affectedTiles.push({ x: this.x, y: this.y, distance: 0 });
    
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
        
        // Distance from bomb center for propagation timing
        affectedTiles.push({ x, y, distance: i });
        
        // Box blocks further explosion but gets destroyed
        if (tile === GAME_CONFIG.tiles.BOX) {
          console.log(`Destroying box at (${x}, ${y}), tile was: '${tile}'`);
          map.destroyBox(x, y);
          break;
        }
      }
    }
    
    // Chain reaction detection moved to GameEngine.update() for propagation timing
    // Only instant chain reaction for bombs at center (distance 0)
    if (allBombs) {
      for (const [bombId, bomb] of allBombs.entries()) {
        if (bomb.id === this.id || bomb.exploded) continue;
        
        // Only chain instantly if bomb is at explosion center
        if (bomb.x === this.x && bomb.y === this.y) {
          console.log(`Instant chain reaction! Bomb at center (${bomb.x}, ${bomb.y})`);
          chainBombs.push(bombId);
        }
      }
    }
    
    // NOTE: Player kills are now handled in GameEngine.update() with propagation timing
    // We still return killedPlayers for instant-kill at center (distance 0)
    for (const player of players) {
      if (!player.alive) continue;
      
      const px = Math.floor(player.x);
      const py = Math.floor(player.y);
      
      // Only instant kill at bomb center (distance 0)
      const centerTile = affectedTiles.find(t => t.distance === 0);
      if (centerTile && centerTile.x === px && centerTile.y === py) {
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


