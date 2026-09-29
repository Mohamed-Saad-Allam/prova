import { create } from 'zustand';

/**
 * interviewStore — Zustand store for live interview session state
 * Single source of truth for the entire interview room
 */
export const useInterviewStore = create((set, get) => ({
  // ── Session identifiers ──
  interviewId: null,
  cvId: null,

  // ── Questions & Progress ──
  questions: [],           // Array of { id, question_text, order_index }
  currentIndex: 0,

  // ── Conversation ──
  conversationHistory: [], // Array of { role: 'user'|'assistant', content: string }

  // ── Recording State ──
  recordingState: 'idle',  // 'idle' | 'listening' | 'processing'

  // ── Avatar State ──
  isSpeaking: false,

  // ── Interim transcript ──
  interimText: '',

  // ── Error ──
  error: null,

  // ─────────────── Actions ───────────────

  initSession: ({ interviewId, cvId, questions }) => set({
    interviewId,
    cvId,
    questions,
    currentIndex: 0,
    conversationHistory: [],
    recordingState: 'idle',
    isSpeaking: false,
    interimText: '',
    error: null,
  }),

  setRecordingState: (state) => set({ recordingState: state }),

  setInterimText: (text) => set({ interimText: text }),

  setIsSpeaking: (val) => set({ isSpeaking: val }),

  setError: (error) => set({ error }),

  addMessage: (role, content) => set((state) => ({
    conversationHistory: [
      ...state.conversationHistory,
      { role, content, timestamp: Date.now() },
    ],
    interimText: '',
  })),

  advanceQuestion: () => set((state) => ({
    currentIndex: Math.min(state.currentIndex + 1, state.questions.length - 1),
  })),

  isLastQuestion: () => {
    const { currentIndex, questions } = get();
    return currentIndex >= questions.length - 1;
  },

  getCurrentQuestion: () => {
    const { questions, currentIndex } = get();
    return questions[currentIndex] || null;
  },

  reset: () => set({
    interviewId: null,
    cvId: null,
    questions: [],
    currentIndex: 0,
    conversationHistory: [],
    recordingState: 'idle',
    isSpeaking: false,
    interimText: '',
    error: null,
  }),
}));
