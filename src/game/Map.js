const GAME_CONFIG = require('../config/gameConfig');

class GameMap {
  constructor(mapString) {
    this.parseMap(mapString);
    this.upgrades = []; // {x, y, type}
  }
  
  parseMap(mapString) {
    if (typeof mapString !== 'string') {
      throw new Error(`Map string must be a string, got ${typeof mapString}`);
    }
    
    if (!mapString || mapString.length === 0) {
      throw new Error('Map string is empty');
    }
    
    const lines = mapString.trim().split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      throw new Error('Map has no valid lines after parsing');
    }
    
    this.height = lines.length;
    this.width = Math.max(...lines.map(line => line.length));
    this.tiles = [];
    this.spawnPoints = [];
    
    for (let y = 0; y < this.height; y++) {
      this.tiles[y] = [];
      const line = lines[y] || '';
      
      for (let x = 0; x < this.width; x++) {
        const char = line[x] || GAME_CONFIG.tiles.EMPTY;
        this.tiles[y][x] = char;
        
        // Track spawn points
        if (char === GAME_CONFIG.tiles.SPAWN) {
          this.spawnPoints.push({ x, y });
          this.tiles[y][x] = GAME_CONFIG.tiles.EMPTY; // Treat as empty after recording
        }
      }
    }
    
    if (this.spawnPoints.length === 0) {
      // Fallback: create spawn points in corners
      this.spawnPoints = [
        { x: 1, y: 1 },
        { x: this.width - 2, y: 1 },
        { x: 1, y: this.height - 2 },
        { x: this.width - 2, y: this.height - 2 }
      ];
    }
  }
  
  getTile(x, y) {
    if (y < 0 || y >= this.height || x < 0 || x >= this.width) {
      return GAME_CONFIG.tiles.WALL; // Out of bounds = wall
    }
    return this.tiles[y][x];
  }
  
  setTile(x, y, tile) {
    if (y >= 0 && y < this.height && x >= 0 && x < this.width) {
      this.tiles[y][x] = tile;
    }
  }
  
  isWalkable(x, y) {
    const tile = this.getTile(x, y);
    return tile === GAME_CONFIG.tiles.EMPTY;
  }
  
  destroyBox(x, y) {
    const tile = this.getTile(x, y);
    console.log(`destroyBox called at (${x}, ${y}), tile is: '${tile}', BOX is: '${GAME_CONFIG.tiles.BOX}'`);
    if (tile === GAME_CONFIG.tiles.BOX) {
      console.log(`Actually destroying box at (${x}, ${y})`);
      this.setTile(x, y, GAME_CONFIG.tiles.EMPTY);
      
      // 30% chance to spawn an upgrade
      if (Math.random() < 0.3) {
        const upgradeTypes = Object.keys(GAME_CONFIG.upgrades);
        const randomType = upgradeTypes[Math.floor(Math.random() * upgradeTypes.length)];
        this.upgrades.push({ x, y, type: randomType });
      }
      
      return true;
    }
    return false;
  }
  
  getUpgradeAt(x, y) {
    const index = this.upgrades.findIndex(u => u.x === x && u.y === y);
    if (index !== -1) {
      const upgrade = this.upgrades[index];
      this.upgrades.splice(index, 1);
      return upgrade;
    }
    return null;
  }
  
  getSpawnPoint(index) {
    return this.spawnPoints[index % this.spawnPoints.length];
  }
  
  serialize() {
    return {
      width: this.width,
      height: this.height,
      tiles: this.tiles,
      upgrades: this.upgrades
    };
  }
}

module.exports = GameMap;


