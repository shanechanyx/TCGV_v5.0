import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';

function App() {
  const [socket, setSocket] = useState(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);

  useEffect(() => {
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('chatMessage', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    return () => newSocket.disconnect();
  }, []);

  const handleJoinGame = () => {
    if (!name || !role) {
      alert('Please enter your name and select a role');
      return;
    }

    socket.emit('joinGame', { name, role });
    setGameStarted(true);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && socket) {
      socket.emit('chat', message);
      setMessage('');
    }
  };

  if (!gameStarted) {
    return (
      <div className="login-container">
        <h1>Welcome to TCG Verse</h1>
        <input
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Select role</option>
          <option value="buyer">Buyer</option>
          <option value="seller">Seller</option>
        </select>
        <button onClick={handleJoinGame}>Join Game</button>
      </div>
    );
  }

  return (
    <div className="game-container">
      <div className="game-area">
        {/* Game canvas will go here */}
      </div>
      <div className="chat-container">
        <div className="messages">
          {messages.map((msg, i) => (
            <div key={i} className="message">
              <strong>{msg.name}:</strong> {msg.message}
            </div>
          ))}
        </div>
        <form onSubmit={handleSendMessage} className="chat-input">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}

export default App; 