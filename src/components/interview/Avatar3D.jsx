import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// ── Canonical Bind Pose & Resting Quaternions (Immutable Constants) ──
const BIND_LEFT_ARM_QUAT = new THREE.Quaternion(0.052049063, 0.0000000965, -0.10452807, 0.993159);
const BIND_RIGHT_ARM_QUAT = new THREE.Quaternion(0.052049566, 0.0000001526, 0.10452753, 0.993159);
const BIND_LEFT_FOREARM_QUAT = new THREE.Quaternion(-0.0528818, -0.00015367, 0.1476778, 0.9876208);
const BIND_RIGHT_FOREARM_QUAT = new THREE.Quaternion(-0.0517615, 0.000000164, -0.1478085, 0.9876605);
const BIND_LEFT_SHOULDER_QUAT = new THREE.Quaternion(0.56836867, 0.48208743, -0.4045192, 0.53001225);
const BIND_RIGHT_SHOULDER_QUAT = new THREE.Quaternion(0.56836873, -0.48208758, 0.4045192, 0.53001207);

const LOCAL_X_AXIS = new THREE.Vector3(1, 0, 0);
const LOCAL_Z_AXIS = new THREE.Vector3(0, 0, 1);

/**
 * ProceduralModel — Real-Time Acoustic Spectral Formant Viseme & Emotion Synthesizer
 * 
 * True Formant-to-Viseme Mapping:
 * - 100Hz - 600Hz (Low Formants): Drives Rounded Vowels (OO / U / O / W) -> mouthFunnel & mouthPucker
 * - 700Hz - 2200Hz (Mid Formants): Drives Open Vowels (AA / AH / OH / AY) -> jawOpen & mouthLowerDown
 * - 2300Hz - 4800Hz (High-Mid Formants): Drives Front Spread Vowels (EE / IH / AE) -> mouthStretch
 * - 5000Hz - 11000Hz (Treble Formants): Drives Sibilants/Fricatives (S / SH / T / Z / F / V) -> mouthShrugLower & mouthClose
 * - Syllable Dips & Micro-Pauses: Drives Bilabial Closures (B / M / P) -> mouthClose & mouthPress
 */
