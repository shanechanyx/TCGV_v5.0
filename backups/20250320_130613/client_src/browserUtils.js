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

// Check if device has a microphone
export const hasMicrophone = async () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    return false;
  }
  
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some(device => device.kind === 'audioinput');
  } catch (error) {
    console.error('Error checking for microphone:', error);
    return false;
  }
};

// Check browser compatibility for voice chat
export const checkVoiceChatCompatibility = () => {
  const issues = [];
  
  if (!getUserMediaSupport()) {
    issues.push('Your browser does not support accessing media devices');
  }
  
  if (!webRTCSupport()) {
    issues.push('Your browser does not support WebRTC (required for voice chat)');
  }
  
  if (!audioContextSupport()) {
    issues.push('Your browser does not support AudioContext (required for voice chat)');
  }
  
  return {
    compatible: issues.length === 0,
    issues
  };
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