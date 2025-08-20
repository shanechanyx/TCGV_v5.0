// Audio Manager for TCGV v5.0
// Handles all sound effects and background music

class AudioManager {
  constructor() {
    this.sounds = {};
    this.backgroundMusic = null;
    this.isMuted = false;
    this.musicVolume = 0.3; // 30% volume for background music
    this.sfxVolume = 0.6;   // 60% volume for sound effects
    
    this.init();
  }

  init() {
    // Preload all sound effects
    this.loadSound('sword_swing', '/assets/sounds/effects/sword_swing.mp3');
    this.loadSound('monster_death', '/assets/sounds/effects/monster_death.mp3');
    this.loadSound('pistol', '/assets/sounds/effects/pistol.mp3');
    this.loadSound('shotgun', '/assets/sounds/effects/shotgun.mp3');
    this.loadSound('smg', '/assets/sounds/effects/smg.mp3');
    
    // Load background music
    this.loadBackgroundMusic('/assets/sounds/music/background_music.mp3');
    
    console.log('[AUDIO] AudioManager initialized');
  }

  loadSound(name, path) {
    try {
      const audio = new Audio(path);
      audio.preload = 'auto';
      audio.volume = this.sfxVolume;
      
      // Add error handling
      audio.onerror = (e) => {
        console.error(`[AUDIO] Failed to load sound: ${name}`, e);
      };
      
      audio.oncanplaythrough = () => {
        console.log(`[AUDIO] Sound loaded: ${name}`);
      };
      
      this.sounds[name] = audio;
    } catch (error) {
      console.error(`[AUDIO] Error loading sound ${name}:`, error);
    }
  }

  loadBackgroundMusic(path) {
    try {
      this.backgroundMusic = new Audio(path);
      this.backgroundMusic.preload = 'auto';
      this.backgroundMusic.volume = this.musicVolume;
      this.backgroundMusic.loop = true;
      
      this.backgroundMusic.onerror = (e) => {
        console.error('[AUDIO] Failed to load background music', e);
      };
      
      this.backgroundMusic.oncanplaythrough = () => {
        console.log('[AUDIO] Background music loaded');
      };
    } catch (error) {
      console.error('[AUDIO] Error loading background music:', error);
    }
  }

  playSound(name) {
    if (this.isMuted) return;
    
    const sound = this.sounds[name];
    if (sound) {
      try {
        // Clone the audio to allow overlapping sounds
        const soundClone = sound.cloneNode();
        soundClone.volume = this.sfxVolume;
        
        soundClone.play().catch(error => {
          console.error(`[AUDIO] Error playing sound ${name}:`, error);
        });
        
        // Clean up cloned audio after it finishes
        soundClone.onended = () => {
          soundClone.remove();
        };
        
        console.log(`[AUDIO] Playing sound: ${name}`);
      } catch (error) {
        console.error(`[AUDIO] Error playing sound ${name}:`, error);
      }
    } else {
      console.warn(`[AUDIO] Sound not found: ${name}`);
    }
  }

  playBackgroundMusic() {
    if (this.isMuted || !this.backgroundMusic) return;
    
    try {
      this.backgroundMusic.currentTime = 0; // Start from beginning
      this.backgroundMusic.volume = this.musicVolume;
      this.backgroundMusic.play().catch(error => {
        console.error('[AUDIO] Error playing background music:', error);
      });
      console.log('[AUDIO] Background music started');
    } catch (error) {
      console.error('[AUDIO] Error playing background music:', error);
    }
  }

  stopBackgroundMusic() {
    if (this.backgroundMusic) {
      try {
        this.backgroundMusic.pause();
        this.backgroundMusic.currentTime = 0;
        console.log('[AUDIO] Background music stopped');
      } catch (error) {
        console.error('[AUDIO] Error stopping background music:', error);
      }
    }
  }

  pauseBackgroundMusic() {
    if (this.backgroundMusic) {
      try {
        this.backgroundMusic.pause();
        console.log('[AUDIO] Background music paused');
      } catch (error) {
        console.error('[AUDIO] Error pausing background music:', error);
      }
    }
  }

  resumeBackgroundMusic() {
    if (this.backgroundMusic && !this.isMuted) {
      try {
        this.backgroundMusic.play().catch(error => {
          console.error('[AUDIO] Error resuming background music:', error);
        });
        console.log('[AUDIO] Background music resumed');
      } catch (error) {
        console.error('[AUDIO] Error resuming background music:', error);
      }
    }
  }

  setMuted(muted) {
    this.isMuted = muted;
    
    if (muted) {
      this.pauseBackgroundMusic();
    } else {
      this.resumeBackgroundMusic();
    }
    
    console.log(`[AUDIO] Audio ${muted ? 'muted' : 'unmuted'}`);
  }

  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.backgroundMusic) {
      this.backgroundMusic.volume = this.musicVolume;
    }
  }

  setSFXVolume(volume) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    // Update volume for all loaded sounds
    Object.values(this.sounds).forEach(sound => {
      sound.volume = this.sfxVolume;
    });
  }

  // Specific sound effect methods
  playSwordSwing() {
    this.playSound('sword_swing');
  }

  playMonsterDeath() {
    this.playSound('monster_death');
  }

  playPistolShot() {
    this.playSound('pistol');
  }

  playShotgunShot() {
    this.playSound('shotgun');
  }

  playSMGShot() {
    this.playSound('smg');
  }

  // Get audio status
  getStatus() {
    return {
      isMuted: this.isMuted,
      musicVolume: this.musicVolume,
      sfxVolume: this.sfxVolume,
      backgroundMusicPlaying: this.backgroundMusic ? !this.backgroundMusic.paused : false,
      soundsLoaded: Object.keys(this.sounds).length
    };
  }
}

// Create global audio manager instance
const audioManager = new AudioManager();

// Export for use in other components
export default audioManager;
