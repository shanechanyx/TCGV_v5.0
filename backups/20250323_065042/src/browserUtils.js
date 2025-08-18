// Check if browser supports getUserMedia
export const getUserMediaSupport = () => {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
};

// Check if WebRTC is supported
export const webRTCSupport = () => {
  return 'RTCPeerConnection' in window;
};

// Check if AudioContext is supported
export const audioContextSupport = () => {
  return !!(window.AudioContext || window.webkitAudioContext);
};

// Request microphone permission
export const requestMicrophonePermission = async () => {
  if (!getUserMediaSupport()) {
    throw new Error('Browser does not support accessing media devices');
  }
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    return stream;
  } catch (error) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      throw new Error('Microphone permission denied. Please allow microphone access.');
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      throw new Error('No microphone found. Please connect a microphone and try again.');
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      throw new Error('Cannot access microphone. It may be in use by another application.');
    } else {
      throw new Error(`Error accessing microphone: ${error.message}`);
    }
  }
};

// Create audio context and check permissions
export const createAudioContext = () => {
  if (!audioContextSupport()) {
    throw new Error('Browser does not support AudioContext');
  }
  
  try {
    return new (window.AudioContext || window.webkitAudioContext)();
  } catch (error) {
    throw new Error(`Error creating AudioContext: ${error.message}`);
  }
};

// Browser utility functions

// Check if browser supports the WebRTC API
export const supportsWebRTC = () => {
  return (
    typeof navigator !== 'undefined' && 
    navigator.mediaDevices && 
    (navigator.mediaDevices.getUserMedia || navigator.getUserMedia || 
     navigator.webkitGetUserMedia || navigator.mozGetUserMedia) && 
    (window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection)
  );
};

// Check if browser supports the AudioContext API
export const supportsAudioContext = () => {
  return !!(window.AudioContext || window.webkitAudioContext);
};

// Check if browser has a microphone
export const hasMicrophone = async () => {
  try {
    // More permissive check for microphone
    if (!navigator.mediaDevices) {
      console.warn('Browser API navigator.mediaDevices not available');
      
      // Try direct access (legacy browsers)
      if (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia) {
        console.log('Using legacy media API instead');
        return true; // Assume presence on legacy browsers
      }
      
      return false;
    }
    
    // If we can access the media devices API at all, assume we have a mic
    // This is more permissive and avoids permission prompts during the check
    if (navigator.mediaDevices.getUserMedia) {
      console.log('Media API available, assuming microphone exists');
      return true;
    }
    
    // Only if we have enumerateDevices, actually check for microphones
    if (navigator.mediaDevices.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some(device => device.kind === 'audioinput');
    }
    
    return false;
  } catch (err) {
    console.error('Error checking for microphone:', err);
    // Be permissive - if there's an error, assume there might be a microphone
    // and let the actual access attempt handle any real problems
    return true;
  }
};

// Check overall voice chat compatibility
export const checkVoiceChatCompatibility = async () => {
  const issues = [];
  let compatible = true;
  
  try {
    // Check WebRTC support first (most critical)
    if (!supportsWebRTC()) {
      issues.push('Your browser does not support WebRTC (required for voice chat)');
      compatible = false;
    }
    
    // Check AudioContext support 
    if (!supportsAudioContext()) {
      issues.push('Your browser does not support AudioContext (required for voice chat)');
      compatible = false;
    }
    
    // Check microphone last (least critical since it might be added later)
    const micAvailable = await hasMicrophone();
    if (!micAvailable) {
      issues.push('No microphone detected on your device');
      // Don't mark as incompatible for mic only - user might connect one later
    }
    
    // Return permissive result
    return {
      compatible: issues.length === 0 || (issues.length === 1 && !micAvailable),
      issues
    };
  } catch (error) {
    console.error('Error checking voice chat compatibility:', error);
    // Be permissive in case of errors
    return {
      compatible: true,
      issues: []
    };
  }
};

// Get list of available audio input devices
export const getAudioInputDevices = async () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    return [];
  }
  
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'audioinput');
  } catch (error) {
    console.error('Error getting audio input devices:', error);
    return [];
  }
}; 