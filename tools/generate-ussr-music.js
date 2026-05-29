#!/usr/bin/env node
/**
 * USSR Theme Music Generator for MesoBuilder Intro Cinematics
 * Generates a 30-second Soviet march-style music file
 */

const fs = require('fs');
const path = require('path');

function generateUSSRMusic() {
  const sampleRate = 44100;
  const duration = 30; // 30 seconds
  const totalSamples = sampleRate * duration;
  
  console.log('Generating USSR theme music...');
  console.log(`Parameters: ${sampleRate} Hz, ${duration} seconds, ${totalSamples} samples`);
  
  // Create PCM data
  const pcm = Buffer.alloc(totalSamples * 2); // 16-bit mono
  const tempo = 120; // BPM
  
  for (let i = 0; i < totalSamples; i++) {
    const time = i / sampleRate;
    const beatPos = (time * tempo / 60) % 16; // 16-beat pattern
    
    // Melody: Soviet march style (E4-B4)
    const melodyFrequencies = [329.63, 329.63, 359.13, 393.99, 440, 440, 392.00, 349.23];
    const melodyNote = Math.floor(beatPos * 8 / 16) % 8;
    const melodyFreq = melodyFrequencies[melodyNote];
    const melodyPhase = (i / sampleRate) * melodyFreq * 2 * Math.PI;
    const melody = Math.sin(melodyPhase) * (Math.sin(beatPos * Math.PI / 8) > 0 ? 0.3 : 0);
    
    // Kick drum on beats 0, 4, 8, 12
    const kickBeat = beatPos % 4;
    const kick = (kickBeat < 0.5 && Math.floor(beatPos) % 4 < 1) ? Math.sin(melodyPhase * 0.5) * 0.4 : 0;
    
    // Bass line
    const bass = Math.sin((i / sampleRate) * 65.41 * 2 * Math.PI) * (Math.sin(beatPos * Math.PI / 2) > 0 ? 0.2 : 0);
    
    // Envelope (fade in/out)
    const startFade = sampleRate * 1;
    const endFade = sampleRate * (duration - 1);
    let envelope = 1;
    if (i < startFade) envelope = i / startFade;
    if (i > endFade) envelope = (totalSamples - i) / sampleRate;
    
    // Mix
    let sample = (melody + kick + bass) * 0.5 * envelope * 0.8;
    sample = Math.max(-1, Math.min(1, sample));
    
    // Write as 16-bit PCM
    const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    pcm.writeInt16LE(Math.round(int16), i * 2);
  }
  
  // Encode to WAV
  const wav = encodeWAV(pcm, sampleRate);
  
  const outputPath = path.join(__dirname, '..', 'data', 'Sounds', 'ussr.wav');
  const outputDir = path.dirname(outputPath);
  
  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created directory: ${outputDir}`);
  }
  
  fs.writeFileSync(outputPath, wav);
  console.log(`✓ Music file generated: ${outputPath}`);
  console.log(`  File size: ${(wav.length / 1024).toFixed(2)} KB`);
  console.log(`  Duration: ${duration} seconds`);
  console.log(`  Format: WAV (16-bit, ${sampleRate} Hz)`);
}

function encodeWAV(pcm, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = pcm.length;
  const fileSize = 36 + dataSize;
  
  const wav = Buffer.alloc(44 + dataSize);
  
  // RIFF header
  wav.write('RIFF', 0);
  wav.writeUInt32LE(fileSize, 4);
  wav.write('WAVE', 8);
  
  // Format subchunk
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16); // Subchunk1Size
  wav.writeUInt16LE(1, 20);  // AudioFormat (PCM)
  wav.writeUInt16LE(numChannels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(byteRate, 28);
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(bitsPerSample, 34);
  
  // Data subchunk
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);
  pcm.copy(wav, 44);
  
  return wav;
}

try {
  generateUSSRMusic();
  process.exit(0);
} catch (err) {
  console.error('Error generating music:', err.message);
  process.exit(1);
}
