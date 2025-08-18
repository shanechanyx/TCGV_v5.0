import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';
import './index.css';

// Force WebGL compatibility
window.WebGLRenderingContext && (window.WebGLRenderingContext.prototype.getShaderPrecisionFormat = 
  window.WebGLRenderingContext.prototype.getShaderPrecisionFormat || function() {
    return { precision: 1, rangeMin: 1, rangeMax: 1 };
  }
);

// Create a react root and render the app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 