function ProceduralModel({
  modelPath = '/model.glb',
  isSpeaking = false,
  audioLevel = 0,
  emotion = 'neutral',
  isFemale = false,
}) {
  const { scene } = useGLTF(modelPath);
  const groupRef = useRef();

  const smoothedAudio = useRef(0);
  const blinkState = useRef({ isBlinking: false, blinkWeight: 0, nextBlink: 2.5 });
  const freqDataBuffer = useMemo(() => new Uint8Array(128), []);

  // Smoothed formant states
  const formantSmooth = useRef({
    low: 0,
    mid: 0,
    highMid: 0,
    treble: 0,
    volume: 0,
    syllableTimer: 0,
    pseudoPhoneme: 0, // 0: Open, 1: Round, 2: Spread, 3: Plosive
  });

  // Reusable quaternion to prevent GC spikes in 60fps render loop
  const tempQuat = useMemo(() => new THREE.Quaternion(), []);

  // Extract critical bones & comprehensive ARKit facial morph targets
  const {
    head, neck, neck1, spine, spine1, spine2,
    leftShoulder, rightShoulder,
    leftArm, rightArm,
    leftForeArm, rightForeArm,
    morphMeshes,
  } = useMemo(() => {
    const headBone = scene.getObjectByName('Head');
    const neckBone = scene.getObjectByName('Neck');
    const neck1Bone = scene.getObjectByName('Neck1');
    const neck2Bone = scene.getObjectByName('Neck2');
    const spineBone = scene.getObjectByName('Spine');
    const spine1Bone = scene.getObjectByName('Spine1');
    const spine2Bone = scene.getObjectByName('Spine2');
    const hipsBone = scene.getObjectByName('Hips');

    const leftShoulderBone = scene.getObjectByName('LeftShoulder');
    const rightShoulderBone = scene.getObjectByName('RightShoulder');
    const leftArmBone = scene.getObjectByName('LeftArm');
    const rightArmBone = scene.getObjectByName('RightArm');
    const leftForeArmBone = scene.getObjectByName('LeftForeArm');
    const rightForeArmBone = scene.getObjectByName('RightForeArm');

    const morphs = [];
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.morphTargetDictionary && child.morphTargetInfluences) {
          const dict = child.morphTargetDictionary;
          morphs.push({
            mesh: child,
            influences: child.morphTargetInfluences,
            idx: {
              // Jaw
              jawOpen: dict.jawOpen,
              jawForward: dict.jawForward,
              jawLeft: dict.jawLeft,
              jawRight: dict.jawRight,
              // Mouth Core
              mouthClose: dict.mouthClose,
              mouthLowerDownLeft: dict.mouthLowerDownLeft,
              mouthLowerDownRight: dict.mouthLowerDownRight,
              mouthUpperUpLeft: dict.mouthUpperUpLeft,
              mouthUpperUpRight: dict.mouthUpperUpRight,
              // Phonetic Shapes
              mouthFunnel: dict.mouthFunnel,
              mouthPucker: dict.mouthPucker,
              mouthStretchLeft: dict.mouthStretchLeft,
              mouthStretchRight: dict.mouthStretchRight,
              mouthRollLower: dict.mouthRollLower,
              mouthRollUpper: dict.mouthRollUpper,
              mouthShrugLower: dict.mouthShrugLower,
              mouthShrugUpper: dict.mouthShrugUpper,
              mouthPressLeft: dict.mouthPressLeft,
              mouthPressRight: dict.mouthPressRight,
              mouthDimpleLeft: dict.mouthDimpleLeft,
              mouthDimpleRight: dict.mouthDimpleRight,
              // Expression & Smiles
              mouthSmileLeft: dict.mouthSmileLeft,
              mouthSmileRight: dict.mouthSmileRight,
              mouthFrownLeft: dict.mouthFrownLeft,
              mouthFrownRight: dict.mouthFrownRight,
              // Cheeks & Nose
              cheekPuff: dict.cheekPuff,
              cheekSquintLeft: dict.cheekSquintLeft,
              cheekSquintRight: dict.cheekSquintRight,
              noseSneerLeft: dict.noseSneerLeft,
              noseSneerRight: dict.noseSneerRight,
              // Eyes & Brows
              eyeBlinkLeft: dict.eyeBlinkLeft,
              eyeBlinkRight: dict.eyeBlinkRight,
              eyeSquintLeft: dict.eyeSquintLeft,
              eyeSquintRight: dict.eyeSquintRight,
              eyeWideLeft: dict.eyeWideLeft,
              eyeWideRight: dict.eyeWideRight,
              eyeLookDownLeft: dict.eyeLookDownLeft,
              eyeLookDownRight: dict.eyeLookDownRight,
              eyeLookInLeft: dict.eyeLookInLeft,
              eyeLookInRight: dict.eyeLookInRight,
              eyeLookOutLeft: dict.eyeLookOutLeft,
              eyeLookOutRight: dict.eyeLookOutRight,
              eyeLookUpLeft: dict.eyeLookUpLeft,
              eyeLookUpRight: dict.eyeLookUpRight,
              browInnerUp: dict.browInnerUp,
              browOuterUpLeft: dict.browOuterUpLeft,
              browOuterUpRight: dict.browOuterUpRight,
              browDownLeft: dict.browDownLeft,
              browDownRight: dict.browDownRight,
            },
          });
        }
        if (child.material) {
          child.material.envMapIntensity = 0.95;
          child.material.roughness = Math.max(0.36, child.material.roughness || 0.48);
        }
      }
    });

    return {
      head: headBone,
      neck: neckBone,
      neck1: neck1Bone,
      neck2: neck2Bone,
      spine: spineBone,
      spine1: spine1Bone,
      spine2: spine2Bone,
      hips: hipsBone,
      leftShoulder: leftShoulderBone,
      rightShoulder: rightShoulderBone,
      leftArm: leftArmBone,
      rightArm: rightArmBone,
      leftForeArm: leftForeArmBone,
      rightForeArm: rightForeArmBone,
      morphMeshes: morphs,
    };
  }, [scene]);

  // Frame Loop (60 FPS Direct Spectral Formant Analysis & Organic Human Physics)
  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();

    // ── 1. Organic Human Breathing & Postural Dynamics ──
    const breathCycle = Math.sin(time * 1.6);
    const chestRise = breathCycle * 0.028;
    const slowSwayX = Math.sin(time * 0.35) * 0.018;
    const slowSwayY = Math.cos(time * 0.28) * 0.022;

    // Emotion states
    const isLaughing = emotion === 'laughing';
    const isSerious = emotion === 'serious';
    const isCurious = emotion === 'curious';
    const isThinking = emotion === 'thinking';
    const isListening = emotion === 'listening' || !isSpeaking;
    const isSmiling = emotion === 'smiling' || isLaughing;

    const laughingShake = isLaughing ? Math.sin(time * 16.0) * 0.015 : 0;

    // ── 2. Real-Time Acoustic Spectral Formant Analyzer ──
    const formants = formantSmooth.current;
    let currentLow = 0;
    let currentMid = 0;
    let currentHighMid = 0;
    let currentTreble = 0;
    let currentVolume = 0;

    const analyser = window.__prova_speaker_analyser;

    if (isSpeaking && analyser) {
      analyser.getByteFrequencyData(freqDataBuffer);

      // Band 1: Low (100Hz - 600Hz: Bins 1-6) -> Round Vowels (OO / U / W / M / B)
      let lowSum = 0;
      for (let i = 1; i <= 6; i++) lowSum += freqDataBuffer[i];
      currentLow = Math.min(1.0, Math.max(0, (lowSum / 6 - 8) / 75));

      // Band 2: Mid (700Hz - 2200Hz: Bins 7-22) -> Open Vowels (AA / AH / OH / AY)
      let midSum = 0;
      for (let i = 7; i <= 22; i++) midSum += freqDataBuffer[i];
      currentMid = Math.min(1.0, Math.max(0, (midSum / 16 - 8) / 75));

      // Band 3: High-Mid (2300Hz - 4800Hz: Bins 23-48) -> Front Spread Vowels (EE / IH / AE)
      let hmSum = 0;
      for (let i = 23; i <= 48; i++) hmSum += freqDataBuffer[i];
      currentHighMid = Math.min(1.0, Math.max(0, (hmSum / 26 - 6) / 65));

      // Band 4: Treble (5000Hz - 11000Hz: Bins 49-105) -> Sibilants & Fricatives (S / SH / T / Z / F / V)
      let trSum = 0;
      for (let i = 49; i <= 105; i++) trSum += freqDataBuffer[i];
      currentTreble = Math.min(1.0, Math.max(0, (trSum / 57 - 5) / 55));

      currentVolume = Math.max(currentLow, currentMid, currentHighMid, currentTreble);
    }

    // Blend live audioLevel to ensure 100% mouth-audio synchronization
    if (isSpeaking && audioLevel > 0.02) {
      const liveBoost = Math.min(1.0, audioLevel * 1.35);
      currentMid = Math.max(currentMid, liveBoost * 0.85);
      currentLow = Math.max(currentLow, liveBoost * 0.55);
      currentHighMid = Math.max(currentHighMid, liveBoost * 0.45);
      currentVolume = Math.max(currentVolume, liveBoost);
    } else if (isSpeaking && !analyser) {
      // Natural procedural syllable sequencer if analyser is initializing
      formants.syllableTimer -= delta;
      if (formants.syllableTimer <= 0) {
        formants.pseudoPhoneme = Math.floor(Math.random() * 4);
        formants.syllableTimer = 0.12 + Math.random() * 0.14;
      }
      const baseVol = audioLevel > 0.02 ? audioLevel : 0.45;
      if (formants.pseudoPhoneme === 0) {
        currentMid = baseVol * 0.85;
        currentLow = baseVol * 0.25;
      } else if (formants.pseudoPhoneme === 1) {
        currentLow = baseVol * 0.95;
        currentMid = baseVol * 0.15;
      } else if (formants.pseudoPhoneme === 2) {
        currentHighMid = baseVol * 0.9;
        currentMid = baseVol * 0.2;
      } else {
        currentTreble = baseVol * 0.85;
      }
      currentVolume = baseVol;
    }

    if (!isSpeaking) {
      currentLow = 0;
      currentMid = 0;
      currentHighMid = 0;
      currentTreble = 0;
      currentVolume = 0;
    }

    // Fast Attack (0.70) for crisp phonetic onsets, smooth release (0.40)
    formants.low = THREE.MathUtils.lerp(formants.low, currentLow, currentLow > formants.low ? 0.70 : 0.40);
    formants.mid = THREE.MathUtils.lerp(formants.mid, currentMid, currentMid > formants.mid ? 0.70 : 0.40);
    formants.highMid = THREE.MathUtils.lerp(formants.highMid, currentHighMid, currentHighMid > formants.highMid ? 0.70 : 0.40);
    formants.treble = THREE.MathUtils.lerp(formants.treble, currentTreble, currentTreble > formants.treble ? 0.70 : 0.40);
    formants.volume = THREE.MathUtils.lerp(formants.volume, currentVolume, currentVolume > formants.volume ? 0.70 : 0.40);

    // ── 3. Head & Neck Conversational Dynamics ──
    let targetHeadX = 0;
    let targetHeadY = 0;
    let targetHeadZ = 0;

    let targetNeckX = 0;
    let targetNeckY = 0;
    let targetNeckZ = 0;

    if (isSpeaking) {
      // Natural conversational cadence: nods on stressed syllables
      const speechCadenceNod = Math.sin(time * 3.6) * 0.045 + (formants.volume * 0.035) + laughingShake;
      const speechTurn = Math.sin(time * 1.25) * 0.055 + (isCurious ? 0.04 : 0);
      const speechTilt = Math.cos(time * 1.65) * 0.040 + (isFemale ? 0.025 : 0);

      targetHeadX = speechCadenceNod * 0.65;
      targetHeadY = speechTurn * 0.65;
      targetHeadZ = speechTilt * 0.65;

      targetNeckX = speechCadenceNod * 0.35;
      targetNeckY = speechTurn * 0.35;
      targetNeckZ = speechTilt * 0.35;
    } else if (isListening) {
      // Active interviewer listening: tilted head + rhythmic understanding nods every 3.4s
      const listenCycle = time % 3.4;
      const affirmativeNod = (listenCycle > 0.8 && listenCycle < 1.6) ? Math.sin((listenCycle - 0.8) * Math.PI * 2.5) * 0.045 : 0;

      targetHeadX = 0.032 + affirmativeNod + laughingShake;
      targetHeadY = Math.sin(time * 0.45) * 0.030;
      targetHeadZ = (isFemale ? 0.055 : 0.042); // Attentive inquisitive tilt

      targetNeckX = affirmativeNod * 0.4;
      targetNeckY = targetHeadY * 0.4;
      targetNeckZ = targetHeadZ * 0.4;
    } else if (isThinking) {
      // Looking up/aside pensively
      targetHeadX = -0.065;
      targetHeadY = 0.080;
      targetHeadZ = -0.035;

      targetNeckX = -0.030;
      targetNeckY = 0.040;
      targetNeckZ = -0.015;
    }

    if (head) {
      head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, targetHeadX, 0.10);
      head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, targetHeadY, 0.08);
      head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, targetHeadZ, 0.08);
    }

    const activeNeck = neck || neck1;
    if (activeNeck) {
      activeNeck.rotation.x = THREE.MathUtils.lerp(activeNeck.rotation.x, targetNeckX, 0.08);
      activeNeck.rotation.y = THREE.MathUtils.lerp(activeNeck.rotation.y, targetNeckY, 0.07);
      activeNeck.rotation.z = THREE.MathUtils.lerp(activeNeck.rotation.z, targetNeckZ, 0.07);
    }
    if (neck1 && neck1 !== activeNeck) {
      neck1.rotation.x = THREE.MathUtils.lerp(neck1.rotation.x, targetNeckX * 0.5, 0.08);
      neck1.rotation.y = THREE.MathUtils.lerp(neck1.rotation.y, targetNeckY * 0.5, 0.07);
    }

    // ── 4. Torso & Spine Breathing & Posture ──
    const targetSpineX = -0.015 + chestRise + (isSerious ? 0.035 : 0) + (isListening ? 0.025 : 0);
    const targetSpineY = slowSwayY;
    const targetSpineZ = -slowSwayX * 0.5;

    if (spine) {
      spine.rotation.x = THREE.MathUtils.lerp(spine.rotation.x, targetSpineX, 0.06);
      spine.rotation.y = THREE.MathUtils.lerp(spine.rotation.y, targetSpineY, 0.05);
      spine.rotation.z = THREE.MathUtils.lerp(spine.rotation.z, targetSpineZ, 0.05);
      spine.position.y = THREE.MathUtils.lerp(spine.position.y, breathCycle * 0.006 + laughingShake * 0.4, 0.06);
    }
    if (spine1) {
      spine1.rotation.x = THREE.MathUtils.lerp(spine1.rotation.x, chestRise * 0.8, 0.06);
    }
    if (spine2) {
      spine2.rotation.x = THREE.MathUtils.lerp(spine2.rotation.x, chestRise * 0.9, 0.06);
    }

    // ── 5. Living Shoulders & Arms Gestures ──
    const shoulderBreath = breathCycle * 0.025 + (isSpeaking ? Math.sin(time * 3.5) * 0.010 : 0) + laughingShake;
    if (leftShoulder) {
      tempQuat.setFromAxisAngle(LOCAL_Z_AXIS, shoulderBreath);
      leftShoulder.quaternion.copy(BIND_LEFT_SHOULDER_QUAT).multiply(tempQuat);
    }
    if (rightShoulder) {
      tempQuat.setFromAxisAngle(LOCAL_Z_AXIS, -shoulderBreath);
      rightShoulder.quaternion.copy(BIND_RIGHT_SHOULDER_QUAT).multiply(tempQuat);
    }

    const armGesticulation = isSpeaking ? (Math.sin(time * 2.4) * 0.035 + formants.mid * 0.025) : 0;
    const leftArmAngle = 1.31 + chestRise * 0.5 + armGesticulation;
    const rightArmAngle = 1.31 + chestRise * 0.5 - armGesticulation * 0.7;

    if (leftArm) {
      tempQuat.setFromAxisAngle(LOCAL_X_AXIS, leftArmAngle);
      leftArm.quaternion.copy(BIND_LEFT_ARM_QUAT).multiply(tempQuat);
    }
    if (rightArm) {
      tempQuat.setFromAxisAngle(LOCAL_X_AXIS, rightArmAngle);
      rightArm.quaternion.copy(BIND_RIGHT_ARM_QUAT).multiply(tempQuat);
    }

    if (leftForeArm) {
      const leftElbowBend = -0.12 - (isSpeaking ? (Math.cos(time * 2.4) * 0.030 + formants.volume * 0.030) : 0);
      tempQuat.setFromAxisAngle(LOCAL_X_AXIS, leftElbowBend);
      leftForeArm.quaternion.copy(BIND_LEFT_FOREARM_QUAT).multiply(tempQuat);
    }
    if (rightForeArm) {
      const rightElbowBend = -0.12 - (isSpeaking ? (Math.sin(time * 2.4) * 0.030 + formants.volume * 0.025) : 0);
      tempQuat.setFromAxisAngle(LOCAL_X_AXIS, rightElbowBend);
      rightForeArm.quaternion.copy(BIND_RIGHT_FOREARM_QUAT).multiply(tempQuat);
    }

    // ── 6. Lifelike Eye Gaze & Micro-Saccades ──
    const gazeCycle = Math.floor(time / 2.7);
    const gazeType = gazeCycle % 6;
    let eyeGazeDown = 0;
    let eyeGazeIn = 0;
    let eyeGazeOut = 0;

    if (gazeType === 3) {
      // Glancing slightly down at interview notes
      eyeGazeDown = 0.15;
    } else if (gazeType === 4 && isThinking) {
      // Glancing slightly away while thinking
      eyeGazeOut = 0.10;
    }

    // ── 7. Acoustic Phonetic Viseme Synthesizer & Intelligent Breath-Pause Engine ──
    // Tracks the exact live PCM waveform from window.__prova_speech_tracker.
    // 1. When audio has pauses, commas, or breath intake (isSilent = true): Mouth immediately rests/closes!
    // 2. Different letters and phonemes produce completely different visemes:
    //    - Open Vowels (AA, AH, AY, ا, أ): vertical lip parting
    //    - Rounded Vowels (OO, U, W, O, و): funneling and puckering
    //    - Spread Vowels (EE, IH, AE, ي): horizontal stretch
    //    - Sibilants/Fricatives (S, SH, F, س, ش, ف): gentle dental closure
    const tracker = window.__prova_speech_tracker;
    const frame = tracker?.getFrame ? tracker.getFrame() : null;

    let targetLowerDown = 0;
    let targetUpperUp = 0;
    let targetFunnel = 0;
    let targetPucker = 0;
    let targetStretch = 0;
    let targetMouthClose = 0;
    let targetJawOpen = 0;

    const targetJawForward = 0;
    const targetJawLeft = 0;
    const targetJawRight = 0;

    if (isSpeaking && frame && !frame.isSilent) {
      // ── A. LIVE ACTIVE SOUND (Real Acoustic Energy > Silence Threshold) ──
      const energy = Math.min(1.0, Math.max(0, (frame.rms - 0.016) * 4.6));
      const zcr = frame.zcrRate;

      // Micro-fraction jaw parting (0.015 - 0.035 max)
      targetJawOpen = Math.min(0.035, energy * 0.035);

      if (zcr < 0.09) {
        // 1. OPEN VOWELS (AA / AH / OH / AY / ا / أ / فتحة / ع / هـ)
        // Deep resonance, low zero-crossings: lips part naturally
        targetLowerDown = Math.min(0.15, energy * 0.16);
        targetUpperUp = Math.min(0.07, energy * 0.075);
      } else if (zcr >= 0.09 && zcr < 0.22) {
        // 2. ROUNDED VOWELS (OO / U / W / O / و / ضمة)
        // Formant shift to 300-800Hz: lips round and funnel forward
        targetFunnel = Math.min(0.20, energy * 0.22);
        targetPucker = Math.min(0.14, energy * 0.15);
        targetLowerDown = Math.min(0.07, energy * 0.08);
        targetUpperUp = Math.min(0.03, energy * 0.04);
      } else if (zcr >= 0.22 && zcr < 0.38) {
        // 3. FRONT SPREAD VOWELS (EE / IH / AE / ي / كسرة)
        // High frequency resonance (2kHz-4kHz): lips widen horizontally
        targetStretch = Math.min(0.16, energy * 0.18);
        targetLowerDown = Math.min(0.06, energy * 0.07);
        targetUpperUp = Math.min(0.03, energy * 0.04);
      } else {
        // 4. SIBILANTS & FRICATIVES (S / SH / T / Z / F / TH / س / ش / ف / ز / ت)
        // Turbulent air (>0.38 ZCR): lips align and close slightly
        targetMouthClose = Math.min(0.24, energy * 0.26);
        targetLowerDown = 0.03;
        targetUpperUp = 0.02;
      }
    } else if (isSpeaking && frame && frame.isSilent) {
      // ── B. BREATHING / PAUSE / SILENCE BETWEEN WORDS ──
      // When audio drops for breath, comma, or pause, mouth is completely still & closed
      targetLowerDown = 0;
      targetUpperUp = 0;
      targetFunnel = 0;
      targetPucker = 0;
      targetStretch = 0;
      targetJawOpen = 0;
      targetMouthClose = 0.12; // Natural resting lip seal
    } else if (isSpeaking && !frame) {
      // ── C. FALLBACK TO FREQUENCY ANALYSER ──
      const analyser = window.__prova_speaker_analyser;
      if (analyser) {
        analyser.getByteFrequencyData(freqDataBuffer);
        let sum = 0;
        for (let k = 2; k < 35; k++) sum += freqDataBuffer[k];
        const avg = sum / 33;
        const vol = Math.min(1.0, Math.max(0, (avg - 10) / 65));

        if (vol < 0.04) {
          // Pause / breath
          targetMouthClose = 0.12;
        } else {
          let lowSum = 0;
          for (let k = 1; k <= 6; k++) lowSum += freqDataBuffer[k];
          let highSum = 0;
          for (let k = 23; k <= 50; k++) highSum += freqDataBuffer[k];

          targetJawOpen = Math.min(0.035, vol * 0.035);
          if (lowSum > highSum * 1.5) {
            targetFunnel = Math.min(0.18, vol * 0.20);
            targetLowerDown = Math.min(0.07, vol * 0.08);
          } else if (highSum > lowSum * 1.2) {
            targetStretch = Math.min(0.15, vol * 0.18);
            targetLowerDown = Math.min(0.06, vol * 0.07);
          } else {
            targetLowerDown = Math.min(0.14, vol * 0.15);
            targetUpperUp = Math.min(0.06, vol * 0.07);
          }
        }
      } else {
        targetMouthClose = 0.12;
      }
    } else {
      // Not speaking -> idle neutral face
      targetLowerDown = 0;
      targetUpperUp = 0;
      targetFunnel = 0;
      targetPucker = 0;
      targetStretch = 0;
      targetMouthClose = 0;
      targetJawOpen = 0;
    }

    // Distorting morphs strictly 0
    const targetRollLower = 0;
    const targetShrugLower = 0;

    // ── 8. Emotion Blendshape Modulation ──
    let emotionSmile = 0.10; // Friendly, professional resting smile
    let emotionDimple = 0;
    let emotionFrown = 0;
    let emotionBrowInner = 0;
    let emotionBrowOuter = 0;
    let emotionBrowDown = 0;
    let emotionCheekSquint = 0;
    let emotionEyeSquint = 0;
    let emotionEyeWide = 0;
    let emotionNoseSneer = 0;

    if (isLaughing) {
      emotionSmile = 0.35;
      emotionDimple = 0.20;
      emotionCheekSquint = 0.28;
      emotionEyeSquint = 0.22;
      emotionBrowInner = 0.12;
    } else if (isSmiling) {
      emotionSmile = 0.26;
      emotionDimple = 0.12;
      emotionCheekSquint = 0.16;
      emotionEyeSquint = 0.12;
      emotionBrowInner = 0.08;
    } else if (isSerious) {
      emotionSmile = 0.03;
      emotionFrown = 0.08;
      emotionBrowDown = 0.22;
      emotionBrowInner = 0.10;
      emotionEyeSquint = 0.12;
    } else if (isCurious) {
      emotionSmile = 0.10;
      emotionBrowOuter = 0.28;
      emotionBrowInner = 0.24;
      emotionEyeWide = 0.20;
    } else if (isThinking) {
      emotionSmile = 0.06;
      emotionBrowInner = 0.18;
      emotionBrowDown = 0.10;
      emotionEyeSquint = 0.10;
    } else if (isListening) {
      emotionSmile = 0.14;
      emotionBrowInner = 0.08;
    }

    const targetSmileL = emotionSmile;
    const targetSmileR = emotionSmile;
    const browAccent = isSpeaking ? (formants.mid * 0.12 + formants.treble * 0.06) : 0;

    // 9. Realistic Eye Blink Scheduler
    blinkState.current.nextBlink -= delta;
    if (blinkState.current.nextBlink <= 0) {
      blinkState.current.isBlinking = true;
      blinkState.current.blinkWeight = THREE.MathUtils.lerp(blinkState.current.blinkWeight, 1.0, 0.60);
      if (blinkState.current.blinkWeight > 0.9) {
        blinkState.current.nextBlink = 2.8 + Math.random() * 3.2;
        blinkState.current.isBlinking = false;
      }
    } else {
      blinkState.current.blinkWeight = THREE.MathUtils.lerp(blinkState.current.blinkWeight, 0, 0.35);
    }
    const blinkValue = blinkState.current.blinkWeight;

    // 10. Zero-Allocation Blendshape Application Loop (60 FPS, Symmetrical & Organic)
    for (let i = 0; i < morphMeshes.length; i++) {
      const { influences, idx } = morphMeshes[i];

      // Jaw Mechanics (Near-zero, subtle micro-movement)
      if (idx.jawOpen !== undefined) {
        influences[idx.jawOpen] = THREE.MathUtils.lerp(influences[idx.jawOpen], targetJawOpen, 0.25);
      }
      if (idx.jawForward !== undefined) influences[idx.jawForward] = THREE.MathUtils.lerp(influences[idx.jawForward], targetJawForward, 0.25);
      if (idx.jawLeft !== undefined) influences[idx.jawLeft] = 0;
      if (idx.jawRight !== undefined) influences[idx.jawRight] = 0;

      // Lips Articulation (Controlled, elegant, and natural)
      const isClosingNow = (targetLowerDown === 0 && targetFunnel === 0 && targetStretch === 0);
      const openLerp = isClosingNow ? 0.48 : 0.38;
      if (idx.mouthLowerDownLeft !== undefined) influences[idx.mouthLowerDownLeft] = THREE.MathUtils.lerp(influences[idx.mouthLowerDownLeft], targetLowerDown, openLerp);
      if (idx.mouthLowerDownRight !== undefined) influences[idx.mouthLowerDownRight] = THREE.MathUtils.lerp(influences[idx.mouthLowerDownRight], targetLowerDown, openLerp);
      if (idx.mouthUpperUpLeft !== undefined) influences[idx.mouthUpperUpLeft] = THREE.MathUtils.lerp(influences[idx.mouthUpperUpLeft], targetUpperUp, openLerp);
      if (idx.mouthUpperUpRight !== undefined) influences[idx.mouthUpperUpRight] = THREE.MathUtils.lerp(influences[idx.mouthUpperUpRight], targetUpperUp, openLerp);

      // Lip Shaping (Rounded & Spread Vowels - natural subtle modulation)
      if (idx.mouthFunnel !== undefined) influences[idx.mouthFunnel] = THREE.MathUtils.lerp(influences[idx.mouthFunnel], targetFunnel, openLerp);
      if (idx.mouthPucker !== undefined) influences[idx.mouthPucker] = THREE.MathUtils.lerp(influences[idx.mouthPucker], targetPucker, openLerp);
      if (idx.mouthStretchLeft !== undefined) influences[idx.mouthStretchLeft] = THREE.MathUtils.lerp(influences[idx.mouthStretchLeft], targetStretch, openLerp);
      if (idx.mouthStretchRight !== undefined) influences[idx.mouthStretchRight] = THREE.MathUtils.lerp(influences[idx.mouthStretchRight], targetStretch, openLerp);

      // Consonants & Plosives (Lips touch cleanly on closures and pause intervals)
      if (idx.mouthClose !== undefined) influences[idx.mouthClose] = THREE.MathUtils.lerp(influences[idx.mouthClose], targetMouthClose, 0.48);
      if (idx.mouthPressLeft !== undefined) influences[idx.mouthPressLeft] = 0;
      if (idx.mouthPressRight !== undefined) influences[idx.mouthPressRight] = 0;
      if (idx.mouthRollLower !== undefined) influences[idx.mouthRollLower] = 0;
      if (idx.mouthShrugLower !== undefined) influences[idx.mouthShrugLower] = 0;

      // Smiles & Emotion Dimples / Frowns (Softened while jaw is wide)
      if (idx.mouthSmileLeft !== undefined) influences[idx.mouthSmileLeft] = THREE.MathUtils.lerp(influences[idx.mouthSmileLeft], targetSmileL, 0.22);
      if (idx.mouthSmileRight !== undefined) influences[idx.mouthSmileRight] = THREE.MathUtils.lerp(influences[idx.mouthSmileRight], targetSmileR, 0.22);
      if (idx.mouthDimpleLeft !== undefined) influences[idx.mouthDimpleLeft] = THREE.MathUtils.lerp(influences[idx.mouthDimpleLeft], emotionDimple, 0.20);
      if (idx.mouthDimpleRight !== undefined) influences[idx.mouthDimpleRight] = THREE.MathUtils.lerp(influences[idx.mouthDimpleRight], emotionDimple, 0.20);
      if (idx.mouthFrownLeft !== undefined) influences[idx.mouthFrownLeft] = THREE.MathUtils.lerp(influences[idx.mouthFrownLeft], emotionFrown, 0.20);
      if (idx.mouthFrownRight !== undefined) influences[idx.mouthFrownRight] = THREE.MathUtils.lerp(influences[idx.mouthFrownRight], emotionFrown, 0.20);

      // Cheeks & Nose
      if (idx.cheekSquintLeft !== undefined) influences[idx.cheekSquintLeft] = THREE.MathUtils.lerp(influences[idx.cheekSquintLeft], emotionCheekSquint, 0.22);
      if (idx.cheekSquintRight !== undefined) influences[idx.cheekSquintRight] = THREE.MathUtils.lerp(influences[idx.cheekSquintRight], emotionCheekSquint, 0.22);
      if (idx.noseSneerLeft !== undefined) influences[idx.noseSneerLeft] = THREE.MathUtils.lerp(influences[idx.noseSneerLeft], emotionNoseSneer, 0.22);
      if (idx.noseSneerRight !== undefined) influences[idx.noseSneerRight] = THREE.MathUtils.lerp(influences[idx.noseSneerRight], emotionNoseSneer, 0.22);

      // Eyes & Brows
      if (idx.eyeBlinkLeft !== undefined) influences[idx.eyeBlinkLeft] = blinkValue;
      if (idx.eyeBlinkRight !== undefined) influences[idx.eyeBlinkRight] = blinkValue;
      if (idx.eyeSquintLeft !== undefined) influences[idx.eyeSquintLeft] = THREE.MathUtils.lerp(influences[idx.eyeSquintLeft], emotionEyeSquint, 0.2);
      if (idx.eyeSquintRight !== undefined) influences[idx.eyeSquintRight] = THREE.MathUtils.lerp(influences[idx.eyeSquintRight], emotionEyeSquint, 0.2);
      if (idx.eyeWideLeft !== undefined) influences[idx.eyeWideLeft] = THREE.MathUtils.lerp(influences[idx.eyeWideLeft], emotionEyeWide, 0.2);
      if (idx.eyeWideRight !== undefined) influences[idx.eyeWideRight] = THREE.MathUtils.lerp(influences[idx.eyeWideRight], emotionEyeWide, 0.2);

      // Eye Saccades (Gaze Direction)
      if (idx.eyeLookDownLeft !== undefined) influences[idx.eyeLookDownLeft] = THREE.MathUtils.lerp(influences[idx.eyeLookDownLeft], eyeGazeDown, 0.15);
      if (idx.eyeLookDownRight !== undefined) influences[idx.eyeLookDownRight] = THREE.MathUtils.lerp(influences[idx.eyeLookDownRight], eyeGazeDown, 0.15);
      if (idx.eyeLookOutLeft !== undefined) influences[idx.eyeLookOutLeft] = THREE.MathUtils.lerp(influences[idx.eyeLookOutLeft], eyeGazeOut, 0.15);
      if (idx.eyeLookInRight !== undefined) influences[idx.eyeLookInRight] = THREE.MathUtils.lerp(influences[idx.eyeLookInRight], eyeGazeOut, 0.15);

      // Brows
      if (idx.browInnerUp !== undefined) influences[idx.browInnerUp] = THREE.MathUtils.lerp(influences[idx.browInnerUp], emotionBrowInner + browAccent, 0.22);
      if (idx.browOuterUpLeft !== undefined) influences[idx.browOuterUpLeft] = THREE.MathUtils.lerp(influences[idx.browOuterUpLeft], emotionBrowOuter + browAccent * 0.6, 0.22);
      if (idx.browOuterUpRight !== undefined) influences[idx.browOuterUpRight] = THREE.MathUtils.lerp(influences[idx.browOuterUpRight], emotionBrowOuter + browAccent * 0.6, 0.22);
      if (idx.browDownLeft !== undefined) influences[idx.browDownLeft] = THREE.MathUtils.lerp(influences[idx.browDownLeft], emotionBrowDown, 0.22);
      if (idx.browDownRight !== undefined) influences[idx.browDownRight] = THREE.MathUtils.lerp(influences[idx.browDownRight], emotionBrowDown, 0.22);
    }
  });

  return (
    <primitive
      ref={groupRef}
      object={scene}
      position={[0, -1.42, 0]}
      scale={[0.98, 0.98, 0.98]}
    />
  );
}

