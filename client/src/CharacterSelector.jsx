import React from 'react';
import { AVAILABLE_SPRITE_TYPES } from './SpriteConfigs';
import SpriteManager from './SpriteManager';
import './CharacterSelector.css';

const CharacterSelector = ({ selectedSpriteId, onSelectSprite }) => {
  return (
    <div className="character-selector">
      <h3 className="selector-title">Choose Your Character</h3>
      <div className="character-grid">
        {AVAILABLE_SPRITE_TYPES.map((spriteType) => (
          <div 
            key={spriteType.id}
            className={`character-option ${selectedSpriteId === spriteType.id ? 'selected' : ''}`}
            onClick={() => onSelectSprite(spriteType.id)}
          >
            <div className="character-preview">
              <SpriteManager 
                spriteSheet={spriteType.config.defaultSprite}
                animation="idle"
                config={spriteType.config}
                size={64}
              />
            </div>
            <div className="character-name">{spriteType.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CharacterSelector; 