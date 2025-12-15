const Lobby = require('./Lobby');

class LobbyManager {
  constructor() {
    this.lobbies = new Map();
    this.lobbyIdCounter = 0;
  }
  
  createLobby(name, hostId, username, hostClient, mapString) {
    const lobbyId = `lobby_${this.lobbyIdCounter++}`;
    const lobby = new Lobby(lobbyId, name, hostId, mapString);
    lobby.addPlayer(hostId, username, hostClient);
    
    this.lobbies.set(lobbyId, lobby);
    return lobby;
  }
  
  getLobby(lobbyId) {
    return this.lobbies.get(lobbyId);
  }
  
  getAllLobbies() {
    return Array.from(this.lobbies.values())
      .filter(lobby => !lobby.gameStarted)
      .map(lobby => lobby.getLobbyInfo());
  }
  
  joinLobby(lobbyId, playerId, username, client) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return null;
    
    if (lobby.addPlayer(playerId, username, client)) {
      return lobby;
    }
    return null;
  }
  
  leaveLobby(lobbyId, playerId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return;
    
    const isEmpty = lobby.removePlayer(playerId);
    
    if (isEmpty) {
      lobby.destroy();
      this.lobbies.delete(lobbyId);
    }
  }
  
  findPlayerLobby(playerId) {
    for (const lobby of this.lobbies.values()) {
      if (lobby.players.has(playerId)) {
        return lobby;
      }
    }
    return null;
  }
  
  removeLobby(lobbyId) {
    const lobby = this.lobbies.get(lobbyId);
    if (lobby) {
      lobby.destroy();
      this.lobbies.delete(lobbyId);
    }
  }
}

module.exports = LobbyManager;


