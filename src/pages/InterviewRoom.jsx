import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMicrophone,
  faMicrophoneSlash,
  faVideo,
  faVideoSlash,
  faComments,
  faClosedCaptioning,
  faPhoneSlash,
  faPaperPlane,
  faSpinner,
  faShieldHalved,
  faUsers,
  faHandPaper,
  faCheck,
  faXmark,
  faLock,
  faTableCellsLarge,
  faCircleCheck,
} from '@fortawesome/free-solid-svg-icons';
import { supabase } from '../lib/supabaseClient';
import { generateReport, startLiveInterview, liveInterviewChat, generatePersonalizedOpening, formatCvContext } from '../lib/llm';
import {
  speak,
  stopSpeaking,
  startListening,
  stopListening,
  subscribeAudioLevel,
  startUserMicLevel,
  stopUserMicLevel,
  resumeMicAudioContext,
} from '../lib/speech';
import { useInterviewStore } from '../store/interviewStore';
import AvatarPlayer from '../components/interview/AvatarPlayer';
import toast from 'react-hot-toast';
import logoImg from '../assets/logo.png';

// ── Emotion Analyzer ────────────────────────────────────────────────────────
function analyzeEmotion(text) {
  if (!text) return 'neutral';
  const t = text.toLowerCase();
  if (t.includes('هههه') || t.includes('haha') || t.includes('lol')) return 'laughing';
  if (
    t.includes('ممتاز') ||
    t.includes('رائع') ||
    t.includes('عاش') ||
    t.includes('جميل') ||
    t.includes('أهلاً') ||
    t.includes('welcome') ||
    t.includes('great')
  )
    return 'smiling';
  if (
    t.includes('مشكلة') ||
    t.includes('تحدي') ||
    t.includes('صعب') ||
    t.includes('خطأ') ||
    t.includes('problem')
  )
    return 'serious';
  if (t.includes('هل') || t.includes('إزاي') || t.includes('ليه') || t.includes('لماذا') || t.includes('?'))
    return 'curious';
  return 'neutral';
}

function formatTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ── Zoom-Style Audio Equalizer Bars ──────────────────────────────────────────
function ZoomAudioMeter({ level = 0, active = false, color = '#22c55e', bars = 4 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 16 }}>
      {Array.from({ length: bars }).map((_, i) => {
        const factor = active ? Math.max(0.2, Math.min(1, level * 1.8 + Math.sin(i * 1.5) * 0.2)) : 0.15;
        const h = Math.max(3, Math.min(14, factor * 14));
        return (
          <motion.div
            key={i}
            animate={{ height: active ? [h * 0.6, h, h * 0.8] : 3 }}
            transition={{ duration: 0.3, repeat: active ? Infinity : 0, delay: i * 0.08 }}
            style={{
              width: 2.5,
              borderRadius: 1.5,
              background: active ? color : 'rgba(255,255,255,0.25)',
            }}
          />
        );
      })}
    </div>
  );
}

