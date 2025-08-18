import React, { useState, useEffect, useRef } from 'react';
import Peer from 'simple-peer';
import './VoiceChat.css';
import { 
  requestMicrophonePermission, 
  createAudioContext,
  checkVoiceChatCompatibility,
  hasMicrophone
} from './browserUtils';

const VoiceChat = ({ socket, inRoom, roomId, players, currentPlayerId }) => {
  const [isVoiceChatEnabled, setIsVoiceChatEnabled] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [peers, setPeers] = useState({});
  const [talkingUsers, setTalkingUsers] = useState({});
  const [audioStream, setAudioStream] = useState(null);
  const [audioAnalyser, setAudioAnalyser] = useState(null);
  const [error, setError] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [micTestMode, setMicTestMode] = useState(false);
  const [compatibilityIssues, setCompatibilityIssues] = useState([]);
  const [loopbackEnabled, setLoopbackEnabled] = useState(false);
  const [loopbackVolume, setLoopbackVolume] = useState(0.5); // Default to 50% volume
  
  const myPeers = useRef({});
  const audioContextRef = useRef(null);
  const animationFrameId = useRef(null);
  const talkingRef = useRef(false);
  const micVisualizerRef = useRef(null);
  const loopbackNodeRef = useRef(null);
  
  // Audio level detection threshold
  const VOICE_ACTIVITY_THRESHOLD = 0.01;
  
  // Check browser compatibility when component mounts
  useEffect(() => {
    const { compatible, issues } = checkVoiceChatCompatibility();
    if (!compatible) {
      setCompatibilityIssues(issues);
    }
    
    // Check if device has a microphone
    const checkMic = async () => {
      const hasMic = await hasMicrophone();
      if (!hasMic) {
        setCompatibilityIssues(prev => [...prev, 'No microphone detected on your device']);
      }
    };
    
    checkMic();
  }, []);
  
  useEffect(() => {
    // Show modal when user enters a room
    if (inRoom) {
      setShowModal(true);
      setMicTestMode(false); // Ensure we start with the initial options
    } else {
      cleanupVoiceChat();
    }
    
    return () => cleanupVoiceChat();
  }, [inRoom]);
  
  // Handle mute/unmute effect on audio tracks
  useEffect(() => {
    if (audioStream) {
      audioStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted, audioStream]);
  
  const cleanupVoiceChat = () => {
    // Clean up all peer connections
    Object.values(myPeers.current).forEach(peer => {
      if (peer && peer.destroy) peer.destroy();
    });
    
    // Stop all audio tracks
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
    }
    
    // Clear global reference
    window.voiceChatStream = null;
    
    // Disconnect loopback if it exists
    if (loopbackNodeRef.current) {
      try {
        loopbackNodeRef.current.source.disconnect();
        loopbackNodeRef.current.gainNode.disconnect();
        loopbackNodeRef.current = null;
      } catch (err) {
        console.error('Error cleaning up loopback:', err);
      }
    }
    
    // Cancel any animation frame
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
    }
    
    setAudioStream(null);
    setAudioAnalyser(null);
    myPeers.current = {};
    setPeers({});
    setTalkingUsers({});
    setIsVoiceChatEnabled(false);
    setShowModal(false);
    setIsMuted(false);
    setAudioLevel(0);
    setMicTestMode(false);
    setLoopbackEnabled(false);
    setLoopbackVolume(0.5);
  };
  
  useEffect(() => {
    if (!socket || !isVoiceChatEnabled) return;
    
    // Setup socket event listeners for WebRTC signaling
    socket.on('user-joined-voice', handleUserJoinedVoice);
    socket.on('signal-data', handleSignalData);
    socket.on('user-left-voice', handleUserLeftVoice);
    socket.on('voice-chat-stats-update', handleVoiceChatStatsUpdate);
    
    // Notify server that we've joined voice chat
    if (roomId) {
      socket.emit('join-voice-chat', { roomId });
    }
    
    return () => {
      socket.off('user-joined-voice', handleUserJoinedVoice);
      socket.off('signal-data', handleSignalData);
      socket.off('user-left-voice', handleUserLeftVoice);
      socket.off('voice-chat-stats-update', handleVoiceChatStatsUpdate);
    };
  }, [socket, isVoiceChatEnabled, roomId]);
  
  const handleUserJoinedVoice = (userData) => {
    const { userId } = userData;
    
    // Don't create a peer connection to ourselves
    if (userId === currentPlayerId) return;
    
    // Create a new peer connection (initiator=true because we're creating the offer)
    const peer = createPeer(userId, true);
    myPeers.current[userId] = peer;
    
    setPeers(prev => ({
      ...prev,
      [userId]: peer
    }));
  };
  
  const handleUserLeftVoice = (userData) => {
    const { userId } = userData;
    
    // Clean up peer connection for user who left
    if (myPeers.current[userId]) {
      myPeers.current[userId].destroy();
      delete myPeers.current[userId];
      
      setPeers(prev => {
        const newPeers = { ...prev };
        delete newPeers[userId];
        return newPeers;
      });
      
      // Remove user from talking users list
      setTalkingUsers(prev => {
        const newTalkingUsers = { ...prev };
        delete newTalkingUsers[userId];
        return newTalkingUsers;
      });
    }
  };
  
  const handleSignalData = (data) => {
    const { userId, signal } = data;
    
    console.log(`[AUDIO] Received signal from ${userId}, type:`, signal.type || 'candidate');
    
    // If we don't have a peer for this user yet and this is not an initiator, create one
    if (!myPeers.current[userId]) {
      console.log(`[AUDIO] Creating new peer for ${userId} as signal receiver`);
      const peer = createPeer(userId, false);
      if (!peer) {
        console.error(`[AUDIO] Failed to create peer for ${userId}`);
        return;
      }
      myPeers.current[userId] = peer;
      
      setPeers(prev => ({
        ...prev,
        [userId]: peer
      }));
    }
    
    // Apply the signal to the peer
    try {
      console.log(`[AUDIO] Applying signal to peer ${userId}`);
      myPeers.current[userId].signal(signal);
    } catch (err) {
      console.error(`[AUDIO] Error signaling peer ${userId}:`, err);
      
      // If signaling fails, try recreating the peer connection
      try {
        console.log(`[AUDIO] Recreating peer for ${userId} after signal failure`);
        
        // Destroy old peer if it exists
        if (myPeers.current[userId]) {
          myPeers.current[userId].destroy();
        }
        
        // Create a new peer
        const newPeer = createPeer(userId, false);
        if (newPeer) {
          myPeers.current[userId] = newPeer;
          setPeers(prev => ({
            ...prev,
            [userId]: newPeer
          }));
          
          // Try applying the signal again
          newPeer.signal(signal);
        }
      } catch (recreateErr) {
        console.error(`[AUDIO] Failed to recreate peer for ${userId}:`, recreateErr);
      }
    }
  };
  
  const handleVoiceChatStatsUpdate = (stats) => {
    // Update UI with voice chat stats (nothing to do for now)
  };
  
  const createPeer = (userId, initiator) => {
    if (!audioStream) {
      console.error('No audio stream available');
      return null;
    }
    
    console.log(`Creating peer connection with ${userId}, initiator: ${initiator}`);
    
    // Use more reliable STUN servers for WebRTC
    const peer = new Peer({
      initiator,
      stream: audioStream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          { urls: 'stun:openrelay.metered.ca:80' },
          { urls: 'stun:stun.stunprotocol.org:3478' }
        ]
      },
      sdpTransform: (sdp) => {
        // Optimize for voice
        return sdp.replace('useinbandfec=1', 'useinbandfec=1; stereo=0; maxaveragebitrate=128000');
      }
    });
    
    peer.on('signal', signal => {
      console.log(`[AUDIO] Signaling to peer ${userId}, type: ${signal.type || 'candidate'}`);
      socket.emit('signal-peer', {
        userId,
        signal
      });
    });
    
    peer.on('connect', () => {
      console.log(`[AUDIO] Connected to peer ${userId}!`);
      peer.send(JSON.stringify({type: 'connected', time: Date.now()}));
    });
    
    peer.on('close', () => {
      console.log(`[AUDIO] Connection to peer ${userId} closed`);
    });
    
    peer.on('error', err => {
      console.error(`[AUDIO] Error with peer ${userId}:`, err);
    });
    
    // Monitor ice connection state
    peer.on('iceStateChange', (state) => {
      console.log(`[AUDIO] ICE state for ${userId}: ${state}`);
      
      if (state === 'connected') {
        console.log(`[AUDIO] Successfully connected to ${userId}`);
      } else if (state === 'failed') {
        console.error(`[AUDIO] Connection to ${userId} failed, attempting restart...`);
        try {
          peer.restartIce();
        } catch (err) {
          console.error(`[AUDIO] Error restarting ICE:`, err);
        }
      }
    });
    
    peer.on('stream', remoteStream => {
      console.log(`[AUDIO] Received audio stream from ${userId} with ${remoteStream.getAudioTracks().length} audio tracks`);
      
      try {
        // METHOD 1: HTML Audio Element (most reliable)
        const audio = new Audio();
        audio.srcObject = remoteStream;
        audio.autoplay = true;
        audio.muted = false; // VERY IMPORTANT: ensure it's not muted
        audio.volume = 1.0;  // Set volume to maximum
        audio.id = `audio-${userId}`;
        document.body.appendChild(audio);
        console.log(`[AUDIO] Created audio element for ${userId}`);
        
        // Force play with explicit user action if needed 
        audio.play()
          .then(() => console.log(`[AUDIO] Successfully playing audio from ${userId}`))
          .catch(err => {
            console.error(`[AUDIO] Autoplay failed:`, err);
            
            // Add a visible button for user to click (browsers require user interaction)
            const button = document.createElement('button');
            button.textContent = 'Enable Voice Chat Audio';
            button.className = 'audio-enable-button';
            button.onclick = () => {
              // On click, try again to play audio
              audio.play().catch(console.error);
              button.remove();
            };
            document.body.appendChild(button);
          });
        
        // METHOD 2: Direct Audio Output through AudioContext
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Resume the audio context (important for Safari/iOS)
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }
        
        // Connect the remote stream to audio output
        const source = audioContextRef.current.createMediaStreamSource(remoteStream);
        source.connect(audioContextRef.current.destination);
        console.log(`[AUDIO] Connected ${userId}'s stream directly to audio output`);
      } catch (err) {
        console.error(`[AUDIO] Error setting up audio for ${userId}:`, err);
      }
      
      // Setup audio analysis for detecting when they're talking
      setupAudioAnalyser(remoteStream, userId);
    });
    
    return peer;
  };
  
  const setupAudioAnalyser = (stream, userId) => {
    try {
      // Create audio context if it doesn't exist
      if (!audioContextRef.current) {
        audioContextRef.current = createAudioContext();
        console.log(`[VOICE] Created new AudioContext`);
      }
      
      // Ensure audio context is running
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume()
          .then(() => console.log(`[VOICE] AudioContext resumed`))
          .catch(err => console.error(`[VOICE] Error resuming AudioContext:`, err));
      }
      
      const analyser = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // Configure analyser for voice detection
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5; // Smooth transitions
      
      // Connect source to analyser only (don't connect to destination to prevent feedback)
      source.connect(analyser);
      
      // Detect voice activity with debouncing
      let lastTalkingState = false;
      let debounceTimeout = null;
      
      const detectVoiceActivity = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average volume with focus on voice frequencies
        const midRangeStart = Math.floor(dataArray.length * 0.1);
        const midRangeEnd = Math.floor(dataArray.length * 0.6);
        
        let sum = 0;
        let count = 0;
        
        for (let i = midRangeStart; i < midRangeEnd; i++) {
          sum += dataArray[i];
          count++;
        }
        
        const average = count > 0 ? sum / count : 0;
        const normalizedAverage = average / 255;
        
        // Determine if user is talking with higher threshold for remotes
        const isTalking = normalizedAverage > (userId === currentPlayerId ? VOICE_ACTIVITY_THRESHOLD : VOICE_ACTIVITY_THRESHOLD * 1.2);
        
        // Only update if state changed, with debouncing to prevent flicker
        if (isTalking !== lastTalkingState) {
          // Clear any existing timeout
          if (debounceTimeout) {
            clearTimeout(debounceTimeout);
          }
          
          // Set timeout to update state after short delay (debouncing)
          debounceTimeout = setTimeout(() => {
            // Update talking state
            if (userId === currentPlayerId) {
              // If this is our own voice
              if (isTalking !== talkingRef.current && !isMuted) {
                talkingRef.current = isTalking;
                // Notify server about our talking state
                if (socket) {
                  socket.emit('talking-status', { isTalking });
                }
              }
            }
            
            // Update UI
            setTalkingUsers(prev => ({
              ...prev,
              [userId]: isTalking && (userId !== currentPlayerId || !isMuted)
            }));
            
            lastTalkingState = isTalking;
            
            if (isTalking) {
              console.log(`[VOICE] ${userId === currentPlayerId ? 'You are' : userId + ' is'} talking`);
            }
          }, 150); // 150ms debounce
        }
        
        // Continue voice detection
        animationFrameId.current = requestAnimationFrame(detectVoiceActivity);
      };
      
      // Start voice activity detection
      detectVoiceActivity();
      console.log(`[VOICE] Voice activity detection started for ${userId}`);
      
      return analyser;
    } catch (err) {
      console.error(`[VOICE] Error setting up audio analyser for ${userId}:`, err);
      return null;
    }
  };
  
  const joinVoiceChat = async () => {
    setMicTestMode(true);
    console.log('[AUDIO] Starting microphone test...');
    
    try {
      // Request microphone with optimal voice settings
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        },
        video: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[AUDIO] Microphone access granted:', stream.getAudioTracks()[0]?.label);
      
      // Check if we have any audio tracks
      if (stream.getAudioTracks().length === 0) {
        throw new Error('No audio tracks found in microphone stream');
      }
      
      // Store the stream and make it globally accessible for other components
      setAudioStream(stream);
      window.voiceChatStream = stream; // Expose globally for mute control in PlayerList
      
      // Setup audio analyzer for visualization and voice detection
      try {
        // Create AudioContext
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
          console.log('[AUDIO] Created new AudioContext');
        }
        
        // Resume AudioContext if suspended (important for Safari)
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
          console.log('[AUDIO] AudioContext resumed');
        }
        
        // Create analyzer for voice activity detection
        const analyser = audioContextRef.current.createAnalyser();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        
        // Configure for voice
        analyser.fftSize = 1024; // More detailed FFT for better voice detection
        analyser.smoothingTimeConstant = 0.5;
        
        source.connect(analyser);
        setAudioAnalyser(analyser);
        
        // Start voice activity detection
        detectMyVoiceActivity();
        console.log('[AUDIO] Voice activity detection started');
        
        // Play test sound to verify audio output system
        playTestSound();
      } catch (audioError) {
        console.error('[AUDIO] Error setting up audio analyzer:', audioError);
        setError(`Audio processing error: ${audioError.message}`);
      }
    } catch (err) {
      console.error('[AUDIO] Error accessing microphone:', err);
      
      // Provide user-friendly error messages
      let errorMessage = 'Could not access microphone.';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Microphone access denied. Please allow microphone access in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone and try again.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'Could not access microphone. It may be in use by another application.';
      }
      
      setError(errorMessage);
    }
  };
  
  const completeJoinVoiceChat = () => {
    // Actually join the voice chat after testing microphone
    setIsVoiceChatEnabled(true);
    setMicTestMode(false);
    setShowModal(false);
    
    // Make sure audio context is running
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(console.error);
    }
    
    // Notify server we've joined voice chat
    if (socket && roomId) {
      console.log(`[AUDIO] Joining voice chat in room ${roomId}`);
      socket.emit('join-voice-chat', { roomId });
      
      // Send initial talking status (not talking)
      socket.emit('talking-status', { isTalking: false, isMuted });
    }
  };
  
  const disableVoiceChat = () => {
    // Notify server we're leaving voice chat
    if (socket && roomId) {
      socket.emit('leave-voice-chat', { roomId });
    }
    
    cleanupVoiceChat();
    setShowModal(false);
  };
  
  const toggleMute = () => {
    setIsMuted(prevMuted => {
      const newMutedState = !prevMuted;
      
      // If we have an audio stream, enable/disable its tracks
      if (audioStream) {
        audioStream.getAudioTracks().forEach(track => {
          track.enabled = !newMutedState;
        });
      }
      
      // If unmuting, make sure we clear the talking indicator if needed
      if (!newMutedState && socket && roomId) {
        socket.emit('talking-status', { isTalking: false });
      }
      
      return newMutedState;
    });
  };
  
  const isPlayerTalking = (playerId) => {
    return talkingUsers[playerId] || false;
  };
  
  const startMicTest = async () => {
    setMicTestMode(true);
    // Play a test sound to ensure audio output is working
    playTestSound();
    await joinVoiceChat();
    // Don't automatically enable loopback, let user toggle it
    setLoopbackEnabled(false);
  };
  
  const toggleMicLoopback = () => {
    setLoopbackEnabled(prev => {
      const newLoopbackState = !prev;
      
      if (audioStream && audioContextRef.current) {
        try {
          if (newLoopbackState) {
            // Create loopback connection if it doesn't exist
            if (!loopbackNodeRef.current) {
              const source = audioContextRef.current.createMediaStreamSource(audioStream);
              // Add a gain node to control volume and prevent feedback
              const gainNode = audioContextRef.current.createGain();
              gainNode.gain.value = loopbackVolume; // Use current volume setting
              
              source.connect(gainNode);
              gainNode.connect(audioContextRef.current.destination);
              
              loopbackNodeRef.current = { source, gainNode };
              console.log(`Loopback enabled at ${Math.round(loopbackVolume * 100)}% volume - you can now hear yourself`);
            }
          } else {
            // Disconnect loopback if it exists
            if (loopbackNodeRef.current) {
              loopbackNodeRef.current.source.disconnect();
              loopbackNodeRef.current.gainNode.disconnect();
              loopbackNodeRef.current = null;
              console.log('Loopback disabled - you will no longer hear yourself');
            }
          }
        } catch (err) {
          console.error('Error toggling loopback:', err);
        }
      }
      
      return newLoopbackState;
    });
  };
  
  // Play a test sound to verify audio output is working
  const playTestSound = () => {
    try {
      // Create a test oscillator
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Configure the oscillator
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // 440 Hz - A4
      
      // Set volume
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime); // 20% volume
      
      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Play sound for 0.5 seconds
      oscillator.start();
      console.log('Playing test sound to verify audio output');
      
      // Stop after 0.5 seconds
      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
        console.log('Test sound completed');
      }, 500);
    } catch (err) {
      console.error('Error playing test sound:', err);
    }
  };
  
  const endMicTest = () => {
    // Make sure to disable loopback
    if (loopbackEnabled) {
      toggleMicLoopback();
    }
    setMicTestMode(false);
    setShowModal(false);
  };
  
  // Add audio debugging button function
  const debugAudio = () => {
    try {
      // Play a test sound to verify audio output
      playTestSound();
      
      // Display all audio elements in DOM
      const audioElements = document.querySelectorAll('audio');
      console.log(`Found ${audioElements.length} audio elements in DOM:`);
      
      audioElements.forEach((el, i) => {
        console.log(`Audio element ${i}:`, {
          id: el.id,
          srcObject: !!el.srcObject,
          muted: el.muted,
          volume: el.volume,
          paused: el.paused,
          tracks: el.srcObject?.getTracks().length || 0
        });
      });
      
      // Check if WebRTC peer connections exist
      console.log('Current peer connections:', Object.keys(myPeers.current));
      
      // Log audio context state
      console.log('AudioContext state:', audioContextRef.current?.state);
      
      // Force resume audio context if suspended
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume().then(() => {
          console.log('AudioContext resumed successfully');
        }).catch(err => {
          console.error('Error resuming AudioContext:', err);
        });
      }
      
      // Create and display audio status
      const existingStatus = document.getElementById('audio-debug-status');
      if (existingStatus) {
        existingStatus.remove();
      }
      
      const statusDiv = document.createElement('div');
      statusDiv.id = 'audio-debug-status';
      statusDiv.className = 'audio-debug-status';
      statusDiv.innerHTML = `
        <h3>Voice Chat Status</h3>
        <p>Audio connections: ${Object.keys(myPeers.current).length}</p>
        <p>Audio elements: ${audioElements.length}</p>
        <p>AudioContext: ${audioContextRef.current?.state || 'none'}</p>
        <p>Microphone: ${audioStream ? 'Connected' : 'Not connected'}</p>
        <button id="debug-close">Close</button>
      `;
      document.body.appendChild(statusDiv);
      
      document.getElementById('debug-close').onclick = () => {
        statusDiv.remove();
      };
    } catch (err) {
      console.error('Error in debug audio:', err);
    }
  };
  
  // Add global audio context handler to ensure it stays active
  useEffect(() => {
    // This ensures the audio context gets resumed on any user interaction
    const resumeAudioContext = () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        console.log('[AUDIO] Resuming audio context from user interaction');
        audioContextRef.current.resume().catch(err => {
          console.error('[AUDIO] Failed to resume audio context:', err);
        });
      }
    };
    
    // Add listeners for common user interactions
    document.addEventListener('click', resumeAudioContext);
    document.addEventListener('touchstart', resumeAudioContext);
    document.addEventListener('keydown', resumeAudioContext);
    
    // Add visibility change handler for when tab becomes visible again
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        resumeAudioContext();
      }
    });
    
    return () => {
      // Clean up all event listeners
      document.removeEventListener('click', resumeAudioContext);
      document.removeEventListener('touchstart', resumeAudioContext);
      document.removeEventListener('keydown', resumeAudioContext);
    };
  }, []);
  
  const handleLoopbackVolumeChange = (event) => {
    const newVolume = parseFloat(event.target.value);
    setLoopbackVolume(newVolume);
    
    // Update gain value immediately if loopback is enabled
    if (loopbackEnabled && loopbackNodeRef.current) {
      loopbackNodeRef.current.gainNode.gain.value = newVolume;
    }
  };
  
  // Detect our own voice activity with improved noise handling
  const detectMyVoiceActivity = () => {
    if (!audioAnalyser) return;
    
    const dataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
    audioAnalyser.getByteFrequencyData(dataArray);
    
    // Calculate average volume with better noise filtering
    // Focus on mid-range frequencies (human voice range)
    const midRangeStart = Math.floor(dataArray.length * 0.1); // Skip lowest 10% (noise)
    const midRangeEnd = Math.floor(dataArray.length * 0.6);   // Use up to 60% (typical voice range)
    
    let sum = 0;
    let count = 0;
    
    for (let i = midRangeStart; i < midRangeEnd; i++) {
      sum += dataArray[i];
      count++;
    }
    
    const average = count > 0 ? sum / count : 0;
    const normalizedAverage = average / 255;
    
    // Update audio level with higher scaling to make changes more visible
    setAudioLevel(normalizedAverage * 1.5); // Amplify the level for better visibility
    
    // Use a slightly higher threshold to avoid false positives
    const isTalking = normalizedAverage > VOICE_ACTIVITY_THRESHOLD;
    
    // Add hysteresis to prevent rapid on/off switching
    if (isTalking && !talkingRef.current) {
      // Just started talking
      talkingRef.current = true;
    } else if (!isTalking && talkingRef.current && normalizedAverage < VOICE_ACTIVITY_THRESHOLD * 0.7) {
      // Stopped talking (with lower threshold to turn off)
      talkingRef.current = false;
    }
    
    // Update local talking state
    setTalkingUsers(prev => {
      const wasTalking = prev[currentPlayerId];
      
      // Only send update to server if talking status changed
      if (wasTalking !== talkingRef.current && socket && !isMuted) {
        socket.emit('talking-status', { isTalking: talkingRef.current });
      }
      
      return {
        ...prev,
        [currentPlayerId]: talkingRef.current && !isMuted
      };
    });
    
    // Continue checking voice activity
    animationFrameId.current = requestAnimationFrame(detectMyVoiceActivity);
  };
  
  const enableVoiceChat = async () => {
    try {
      // Request microphone permission
      const stream = await requestMicrophonePermission();
      setAudioStream(stream);
      
      // Make stream available globally for the mute button in PlayerList
      window.voiceChatStream = stream;
      
      // Setup audio analyser for our own stream
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = createAudioContext();
        }
        
        const analyser = audioContextRef.current.createAnalyser();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        
        analyser.fftSize = 256;
        source.connect(analyser);
        setAudioAnalyser(analyser);
        
        // Start voice activity detection
        detectMyVoiceActivity();
      } catch (audioError) {
        console.error('Error setting up audio analyzer:', audioError);
        setError(`Audio processing error: ${audioError.message}`);
      }
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError(err.message || 'Could not access microphone. Please check your permissions.');
    }
  };
  
  return (
    <div className="voice-chat-container">
      {/* Voice chat join modal */}
      {showModal && (
        <div className="voice-chat-modal">
          <div className="voice-chat-modal-content">
            <h2>Voice Chat</h2>
            {compatibilityIssues.length > 0 ? (
              <div className="compatibility-issues">
                <h3>Voice Chat Not Available</h3>
                <ul className="issues-list">
                  {compatibilityIssues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
                <div className="voice-chat-modal-buttons">
                  <button onClick={disableVoiceChat}>Text Chat Only</button>
                </div>
              </div>
            ) : micTestMode ? (
              <div className="mic-test-container">
                <h3>Microphone Test</h3>
                <p>Speak into your microphone to test it.</p>
                <div className="mic-level-meter-container">
                  <div 
                    className="mic-level-meter" 
                    style={{ width: `${Math.min(audioLevel * 100 * 10, 100)}%` }}
                  ></div>
                  <div className="mic-level-value">{Math.round(audioLevel * 100)}%</div>
                </div>
                <p className="mic-status">
                  {audioLevel > VOICE_ACTIVITY_THRESHOLD ? 
                    "Your microphone is working!" : 
                    "No sound detected. Try speaking louder or check your mic."}
                </p>
                <div className="loopback-control">
                  <button 
                    className={`loopback-toggle ${loopbackEnabled ? 'enabled' : ''}`}
                    onClick={toggleMicLoopback}
                  >
                    {loopbackEnabled ? 'Stop Hearing Myself' : 'Hear My Voice'}
                  </button>
                  {loopbackEnabled && (
                    <>
                      <p className="loopback-warning">
                        You should now hear your own voice. If using speakers instead of headphones, be careful of feedback.
                      </p>
                      <div className="loopback-volume-control">
                        <label htmlFor="loopback-volume">Volume:</label>
                        <input
                          type="range"
                          id="loopback-volume"
                          min="0"
                          max="1"
                          step="0.01"
                          value={loopbackVolume}
                          onChange={handleLoopbackVolumeChange}
                        />
                        <span>{Math.round(loopbackVolume * 100)}%</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="voice-chat-modal-buttons">
                  <button 
                    onClick={completeJoinVoiceChat}
                    className="join-voice-chat-button"
                  >
                    Join Voice Chat
                  </button>
                  <button onClick={disableVoiceChat}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <p>Would you like to join the voice chat?</p>
                {error && <p className="error">{error}</p>}
                <div className="voice-chat-modal-buttons">
                  <button onClick={joinVoiceChat}>Join Voice Chat</button>
                  <button onClick={startMicTest}>Test Microphone</button>
                  <button onClick={disableVoiceChat}>Text Chat Only</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Remote audio container - changed to visible for testing */}
      <div 
        id="remote-audio-container" 
        className="remote-audio-container"
      ></div>
      
      {/* Voice chat controls (only shown when voice chat is enabled) */}
      {isVoiceChatEnabled && (
        <div className="voice-chat-controls">
          {/* Mute button */}
          <button 
            className={`voice-chat-button ${isMuted ? 'muted' : ''}`}
            onClick={toggleMute}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <span className="mic-icon muted">🔇</span>
            ) : (
              <span className="mic-icon">🎤</span>
            )}
          </button>
          
          {/* Audio level indicator when speaking */}
          {!isMuted && (
            <div 
              className={`audio-level-indicator ${audioLevel > VOICE_ACTIVITY_THRESHOLD ? 'active' : ''}`}
              style={{ width: `${Math.min(audioLevel * 100 * 5, 50)}px` }}
            ></div>
          )}
          
          {/* Debug button */}
          <button 
            className="voice-chat-button debug"
            onClick={debugAudio}
            title="Debug Voice Chat"
          >
            <span>🔧</span>
          </button>
          
          {/* Leave voice chat button */}
          <button 
            className="voice-chat-button leave"
            onClick={disableVoiceChat}
            title="Leave Voice Chat"
          >
            <span>Leave Voice Chat</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default VoiceChat; 