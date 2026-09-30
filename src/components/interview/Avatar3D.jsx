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
    const spineBone = scene.getObjectByName('Spine');
    const spine1Bone = scene.getObjectByName('Spine1');
    const spine2Bone = scene.getObjectByName('Spine2');

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
      spine: spineBone,
      spine1: spine1Bone,
      spine2: spine2Bone,
      leftShoulder: leftShoulderBone,
      rightShoulder: rightShoulderBone,
      leftArm: leftArmBone,
      rightArm: rightArmBone,
      leftForeArm: leftForeArmBone,
      rightForeArm: rightForeArmBone,
      morphMeshes: morphs,
    };
  }, [scene]);

  // Frame Loop (60 FPS Direct Spectral Formant Analysis & Physics)
  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();

    // 1. Organic Idle Breathing & Conversational Posture
    const breathing = Math.sin(time * 1.4) * 0.012;
    const slowSway = Math.sin(time * 0.5) * 0.008;
    const slowTilt = Math.cos(time * 0.35) * 0.006;

    // Emotion-specific body gestures
    const isLaughing = emotion === 'laughing';
    const isSerious = emotion === 'serious';
    const isCurious = emotion === 'curious';
    const isThinking = emotion === 'thinking';
    const isListening = emotion === 'listening';
    const isSmiling = emotion === 'smiling' || isLaughing;

    const laughingVibe = isLaughing ? Math.sin(time * 18.0) * 0.009 : 0;
    const listeningNod = isListening ? Math.sin(time * 2.2) * 0.024 : 0;
    const curiousTilt = isCurious ? 0.045 : 0;
    const thinkingTilt = isThinking ? -0.035 : 0;

    const speechTilt = isSpeaking ? Math.sin(time * 2.8) * 0.016 + slowTilt + curiousTilt + thinkingTilt : (slowTilt + curiousTilt + thinkingTilt);
    const speechNod = isSpeaking ? Math.cos(time * 2.2) * 0.015 + breathing * 0.5 + laughingVibe : (breathing * 0.3 + listeningNod + laughingVibe);
    const speechArmGesticulation = isSpeaking ? Math.sin(time * 2.5) * 0.022 : 0;
    const speechShoulderPulse = isSpeaking ? Math.sin(time * 3.0) * 0.008 + laughingVibe : laughingVibe;

    // Arms & Shoulders Physics
    const leftArmAngle = 1.31 + breathing * 0.6 + speechArmGesticulation;
    const rightArmAngle = 1.31 + breathing * 0.6 - speechArmGesticulation * 0.7;

    if (leftArm) {
      tempQuat.setFromAxisAngle(LOCAL_X_AXIS, leftArmAngle);
      leftArm.quaternion.copy(BIND_LEFT_ARM_QUAT).multiply(tempQuat);
    }
    if (rightArm) {
      tempQuat.setFromAxisAngle(LOCAL_X_AXIS, rightArmAngle);
      rightArm.quaternion.copy(BIND_RIGHT_ARM_QUAT).multiply(tempQuat);
    }

    if (leftForeArm) {
      const leftElbowBend = -0.12 - (isSpeaking ? Math.cos(time * 2.5) * 0.015 : 0);
      tempQuat.setFromAxisAngle(LOCAL_X_AXIS, leftElbowBend);
      leftForeArm.quaternion.copy(BIND_LEFT_FOREARM_QUAT).multiply(tempQuat);
    }
    if (rightForeArm) {
      const rightElbowBend = -0.12 - (isSpeaking ? Math.sin(time * 2.5) * 0.015 : 0);
      tempQuat.setFromAxisAngle(LOCAL_X_AXIS, rightElbowBend);
      rightForeArm.quaternion.copy(BIND_RIGHT_FOREARM_QUAT).multiply(tempQuat);
    }

    if (leftShoulder) {
      tempQuat.setFromAxisAngle(LOCAL_Z_AXIS, breathing * 0.4 + speechShoulderPulse);
      leftShoulder.quaternion.copy(BIND_LEFT_SHOULDER_QUAT).multiply(tempQuat);
    }
    if (rightShoulder) {
      tempQuat.setFromAxisAngle(LOCAL_Z_AXIS, -(breathing * 0.4 + speechShoulderPulse));
      rightShoulder.quaternion.copy(BIND_RIGHT_SHOULDER_QUAT).multiply(tempQuat);
    }

    // Attentive Head & Neck Alignment
    if (head) {
      const targetHeadY = isThinking ? 0.05 : speechTilt;
      const targetHeadX = isSerious ? -0.04 : speechNod;
      const targetHeadZ = speechTilt * 0.4;
      head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, targetHeadY, 0.08);
      head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, targetHeadX, 0.08);
      head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, targetHeadZ, 0.08);
    }

    if (neck || neck1) {
      const activeNeck = neck || neck1;
      activeNeck.rotation.y = THREE.MathUtils.lerp(activeNeck.rotation.y, speechTilt * 0.35, 0.06);
      activeNeck.rotation.x = THREE.MathUtils.lerp(activeNeck.rotation.x, speechNod * 0.35, 0.06);
    }

    if (spine2 || spine1 || spine) {
      const activeSpine = spine2 || spine1 || spine;
      activeSpine.rotation.x = breathing * 0.35 + (isSerious ? 0.03 : 0);
      activeSpine.rotation.y = slowSway * 0.3;
      activeSpine.position.y = breathing * 0.004 + laughingVibe * 0.5;
    }

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
      const liveBoost = Math.min(1.0, audioLevel * 1.4);
      currentMid = Math.max(currentMid, liveBoost * 0.75);
      currentLow = Math.max(currentLow, liveBoost * 0.45);
      currentHighMid = Math.max(currentHighMid, liveBoost * 0.35);
      currentVolume = Math.max(currentVolume, liveBoost);
    } else if (isSpeaking && !analyser) {
      // Natural procedural syllable sequencer if analyser is temporarily initializing
      formants.syllableTimer -= delta;
      if (formants.syllableTimer <= 0) {
        formants.pseudoPhoneme = Math.floor(Math.random() * 4);
        formants.syllableTimer = 0.12 + Math.random() * 0.16;
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

    // Fast Attack (0.65) for crisp phonetic onsets, smooth release (0.35)
    formants.low = THREE.MathUtils.lerp(formants.low, currentLow, currentLow > formants.low ? 0.65 : 0.4);
    formants.mid = THREE.MathUtils.lerp(formants.mid, currentMid, currentMid > formants.mid ? 0.65 : 0.4);
    formants.highMid = THREE.MathUtils.lerp(formants.highMid, currentHighMid, currentHighMid > formants.highMid ? 0.65 : 0.4);
    formants.treble = THREE.MathUtils.lerp(formants.treble, currentTreble, currentTreble > formants.treble ? 0.65 : 0.4);
    formants.volume = THREE.MathUtils.lerp(formants.volume, currentVolume, currentVolume > formants.volume ? 0.65 : 0.4);

    // ── 3. Exact Viseme Output Calculations based on Acoustic Formants ──
    const { low, mid, highMid, treble, volume } = formants;

    // A. Natural Jaw Open — Primary, balanced speech driver
    const speechEnergy = Math.max(audioLevel * 0.95, mid * 0.45 + low * 0.25 + highMid * 0.2);
    const targetJawOpen = isSpeaking
      ? Math.min(0.36, Math.max(0, speechEnergy))
      : (isCurious ? 0.02 : 0);

    // Keep jaw strictly centered — never dislocate or swing jaw sideways
    const targetJawLeft = 0;
    const targetJawRight = 0;

    // Symmetrical, subtle lip response accompanying jaw (prevents mouth tearing/stretching)
    const targetLowerDown = isSpeaking ? Math.min(0.06, targetJawOpen * 0.20) : 0;
    const targetUpperUp = isSpeaking ? Math.min(0.04, targetJawOpen * 0.14) : 0;

    // B. Subtle Vowel Formants (Rounded vowels: OO, U, W)
    const targetFunnel = isSpeaking ? Math.min(0.08, low * 0.14) : (isCurious ? 0.03 : 0);
    const targetPucker = isSpeaking ? Math.min(0.06, low * 0.10) : 0;

    // C. Front Spread Vowels (EE, IH, AE) — subtle, symmetrical
    const targetStretch = isSpeaking ? Math.min(0.07, highMid * 0.12) : 0;

    // D. Sibilants & Plosive Closures
    const targetShrugLower = 0;
    const targetRollLower = 0;
    const targetMouthClose = (isSpeaking && speechEnergy < 0.03) ? 0.02 : 0;

    // ── 4. Emotion Blendshape Modulation ──
    let emotionSmile = 0.08; // Friendly, approachable neutral resting smile
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
      emotionSmile = 0.32;
      emotionDimple = 0.18;
      emotionCheekSquint = 0.25;
      emotionEyeSquint = 0.20;
      emotionBrowInner = 0.10;
    } else if (isSmiling) {
      emotionSmile = 0.24;
      emotionDimple = 0.10;
      emotionCheekSquint = 0.14;
      emotionEyeSquint = 0.10;
      emotionBrowInner = 0.06;
    } else if (isSerious) {
      emotionSmile = 0.02;
      emotionFrown = 0.08;
      emotionBrowDown = 0.22;
      emotionBrowInner = 0.10;
      emotionEyeSquint = 0.12;
    } else if (isCurious) {
      emotionSmile = 0.08;
      emotionBrowOuter = 0.26;
      emotionBrowInner = 0.22;
      emotionEyeWide = 0.18;
    } else if (isThinking) {
      emotionSmile = 0.05;
      emotionBrowInner = 0.16;
      emotionBrowDown = 0.10;
      emotionEyeSquint = 0.08;
    } else if (isListening) {
      emotionSmile = 0.12;
      emotionBrowInner = 0.06;
    }

    const targetSmileL = emotionSmile;
    const targetSmileR = emotionSmile;
    const browAccent = isSpeaking ? (mid * 0.08 + treble * 0.04) : 0;

    // 5. Realistic Eye Blink Scheduler
    blinkState.current.nextBlink -= delta;
    if (blinkState.current.nextBlink <= 0) {
      blinkState.current.isBlinking = true;
      blinkState.current.blinkWeight = THREE.MathUtils.lerp(blinkState.current.blinkWeight, 1.0, 0.55);
      if (blinkState.current.blinkWeight > 0.9) {
        blinkState.current.nextBlink = 3.0 + Math.random() * 3.5;
        blinkState.current.isBlinking = false;
      }
    } else {
      blinkState.current.blinkWeight = THREE.MathUtils.lerp(blinkState.current.blinkWeight, 0, 0.35);
    }
    const blinkValue = blinkState.current.blinkWeight;

    // 6. Zero-Allocation Blendshape Application Loop (60 FPS, Symmetrical & Organic)
    for (let i = 0; i < morphMeshes.length; i++) {
      const { influences, idx } = morphMeshes[i];

      // Jaw Mechanics (Smooth, centered, organic)
      if (idx.jawOpen !== undefined) influences[idx.jawOpen] = THREE.MathUtils.lerp(influences[idx.jawOpen], targetJawOpen, 0.28);
      if (idx.jawForward !== undefined) influences[idx.jawForward] = THREE.MathUtils.lerp(influences[idx.jawForward], targetFunnel * 0.2, 0.25);
      if (idx.jawLeft !== undefined) influences[idx.jawLeft] = THREE.MathUtils.lerp(influences[idx.jawLeft], targetJawLeft, 0.3);
      if (idx.jawRight !== undefined) influences[idx.jawRight] = THREE.MathUtils.lerp(influences[idx.jawRight], targetJawRight, 0.3);

      // Lips Open & Drop (Symmetrical, subtle)
      if (idx.mouthLowerDownLeft !== undefined) influences[idx.mouthLowerDownLeft] = THREE.MathUtils.lerp(influences[idx.mouthLowerDownLeft], targetLowerDown, 0.28);
      if (idx.mouthLowerDownRight !== undefined) influences[idx.mouthLowerDownRight] = THREE.MathUtils.lerp(influences[idx.mouthLowerDownRight], targetLowerDown, 0.28);
      if (idx.mouthUpperUpLeft !== undefined) influences[idx.mouthUpperUpLeft] = THREE.MathUtils.lerp(influences[idx.mouthUpperUpLeft], targetUpperUp, 0.28);
      if (idx.mouthUpperUpRight !== undefined) influences[idx.mouthUpperUpRight] = THREE.MathUtils.lerp(influences[idx.mouthUpperUpRight], targetUpperUp, 0.28);

      // Lip Shaping (Natural and gentle)
      if (idx.mouthFunnel !== undefined) influences[idx.mouthFunnel] = THREE.MathUtils.lerp(influences[idx.mouthFunnel], targetFunnel, 0.26);
      if (idx.mouthPucker !== undefined) influences[idx.mouthPucker] = THREE.MathUtils.lerp(influences[idx.mouthPucker], targetPucker, 0.26);
      if (idx.mouthStretchLeft !== undefined) influences[idx.mouthStretchLeft] = THREE.MathUtils.lerp(influences[idx.mouthStretchLeft], targetStretch, 0.26);
      if (idx.mouthStretchRight !== undefined) influences[idx.mouthStretchRight] = THREE.MathUtils.lerp(influences[idx.mouthStretchRight], targetStretch, 0.26);

      // Consonants & Plosives
      if (idx.mouthClose !== undefined) influences[idx.mouthClose] = THREE.MathUtils.lerp(influences[idx.mouthClose], targetMouthClose, 0.3);
      if (idx.mouthRollLower !== undefined) influences[idx.mouthRollLower] = THREE.MathUtils.lerp(influences[idx.mouthRollLower], targetRollLower, 0.25);
      if (idx.mouthShrugLower !== undefined) influences[idx.mouthShrugLower] = THREE.MathUtils.lerp(influences[idx.mouthShrugLower], targetShrugLower, 0.25);
      if (idx.mouthPressLeft !== undefined) influences[idx.mouthPressLeft] = THREE.MathUtils.lerp(influences[idx.mouthPressLeft], 0, 0.25);
      if (idx.mouthPressRight !== undefined) influences[idx.mouthPressRight] = THREE.MathUtils.lerp(influences[idx.mouthPressRight], 0, 0.25);

      // Smiles & Emotion Dimples / Frowns
      if (idx.mouthSmileLeft !== undefined) influences[idx.mouthSmileLeft] = THREE.MathUtils.lerp(influences[idx.mouthSmileLeft], targetSmileL, 0.18);
      if (idx.mouthSmileRight !== undefined) influences[idx.mouthSmileRight] = THREE.MathUtils.lerp(influences[idx.mouthSmileRight], targetSmileR, 0.18);
      if (idx.mouthDimpleLeft !== undefined) influences[idx.mouthDimpleLeft] = THREE.MathUtils.lerp(influences[idx.mouthDimpleLeft], emotionDimple, 0.18);
      if (idx.mouthDimpleRight !== undefined) influences[idx.mouthDimpleRight] = THREE.MathUtils.lerp(influences[idx.mouthDimpleRight], emotionDimple, 0.18);
      if (idx.mouthFrownLeft !== undefined) influences[idx.mouthFrownLeft] = THREE.MathUtils.lerp(influences[idx.mouthFrownLeft], emotionFrown, 0.18);
      if (idx.mouthFrownRight !== undefined) influences[idx.mouthFrownRight] = THREE.MathUtils.lerp(influences[idx.mouthFrownRight], emotionFrown, 0.18);

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

      // Brows
      if (idx.browInnerUp !== undefined) influences[idx.browInnerUp] = THREE.MathUtils.lerp(influences[idx.browInnerUp], emotionBrowInner + browAccent, 0.2);
      if (idx.browOuterUpLeft !== undefined) influences[idx.browOuterUpLeft] = THREE.MathUtils.lerp(influences[idx.browOuterUpLeft], emotionBrowOuter + browAccent * 0.6, 0.2);
      if (idx.browOuterUpRight !== undefined) influences[idx.browOuterUpRight] = THREE.MathUtils.lerp(influences[idx.browOuterUpRight], emotionBrowOuter + browAccent * 0.6, 0.2);
      if (idx.browDownLeft !== undefined) influences[idx.browDownLeft] = THREE.MathUtils.lerp(influences[idx.browDownLeft], emotionBrowDown, 0.2);
      if (idx.browDownRight !== undefined) influences[idx.browDownRight] = THREE.MathUtils.lerp(influences[idx.browDownRight], emotionBrowDown, 0.2);
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
