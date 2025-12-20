// Game configuration - can be overridden by environment variables or ConfigMap

const GAME_CONFIG = {
  // Game rules
  maxPlayersPerLobby: 4,
  minPlayersToStart: 2,
  bombTimer: 3000, // ms
  explosionDuration: 500, // ms
  explosionPropagationDelay: 20, // ms per tile (20ms = 50 tiles/sec, reaches 10 tiles in 200ms)
  tickRate: 60, // game updates per second
  
  // Player defaults
  defaultPlayerSpeed: 3, // tiles per second
  defaultBombCount: 1,
  defaultExplosionRange: 2, // tiles in each direction
  
  // Upgrade definitions (extensible)
  upgrades: {
    SPEED: {
      id: 'SPEED',
      name: 'Speed Boost',
      icon: 'S',
      color: '#00FF00',
      effect: (player) => {
        player.speed += 1;
      }
    },
    BOMB: {
      id: 'BOMB',
      name: 'Extra Bomb',
      icon: 'B',
      color: '#FF00FF',
      effect: (player) => {
        player.maxBombs += 1;
      }
    },
    RANGE: {
      id: 'RANGE',
      name: 'Explosion Range',
      icon: 'R',
      color: '#FFFF00',
      effect: (player) => {
        player.explosionRange += 1;
      }
    }
  },
  
  // Map tile types
  tiles: {
    EMPTY: '.',
    WALL: '#',
    BOX: 'X',
    HOLE: 'O',
    SPAWN: 'S'
  }
};

module.exports = GAME_CONFIG;