// ── Zoom Toolbar Icon Button ────────────────────────────────────────────────
function ZoomButton({
  icon,
  label,
  active = false,
  danger = false,
  badgeCount = 0,
  onClick,
  disabled = false,
  className = '',
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className={`zoom-toolbar-btn ${className}`.trim()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.2rem',
        padding: '0.35rem 0.6rem',
        borderRadius: 8,
        border: danger && active ? '1px solid rgba(239,68,68,0.35)' : '1px solid transparent',
        background: danger && active ? 'rgba(239,68,68,0.12)' : active ? 'rgba(232,130,90,0.14)' : hov ? 'var(--bg-subtle)' : 'transparent',
        color: danger ? '#ef4444' : active ? 'var(--c-coral)' : 'var(--text-secondary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
        position: 'relative',
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <FontAwesomeIcon icon={icon} style={{ fontSize: '1.15rem', color: danger ? '#ef4444' : active ? 'var(--c-coral)' : 'var(--text-secondary)' }} />
      <span className="zoom-btn-label" style={{ fontSize: '0.65rem', fontWeight: 600, color: danger ? '#ef4444' : active ? 'var(--c-coral)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</span>
      {badgeCount > 0 && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            right: 6,
            minWidth: 15,
            height: 15,
            padding: '0 3px',
            borderRadius: 8,
            background: 'var(--c-coral)',
            color: '#fff',
            fontSize: '0.58rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {badgeCount}
        </span>
      )}
    </button>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function InterviewRoom({ user }) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const isRtl = i18n.language === 'ar';

  const { interviewId, conversationHistory, isSpeaking, setIsSpeaking, addMessage, initSession } =
    useInterviewStore();

  const [selectedAvatar] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get('interviewer') || localStorage.getItem('prova_selected_avatar') || 'ahmed';
  });

  const isSara = selectedAvatar === 'sara';
  const MAX_SECS = 300; // 5 minutes
  const candidateName =
    user?.user_metadata?.full_name?.split(' ')[0] || (isRtl ? 'المتقدم' : 'Candidate');

  // Phases
  const [phase, setPhase] = useState('loading');
  const [dailyLimit, setDailyLimit] = useState(false);

  // States
  const [turnState, setTurnState] = useState('listening');
  const [aiAudioLevel, setAiAudioLevel] = useState(0);
  const [userAudioLevel, setUserAudioLevel] = useState(0);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);

  // UI
  const [elapsed, setElapsed] = useState(0);
  const [subtitle, setSubtitle] = useState('');
  const [spokenText, setSpokenText] = useState('');
  const [showCC, setShowCC] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [emotion, setEmotion] = useState('neutral');
  const [textInput, setTextInput] = useState('');
  const [autoSendCountdown, setAutoSendCountdown] = useState(0);

  // Refs
  const isSpeakingRef = useRef(false);
  const initDoneRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const chatBottomRef = useRef(null);
  const cvContextRef = useRef('');
  const interviewIdRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const watchdogTimerRef = useRef(null);
  const recoveryTimerRef = useRef(null);
  const isTerminatedRef = useRef(false);
  const micMutedRef = useRef(false);
  const turnStateRef = useRef('listening');
  const spokenTextRef = useRef('');
  const submitUserTurnRef = useRef(null);

  isSpeakingRef.current = isSpeaking;
  micMutedRef.current = micMuted;
  turnStateRef.current = turnState;
  spokenTextRef.current = spokenText;

  const isAiSpeaking = turnState === 'ai_speaking';
  const isUserSpeaking = turnState === 'user_speaking';
  const isThinking = turnState === 'thinking';

  // ── Meeting Duration Timer ────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'ready' || dailyLimit) return;
    const id = setInterval(() => {
      setElapsed((p) => {
        if (p + 1 >= MAX_SECS) {
          clearInterval(id);
          return MAX_SECS;
        }
        return p + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, dailyLimit]);

  useEffect(() => {
    if (elapsed === 240) {
      toast('⏳ ' + (isRtl ? 'متبقي دقيقة واحدة على نهاية المقابلة' : '1 minute remaining'), {
        duration: 5000,
        icon: '⏱️',
      });
    } else if (elapsed >= MAX_SECS) {
      handleFinish();
    }
  }, [elapsed]);

  const detectEmotion = useCallback((text) => {
    const e = analyzeEmotion(text);
    setEmotion(e);
  }, []);

  const persistTurn = async (role, content) => {
    const iid = interviewIdRef.current;
    if (!iid || !content) return;
    try {
      await supabase.from('interview_answers').insert({
        interview_id: iid,
        question_id: null,
        transcription: content,
        duration_seconds: elapsed,
      });
      await supabase.from('interviews').update({ updated_at: new Date().toISOString() }).eq('id', iid);
    } catch (e) {
      console.warn('Persist turn error:', e);
    }
  };

  // ── Candidate Voice Recognition ───────────────────────────────────────────
  const startListeningSession = useCallback(() => {
    if (isTerminatedRef.current || micMutedRef.current || isSpeakingRef.current) return;

    setSpokenText('');
    spokenTextRef.current = '';
    setAutoSendCountdown(0);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    startListening({
      lang: isRtl ? 'ar-EG' : 'en-US',
      continuous: true,
      onTranscriptUpdate: ({ text }) => {
        if (isTerminatedRef.current || isSpeakingRef.current || turnStateRef.current === 'ai_speaking') return;

        const clean = text.trim();
        if (!clean) return;

        setSpokenText(clean);
        spokenTextRef.current = clean;
        setSubtitle(clean);

        // Visual feedback for user speaking
        setUserAudioLevel(0.65);

        const words = clean.split(/\s+/).filter(Boolean);
        if (clean.length >= 2) {
          setTurnState('user_speaking');
          turnStateRef.current = 'user_speaking';
        }

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

        // Generous, natural conversational pause threshold (3.2s for replies, 2.2s for short acknowledgements)
        // Gives candidate ample time to think, pause, and breathe without being interrupted prematurely
        if (clean.length >= 2) {
          const SILENCE_MS = clean.length > 12 ? 3200 : 2200;
          let remaining = SILENCE_MS;
          setAutoSendCountdown(remaining);

          countdownIntervalRef.current = setInterval(() => {
            remaining -= 100;
            setAutoSendCountdown(Math.max(0, remaining));
            if (remaining <= 0) clearInterval(countdownIntervalRef.current);
          }, 100);

          silenceTimerRef.current = setTimeout(() => {
            clearInterval(countdownIntervalRef.current);
            setAutoSendCountdown(0);
            if (
              spokenTextRef.current &&
              spokenTextRef.current.trim().length >= 2 &&
              !isSubmittingRef.current &&
              !isTerminatedRef.current
            ) {
              submitUserTurnRef.current?.(spokenTextRef.current);
            }
          }, SILENCE_MS);
        } else {
          setAutoSendCountdown(0);
        }
      },
      onError: (err) => {
        console.warn('[Speech] Notice:', err);
      },
      onEnd: () => {
        setUserAudioLevel(0);
        if (isTerminatedRef.current) return;
        if (
          !micMutedRef.current &&
          !isSpeakingRef.current &&
          turnStateRef.current !== 'thinking' &&
          turnStateRef.current !== 'ai_speaking'
        ) {
          if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
          recoveryTimerRef.current = setTimeout(() => {
            if (!isTerminatedRef.current && !micMutedRef.current && !isSpeakingRef.current) {
              startListeningSession();
            }
          }, 200);
        }
      },
    });
  }, [isRtl]);

  // ── Tab Focus & Window Restore Recovery ──
  // When candidate minimizes/un-minimizes browser or switches tabs, ensure mic & recognition immediately re-activate
  useEffect(() => {
    const handleVisibilityRecovery = () => {
      if (document.visibilityState !== 'visible') return;
      if (isTerminatedRef.current || micMutedRef.current) return;

      // Resume Web Audio Context if suspended by Chrome
      resumeMicAudioContext?.();

      // If AI is actively speaking, let it finish naturally
      if (isSpeakingRef.current || turnStateRef.current === 'ai_speaking') return;

      // Reset any stuck states
      if (turnStateRef.current === 'thinking' && !isSubmittingRef.current) {
        setTurnState('listening');
        turnStateRef.current = 'listening';
      }

      stopListening();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      setAutoSendCountdown(0);

      // 250ms breather gives Chrome audio thread enough time to re-activate hardware mic
      setTimeout(() => {
        if (
          !isTerminatedRef.current &&
          !micMutedRef.current &&
          !isSpeakingRef.current &&
          turnStateRef.current !== 'ai_speaking'
        ) {
          setTurnState('listening');
          turnStateRef.current = 'listening';
          startListeningSession();
        }
      }, 250);
    };

    document.addEventListener('visibilitychange', handleVisibilityRecovery);
    window.addEventListener('focus', handleVisibilityRecovery);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityRecovery);
      window.removeEventListener('focus', handleVisibilityRecovery);
    };
  }, [startListeningSession]);

  // ── Gemini & Neural Voice Live Conversational Playback ─────────────────────
  const speakAiTurn = useCallback(
    async (text) => {
      stopListening();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

      // Keep in thinking state while audio stream is being generated and loaded
      setTurnState('thinking');
      turnStateRef.current = 'thinking';
      setIsSpeaking(false);
      isSpeakingRef.current = false;

      const voice = isSara ? 'Aoede' : 'Puck';
      let messageRevealed = false;

      const revealAiMessage = () => {
        if (!messageRevealed) {
          messageRevealed = true;
          setTurnState('ai_speaking');
          turnStateRef.current = 'ai_speaking';
          setSubtitle(text);
          detectEmotion(text);
          addMessage('assistant', text);
          persistTurn('assistant', text);
        }
      };

      await speak({
        text,
        lang: isRtl ? 'ar-EG' : 'en-US',
        voice,
        onStart: () => {
          // Perfectly synchronized: audio and text appear simultaneously on sound wave start
          revealAiMessage();
          setIsSpeaking(true);
          isSpeakingRef.current = true;
        },
        onEnd: () => {
          setIsSpeaking(false);
          isSpeakingRef.current = false;
          setEmotion('neutral');
          setTimeout(() => {
            if (!isTerminatedRef.current) {
              setTurnState('listening');
              turnStateRef.current = 'listening';
              setSubtitle(isRtl ? '🎙️ المايك مفتوح — تفضل بالإجابة' : '🎙️ Microphone open — Go ahead');
              if (!micMutedRef.current) {
                startListeningSession();
              }
            }
          }, 250);
        },
        onError: () => {
          revealAiMessage();
          setIsSpeaking(false);
          isSpeakingRef.current = false;
          setEmotion('neutral');
          setTimeout(() => {
            if (!isTerminatedRef.current) {
              setTurnState('listening');
              turnStateRef.current = 'listening';
              if (!micMutedRef.current) startListeningSession();
            }
          }, 350);
        },
      });
    },
    [isSara, isRtl, detectEmotion, setIsSpeaking, addMessage, startListeningSession]
  );

  // ── Submit Turn ───────────────────────────────────────────────────────────
  const submitUserTurn = useCallback(
    async (userText) => {
      const text = (userText || spokenTextRef.current).trim();
      if (!text) return;
      if (isSubmittingRef.current) return;

      isSubmittingRef.current = true;
      setSpokenText('');
      spokenTextRef.current = '';
      setAutoSendCountdown(0);
      stopListening();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

      setTurnState('thinking');
      turnStateRef.current = 'thinking';
      setSubtitle(isRtl ? 'المحاور يفكر في الرد...' : 'Thinking...');
      addMessage('user', text);
      persistTurn('user', text);

      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = setTimeout(() => {
        if (turnStateRef.current === 'thinking' || isSubmittingRef.current) {
          isSubmittingRef.current = false;
          const emergencyReply = isRtl
            ? `معاك يا ${candidateName} وسامعك كويس. اتفضل كمل إجابتك.`
            : `I'm with you ${candidateName}. Please go ahead.`;
          speakAiTurn(emergencyReply).catch(() => {
            setTurnState('listening');
            turnStateRef.current = 'listening';
            if (!micMutedRef.current) startListeningSession();
          });
        }
      }, 14000);

      try {
        const freshHistory = useInterviewStore.getState().conversationHistory || [];
        const history = [...freshHistory];
        if (!history.some(m => m.role === 'user' && m.content === text)) {
          history.push({ role: 'user', content: text });
        }

        const reply = await liveInterviewChat({
          conversationHistory: history,
          cvContext: cvContextRef.current,
          candidateName,
          interviewerName: isSara ? (isRtl ? 'سارة' : 'Sara') : (isRtl ? 'أحمد' : 'Ahmed'),
          isSara,
        });

        if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);

        const dynamicFallback = isRtl
          ? `فهمت وجهة نظرك يا ${candidateName} بخصوص "${text.slice(0, 50)}". احكي لي أكتر عن دورك وتطبيقك العملي فيها؟`
          : `Understood your point ${candidateName} regarding "${text.slice(0, 50)}". Could you tell me more about your specific role and execution there?`;

        await speakAiTurn(reply || dynamicFallback);
      } catch (err) {
        console.error('[IR] Turn error:', err);
        if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
        isSubmittingRef.current = false;

        const dynamicFallback = isRtl
          ? `فهمت وجهة نظرك يا ${candidateName} بخصوص "${text.slice(0, 50)}". احكي لي أكتر عن دورك وتطبيقك العملي فيها؟`
          : `Understood your point ${candidateName} regarding "${text.slice(0, 50)}". Could you tell me more about your specific role and execution there?`;

        await speakAiTurn(dynamicFallback);
      } finally {
        isSubmittingRef.current = false;
      }
    },
    [candidateName, isSara, isRtl, speakAiTurn, startListeningSession, addMessage]
  );

  submitUserTurnRef.current = submitUserTurn;

  // ── Interrupt AI ──────────────────────────────────────────────────────────
  const interruptAI = useCallback(() => {
    stopSpeaking();
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    setTurnState('listening');
    turnStateRef.current = 'listening';
    setEmotion('neutral');
    toast(isRtl ? '🎙️ تفضل، المايك متاح لك' : '🎙️ Go ahead, mic is yours', { duration: 1500, icon: '✋' });
    setTimeout(() => {
      if (!micMutedRef.current) startListeningSession();
    }, 200);
  }, [isRtl, setIsSpeaking, startListeningSession]);

  // ── Manual Mic Re-activation ──
  const forceRestartMic = useCallback(() => {
    if (isSpeakingRef.current || turnStateRef.current === 'ai_speaking') return;
    toast(isRtl ? '🎙️ جاري إعادة تنشيط المايك...' : '🎙️ Re-activating microphone...', { duration: 1200 });
    resumeMicAudioContext?.();
    stopListening();
    setTurnState('listening');
    turnStateRef.current = 'listening';
    setTimeout(() => {
      if (!micMutedRef.current) startListeningSession();
    }, 150);
  }, [isRtl, startListeningSession]);

  // ── Toolbar Actions ───────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    if (micMuted) {
      setMicMuted(false);
      micMutedRef.current = false;
      toast.success(isRtl ? 'تم تشغيل المايك' : 'Microphone unmuted', { duration: 1200 });
      resumeMicAudioContext?.();
      if (!isSpeakingRef.current && turnStateRef.current !== 'thinking') {
        startListeningSession();
      }
    } else {
      setMicMuted(true);
      micMutedRef.current = true;
      stopListening();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      setAutoSendCountdown(0);
      toast(isRtl ? 'تم كتم المايك' : 'Microphone muted', { icon: '🔇', duration: 1200 });
    }
  }, [micMuted, isRtl, startListeningSession]);

  const toggleCamera = useCallback(async () => {
    if (cameraOn) {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      }
      setCameraOn(false);
      toast(isRtl ? 'تم إيقاف الكاميرا' : 'Camera stopped', { icon: '📷', duration: 1200 });
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        cameraStreamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraOn(true);
        toast.success(isRtl ? 'تم تشغيل الكاميرا' : 'Camera active', { duration: 1200 });
      } catch (err) {
        console.warn('Camera error:', err);
        toast.error(isRtl ? 'تعذر تشغيل الكاميرا' : 'Camera unavailable');
      }
    }
  }, [cameraOn, isRtl]);

  useEffect(() => {
    if (cameraOn && videoRef.current && cameraStreamRef.current) {
      videoRef.current.srcObject = cameraStreamRef.current;
    }
  }, [cameraOn]);

  const sendChatText = useCallback(() => {
    const txt = textInput.trim();
    if (!txt) return;
    setTextInput('');
    submitUserTurn(txt);
  }, [textInput, submitUserTurn]);

  const fullCleanup = useCallback(() => {
    isTerminatedRef.current = true;
    if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
    stopSpeaking();
    stopListening();
    stopUserMicLevel();
    if (cameraStreamRef.current) {
      try {
        cameraStreamRef.current.getTracks().forEach((t) => {
          t.stop();
          t.enabled = false;
        });
      } catch (_) {}
      cameraStreamRef.current = null;
    }
  }, []);

  const handleFinish = useCallback(async () => {
    fullCleanup();

    const iid = interviewIdRef.current || interviewId;
    if (!iid) {
      navigate('/services');
      return;
    }

    toast.loading(isRtl ? 'جارٍ إعداد تقرير التقييم...' : 'Generating evaluation report...', { id: 'rep' });
    try {
      await generateReport(iid, conversationHistory);
      await supabase.from('interviews').update({ status: 'completed', ended_at: new Date().toISOString() }).eq('id', iid);
    } catch (e) {
      console.warn('Finish report error:', e);
    }
    toast.dismiss('rep');
    navigate(`/report/${iid}`);
  }, [fullCleanup, interviewId, conversationHistory, isRtl, navigate]);

  // ── Initialization ────────────────────────────────────────────────────────
  useEffect(() => {
    if (initDoneRef.current || !user) return;
    initDoneRef.current = true;
    isTerminatedRef.current = false;

    const unsubAiLevel = subscribeAudioLevel((lvl) => setAiAudioLevel(lvl));
    startUserMicLevel((lvl) => {
      if (!isTerminatedRef.current) {
        setUserAudioLevel(micMutedRef.current ? 0 : lvl);
      }
    });

    const teardown = () => {
      fullCleanup();
      unsubAiLevel?.();
    };

    window.addEventListener('pagehide', teardown);
    window.addEventListener('beforeunload', teardown);

    initialize();

    return () => {
      window.removeEventListener('pagehide', teardown);
      window.removeEventListener('beforeunload', teardown);
      teardown();
    };
  }, [user, fullCleanup]);

  async function initialize() {
    try {
      const cutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from('interviews')
        .select('id, started_at')
        .eq('user_id', user.id)
        .eq('status', 'in_progress')
        .gte('started_at', cutoff)
        .order('started_at', { ascending: false })
        .limit(1);

      let localId = null;
      let isResumed = false;

      if (existing?.length > 0) {
        localId = existing[0].id;
        isResumed = true;
        const startedAt = new Date(existing[0].started_at).getTime();
        setElapsed(Math.min(MAX_SECS - 10, Math.max(0, Math.floor((Date.now() - startedAt) / 1000))));
        const { data: prev } = await supabase
          .from('interview_answers')
          .select('transcription')
          .eq('interview_id', localId)
          .order('created_at', { ascending: true });
        prev?.forEach((a) => a.transcription && addMessage('user', a.transcription));
      } else {
        const { data: prof } = await supabase
          .from('profiles')
          .select('daily_interview_limit, bonus_interviews, quota_reset_at, is_banned, ban_reason')
          .eq('id', user.id)
          .single();

        if (prof?.is_banned) {
          toast.error(isRtl ? 'حسابك موقوف' : 'Account suspended');
          navigate('/services');
          return;
        }

        const maxAllowed = (prof?.daily_interview_limit ?? 3) + (prof?.bonus_interviews || 0);
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        let q = supabase.from('interviews').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
        q =
          prof?.quota_reset_at && new Date(prof.quota_reset_at) > startOfDay
            ? q.gte('started_at', prof.quota_reset_at)
            : q.gte('started_at', startOfDay.toISOString());

        const { count } = await q;
        if (count && count >= maxAllowed) {
          setDailyLimit(true);
          setPhase('ready');
          return;
        }
      }

      const { data: cvs } = await supabase
        .from('cvs')
        .select('id, raw_text, formatted_html')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      const cvId = cvs?.[0]?.id || null;
      let cvText = cvs?.[0]?.raw_text || '';
      const { data: answers } = await supabase
        .from('cv_answers')
        .select('section, question_key, answer')
        .eq('user_id', user.id);

      let dossier = '';
      if (answers?.length > 0) {
        const sec = {};
        answers.forEach((r) => {
          if (!sec[r.section]) sec[r.section] = {};
          sec[r.section][r.question_key] = r.answer;
        });
        const pe = sec.personal || {};
        const edu = sec.education || {};
        const exp = sec.experience || {};
        const sk = sec.skills || {};
        const prj = sec.projects || {};

        dossier = [
          `الاسم: ${pe.name || candidateName}`,
          pe.title && `المسمى: ${pe.title}`,
          pe.summary && `الملخص: ${pe.summary}`,
          (exp.role || exp.company) &&
            `الخبرة: ${exp.role || ''} - ${exp.company || ''} (${exp.duration || ''}) ${
              exp.exp_details || exp.no_exp || ''
            }`,
          sk.tech_skills && `المهارات التقنية: ${sk.tech_skills}`,
          sk.soft_skills && `المهارات الشخصية: ${sk.soft_skills}`,
          prj.project1 && `المشاريع: ${prj.project1}`,
          prj.project2 && `مشروع إضافي: ${prj.project2}`,
          (edu.degree || edu.university) &&
            `التعليم: ${edu.degree || ''} - ${edu.university || ''} (${edu.grad_year || ''})`,
        ]
          .filter(Boolean)
          .join('\n');
        if (cvText && !dossier.includes(cvText.slice(0, 50))) dossier += '\n\n' + cvText;
      }
      if (!dossier) {
        if (cvs?.[0]?.formatted_html) {
          const d = document.createElement('div');
          d.innerHTML = cvs[0].formatted_html;
          dossier = d.textContent || cvText;
        } else {
          dossier = cvText;
        }
      }
      cvContextRef.current = formatCvContext(dossier);

      fetch(isSara ? '/model2.glb' : '/model.glb').catch(() => {});

      if (!isResumed) {
        localId = await startLiveInterview(user.id, cvId);
      }
      interviewIdRef.current = localId;
      initSession({ interviewId: localId, cvId, questions: [] });

      setPhase('ready');

      if (isResumed) {
        const resumeGreeting = isRtl
          ? `أهلاً بك يا ${candidateName} من جديد. مكملين المقابلة من حيث توقفنا، اتفضل كمل فكرتك الأخيرة.`
          : `Welcome back ${candidateName}. Resuming our interview from where we left off, please go ahead.`;
        await speakAiTurn(resumeGreeting);
      } else {
        const greeting = await generatePersonalizedOpening({
          cvContext: cvContextRef.current,
          candidateName,
          interviewerName: isSara ? (isRtl ? 'سارة' : 'Sara') : (isRtl ? 'أحمد' : 'Ahmed'),
          isSara,
          isRtl,
        });
        await speakAiTurn(greeting);
      }
    } catch (err) {
      console.error('[IR] Init error:', err);
      setPhase('ready');
    }
  }

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory, subtitle]);

  // ── Daily Limit Screen ────────────────────────────────────────────────────
  if (dailyLimit) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div style={{ maxWidth: 460, width: '100%', textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 20, padding: '2.5rem 2rem', color: 'var(--text-primary)', boxShadow: 'var(--shadow-xl)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏰</div>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.35rem', fontWeight: 800 }}>
            {isRtl ? 'الحد اليومي للمقابلات' : 'Daily Interview Limit'}
          </h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 1.5rem', fontSize: '0.9rem' }}>
            {isRtl ? 'أجريت 3 مقابلات اليوم. يتجدد رصيدك تلقائياً غداً.' : 'You have completed your daily interview quota.'}
          </p>
          <button
            onClick={() => navigate('/services')}
            className="btn btn-primary"
            style={{ padding: '0.65rem 2.2rem', margin: '0 auto', display: 'inline-flex', justifyContent: 'center' }}
          >
            {isRtl ? 'العودة لمركز الخدمات' : 'Return to Services'}
          </button>
        </div>
      </div>
    );
  }

  // ── Loading Screen ────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', padding: '1.5rem' }}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 24, padding: '2.5rem 2rem', maxWidth: 420, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', boxShadow: 'var(--shadow-xl)' }}>
          <img
            src={logoImg}
            alt="Prova"
            onError={(e) => { e.currentTarget.src = '/logo.png'; }}
            style={{
              height: '36px',
              width: 'auto',
              objectFit: 'contain',
              marginBottom: '-0.25rem',
              filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.06))',
            }}
          />
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(232,130,90,0.18), rgba(232,130,90,0.06))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2.5rem', border: '1px solid rgba(232,130,90,0.3)',
          }}>
            {isSara ? '👩‍💼' : '👨‍💼'}
          </div>
          <div>
            <div style={{
              display: 'inline-block',
              fontSize: '0.72rem',
              fontWeight: 800,
              color: 'var(--c-coral)',
              background: 'rgba(232,130,90,0.12)',
              padding: '0.2rem 0.65rem',
              borderRadius: 999,
              letterSpacing: '0.5px',
              marginBottom: 8
            }}>
              PROVA INTERVIEW • ZOOM WORKPLACE
            </div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {isRtl ? 'جارٍ الانضمام إلى جلسة المقابلة...' : 'Joining Meeting Room...'}
            </h2>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {isRtl ? `المحاور: ${isSara ? 'سارة (مديرة التوظيف)' : 'أحمد (مدير التوظيف)'}` : `Host: ${isSara ? 'Sara (Hiring Lead)' : 'Ahmed (Hiring Lead)'}`}
            </p>
          </div>
          <div style={{ width: '100%', background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', textAlign: isRtl ? 'right' : 'left' }}>
            {[isRtl ? '✓ تحليل السيرة الذاتية واستخراج المشاريع' : '✓ Candidate CV & Projects Loaded', isRtl ? '✓ تحميل مجسم المحاور ثلاثي الأبعاد' : '✓ 3D Avatar Ready', isRtl ? '✓ تهيئة الصوت البشري فائق السرعة' : '✓ Realtime Voice Ready'].map((t, i) => (
              <div key={i} style={{ color: '#10b981', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                <FontAwesomeIcon icon={faCircleCheck} />
                <span style={{ color: 'var(--text-primary)' }}>{t}</span>
              </div>
            ))}
            <div style={{ color: 'var(--c-coral)', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <FontAwesomeIcon icon={faSpinner} spin />
              <span>{isRtl ? 'بدء الحوار الحي المفتوح...' : 'Starting live session...'}</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── MAIN ZOOM MEETING WINDOW ──────────────────────────────────────────────
  return (
    <div
      style={{
        height: '100dvh',
        width: '100%',
        background: 'var(--bg-base)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
        fontFamily: "'Cairo', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* ── 1. ZOOM TOP MEETING BAR ── */}
      <div
        className="zoom-top-bar"
        style={{
          height: 44,
          flexShrink: 0,
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1rem',
          zIndex: 40,
        }}
      >
        {/* Left: Meeting Info Button & Recording Dot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {/* Zoom Green Shield / Meeting Info */}
          <button
            onClick={() => setShowSecurityModal((p) => !p)}
            title="Meeting Information"
            style={{
              background: 'rgba(232,130,90,0.12)',
              border: '1px solid rgba(232,130,90,0.25)',
              borderRadius: 6,
              cursor: 'pointer',
              color: 'var(--c-coral)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.3rem 0.5rem',
              gap: '0.35rem',
              fontSize: '0.78rem',
              fontWeight: 700,
            }}
          >
            <FontAwesomeIcon icon={faShieldHalved} />
            <span className="zoom-top-text" style={{ fontSize: '0.72rem' }}>Prova SSL</span>
          </button>

          {/* Recording Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: 'rgba(239,68,68,0.1)',
              borderRadius: 6,
              padding: '0.2rem 0.55rem',
              border: '1px solid rgba(239,68,68,0.22)',
            }}
          >
            <motion.span
              animate={{ opacity: [1, 0.25, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }}
            />
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#ef4444', letterSpacing: '0.3px' }}>
              REC
            </span>
          </div>

          <span className="zoom-top-title" style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 700 }}>
            {isRtl ? `مقابلة عمل — ${isSara ? 'سارة' : 'أحمد'}` : `Technical Interview — ${isSara ? 'Sara' : 'Ahmed'}`}
          </span>
        </div>

        {/* Center: Meeting Clock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: elapsed >= 240 ? '#ef4444' : 'var(--text-secondary)', fontSize: '0.84rem', fontFamily: 'monospace', fontWeight: 700 }}>
          <span>{formatTime(elapsed)}</span>
          <span style={{ color: 'var(--text-muted)' }}>/ 05:00</span>
        </div>

        {/* Right: View Button (Speaker / Gallery View) */}
        <div className="zoom-view-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              padding: '0.28rem 0.75rem',
              color: 'var(--text-primary)',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <FontAwesomeIcon icon={faTableCellsLarge} style={{ fontSize: '0.75rem', color: 'var(--c-coral)' }} />
            <span>{isRtl ? 'عرض المتحدث' : 'Speaker View'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. MAIN MEETING STAGE ── */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden', background: 'var(--bg-base)' }}>
        {/* Main Stage Video Tile: Interviewer */}
        <div
          style={{
            flex: 1,
            margin: '0.5rem',
            borderRadius: 16,
            overflow: 'hidden',
            position: 'relative',
            background: 'var(--bg-surface)',
            border: isAiSpeaking ? '2px solid var(--c-coral)' : '1px solid var(--border-default)',
            boxShadow: isAiSpeaking ? '0 0 24px rgba(232,130,90,0.3)' : 'var(--shadow-sm)',
            transition: 'border 0.2s, box-shadow 0.25s',
          }}
        >
          {/* 3D Avatar */}
          <AvatarPlayer
            isSpeaking={isSpeaking}
            isThinking={isThinking}
            audioLevel={aiAudioLevel}
            emotion={emotion}
            selectedAvatar={selectedAvatar}
          />

          {/* Clean Bottom-Left Name Pill */}
          <div
            style={{
              position: 'absolute',
              bottom: 14,
              left: 14,
              zIndex: 30,
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.32rem 0.75rem',
              borderRadius: 8,
              background: 'rgba(27, 42, 65, 0.88)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <FontAwesomeIcon icon={faMicrophone} style={{ fontSize: '0.68rem', color: isAiSpeaking ? 'var(--c-coral)' : '#a1a1aa' }} />
            <span style={{ fontSize: '0.76rem', color: '#fff', fontWeight: 700 }}>
              {isSara ? (isRtl ? 'سارة (المضيف)' : 'Sara (Host)') : (isRtl ? 'أحمد (المضيف)' : 'Ahmed (Host)')}
            </span>
            {isAiSpeaking && <ZoomAudioMeter level={aiAudioLevel} active={true} color="var(--c-coral)" bars={3} />}
          </div>

          {/* Instant Submit Button (When User Speaks) */}
          <AnimatePresence>
            {isUserSpeaking && spokenText.length >= 2 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8, x: '-50%' }}
                animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
                exit={{ opacity: 0, scale: 0.95, y: 8, x: '-50%' }}
                className="zoom-done-speaking-btn"
                style={{
                  position: 'absolute',
                  bottom: '4.8rem',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 35,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <button
                  onClick={() => submitUserTurn(spokenText)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.55rem 1.4rem',
                    borderRadius: 999,
                    background: 'linear-gradient(135deg, var(--c-coral), var(--c-coral-dark))',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-coral)',
                  }}
                >
                  <FontAwesomeIcon icon={faCheck} />
                  <span>{isRtl ? 'انتهيت من الإجابة (إرسال)' : 'Done Speaking (Send)'}</span>
                </button>
                {autoSendCountdown > 0 && (
                  <span style={{ fontSize: '0.68rem', color: '#fff', background: 'rgba(27, 42, 65, 0.85)', padding: '0.15rem 0.55rem', borderRadius: 6, backdropFilter: 'blur(4px)' }}>
                    {isRtl ? `إرسال تلقائي بعد ${(autoSendCountdown / 1000).toFixed(1)} ثانية صمت` : `Auto-sending in ${(autoSendCountdown / 1000).toFixed(1)}s`}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Live Captions Box — Dead-Center */}
          <AnimatePresence>
            {showCC && subtitle && (
              <motion.div
                initial={{ opacity: 0, y: 10, x: '-50%' }}
                animate={{ opacity: 1, y: 0, x: '-50%' }}
                exit={{ opacity: 0, y: 10, x: '-50%' }}
                transition={{ duration: 0.18 }}
                className="zoom-captions-box"
                style={{
                  position: 'absolute',
                  bottom: 22,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  maxWidth: '76%',
                  width: 'fit-content',
                  padding: '0.6rem 1.4rem',
                  borderRadius: 14,
                  background: 'rgba(27, 42, 65, 0.92)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
                  color: '#fff',
                  textAlign: 'center',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  lineHeight: 1.5,
                  zIndex: 35,
                  pointerEvents: !isAiSpeaking ? 'auto' : 'none',
                  cursor: !isAiSpeaking ? 'pointer' : 'default',
                  direction: isRtl ? 'rtl' : 'ltr',
                }}
                onClick={!isAiSpeaking ? forceRestartMic : undefined}
                title={!isAiSpeaking ? (isRtl ? 'اضغط لإعادة تنشيط المايك' : 'Click to re-activate mic') : undefined}
              >
                <span style={{ color: isAiSpeaking ? 'var(--c-coral-light)' : isUserSpeaking ? '#10b981' : '#cbd5e1', fontWeight: 800, marginInlineEnd: 8 }}>
                  {isAiSpeaking ? (isSara ? 'سارة:' : 'أحمد:') : isUserSpeaking ? `${candidateName}:` : ''}
                </span>
                <span style={{ color: '#f8fafc' }}>{subtitle}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Candidate Self View Tile (Picture-in-Picture on Top-Left) */}
        <div
          className="candidate-pip-window"
          style={{
            position: 'absolute',
            zIndex: 40,
            borderRadius: 12,
            overflow: 'hidden',
            background: 'var(--bg-surface)',
            border: isUserSpeaking ? '2px solid var(--c-coral)' : '1px solid var(--border-default)',
            boxShadow: isUserSpeaking ? '0 0 16px rgba(232,130,90,0.35)' : 'var(--shadow-md)',
            transition: 'border 0.2s, box-shadow 0.25s',
          }}
        >
          {cameraOn ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', background: 'var(--bg-subtle)' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, var(--c-coral), var(--c-coral-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1.15rem' }}>
                {candidateName.charAt(0).toUpperCase()}
              </div>
              <ZoomAudioMeter level={userAudioLevel} active={!micMuted && userAudioLevel > 0.04} color="var(--c-coral)" bars={4} />
            </div>
          )}

          {/* Candidate Name Tag */}
          <div
            style={{
              position: 'absolute',
              bottom: 6,
              left: 6,
              right: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.2rem 0.5rem',
              borderRadius: 6,
              background: 'rgba(27, 42, 65, 0.85)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <span style={{ fontSize: '0.66rem', color: '#fff', fontWeight: 700, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {candidateName} {isRtl ? '(أنت)' : '(You)'}
            </span>
            {micMuted ? (
              <FontAwesomeIcon icon={faMicrophoneSlash} style={{ fontSize: '0.6rem', color: '#ef4444' }} />
            ) : isUserSpeaking ? (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-coral)', display: 'inline-block' }} />
            ) : (
              <FontAwesomeIcon icon={faMicrophone} style={{ fontSize: '0.6rem', color: '#10b981' }} />
            )}
          </div>
        </div>

        {/* ── 3. ZOOM MEETING CHAT SIDE DRAWER (Absolute Overlay — Never Shifts Avatar) ── */}
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{ x: 340, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 340, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="zoom-chat-drawer"
              style={{
                position: 'absolute',
                top: 12,
                bottom: 12,
                borderRadius: 16,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-xl)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 60,
                overflow: 'hidden',
              }}
            >
              {/* Drawer Header */}
              <div style={{ height: 44, padding: '0 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {isRtl ? 'محادثة الجلسة (Meeting Chat)' : 'Meeting Chat'}
                </span>
                <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.95rem' }}>
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>

              {/* Messages Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {conversationHistory.map((m, idx) => {
                  const isUserMsg = m.role === 'user';
                  return (
                    <div
                      key={idx}
                      style={{
                        alignSelf: isUserMsg ? (isRtl ? 'flex-start' : 'flex-end') : isRtl ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        padding: '0.6rem 0.85rem',
                        borderRadius: 12,
                        background: isUserMsg ? 'linear-gradient(135deg, var(--c-coral), var(--c-coral-dark))' : 'var(--bg-subtle)',
                        color: isUserMsg ? '#fff' : 'var(--text-primary)',
                        border: isUserMsg ? 'none' : '1px solid var(--border-subtle)',
                        fontSize: '0.8rem',
                        lineHeight: 1.5,
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      <div style={{ fontSize: '0.64rem', opacity: isUserMsg ? 0.85 : 0.6, marginBottom: 2, fontWeight: 700 }}>
                        {isUserMsg ? candidateName : isSara ? 'سارة' : 'أحمد'}
                      </div>
                      {m.content}
                    </div>
                  );
                })}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input */}
              <div style={{ padding: '0.65rem 0.85rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.45rem', background: 'var(--bg-subtle)' }}>
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChatText()}
                  placeholder={isRtl ? 'اكتب رسالة للمحاور...' : 'Type message here...'}
                  style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '0.45rem 0.75rem', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none' }}
                />
                <button onClick={sendChatText} style={{ background: 'var(--c-coral)', border: 'none', borderRadius: 8, width: 34, height: 34, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesomeIcon icon={faPaperPlane} style={{ fontSize: '0.8rem' }} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── 4. ICONIC BOTTOM TOOLBAR ── */}
      <div
        className="zoom-bottom-toolbar"
        style={{
          flexShrink: 0,
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-subtle)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 50,
        }}
      >
        {/* Left: Audio & Video controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ZoomButton
            icon={micMuted ? faMicrophoneSlash : faMicrophone}
            label={micMuted ? (isRtl ? 'إلغاء الكتم' : 'Unmute') : isRtl ? 'كتم الصوت' : 'Mute'}
            danger={micMuted}
            active={!micMuted}
            onClick={toggleMic}
          />
          <ZoomButton
            icon={cameraOn ? faVideo : faVideoSlash}
            label={cameraOn ? (isRtl ? 'إيقاف الفيديو' : 'Stop Video') : isRtl ? 'تشغيل الفيديو' : 'Start Video'}
            danger={!cameraOn}
            active={cameraOn}
            onClick={toggleCamera}
          />
        </div>

        {/* Center: Meeting Actions (Security, Participants, Chat, Captions, Raise Hand) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <ZoomButton
            className="zoom-btn-desktop-only"
            icon={faShieldHalved}
            label={isRtl ? 'الأمان' : 'Security'}
            onClick={() => setShowSecurityModal((p) => !p)}
          />
          <ZoomButton
            className="zoom-btn-desktop-only"
            icon={faUsers}
            label={isRtl ? 'المشاركون (2)' : 'Participants (2)'}
            onClick={() => toast(isRtl ? 'المشاركون: أنت و المحاور' : 'Participants: You and Interviewer')}
          />
          <ZoomButton
            icon={faComments}
            label={isRtl ? 'المحادثة' : 'Chat'}
            active={chatOpen}
            badgeCount={conversationHistory.length}
            onClick={() => setChatOpen((p) => !p)}
          />
          <ZoomButton
            icon={faClosedCaptioning}
            label={isRtl ? 'الترجمة' : 'Captions'}
            active={showCC}
            onClick={() => setShowCC((p) => !p)}
          />
          <ZoomButton
            icon={faHandPaper}
            label={isAiSpeaking ? (isRtl ? 'مقاطعة' : 'Interrupt') : (isRtl ? 'رفع اليد' : 'Raise Hand')}
            danger={isAiSpeaking}
            active={isAiSpeaking}
            onClick={isAiSpeaking ? interruptAI : () => toast(isRtl ? '✋ تم رفع يدك للتحدث' : '✋ Hand raised', { icon: '✋', duration: 1500 })}
          />
        </div>

        {/* Right: End Meeting Button */}
        <div>
          <button
            onClick={() => setConfirmEnd(true)}
            style={{
              padding: '0.5rem 1.3rem',
              borderRadius: 8,
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 2px 10px rgba(239,68,68,0.3)',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#dc2626')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#ef4444')}
          >
            <FontAwesomeIcon icon={faPhoneSlash} />
            <span>{isRtl ? 'إنهاء' : 'End'}</span>
          </button>
        </div>
      </div>

      {/* ── 5. ZOOM MEETING INFO MODAL (Platform Styled Popover) ── */}
      <AnimatePresence>
        {showSecurityModal && (
          <div
            style={{
              position: 'fixed',
              top: 52,
              left: isRtl ? 'auto' : 16,
              right: isRtl ? 16 : 'auto',
              width: 300,
              borderRadius: 14,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-xl)',
              padding: '1.2rem',
              zIndex: 100,
              color: 'var(--text-primary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.85rem', color: 'var(--c-coral)' }}>
                <FontAwesomeIcon icon={faLock} />
                <span>{isRtl ? 'معلومات المقابلة المشفرة' : 'Encrypted Meeting Info'}</span>
              </div>
              <button onClick={() => setShowSecurityModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            <div style={{ fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-secondary)' }}>
              <div><strong style={{ color: 'var(--text-primary)' }}>الموضوع:</strong> مقابلة توظيف تقنية — Prova</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>معرف الجلسة:</strong> 839 2049 1092</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>المحاور:</strong> {isSara ? 'سارة (مديرة التوظيف)' : 'أحمد (مدير التوظيف)'}</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>الصوت الذكي:</strong> Cartesia Sonic / Neural Engine</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>التشفير:</strong> Enhanced End-to-End Encryption</div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 6. END MEETING CONFIRMATION MODAL ── */}
      <AnimatePresence>
        {confirmEnd && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(27, 42, 65, 0.45)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 20, padding: '2rem', maxWidth: 420, width: '100%', color: 'var(--text-primary)', textAlign: 'center', boxShadow: 'var(--shadow-xl)' }}
            >
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 800 }}>
                {isRtl ? 'إنهاء جلسة المقابلة؟' : 'End Meeting?'}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
                {isRtl ? 'سيتم حفظ كافة إجاباتك ونقاشاتك الحالية وتوليد تقرير التقييم الفوري.' : 'All answers will be saved, and your evaluation report will be generated.'}
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button
                  onClick={() => setConfirmEnd(false)}
                  style={{ flex: 1, padding: '0.65rem 1rem', borderRadius: 8, background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  {isRtl ? 'متابعة المقابلة' : 'Cancel'}
                </button>
                <button
                  onClick={handleFinish}
                  style={{ flex: 1, padding: '0.65rem 1rem', borderRadius: 8, background: '#ef4444', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  {isRtl ? 'إنهاء واستخراج التقرير' : 'End Meeting'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
