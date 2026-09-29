import React, { Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUserTie, faVenus, faMars } from '@fortawesome/free-solid-svg-icons';
import Avatar3D from './Avatar3D';

/**
 * AvatarPlayer — Pure 3D Multi-Persona AI Interviewer Screen
 * 
 * Supports:
 * 1. Male Avatar: 'ahmed' -> /model.glb (Senior Tech Lead, Voice: Puck)
 * 2. Female Avatar: 'sara' -> /model2.glb (Engineering Manager, Voice: Aoede)
 * 3. Smooth active speaker framing, live equalizer bars, and studio lighting
 */
export default function AvatarPlayer({
  isSpeaking = false,
  isThinking = false,
  audioLevel = 0,
  emotion = 'neutral',
  selectedAvatar = 'ahmed', // 'ahmed' | 'sara'
  onSwitchAvatar,
}) {
  const isFemale = selectedAvatar === 'sara';
  const interviewerName = isFemale ? 'سارة (مديرة التوظيف)' : 'أحمد (مدير التوظيف)';
  const modelPath = isFemale ? '/model2.glb' : '/model.glb';

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-[var(--bg-base)] overflow-hidden select-none">
      
      {/* ── Strict 16:9 Aspect Video Container ── */}
      <div className="relative w-full h-full max-w-[calc(100vh*1.777)] max-h-[calc(100vw/1.777)] aspect-[1376/768] flex items-center justify-center overflow-hidden">
        
        {/* ── 3D Procedural Avatar ── */}
        <Suspense
          fallback={
            <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--bg-surface)] text-[var(--text-secondary)] gap-3">
              <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 28 }} className="text-[var(--c-coral)]" />
              <span className="text-sm font-medium">جاري تحميل مجسم المحاور 3D...</span>
            </div>
          }
        >
          <Avatar3D
            key={selectedAvatar}
            modelPath={modelPath}
            isFemale={isFemale}
            isSpeaking={isSpeaking}
            audioLevel={audioLevel}
            emotion={emotion}
          />
        </Suspense>

        {/* ── Active Speaker Glowing Frame (Platform Coral Accent) ── */}
        <div
          className={`absolute inset-0 pointer-events-none transition-all duration-300 z-20 ${
            isSpeaking
              ? 'border-2 border-[var(--c-coral)] shadow-[inset_0_0_20px_rgba(232,130,90,0.28)]'
              : 'border border-transparent'
          }`}
        />
      </div>
    </div>
  );
}
