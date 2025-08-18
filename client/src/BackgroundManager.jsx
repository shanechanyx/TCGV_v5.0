import React, { useState, useRef } from 'react';
import { 
  BackgroundTypes, 
  SolidColors, 
  Gradients, 
  Patterns, 
  BackgroundImages,
  defaultBackgroundSettings
} from './BackgroundSettings';

/**
 * BackgroundManager Component
 * 
 * This component provides a UI for customizing the background of the interactive area.
 * It allows selecting from different background types, colors, gradients, patterns, and images.
 */
const BackgroundManager = ({ onApplyBackground }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState(defaultBackgroundSettings);
  const [uploadedImage, setUploadedImage] = useState(null);
  const fileInputRef = useRef(null);
  
  const handleTypeChange = (type) => {
    const newSettings = { ...settings, type };
    
    // Set default value based on type
    switch (type) {
      case BackgroundTypes.SOLID:
        newSettings.value = SolidColors[0].value;
        break;
      case BackgroundTypes.GRADIENT:
        newSettings.value = Gradients[0].value;
        break;
      case BackgroundTypes.PATTERN:
        newSettings.value = Patterns[0].value;
        newSettings.backgroundSize = Patterns[0].backgroundSize;
        newSettings.backgroundPosition = Patterns[0].backgroundPosition;
        break;
      case BackgroundTypes.IMAGE:
        newSettings.value = `url(${BackgroundImages[0].url})`;
        newSettings.backgroundSize = 'cover';
        newSettings.backgroundPosition = 'center';
        break;
      default:
        break;
    }
    
    setSettings(newSettings);
  };
  
  const handleValueChange = (value, additionalProps = {}) => {
    setSettings({ ...settings, value, ...additionalProps });
  };
  
  const handleOpacityChange = (e) => {
    setSettings({ ...settings, opacity: parseFloat(e.target.value) });
  };
  
  const handleBlurChange = (e) => {
    setSettings({ ...settings, blur: parseInt(e.target.value, 10) });
  };
  
  const applyBackground = () => {
    onApplyBackground(settings);
    setIsOpen(false);
  };
  
  const getBackgroundStyle = () => {
    const { type, value, opacity, blur, backgroundSize, backgroundPosition } = settings;
    
    let style = {
      background: value,
      backgroundSize,
      backgroundPosition
    };
    
    if (type === BackgroundTypes.IMAGE) {
      style.opacity = opacity;
      style.filter = blur > 0 ? `blur(${blur}px)` : 'none';
    }
    
    return style;
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target.result;
        setUploadedImage(imageUrl);
        setSettings({ 
          ...settings, 
          type: BackgroundTypes.IMAGE,
          value: `url(${imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };
  
  if (!isOpen) {
    return (
      <button 
        className="background-settings-button"
        onClick={() => setIsOpen(true)}
        title="Change Background"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="background-settings-icon">
          <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clipRule="evenodd" />
        </svg>
      </button>
    );
  }
  
  return (
    <div className="background-settings-panel">
      <div className="background-settings-header">
        <h3>Background Settings</h3>
        <button 
          className="background-settings-close"
          onClick={() => setIsOpen(false)}
        >
          ×
        </button>
      </div>
      
      <div className="background-settings-preview" style={getBackgroundStyle()}>
        <div className="background-preview-square"></div>
      </div>
      
      <div className="background-settings-options">
        <div className="background-settings-group">
          <label>Background Type</label>
          <div className="background-type-buttons">
            {Object.values(BackgroundTypes).map(type => (
              <button
                key={type}
                className={`background-type-button ${settings.type === type ? 'active' : ''}`}
                onClick={() => handleTypeChange(type)}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        {settings.type === BackgroundTypes.SOLID && (
          <div className="background-settings-group">
            <label>Color</label>
            <div className="background-colors">
              {SolidColors.map(color => (
                <div
                  key={color.value}
                  className={`background-color-option ${settings.value === color.value ? 'active' : ''}`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => handleValueChange(color.value)}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        )}
        
        {settings.type === BackgroundTypes.GRADIENT && (
          <div className="background-settings-group">
            <label>Gradient</label>
            <div className="background-gradients">
              {Gradients.map(gradient => (
                <div
                  key={gradient.name}
                  className={`background-gradient-option ${settings.value === gradient.value ? 'active' : ''}`}
                  style={{ background: gradient.value }}
                  onClick={() => handleValueChange(gradient.value)}
                  title={gradient.name}
                />
              ))}
            </div>
          </div>
        )}
        
        {settings.type === BackgroundTypes.PATTERN && (
          <div className="background-settings-group">
            <label>Pattern</label>
            <div className="background-patterns">
              {Patterns.map(pattern => (
                <div
                  key={pattern.name}
                  className={`background-pattern-option ${settings.value === pattern.value ? 'active' : ''}`}
                  style={{ 
                    background: pattern.value,
                    backgroundSize: pattern.backgroundSize,
                    backgroundPosition: pattern.backgroundPosition
                  }}
                  onClick={() => handleValueChange(
                    pattern.value, 
                    { 
                      backgroundSize: pattern.backgroundSize,
                      backgroundPosition: pattern.backgroundPosition
                    }
                  )}
                  title={pattern.name}
                />
              ))}
            </div>
          </div>
        )}
        
        {settings.type === BackgroundTypes.IMAGE && (
          <>
            <div className="background-settings-group">
              <label>Image</label>
              <div className="background-images">
                <div 
                  className="background-image-upload"
                  onClick={triggerFileInput}
                  title="Upload your own image"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                    <path d="M11 15h2V9h3l-4-5-4 5h3z"/>
                    <path d="M20 18H4v-8H2v8c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-8h-2v8z"/>
                  </svg>
                  <span>Upload</span>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                </div>
                
                {uploadedImage && (
                  <div
                    className={`background-image-option ${settings.value === `url(${uploadedImage})` ? 'active' : ''}`}
                    style={{ backgroundImage: `url(${uploadedImage})` }}
                    onClick={() => handleValueChange(`url(${uploadedImage})`, {
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    })}
                    title="Uploaded Image"
                  />
                )}
                
                {BackgroundImages.map(image => (
                  <div
                    key={image.name}
                    className={`background-image-option ${settings.value === `url(${image.url})` ? 'active' : ''}`}
                    style={{ backgroundImage: `url(${image.url})` }}
                    onClick={() => handleValueChange(`url(${image.url})`, {
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    })}
                    title={image.name}
                  />
                ))}
              </div>
            </div>
            
            <div className="background-settings-group">
              <label>Opacity: {settings.opacity.toFixed(1)}</label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={settings.opacity}
                onChange={handleOpacityChange}
                className="background-settings-slider"
              />
            </div>
            
            <div className="background-settings-group">
              <label>Blur: {settings.blur}px</label>
              <input
                type="range"
                min="0"
                max="10"
                value={settings.blur}
                onChange={handleBlurChange}
                className="background-settings-slider"
              />
            </div>
          </>
        )}
      </div>
      
      <div className="background-settings-actions">
        <button 
          className="background-settings-apply"
          onClick={applyBackground}
        >
          Apply Background
        </button>
      </div>
    </div>
  );
};

export default BackgroundManager; 