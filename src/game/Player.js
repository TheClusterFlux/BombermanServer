const GAME_CONFIG = require('../config/gameConfig');

class Player {
  constructor(id, username, spawnPoint, customSettings = {}) {
    this.id = id;
    this.username = username;
    this.x = spawnPoint.x + 0.5; // Center of tile
    this.y = spawnPoint.y + 0.5;
    this.alive = true;
    
    // Stats (can be upgraded) - use custom settings if provided
    this.speed = customSettings.playerSpeed || GAME_CONFIG.defaultPlayerSpeed;
    this.maxBombs = customSettings.bombCount || GAME_CONFIG.defaultBombCount;
    this.explosionRange = customSettings.explosionRange || GAME_CONFIG.defaultExplosionRange;
    this.activeBombs = 0;
    
    // Movement (continuous, non-grid-locked)
    this.velocityX = 0;
    this.velocityY = 0;
    this.radius = 0.35; // Player collision radius (smaller than 0.5 tile)
  }
  
  setVelocity(vx, vy) {
    // Normalize diagonal movement
    const length = Math.sqrt(vx * vx + vy * vy);
    if (length > 0) {
      this.velocityX = (vx / length) * this.speed;
      this.velocityY = (vy / length) * this.speed;
    } else {
      this.velocityX = 0;
      this.velocityY = 0;
    }
  }
  
  updatePosition(deltaTime, map, otherPlayers, bombs) {
    if (this.velocityX === 0 && this.velocityY === 0) return;
    
    // Calculate new position
    let newX = this.x + this.velocityX * deltaTime;
    let newY = this.y + this.velocityY * deltaTime;
    
    // Try moving diagonally first (full velocity)
    const canMoveDiagonal = this.canMoveTo(newX, newY, map, otherPlayers, bombs);
    if (canMoveDiagonal) {
      this.x = newX;
      this.y = newY;
      return;
    }
    
    // If diagonal blocked, try each axis independently
    // This allows sliding along walls while holding both keys
    const canMoveX = this.canMoveTo(newX, this.y, map, otherPlayers, bombs);
    const canMoveY = this.canMoveTo(this.x, newY, map, otherPlayers, bombs);
    
    // Move on whichever axis is free
    // Keep checking both so if one opens up, we move in that direction too
    if (canMoveX) {
      this.x = newX;
    }
    if (canMoveY) {
      this.y = newY;
    }
    
    // If both individual axes work but diagonal didn't, try moving to the position
    // This handles cases where collision detection is more strict on diagonal
    if (canMoveX && canMoveY && !canMoveDiagonal) {
      const finalCanMove = this.canMoveTo(this.x, this.y, map, otherPlayers, bombs);
      if (finalCanMove) {
        // Position is valid, we're good
      }
    }
  }
  
  canMoveTo(x, y, map, otherPlayers, bombs) {
    // Check collision with map tiles (walls and boxes - holes are passable but deadly)
    const checkPoints = [
      { dx: -this.radius, dy: -this.radius }, // Top-left
      { dx: this.radius, dy: -this.radius },  // Top-right
      { dx: -this.radius, dy: this.radius },  // Bottom-left
      { dx: this.radius, dy: this.radius }    // Bottom-right
    ];
    
    for (const point of checkPoints) {
      const checkX = Math.floor(x + point.dx);
      const checkY = Math.floor(y + point.dy);
      const tile = map.getTile(checkX, checkY);
      
      // Only walls and boxes block movement (not holes)
      if (tile === GAME_CONFIG.tiles.WALL || 
          tile === GAME_CONFIG.tiles.BOX) {
        return false;
      }
    }
    
    // Check collision with bombs
    // Player can move off the bomb they're currently on, but not back onto it or onto other bombs
    if (bombs) {
      const targetTileX = Math.floor(x);
      const targetTileY = Math.floor(y);
      const currentTileX = Math.floor(this.x);
      const currentTileY = Math.floor(this.y);
      
      for (const bomb of bombs.values()) {
        if (bomb.x === targetTileX && bomb.y === targetTileY) {
          // Allow moving if we're currently on the same tile as the bomb (moving off it)
          if (currentTileX === bomb.x && currentTileY === bomb.y) {
            // We're on the bomb, allow movement off
            continue;
          }
          // Otherwise, bomb blocks movement
          return false;
        }
      }
    }
    
    // Check collision with other players
    for (const other of otherPlayers) {
      if (other.id === this.id || !other.alive) continue;
      
      const dx = x - other.x;
      const dy = y - other.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < this.radius + other.radius) {
        return false; // Collision with other player
      }
    }
    
    return true;
  }
  
  isOnHole(map) {
    // Check if player's center is on a hole tile
    const tileX = Math.floor(this.x);
    const tileY = Math.floor(this.y);
    return map.getTile(tileX, tileY) === GAME_CONFIG.tiles.HOLE;
  }
  
  canPlaceBomb() {
    return this.alive && this.activeBombs < this.maxBombs;
  }
  
  applyUpgrade(upgrade) {
    const upgradeConfig = GAME_CONFIG.upgrades[upgrade.type];
    if (upgradeConfig && upgradeConfig.effect) {
      upgradeConfig.effect(this);
    }
  }
  
  kill() {
    this.alive = false;
  }
  
  serialize() {
    return {
      id: this.id,
      username: this.username,
      x: this.x,
      y: this.y,
      alive: this.alive,
      speed: this.speed,
      maxBombs: this.maxBombs,
      explosionRange: this.explosionRange,
      activeBombs: this.activeBombs
    };
  }
}

module.exports = Player;


