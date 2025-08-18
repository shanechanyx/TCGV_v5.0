import React, { useState } from 'react';
import './PlayerList.css';

const PlayerList = ({ 
  players, 
  playersInVoiceChat, 
  talkingPlayers, 
  currentPlayerId,
  socket,
  roomId,
  isVoiceChatEnabled
}) => {
  const [isMuted, setIsMuted] = useState(false);
  
  // Filter players into voice chat and text-only groups
  const voiceChatPlayers = players.filter(player => playersInVoiceChat[player.id]);
  const textOnlyPlayers = players.filter(player => !playersInVoiceChat[player.id]);
  
  // Check if player is talking
  const isPlayerTalking = (playerId) => {
    return talkingPlayers[playerId] || false;
  };
  
  // Check if current player is in voice chat
  const isCurrentPlayerInVoiceChat = playersInVoiceChat[currentPlayerId] || false;
  
  // Handle rejoin voice chat
  const handleRejoinVoiceChat = () => {
    if (socket && roomId) {
      socket.emit('join-voice-chat', { roomId });
    }
  };
  
  // Handle leave voice chat
  const handleLeaveVoiceChat = () => {
    if (socket && roomId) {
      socket.emit('leave-voice-chat', { roomId });
    }
  };
  
  // Handle mute/unmute
  const handleToggleMute = () => {
    setIsMuted(prev => {
      const newMuteState = !prev;
      
      // Tell the server about mute state
      if (socket) {
        socket.emit('talking-status', { 
          isTalking: false, // When muted, not talking
          isMuted: newMuteState
        });
      }
      
      // If we have access to audio tracks, mute/unmute them
      if (window.voiceChatStream) {
        window.voiceChatStream.getAudioTracks().forEach(track => {
          track.enabled = !newMuteState;
        });
      }
      
      return newMuteState;
    });
  };
  
  return (
    <div className="player-list-container">
      {/* Voice Chat Players */}
      <div className="player-group">
        <h3>Voice Chat Players ({voiceChatPlayers.length})</h3>
        <ul className="player-list">
          {voiceChatPlayers.length > 0 ? (
            voiceChatPlayers.map(player => (
              <li 
                key={player.id} 
                className={player.id === currentPlayerId ? 'current-player' : ''}
              >
                {player.name} ({player.role})
                <span className="voice-chat-indicator" title="In voice chat">🎤</span>
                {isPlayerTalking(player.id) && (
                  <span className="talking-indicator" title="Talking"></span>
                )}
              </li>
            ))
          ) : (
            <li className="no-players">No players in voice chat</li>
          )}
        </ul>
        
        {/* Voice chat controls */}
        {isVoiceChatEnabled && (
          <div className="voice-chat-controls-container">
            {isCurrentPlayerInVoiceChat ? (
              <>
                <button 
                  className={`voice-button mute-button ${isMuted ? 'muted' : ''}`}
                  onClick={handleToggleMute}
                  title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                >
                  {isMuted ? '🔇' : '🎤'}
                </button>
                <button 
                  className="voice-button leave-button"
                  onClick={handleLeaveVoiceChat}
                  title="Leave Voice Chat"
                >
                  Leave Voice Chat
                </button>
              </>
            ) : (
              <button 
                className="rejoin-voice-chat-button"
                onClick={handleRejoinVoiceChat}
              >
                Join Voice Chat
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Text-Only Players */}
      <div className="player-group">
        <h3>Text-Only Players ({textOnlyPlayers.length})</h3>
        <ul className="player-list">
          {textOnlyPlayers.length > 0 ? (
            textOnlyPlayers.map(player => (
              <li 
                key={player.id} 
                className={player.id === currentPlayerId ? 'current-player' : ''}
              >
                {player.name} ({player.role})
              </li>
            ))
          ) : (
            <li className="no-players">No text-only players</li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default PlayerList; 