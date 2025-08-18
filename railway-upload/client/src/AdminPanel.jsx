import React, { useState, useEffect } from 'react';
import './AdminPanel.css';

const AdminPanel = ({ socket, isVisible, onClose, isAdmin }) => {
  const [monsterSettings, setMonsterSettings] = useState({
    maxMonstersPerRoom: 5,
    spawnInterval: 10000,
    monsterTypes: [
      { id: 'goblin', name: 'Goblin', hp: 30, attack: 5, exp: 10, color: '#8B4513', type: 'small' },
      { id: 'orc', name: 'Orc', hp: 50, attack: 8, exp: 20, color: '#228B22', type: 'medium' },
      { id: 'dragon', name: 'Dragon', hp: 100, attack: 15, exp: 50, color: '#DC143C', type: 'boss' }
    ]
  });

  const [currentStats, setCurrentStats] = useState({
    activeMonsters: 0,
    totalSpawns: 0,
    totalKills: 0
  });

  const [successMessage, setSuccessMessage] = useState('');
  const [buttonClicked, setButtonClicked] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  const refreshStats = () => {
    if (socket) {
      setStatsLoading(true);
      socket.emit('requestAdminStats');
    }
  };

  useEffect(() => {
    if (!socket || !isVisible) return;

    // Request current admin settings and stats
    socket.emit('requestAdminSettings');
    socket.emit('requestAdminStats');

    // Listen for admin settings updates
    const handleAdminSettings = (settings) => {
      setMonsterSettings(settings);
    };

    const handleAdminStats = (stats) => {
      console.log('Received admin stats:', stats);
      setCurrentStats(stats);
      setStatsLoading(false);
    };

    const handleAdminActionSuccess = (data) => {
      console.log('=== ADMIN ACTION SUCCESS DEBUG ===');
      console.log('Received adminActionSuccess:', data);
      
      if (data.action === 'apply') {
        console.log('Apply settings success received');
        setSuccessMessage(`Settings applied successfully! Cleared ${data.clearedCount} monsters, spawning ${data.spawnCount} new monsters.`);
        setTimeout(() => setSuccessMessage(''), 5000); // Clear message after 5 seconds
      } else if (data.action === 'spawn') {
        setSuccessMessage(`Monster spawned: ${data.monster.name}`);
        setTimeout(() => setSuccessMessage(''), 3000);
      } else if (data.action === 'clear') {
        setSuccessMessage(`Cleared ${data.count} monsters`);
        setTimeout(() => setSuccessMessage(''), 3000);
      }
      
      // Request updated stats after any action
      setTimeout(() => {
        socket.emit('requestAdminStats');
      }, 1000);
    };

    const handleAdminError = (error) => {
      console.log('=== ADMIN ERROR DEBUG ===');
      console.log('Received admin error:', error);
      setSuccessMessage(`Error: ${error}`);
      setTimeout(() => setSuccessMessage(''), 5000);
    };

    socket.on('adminSettings', handleAdminSettings);
    socket.on('adminStats', handleAdminStats);
    socket.on('adminActionSuccess', handleAdminActionSuccess);
    socket.on('adminError', handleAdminError);

    return () => {
      socket.off('adminSettings', handleAdminSettings);
      socket.off('adminStats', handleAdminStats);
      socket.off('adminActionSuccess', handleAdminActionSuccess);
      socket.off('adminError', handleAdminError);
    };
  }, [socket, isVisible]);

  const updateMonsterSettings = (newSettings) => {
    setMonsterSettings(newSettings);
    if (socket) {
      socket.emit('updateAdminSettings', newSettings);
    }
  };

  const handleMaxMonstersChange = (value) => {
    const newSettings = {
      ...monsterSettings,
      maxMonstersPerRoom: parseInt(value) || 1
    };
    updateMonsterSettings(newSettings);
  };

  const handleSpawnIntervalChange = (value) => {
    const newSettings = {
      ...monsterSettings,
      spawnInterval: parseInt(value) * 1000 // Convert seconds to milliseconds
    };
    updateMonsterSettings(newSettings);
  };

  const handleMonsterTypeChange = (index, field, value) => {
    const newMonsterTypes = [...monsterSettings.monsterTypes];
    newMonsterTypes[index] = {
      ...newMonsterTypes[index],
      [field]: field === 'hp' || field === 'attack' || field === 'exp' ? parseInt(value) : value
    };
    
    const newSettings = {
      ...monsterSettings,
      monsterTypes: newMonsterTypes
    };
    updateMonsterSettings(newSettings);
  };

  const addMonsterType = () => {
    const newMonsterType = {
      id: `monster_${Date.now()}`,
      name: 'New Monster',
      hp: 30,
      attack: 5,
      exp: 10,
      color: '#8B4513',
      type: 'small'
    };
    
    const newSettings = {
      ...monsterSettings,
      monsterTypes: [...monsterSettings.monsterTypes, newMonsterType]
    };
    updateMonsterSettings(newSettings);
  };

  const removeMonsterType = (index) => {
    const newMonsterTypes = monsterSettings.monsterTypes.filter((_, i) => i !== index);
    const newSettings = {
      ...monsterSettings,
      monsterTypes: newMonsterTypes
    };
    updateMonsterSettings(newSettings);
  };

  const spawnMonsterNow = () => {
    if (socket) {
      console.log('Admin: Spawning monster now');
      socket.emit('adminSpawnMonster');
      
      // Request updated stats after spawning
      setTimeout(() => {
        socket.emit('requestAdminStats');
      }, 1000);
    } else {
      console.error('Admin: No socket connection');
    }
  };

  const clearAllMonsters = () => {
    if (socket) {
      console.log('Admin: Clearing all monsters');
      socket.emit('adminClearMonsters');
      
      // Request updated stats after clearing
      setTimeout(() => {
        socket.emit('requestAdminStats');
      }, 1000);
    } else {
      console.error('Admin: No socket connection');
    }
  };

  const applySettingsNow = () => {
    console.log('=== ADMIN APPLY SETTINGS DEBUG ===');
    console.log('Socket exists:', !!socket);
    console.log('Socket connected:', socket?.connected);
    console.log('Current monster settings:', monsterSettings);
    console.log('Is admin:', isAdmin);
    
    if (socket) {
      console.log('Admin: Applying settings now:', monsterSettings);
      console.log('Emitting adminApplySettings event...');
      socket.emit('adminApplySettings', monsterSettings);
      console.log('Event emitted successfully');
    } else {
      console.error('Admin: No socket connection');
    }
  };

  // Debug: Always show for testing
  console.log('AdminPanel render check:', { isVisible, isAdmin });
  if (!isVisible) return null;

  return (
    <div className="admin-panel-overlay">
      <div className="admin-panel">
        <div className="admin-panel-header">
          <h2>Admin Panel</h2>
          <button className="admin-close-btn" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="admin-panel-content">
          {/* Success Message */}
          {successMessage && (
            <div className="admin-success-message">
              {successMessage}
            </div>
          )}
          
          {/* Current Stats */}
          <div className="admin-section">
            <div className="section-header">
              <h3>Current Stats</h3>
              <button 
                className="admin-btn admin-btn-refresh" 
                onClick={refreshStats}
                disabled={statsLoading}
              >
                {statsLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Active Monsters:</span>
                <span className="stat-value">
                  {statsLoading ? '...' : currentStats.activeMonsters}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Total Spawns:</span>
                <span className="stat-value">
                  {statsLoading ? '...' : currentStats.totalSpawns}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Total Kills:</span>
                <span className="stat-value">
                  {statsLoading ? '...' : currentStats.totalKills}
                </span>
              </div>
            </div>
          </div>

          {/* Spawn Settings */}
          <div className="admin-section">
            <h3>Spawn Settings</h3>
            <div className="setting-group">
              <label>
                Max Monsters Per Room:
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={monsterSettings.maxMonstersPerRoom}
                  onChange={(e) => handleMaxMonstersChange(e.target.value)}
                  className="admin-input"
                />
              </label>
            </div>
            <div className="setting-group">
              <label>
                Spawn Interval (seconds):
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={monsterSettings.spawnInterval / 1000}
                  onChange={(e) => handleSpawnIntervalChange(e.target.value)}
                  className="admin-input"
                />
              </label>
            </div>
          </div>

          {/* Monster Types */}
          <div className="admin-section">
            <div className="section-header">
              <h3>Monster Types</h3>
              <button className="admin-btn admin-btn-add" onClick={addMonsterType}>
                Add Monster Type
              </button>
            </div>
            
            <div className="monster-types-list">
              {monsterSettings.monsterTypes.map((monster, index) => (
                <div key={monster.id} className="monster-type-item">
                  <div className="monster-type-header">
                    <h4>Monster {index + 1}</h4>
                    <button 
                      className="admin-btn admin-btn-remove"
                      onClick={() => removeMonsterType(index)}
                    >
                      Remove
                    </button>
                  </div>
                  
                  <div className="monster-type-fields">
                    <div className="field-group">
                      <label>Name:</label>
                      <input
                        type="text"
                        value={monster.name}
                        onChange={(e) => handleMonsterTypeChange(index, 'name', e.target.value)}
                        className="admin-input"
                      />
                    </div>
                    
                    <div className="field-group">
                      <label>Type:</label>
                      <select
                        value={monster.type}
                        onChange={(e) => handleMonsterTypeChange(index, 'type', e.target.value)}
                        className="admin-select"
                      >
                        <option value="small">Small Mob</option>
                        <option value="medium">Medium Mob</option>
                        <option value="boss">Boss Mob</option>
                      </select>
                    </div>
                    
                    <div className="field-group">
                      <label>HP:</label>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={monster.hp}
                        onChange={(e) => handleMonsterTypeChange(index, 'hp', e.target.value)}
                        className="admin-input"
                      />
                    </div>
                    
                    <div className="field-group">
                      <label>Attack:</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={monster.attack}
                        onChange={(e) => handleMonsterTypeChange(index, 'attack', e.target.value)}
                        className="admin-input"
                      />
                    </div>
                    
                    <div className="field-group">
                      <label>EXP Reward:</label>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={monster.exp}
                        onChange={(e) => handleMonsterTypeChange(index, 'exp', e.target.value)}
                        className="admin-input"
                      />
                    </div>
                    
                    <div className="field-group">
                      <label>Color:</label>
                      <input
                        type="color"
                        value={monster.color}
                        onChange={(e) => handleMonsterTypeChange(index, 'color', e.target.value)}
                        className="admin-color-input"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="admin-section">
            <h3>Quick Actions</h3>
            <div className="action-buttons">
              <button className="admin-btn admin-btn-primary" onClick={spawnMonsterNow}>
                Spawn Monster Now
              </button>
              <button className="admin-btn admin-btn-danger" onClick={clearAllMonsters}>
                Clear All Monsters
              </button>
              <button className="admin-btn admin-btn-success" onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Apply Settings Now button clicked!');
                setButtonClicked(true);
                setTimeout(() => setButtonClicked(false), 1000);
                applySettingsNow();
              }}>
                Apply Settings Now {buttonClicked ? ' (CLICKED!)' : ''}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel; 