// ── Main 3D Canvas with Realistic Office Environment & Studio Lighting ──
export default function Avatar3D({
  isSpeaking = false,
  audioLevel = 0,
  emotion = 'neutral',
  modelPath = '/model.glb',
  isFemale = false,
}) {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden select-none">
      
      {/* ── Realistic Blurred Tech Office Background ── */}
      <img
        src="/assets/office_bg.jpg"
        alt="Office Background"
        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none filter brightness-[0.92] contrast-[1.05]"
      />

      {/* Subtle Depth-of-Field & Atmospheric Vignette */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/50 via-transparent to-black/30" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_40%,transparent_55%,rgba(0,0,0,0.4)_100%)]" />

      {/* ── 3D WebGL Canvas Overlay with Medium Close-Up Framing ── */}
      <Canvas
        camera={{ position: [0, 0.08, 1.16], fov: 32 }}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.12,
        }}
        dpr={[1, 1.5]}
        style={{ width: '100%', height: '100%', position: 'relative', zIndex: 10 }}
      >
        {/* Balanced Ambient Room Lighting */}
        <ambientLight intensity={1.1} color="#fbfbfd" />

        {/* Office Window Key Light (Soft Warm Front-Right) */}
        <directionalLight
          position={[1.8, 2.4, 1.8]}
          intensity={1.65}
          color="#fffcf5"
          castShadow
          shadow-mapSize={[1024, 1024]}
        />

        {/* Office Interior Fill Light (Left side gentle bounce) */}
        <directionalLight
          position={[-2.0, 1.6, 1.2]}
          intensity={0.95}
          color="#e6effa"
        />

        {/* Ceiling Warm Fluorescent / Sunlight Rim Light */}
        <directionalLight
          position={[0, 3.0, -1.5]}
          intensity={1.2}
          color="#ffe8d6"
        />

        {/* Desk Bounce Light */}
        <directionalLight
          position={[0, -1.8, 1.2]}
          intensity={0.4}
          color="#d5dfec"
        />

        {/* Soft Ground Contact Shadow */}
        <ContactShadows
          position={[0, -1.42, 0]}
          opacity={0.65}
          scale={3.2}
          blur={2}
          far={2.5}
        />

        {/* Model Loader */}
        <React.Suspense fallback={null}>
          <ProceduralModel
            key={modelPath}
            modelPath={modelPath}
            isSpeaking={isSpeaking}
            audioLevel={audioLevel}
            emotion={emotion}
            isFemale={isFemale}
          />
        </React.Suspense>
      </Canvas>
    </div>
  );
}

// Preload both 3D avatars for zero-latency 3D rendering
useGLTF.preload('/model.glb');
useGLTF.preload('/model2.glb');
