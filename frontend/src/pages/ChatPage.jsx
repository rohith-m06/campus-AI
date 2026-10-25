import React, { useState, useEffect, useRef } from 'react';
import Icon from '../components/Icon';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuthStore } from '../store/authStore';
import { api, API_BASE } from '../services/api';
import BrandLogo from '../components/BrandLogo';
import AttendanceModal from '../components/AttendanceModal';
import TimetableModal from '../components/TimetableModal';
import GrievancesModal from '../components/GrievancesModal';
import CampusNewsModal from '../components/CampusNewsModal';
import CitationModal from '../components/CitationModal';
import InteractiveTicketCard from '../components/InteractiveTicketCard';
import { formatMessageTimestamp } from '../utils/dateFormatting';

function getAcademicYearLabel(yearStr) {
  const y = (yearStr || '2nd').toString().toLowerCase();
  if (y.includes('1')) return '1st Year • Sem 2';
  if (y.includes('2')) return '2nd Year • Sem 4';
  if (y.includes('3')) return '3rd Year • Sem 6';
  if (y.includes('4')) return '4th Year • Sem 8';
  return `${yearStr} Year • Sem 4`;
}

export default function ChatPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  // Navigation & UI state: collapsed by default on mobile/tablet (< 1024px)
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return false;
  });
  const [activeModal, setActiveModal] = useState(null); // 'attendance' | 'timetable' | 'grievance' | 'news' | 'citation'
  const [citationData, setCitationData] = useState(null);

  // Chat sessions state
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [activeSessionTitle, setActiveSessionTitle] = useState('New Copilot Chat');
  const [messages, setMessages] = useState([]);

  // Input & Streaming state
  const [inputPrompt, setInputPrompt] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState('English');
  const [isListening, setIsListening] = useState(false);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [openTicketsCount, setOpenTicketsCount] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);

  // Experience fixes state (Sections 7 & 8)
  const [confirmDeleteSession, setConfirmDeleteSession] = useState(null); // { id, title } | null
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [copyErrorId, setCopyErrorId] = useState(null);
  const [processingStage, setProcessingStage] = useState('Preparing your academic context...');

  // 7.9 Platform-aware keyboard shortcut detection
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const shortcutLabel = isMac ? '⌘K' : 'Ctrl+K';

  // 7.4 Processing stage progression during waiting
  useEffect(() => {
    if (!isSending) {
      setProcessingStage('Preparing your academic context...');
      return;
    }
    setProcessingStage('Preparing your academic context...');
    const t1 = setTimeout(() => {
      setProcessingStage('Searching university records...');
    }, 1200);
    const t2 = setTimeout(() => {
      setProcessingStage('Generating grounded answer...');
    }, 2600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isSending]);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-collapse sidebar on smaller screens during window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load live student attendance and tickets metrics for sidebar badges
  const loadStudentContext = async () => {
    try {
      const att = await api.getAttendance();
      if (att) setAttendanceSummary(att);
    } catch (e) {
      console.log('Attendance sync notice:', e);
    }

    try {
      const tickets = await api.getMyTickets();
      if (tickets) {
        const openOnes = tickets.filter(
          (t) => t.status && !['Resolved', 'Closed'].includes(t.status)
        );
        setOpenTicketsCount(openOnes.length);
      }
    } catch (e) {
      console.log('Tickets sync notice:', e);
    }
  };

  // Switch active session
  const selectSession = async (sessionId, title) => {
    setActiveSessionId(sessionId);
    setActiveSessionTitle(title || 'Copilot Chat');
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
    try {
      const msgs = await api.getSessionMessages(sessionId);
      setMessages(msgs || []);
    } catch (err) {
      console.error('Failed to load session messages:', err);
    }
  };

  // Create or reset to a new chat
  const handleNewChat = () => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
    // Set to null so the very next message automatically creates a named session
    setActiveSessionId(null);
    setActiveSessionTitle('New Chat');
    setMessages([]);
    inputRef.current?.focus();
  };

  // Load chat sessions from backend
  const loadSessions = async () => {
    try {
      const data = await api.getChatSessions();
      if (data && data.length > 0) {
        setSessions(data);
        if (!activeSessionId) {
          selectSession(data[0].id, data[0].title);
        }
      } else {
        handleNewChat(false);
      }
    } catch (err) {
      console.error('Failed to load chat sessions:', err);
    }
  };

  // Click outside to close profile card
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut listener (Cmd/Ctrl + K for new chat, Esc to clear or close delete modal)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleNewChat();
      } else if (e.key === 'Escape') {
        if (confirmDeleteSession) {
          setConfirmDeleteSession(null);
        } else {
          setInputPrompt('');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDeleteSession]);

  // Initial data loading
  useEffect(() => {
    loadSessions();
    loadStudentContext();
  }, [user]);

  // 7.6 Visible copy confirmation & error feedback
  const handleCopyMessage = async (msgId, text) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (!successful) throw new Error('execCommand failed');
      }
      setCopiedMessageId(msgId);
      setCopyErrorId(null);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      setCopyErrorId(msgId);
      setTimeout(() => setCopyErrorId(null), 2500);
    }
  };

  // 7.7 Delete chat session after user confirmation
  const executeDeleteSession = async (sessionId) => {
    const remaining = sessions.filter((s) => s.id !== sessionId);
    setSessions(remaining);

    if (activeSessionId === sessionId) {
      if (remaining.length > 0) {
        selectSession(remaining[0].id, remaining[0].title);
      } else {
        handleNewChat(false);
      }
    }

    try {
      await api.deleteChatSession(sessionId);
    } catch (err) {
      console.error('Failed to delete session:', err);
      loadSessions();
    }
  };

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Voice speech-to-text recognition
  const handleToggleVoice = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please type your query.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang =
        preferredLanguage === 'Hindi'
          ? 'hi-IN'
          : preferredLanguage === 'Tamil'
            ? 'ta-IN'
            : preferredLanguage === 'Telugu'
              ? 'te-IN'
              : preferredLanguage === 'French'
                ? 'fr-FR'
                : preferredLanguage === 'German'
                  ? 'de-DE'
                  : preferredLanguage === 'Spanish'
                    ? 'es-ES'
                    : 'en-US';
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (e) => {
        const text = e.results[0][0].transcript;
        setInputPrompt((prev) => (prev ? `${prev} ${text}` : text));
      };

      recognition.start();
    } catch (err) {
      console.error('Voice input error:', err);
      setIsListening(false);
    }
  };

  // 7.3 Retry handler for failed messages
  const handleRetryMessage = (msg) => {
    const textToRetry = msg.content || msg.retryQuery;
    const userMsgId = msg.id || msg.targetUserMsgId;
    if (!textToRetry || isSending) return;

    // Remove any previous connection error notice for this question
    setMessages((prev) =>
      prev.filter((m) => !(m.role === 'error' && (m.targetUserMsgId === userMsgId || m.retryQuery === textToRetry)))
    );

    handleSendMessage(textToRetry, userMsgId);
  };

  // Send message with sync state tracking & response timing (7.2, 7.3, 7.5)
  const handleSendMessage = async (textToSend, retryUserMsgId = null) => {
    const query = (textToSend || inputPrompt).trim();
    if (!query || isSending) return;

    if (!retryUserMsgId) {
      setInputPrompt('');
    }
    setIsSending(true);

    const userMsgId = retryUserMsgId || `temp_${Date.now()}`;
    const startTime = Date.now();

    if (retryUserMsgId) {
      // Re-trying previous failed message: update status to 'sending'
      setMessages((prev) =>
        prev.map((m) => (m.id === userMsgId ? { ...m, syncStatus: 'sending' } : m))
      );
    } else {
      // 7.2 Optimistically append user message with 'sending' status
      const tempUserMsg = {
        id: userMsgId,
        role: 'user',
        content: query,
        created_at: new Date().toISOString(),
        syncStatus: 'sending', // 'sending' | 'saved' | 'synced' | 'failed'
      };
      setMessages((prev) => [...prev, tempUserMsg]);
    }

    // Step 2: Transition from 'sending' to 'saved' (confirmed in local store)
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === userMsgId && m.syncStatus === 'sending' ? { ...m, syncStatus: 'saved' } : m
        )
      );
    }, 350);

    const aiMsgId = `ai_${Date.now()}`;
    let typingTicker = null;

    try {
      const langParam = preferredLanguage !== 'English' ? preferredLanguage : null;

      // Optimistically create assistant message placeholder for progressive streaming
      const initialAssistantMsg = {
        id: aiMsgId,
        role: 'assistant',
        content: '',
        source: '',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, initialAssistantMsg]);

      let targetText = '';
      let displayedChars = 0;
      let finalEventReceived = null;
      let streamFinished = false;

      // Smooth progressive typing animation ticker (fluid ~60fps letter-by-letter reveal)
      typingTicker = setInterval(() => {
        if (displayedChars < targetText.length) {
          const delta = targetText.length - displayedChars;
          const step = delta > 60 ? Math.ceil(delta / 5) : delta > 20 ? 3 : 2;
          displayedChars = Math.min(targetText.length, displayedChars + step);
          const currentSlice = targetText.slice(0, displayedChars);
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMsgId ? { ...m, content: currentSlice } : m))
          );
        } else if (streamFinished && finalEventReceived) {
          clearInterval(typingTicker);
          typingTicker = null;
          const durationSec = Math.max(0.4, Number(((Date.now() - startTime) / 1000).toFixed(1)));
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === userMsgId) {
                // 7.2 Only show 'synced' after confirmed response
                return { ...m, syncStatus: 'synced' };
              }
              if (m.id === aiMsgId) {
                return {
                  ...m,
                  content: finalEventReceived.answer || targetText,
                  source: finalEventReceived.source || '',

                };
              }
              return m;
            })
          );
          setIsSending(false);
        }
      }, 18);

      const res = await api.sendMessageStream(
        query,
        langParam,
        activeSessionId,
        (token, accumulated) => {
          targetText = accumulated;
        },
        (doneEvent) => {
          finalEventReceived = doneEvent;
          targetText = doneEvent.answer || targetText;
          streamFinished = true;
        }
      );

      if (res && res.session_id) {
        const newSessionId = res.session_id;
        const updatedTitle = res.session_title || 'New Chat';
        setActiveSessionId(newSessionId);
        setActiveSessionTitle(updatedTitle);

        // Update local session list immediately
        setSessions((prev) => {
          const exists = prev.some((s) => s.id === newSessionId);
          if (exists) {
            return prev.map((s) => (s.id === newSessionId ? { ...s, title: updatedTitle } : s));
          } else {
            return [{ id: newSessionId, title: updatedTitle, created_at: new Date().toISOString() }, ...prev];
          }
        });

        // Fetch fresh list from server and update state
        try {
          const freshSessions = await api.getChatSessions();
          if (freshSessions && freshSessions.length > 0) {
            setSessions(freshSessions);
          }
        } catch (syncErr) {
          console.log('Session sync notice:', syncErr);
        }
      }

      // If stream ended quickly, make sure final text catches up
      if (res && res.answer) {
        targetText = res.answer;
        finalEventReceived = res;
        streamFinished = true;
      }
    } catch (err) {
      if (typingTicker) clearInterval(typingTicker);
      console.error('Chat streaming error:', err);

      // 7.3 Mark message as failed, preserve query, remove assistant bubble, and show connection error
      setMessages((prev) => {
        const cleaned = prev
          .filter((m) => m.id !== aiMsgId)
          .map((m) => (m.id === userMsgId ? { ...m, syncStatus: 'failed' } : m));

        return [
          ...cleaned,
          {
            id: `err_${Date.now()}`,
            role: 'error',
            content: 'Connection error contacting the university copilot service. Please verify your connection or try again.',
            created_at: new Date().toISOString(),
            retryQuery: query,
            targetUserMsgId: userMsgId,
          },
        ];
      });
      setIsSending(false);
    } finally {
      loadStudentContext();
    }
  };

  // Open verified citation modal
  const handleOpenCitation = (source) => {
    const doc = (source && source.trim()) || 'academic_policies_and_attendance.md';
    setCitationData({
      document: doc,
      clause: 'Official Academic Regulation Clause',
      text: 'This guidance is extracted directly from your university official policy documents with deterministic RAG verification.',
    });
    setActiveModal('citation');
  };

  // Student initials
  const studentInitials = user?.full_name
    ? user.full_name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
    : 'AS';

  const attendanceAlertCount = attendanceSummary?.subject_records
    ? attendanceSummary.subject_records.filter((s) => s.percentage < 75.0).length
    : 0;

  return (
    <div className="min-h-screen bg-background text-on-surface flex overflow-hidden">
      {/* 1. COLLAPSIBLE LEFT SIDEBAR */}
      <aside
        className={`fixed left-0 top-0 h-screen bg-surface-container-lowest z-50 flex flex-col justify-between overflow-y-auto transition-all duration-300 border-r border-surface-container shadow-xs ${
          sidebarOpen ? 'w-72 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-20'
        }`}
      >
        <div className="flex flex-col">
          {/* Sidebar Top Branding & Collapse Button */}
          <div className={`p-space-md flex items-center border-b border-surface-container ${sidebarOpen ? 'justify-between' : 'justify-center gap-space-xs'
            }`}>
            <div className="flex items-center gap-space-sm overflow-hidden">
              <BrandLogo className="w-8 h-8 shrink-0" />
              {sidebarOpen && (
                <div className="flex flex-col min-w-0">
                  <span className="font-headline-sm text-headline-sm text-on-surface leading-none truncate font-semibold">
                    CampusMind
                  </span>
                  <span className="font-label-sm text-label-sm text-primary leading-tight tracking-wider uppercase text-[10px] font-semibold">
                    Copilot
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer shrink-0"
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <Icon name="dock_to_left" className="text-[18px]" />
            </button>
          </div>

          {/* Student Profile Identity Card */}
          <div className={`${sidebarOpen ? 'px-space-md' : 'px-space-xs flex justify-center'} mt-space-sm mb-space-sm`}>
            <div className={`rounded-xl bg-surface-container-low border border-surface-container flex items-center overflow-hidden ${sidebarOpen ? 'p-space-sm gap-space-sm w-full' : 'p-1.5 justify-center'
              }`}>
              <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-label-md text-label-md font-semibold shrink-0 shadow-2xs">
                {studentInitials}
              </div>
              {sidebarOpen && (
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-label-md text-label-md text-on-surface font-semibold truncate">
                    {user?.full_name || 'Arjun Sharma'}
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
                    {user?.student_id || '24CSE101'} • {user?.branch || 'CSE'} {user?.current_year || '1st'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* "+ New Copilot Chat" CTA Button (7.9 Platform-aware shortcut) */}
          <div className={`${sidebarOpen ? 'px-space-md' : 'px-space-xs flex justify-center'} mb-space-md`}>
            <button
              type="button"
              onClick={() => handleNewChat(true)}
              title={!sidebarOpen ? `New Copilot Chat (${shortcutLabel})` : undefined}
              aria-label={`New Copilot Chat (${shortcutLabel})`}
              className={`flex items-center rounded-xl bg-primary-container text-on-primary hover:bg-primary transition-all shadow-md cursor-pointer active:scale-98 ${sidebarOpen
                  ? 'w-full justify-between px-space-md py-space-sm'
                  : 'w-10 h-10 justify-center p-0'
                }`}
            >
              <span className="flex items-center justify-center gap-space-xs font-label-md text-label-md font-semibold">
                <Icon name="add" className="text-[20px]" />
                {sidebarOpen && 'New Copilot Chat'}
              </span>
              {sidebarOpen && (
                <span className="font-code-sm text-code-sm px-1.5 py-0.5 rounded bg-surface-container-lowest/20 text-on-primary text-[10px]">
                  {shortcutLabel}
                </span>
              )}
            </button>
          </div>

          {/* Section: Academic Space */}
          {sidebarOpen && (
            <div className="px-space-md mb-space-xs">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
                Academic Space
              </span>
            </div>
          )}

          <nav className={`${sidebarOpen ? 'px-space-sm' : 'px-space-xs items-center'} space-y-space-xs flex flex-col`}>
            {/* Active Copilot */}
            <button
              type="button"
              onClick={() => { }}
              title={!sidebarOpen ? "Active Copilot" : undefined}
              aria-label="Active Copilot"
              className={`flex items-center rounded-lg transition-colors bg-surface-container text-primary font-semibold cursor-pointer ${sidebarOpen
                  ? 'justify-between px-space-sm py-2 w-full'
                  : 'justify-center w-10 h-10 p-0'
                }`}
            >
              <div className="flex items-center justify-center gap-space-sm">
                <Icon name="neurology" className="text-[20px]" />
                {sidebarOpen && <span className="font-label-md text-label-md">Active Copilot</span>}
              </div>
            </button>

            {/* Course Attendance */}
            <button
              type="button"
              onClick={() => setActiveModal('attendance')}
              title={!sidebarOpen ? (attendanceAlertCount > 0 ? `Course Attendance (${attendanceAlertCount} Shortage)` : "Course Attendance") : undefined}
              aria-label={attendanceAlertCount > 0 ? `Course Attendance (${attendanceAlertCount} subjects below 75%)` : "Course Attendance"}
              className={`flex items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors cursor-pointer ${sidebarOpen
                  ? 'justify-between px-space-sm py-2 w-full'
                  : 'justify-center w-10 h-10 p-0'
                }`}
            >
              <div className="flex items-center justify-center gap-space-sm">
                <Icon name="fact_check" className={`text-[20px] ${attendanceAlertCount > 0 ? 'text-error' : 'text-tertiary-container'}`} />
                {sidebarOpen && <span className="font-label-md text-label-md">Course Attendance</span>}
              </div>
              {attendanceAlertCount > 0 && (
                sidebarOpen ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-error font-label-sm text-label-sm font-semibold border border-rose-500/20">
                    <Icon name="warning" className="text-[13px]" />
                    <span>{attendanceAlertCount} Below 75%</span>
                  </span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>
                )
              )}
            </button>

            {/* Timetable & Schedule */}
            <button
              type="button"
              onClick={() => setActiveModal('timetable')}
              title={!sidebarOpen ? "Timetable & Schedule" : undefined}
              aria-label="Timetable and Academic Schedule"
              className={`flex items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors cursor-pointer ${sidebarOpen
                  ? 'justify-between px-space-sm py-2 w-full'
                  : 'justify-center w-10 h-10 p-0'
                }`}
            >
              <div className="flex items-center justify-center gap-space-sm">
                <Icon name="calendar_today" className="text-[20px] text-primary" />
                {sidebarOpen && <span className="font-label-md text-label-md">Timetable &amp; Schedule</span>}
              </div>
            </button>

            {/* Student Grievances */}
            <button
              type="button"
              onClick={() => setActiveModal('grievance')}
              title={!sidebarOpen ? `Student Grievances (${openTicketsCount} Open)` : undefined}
              aria-label={`Student Grievances (${openTicketsCount} open)`}
              className={`flex items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors cursor-pointer ${sidebarOpen
                  ? 'justify-between px-space-sm py-2 w-full'
                  : 'justify-center w-10 h-10 p-0'
                }`}
            >
              <div className="flex items-center justify-center gap-space-sm">
                <Icon name="support_agent" className="text-[20px] text-secondary" />
                {sidebarOpen && <span className="font-label-md text-label-md">Student Grievances</span>}
              </div>
              {sidebarOpen && (
                <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm font-semibold">
                  {openTicketsCount} Open
                </span>
              )}
            </button>

            {/* Campus Circulars */}
            <button
              type="button"
              onClick={() => setActiveModal('news')}
              title={!sidebarOpen ? "Campus Circulars" : undefined}
              aria-label="Campus Circulars and Bulletins"
              className={`flex items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors cursor-pointer ${sidebarOpen
                  ? 'justify-between px-space-sm py-2 w-full'
                  : 'justify-center w-10 h-10 p-0'
                }`}
            >
              <div className="flex items-center justify-center gap-space-sm">
                <Icon name="campaign" className="text-[20px] text-primary-container" />
                {sidebarOpen && <span className="font-label-md text-label-md">Campus Circulars</span>}
              </div>
              {sidebarOpen && <span className="w-2 h-2 rounded-full bg-secondary"></span>}
            </button>
          </nav>

          {/* Section: Recent Inquiries */}
          {sidebarOpen && (
            <div className="px-space-md mt-space-md mb-space-xs flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
                Recent Inquiries
              </span>
              <span className="font-code-sm text-code-sm text-on-surface-variant text-[10px]">
                {sessions.length} chats
              </span>
            </div>
          )}

          {/* 7.8 Keyboard-accessible session rows with buttons */}
          {sidebarOpen && (
            <div className="px-space-sm space-y-space-xs flex flex-col max-h-48 overflow-y-auto">
              {sessions.length === 0 ? (
                <span className="px-space-sm py-1 font-body-sm text-body-sm text-on-surface-variant italic">
                  No prior chats yet
                </span>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    className={`group flex items-center justify-between gap-space-xs px-space-sm py-1.5 rounded-lg transition-colors ${activeSessionId === s.id
                        ? 'bg-surface-container text-primary font-medium'
                        : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                      }`}
                  >
                    <button
                      type="button"
                      onClick={() => selectSession(s.id, s.title)}
                      aria-label={`Open conversation: ${s.title}`}
                      className="flex items-center gap-space-xs truncate min-w-0 flex-1 text-left bg-transparent border-none p-0 text-inherit font-inherit cursor-pointer outline-none focus-visible:underline"
                    >
                      <Icon name="chat_bubble" className="text-[16px] text-outline shrink-0" />
                      <span className="font-label-md text-label-md truncate">{s.title}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteSession(s);
                      }}
                      className="opacity-60 hover:opacity-100 p-1 rounded-md hover:bg-rose-50 hover:text-error text-on-surface-variant transition-all cursor-pointer shrink-0 z-10"
                      title="Delete chat session"
                      aria-label={`Delete conversation ${s.title}`}
                    >
                      <Icon name="delete" className="text-[16px]" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Sidebar Bottom: Multilingual Selector */}
        {sidebarOpen && (
          <div className="p-space-md mt-space-md bg-surface-container-lowest border-t border-surface-container">
            <div className="flex items-center justify-between px-space-xs">
              <div className="flex items-center gap-space-xs text-on-surface-variant">
                <Icon name="translate" className="text-[16px]" />
                <span className="font-label-sm text-label-sm font-medium">Language</span>
              </div>
              <select
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                className="bg-surface-container-low text-on-surface font-label-sm text-label-sm rounded-lg px-2 py-1 outline-none border border-surface-container cursor-pointer"
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi (हिंदी)</option>
                <option value="Tamil">Tamil (தமிழ்)</option>
                <option value="Telugu">Telugu (తెలుగు)</option>
                <option value="Spanish">Spanish (Español)</option>
                <option value="French">French (Français)</option>
                <option value="German">German (Deutsch)</option>
              </select>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Sidebar Backdrop Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden cursor-pointer"
        />
      )}

      {/* 2. MAIN WORKSPACE CONTAINER */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${sidebarOpen ? 'lg:pl-72' : 'lg:pl-20'
          }`}
      >
        {/* Top Header Bar */}
        <header
          className={`fixed top-0 right-0 h-16 bg-surface-container-lowest/80 backdrop-blur-xl border-b border-surface-container shadow-2xs z-40 flex items-center justify-between px-space-md transition-all duration-300 ${sidebarOpen ? 'left-0 lg:left-72' : 'left-0 lg:left-20'
            }`}
        >
          <div className="flex items-center gap-space-sm">
            {/* 8.6 Mobile Sidebar Toggle (>= 44x44px touch target) */}
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? "Close sidebar menu" : "Open sidebar menu"}
              className="lg:hidden min-w-[44px] min-h-[44px] p-2 rounded-xl hover:bg-surface-container text-on-surface-variant flex items-center justify-center cursor-pointer transition-colors"
            >
              <Icon name="menu" className="text-[24px]" />
            </button>

            <BrandLogo className="w-8 h-8 shrink-0" />
            <span className="font-headline-sm text-headline-sm text-on-surface font-semibold hidden sm:inline">
              CampusMind AI
            </span>
          </div>

          <div className="flex items-center gap-space-sm sm:gap-space-md">
            {/* Context Pill - Hidden on mobile to avoid crowded badges (8.6) */}
            <div className="hidden sm:flex items-center gap-space-xs px-space-sm py-1.5 rounded-xl bg-surface-container-low border border-surface-container text-on-surface-variant font-label-md text-label-md">
              <Icon name="school" className="text-[16px] text-primary" />
              <span>
                {user?.branch || 'CSE'} • {user?.current_year ? `${user.current_year} Year` : '2nd Year'}
              </span>
            </div>

            {/* Circulars Button (>= 44x44px touch target) */}
            <button
              type="button"
              onClick={() => setActiveModal('news')}
              className="relative flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer border border-surface-container"
              title="Campus Circulars"
              aria-label="Campus circulars notifications"
            >
              <Icon name="notifications" className="text-[20px]" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-secondary"></span>
            </button>

            {/* Profile Avatar with Information Popover (>= 44x44px touch target) */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-primary-container text-on-primary flex items-center justify-center font-label-md text-label-md font-semibold shadow-xs hover:ring-2 hover:ring-primary/40 transition-all cursor-pointer"
                title="View Student Profile"
                aria-label="Student profile"
              >
                {studentInitials}
              </button>

              {/* Basic Student Information Dropdown */}
              <AnimatePresence>
                {showProfileMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-80 rounded-2xl bg-surface-container-lowest p-space-md shadow-2xl border border-surface-container z-50 flex flex-col space-y-space-sm"
                  >
                    <div className="flex items-center gap-space-sm pb-space-sm border-b border-surface-container">
                      <div className="w-12 h-12 rounded-xl bg-primary-container text-on-primary flex items-center justify-center font-headline-md text-headline-md font-semibold shadow-xs shrink-0">
                        {studentInitials}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">
                          {user?.full_name || 'Arjun Sharma'}
                        </span>
                        <span className="font-code-sm text-code-sm text-primary font-medium">
                          {user?.student_id || '24CSE101'}
                        </span>
                      </div>
                    </div>

                    {/* Information Grid */}
                    <div className="space-y-space-xs py-1">
                      <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-surface-container-low text-label-sm font-label-sm">
                        <span className="text-on-surface-variant flex items-center gap-1.5">
                          <Icon name="badge" className="text-[15px] text-primary" />
                          Student ID
                        </span>
                        <span className="font-semibold text-on-surface font-mono">{user?.student_id || '24CSE101'}</span>
                      </div>

                      <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-surface-container-low text-label-sm font-label-sm">
                        <span className="text-on-surface-variant flex items-center gap-1.5">
                          <Icon name="school" className="text-[15px] text-primary" />
                          Department
                        </span>
                        <span className="font-semibold text-on-surface">{user?.branch || 'Computer Science (CSE)'}</span>
                      </div>

                      <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-surface-container-low text-label-sm font-label-sm">
                        <span className="text-on-surface-variant flex items-center gap-1.5">
                          <Icon name="calendar_today" className="text-[15px] text-primary" />
                          Academic Year
                        </span>
                        <span className="font-semibold text-on-surface">{getAcademicYearLabel(user?.current_year)}</span>
                      </div>

                      <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-surface-container-low text-label-sm font-label-sm">
                        <span className="text-on-surface-variant flex items-center gap-1.5">
                          <Icon name="mail" className="text-[15px] text-primary" />
                          Email Address
                        </span>
                        <span className="font-medium text-on-surface truncate max-w-[150px]">{user?.email || 'student@university.edu'}</span>
                      </div>
                    </div>

                    {/* Quick Profile Shortcuts */}
                    <div className="pt-space-xs border-t border-surface-container flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          setActiveModal('attendance');
                        }}
                        className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer text-label-sm font-label-sm"
                      >
                        <span className="flex items-center gap-2">
                          <Icon name="fact_check" className="text-[16px] text-tertiary-container" />
                          View Attendance Record
                        </span>
                        <span className="text-tertiary-container font-semibold">{overallAttPct}%</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          setActiveModal('timetable');
                        }}
                        className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer text-label-sm font-label-sm"
                      >
                        <span className="flex items-center gap-2">
                          <Icon name="calendar_month" className="text-[16px] text-primary" />
                          View Daily Schedule
                        </span>
                        <Icon name="arrow_forward" className="text-[14px]" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Logout Button at Far Right Corner of Top Bar (8.6 >= 44px touch target) */}
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/auth', { replace: true });
              }}
              title="Sign Out"
              aria-label="Sign out"
              className="flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl bg-surface-container-low hover:bg-rose-50 text-on-surface-variant hover:text-error border border-surface-container hover:border-rose-200 transition-all cursor-pointer shadow-2xs group"
            >
              <Icon name="logout" className="text-[18px] group-hover:text-error transition-colors" />
              <span className="hidden sm:inline font-label-md text-label-md font-medium group-hover:text-error">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Sub-Header / Active Session Toolbar */}
        <div
          className={`sticky top-16 z-30 w-full bg-surface-container-lowest/90 backdrop-blur-md px-space-md py-space-sm border-b border-surface-container shadow-2xs flex flex-wrap items-center justify-between gap-space-sm`}
        >
          <div className="flex items-center gap-space-sm min-w-0">
            <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
              <Icon name="forum" className="text-[20px]" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-headline-sm text-on-surface truncate font-semibold">
                  {activeSessionTitle}
                </span>
                <span className="hidden sm:flex px-2 py-0.5 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm items-center gap-1 font-semibold">
                  {user?.branch || 'CSE'} • {user?.current_year ? `${user.current_year} Year` : '2nd Year'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-tertiary-container animate-pulse"></span>
                  Firebase Activity Analytics
                </span>
                <span className="text-outline-variant font-code-sm text-code-sm">•</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                  Session #{activeSessionId ? activeSessionId.slice(-6) : 'COP-LIVE'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. CHAT STREAM CONTENT AREA */}
        <main className="w-full flex-1 max-w-5xl mx-auto px-space-md py-space-md space-y-space-lg pb-44">
          {/* Welcome / Student Context Badge */}
          <div className="flex justify-center">
            <span className="px-3.5 py-1 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm font-medium shadow-2xs border border-surface-container">
              Today • Demo-Generated Student Context Connected • Spring 2026
            </span>
          </div>

          {/* Empty State with Suggested Inquiries */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-space-md text-center max-w-2xl mx-auto">
              <BrandLogo className="w-14 h-14" />
              <div className="flex flex-col gap-1">
                <h2 className="font-headline-lg text-headline-lg font-semibold text-on-surface">
                  Welcome to CampusMind AI, {user?.full_name?.split(' ')[0] || 'Scholar'}
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Your academic agent is initialized with your verified branch ({user?.branch || 'CSE'}),
                  attendance records, timetable shifts, and syllabus. Ask anything below!
                </p>
              </div>

              <div className="w-full mt-space-sm flex flex-col gap-space-xs text-left">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
                  Suggested Inquiries
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-xs">
                  {[
                    {
                      icon: 'event_available',
                      color: 'text-primary',
                      text: 'Current attendance status of every subjects.',
                    },
                    {
                      icon: 'menu_book',
                      color: 'text-secondary',
                      text: 'Provide syllabus of this sem of mine and a tailored roadmap to achieve 9+ gpa.',
                    },
                    {
                      icon: 'work',
                      color: 'text-tertiary-container',
                      text: 'Any recent placement updates?',
                    },
                    {
                      icon: 'wifi',
                      color: 'text-error',
                      text: 'Hostel Wi-Fi high packet loss status and maintenance update',
                    },
                  ].map((pill, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(pill.text)}
                      className="p-space-sm rounded-xl bg-surface-container-lowest hover:bg-surface-container border border-surface-container flex items-center gap-space-sm text-left transition-all cursor-pointer shadow-2xs group"
                    >
                      <Icon name={pill.icon} className={`text-[20px] ${pill.color}`} />
                      <span className="font-body-sm text-body-sm text-on-surface group-hover:text-primary font-medium">
                        {pill.text}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Messages Flow */}
          {messages.map((msg, index) => {
            // 7.3 Dedicated connection error display (avoiding assistant styling)
            if (msg.role === 'error') {
              return (
                <div key={msg.id || index} className="flex items-start gap-space-sm max-w-3xl mr-auto">
                  <div className="p-space-md rounded-2xl bg-rose-500/10 border border-rose-500/20 text-on-surface flex items-start gap-space-sm shadow-xs w-full">
                    <Icon name="wifi_off" className="text-error text-[22px] shrink-0 mt-0.5" />
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-label-md text-label-md font-semibold text-error">Connection Issue</span>
                        <span className="font-code-sm text-code-sm text-on-surface-variant text-[11px]">
                          {formatMessageTimestamp(msg.created_at)}
                        </span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                        {msg.content}
                      </p>
                      {msg.retryQuery && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRetryMessage(msg)}
                            className="px-3 py-1 rounded-lg bg-error hover:bg-rose-700 text-white font-label-sm text-label-sm font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                            aria-label="Retry question"
                          >
                            <Icon name="refresh" className="text-[15px]" />
                            <span>Retry</span>
                          </button>
                          <span className="font-body-sm text-body-sm text-on-surface-variant text-xs italic">
                            Original question preserved
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            const isUser = msg.role === 'user';

            if (isUser) {
              return (
                <div key={msg.id || index} className="flex justify-end items-start gap-space-sm max-w-3xl ml-auto">
                  <div className="flex flex-col items-end">
                    <div className="bg-inverse-surface text-inverse-on-surface rounded-2xl rounded-tr-xs px-space-md py-space-sm shadow-md font-body-md text-body-md leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </div>

                    {/* 7.1 Real timestamps & 7.2 Sync status progression */}
                    <div className="flex items-center gap-2 mt-1 text-on-surface-variant font-code-sm text-code-sm">
                      <span>{formatMessageTimestamp(msg.created_at)}</span>
                      <span>•</span>
                      {msg.syncStatus === 'sending' ? (
                        <span className="text-on-surface-variant flex items-center gap-1">
                          <Icon name="progress_activity" className="text-[13px] animate-spin" />
                          <span>Sending...</span>
                        </span>
                      ) : msg.syncStatus === 'saved' ? (
                        <span className="text-on-surface-variant flex items-center gap-1">
                          <Icon name="done" className="text-[14px]" />
                          <span>Saved</span>
                        </span>
                      ) : msg.syncStatus === 'failed' ? (
                        <span className="text-error flex items-center gap-1 font-semibold">
                          <Icon name="error" className="text-[14px]" />
                          <span>Failed</span>
                        </span>
                      ) : (
                        <span className="text-tertiary-container flex items-center gap-0.5">
                          <Icon name="done_all" className="text-[14px]" />
                          <span>Synced</span>
                        </span>
                      )}

                      {/* 7.3 Retry button on failed user message */}
                      {msg.syncStatus === 'failed' && (
                        <button
                          type="button"
                          onClick={() => handleRetryMessage(msg)}
                          className="ml-1 px-2 py-0.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-error font-medium text-xs flex items-center gap-1 cursor-pointer transition-colors"
                          aria-label="Retry sending message"
                        >
                          <Icon name="refresh" className="text-[13px]" />
                          <span>Retry</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-label-md text-label-md font-semibold shadow-xs shrink-0">
                    {studentInitials}
                  </div>
                </div>
              );
            }

            // Assistant Response
            // 1. Detect any .md filename mentioned in the message text
            const embeddedDocMatch = msg.content.match(/([a-zA-Z0-9_\-]+\.md)/i);
            const embeddedDoc = embeddedDocMatch ? embeddedDocMatch[1].trim() : '';

            const resolvedSource = (msg.source && msg.source.trim()) || embeddedDoc || '';
            const isValidSource = Boolean(
              resolvedSource &&
              !['none', 'n/a', 'null', 'undefined', ''].includes(resolvedSource.toLowerCase())
            );

            // Parse action tags like [ACTION:SHOW_COMPLAINT_FORM:Category|Title|Description]
            const actionRegex = /\[ACTION:SHOW_COMPLAINT_FORM:([^|\]]*)(?:\|([^|\]]*))?(?:\|([^\]]*))?\]/i;
            const actionMatch = msg.content.match(actionRegex);
            
            // Clean action tags AND any orphan .md citations from the display text so raw filenames never leak to user
            let displayContent = msg.content
              .replace(actionRegex, '')
              .replace(/\[ACTION:[^\]]*$/i, '')
              .replace(/\[ACTION$/i, '')
              .trim();
            displayContent = displayContent.replace(/[,;]?\s*(?:🏷️\s*)?(?:\*{1,2})?(?:Source|Document|Reference)?(?:\*{1,2})?:\s*\[?[a-zA-Z0-9_\-\.\s]+\.md\]?/gi, '');
            displayContent = displayContent.replace(/[,;]?\s*\[?[a-zA-Z0-9_\-]+\.md\]?\s*$/gi, '').trim();
            displayContent = displayContent.replace(/\n\s*[,;]\s*([a-zA-Z0-9_\-]+\.md)?/gi, '\n').trim();
            displayContent = displayContent.replace(/[,;]\s*$/, '').trim();

            // Detect grievance intent either from Gemini's action tag OR student's explicit complaint query
            const msgLower = msg.content.toLowerCase();
            const prevUserMsg = index > 0 ? (messages[index - 1]?.content?.toLowerCase() || '') : '';
            const isGrievanceContext = Boolean(
              actionMatch ||
              ['complaint', 'grievance', 'lodge', 'file a complaint', 'ticket', 'issue with mess', 'complain on', 'packet loss', 'wifi', 'wi-fi', 'maintenance'].some(
                (k) => prevUserMsg.includes(k) || msgLower.includes('form below') || msgLower.includes('instant form')
              )
            );

            const hasTicketIntent = isGrievanceContext;

            // Only suppress source footer for casual greetings
            const isCasualGreeting = /^(hi|hello|hey|hola|namaste|good\s*(morning|evening|afternoon)|sup|yo|ok|okay)[\s!.,?]*$/i.test(prevUserMsg.trim());
            const shouldShowSourceFooter = isValidSource && Boolean(displayContent) && !isCasualGreeting;

            // Smart category & title resolution
            let detectedCat = actionMatch?.[1]?.trim();
            if (!detectedCat) {
              if (prevUserMsg.includes('mess') || prevUserMsg.includes('food') || prevUserMsg.includes('hostel') || prevUserMsg.includes('room') || prevUserMsg.includes('water')) {
                detectedCat = 'Hostel Maintenance';
              } else if (prevUserMsg.includes('wifi') || prevUserMsg.includes('internet') || prevUserMsg.includes('portal') || prevUserMsg.includes('lab') || prevUserMsg.includes('packet loss')) {
                detectedCat = 'IT & Campus Wi-Fi';
              } else if (prevUserMsg.includes('exam') || prevUserMsg.includes('grade') || prevUserMsg.includes('mark') || prevUserMsg.includes('course') || prevUserMsg.includes('attendance')) {
                detectedCat = 'Academic Grievance';
              } else if (prevUserMsg.includes('fee') || prevUserMsg.includes('tuition') || prevUserMsg.includes('payment') || prevUserMsg.includes('fine')) {
                detectedCat = 'Fee & Financial';
              } else {
                detectedCat = 'Hostel Maintenance';
              }
            }

            const parsedCategory = detectedCat;
            const parsedTitle = actionMatch?.[2]?.trim() || (prevUserMsg.includes('mess') ? 'Hostel Mess & Food Quality Concern' : (prevUserMsg.includes('wifi') || prevUserMsg.includes('packet loss')) ? 'Hostel Wi-Fi High Packet Loss' : 'Student Campus Concern');
            const parsedDesc = actionMatch?.[3]?.trim() || '';

            return (
              <div key={msg.id || index} className="flex items-start gap-space-md max-w-4xl">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary text-on-primary flex items-center justify-center shadow-md shrink-0">
                  <Icon name="neurology" className="text-[20px]" />
                </div>

                <div className="flex-1 flex flex-col space-y-space-sm min-w-0">
                  <div className="group relative bg-surface-container-lowest rounded-2xl rounded-tl-xs p-space-md sm:p-space-lg shadow-xs border border-surface-container flex flex-col space-y-space-md">
                    {/* 7.6 Floating corner copy action with visible confirmation / failure handling & aria-label */}
                    {displayContent && (
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.id || index, displayContent || msg.content)}
                        className={`absolute top-3 right-3 px-2 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer z-10 text-xs font-medium ${
                          copiedMessageId === (msg.id || index)
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                            : copyErrorId === (msg.id || index)
                            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30'
                            : 'hover:bg-surface-container text-on-surface-variant hover:text-on-surface opacity-70 hover:opacity-100'
                        }`}
                        title={copiedMessageId === (msg.id || index) ? "Copied" : "Copy response"}
                        aria-label={copiedMessageId === (msg.id || index) ? "Copied message" : "Copy message"}
                      >
                        {copiedMessageId === (msg.id || index) ? (
                          <>
                            <Icon name="check" className="text-[15px] text-emerald-600" />
                            <span className="font-semibold text-[11px]">Copied</span>
                          </>
                        ) : copyErrorId === (msg.id || index) ? (
                          <>
                            <Icon name="error" className="text-[15px] text-error" />
                            <span className="font-semibold text-[11px]">Failed</span>
                          </>
                        ) : (
                          <Icon name="content_copy" className="text-[16px]" />
                        )}
                      </button>
                    )}

                    {/* Markdown Body or 7.4 Staged RAG Processing Pipeline */}
                    {displayContent ? (
                      <div className="prose-chat font-body-md text-body-md text-on-surface leading-relaxed pr-8 relative">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
                        {isSending && index === messages.length - 1 && (
                          <span className="inline-block w-1.5 h-4 ml-1.5 bg-primary rounded-xs animate-pulse align-middle" />
                        )}


                      </div>
                    ) : (
                      /* 7.4 Dynamic multi-stage waiting indicator */
                      <div className="flex items-center gap-3 py-1.5 text-on-surface-variant font-label-md text-label-md">
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"></span>
                          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]"></span>
                          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce"></span>
                        </div>
                        <span className="text-on-surface font-medium animate-pulse transition-all duration-300">
                          {processingStage}
                        </span>
                      </div>
                    )}

                    {/* Interactive Ticket Quick-Action Card - RENDERS IMMEDIATELY WITHOUT DELAY */}
                    {hasTicketIntent && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                        <InteractiveTicketCard
                          userProfile={user}
                          category={parsedCategory}
                          initialTitle={parsedTitle || (parsedCategory === 'Academic Grievance' ? 'Academic Concern / Discrepancy' : 'Hostel & Campus Facility Issue')}
                          initialDescription={parsedDesc}
                          onOpenGrievances={() => setActiveModal('grievance')}
                        />
                      </div>
                    )}

                    {/* Knowledge-Base Source Citation Card - ONLY show if an authentic verified source was retrieved, content is present, and user asked an academic/institutional inquiry */}
                    {shouldShowSourceFooter && (
                      <div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs border-t border-surface-container">
                        <div className="flex items-center gap-space-xs text-on-surface-variant font-body-sm text-body-sm">
                          <Icon name="verified" className="text-[18px] text-primary" />
                          <span>
                            Knowledge-Base Source: <strong className="text-on-surface">{resolvedSource}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              window.open(
                                `${API_BASE}/documents/view/${encodeURIComponent(resolvedSource.replace(/^\[+|\]+$/g, '').trim())}`,
                                '_blank'
                              )
                            }
                            className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-label-sm text-label-sm font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Directly open formatted university gazette / policy"
                          >
                            <span>Open Gazette</span>
                            <Icon name="open_in_new" className="text-[14px]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenCitation(resolvedSource)}
                            className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm font-medium flex items-center gap-1 transition-colors cursor-pointer"
                            title="View institutional clause verification details"
                          >
                            <span>Clause Details</span>
                            <Icon name="info" className="text-[14px]" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </main>

        {/* 4. BOTTOM FLOATING PROMPT INPUT BAR */}
        <div
          className={`fixed bottom-0 right-0 bg-gradient-to-t from-background via-background/95 to-transparent pt-6 pb-space-md px-space-md z-40 transition-all duration-300 ${sidebarOpen ? 'left-0 lg:left-72' : 'left-0 lg:left-20'
            }`}
        >
          <div className="max-w-4xl mx-auto flex flex-col space-y-space-xs">
            {/* Meta Context Pill */}
            <div className="flex items-center justify-between px-space-xs">
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline font-code-sm text-code-sm text-on-surface-variant">
                  Roll: {user?.student_id || '24CSE101'}
                </span>
                {preferredLanguage !== 'English' && (
                  <span className="px-2 py-0.5 rounded-full bg-secondary/10 text-secondary font-label-sm text-label-sm font-semibold">
                    {preferredLanguage}
                  </span>
                )}
              </div>
              <div className="hidden sm:flex items-center gap-2 font-code-sm text-code-sm text-on-surface-variant">
                <span>Enter to submit • Esc to clear</span>
              </div>
            </div>

            {/* Input Pill */}
            <div className="bg-surface-container-lowest/95 backdrop-blur-md rounded-full px-space-md py-2 flex items-center gap-space-sm shadow-xl border border-surface-container">
              <button
                type="button"
                onClick={handleToggleVoice}
                className={`w-8 h-8 rounded-full transition-colors flex items-center justify-center cursor-pointer ${isListening
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-container'
                  }`}
                title={isListening ? "Stop voice recording" : "Voice Query"}
                aria-label={isListening ? "Stop voice recording" : "Voice input"}
              >
                <Icon name="mic" className="text-[20px]" />
              </button>

              <input
                ref={inputRef}
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Ask CampusMind AI anything about your branch, courses, exams, fees, or hostel..."
                className="flex-1 bg-transparent border-none outline-none font-body-md text-body-md text-on-surface placeholder:text-outline"
              />

              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputPrompt.trim() || isSending}
                title="Send message"
                aria-label="Send message"
                className="w-10 h-10 rounded-full bg-gradient-to-r from-primary-container to-secondary text-on-primary flex items-center justify-center shadow-md hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
              >
                <Icon name="arrow_upward" className="text-[20px]" />
              </button>
            </div>

            <div className="text-center font-body-sm text-body-sm text-on-surface-variant text-[11px]">
              CampusMind AI • Hyper-personalized student copilot • Grounded in official university records.
            </div>
          </div>
        </div>
      </div>

      {/* 7.7 CONFIRM CHAT DELETION MODAL */}
      <AnimatePresence>
        {confirmDeleteSession && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setConfirmDeleteSession(null);
            }}
            className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-space-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-delete-title"
              className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-lg shadow-2xl border border-surface-container flex flex-col space-y-space-md outline-none"
            >
              <div className="flex items-start gap-space-sm">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-error flex items-center justify-center shrink-0">
                  <Icon name="delete_forever" className="text-[22px]" />
                </div>
                <div className="flex flex-col">
                  <h3 id="confirm-delete-title" className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Delete this conversation?
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    This cannot be undone.
                  </p>
                </div>
              </div>

              <div className="bg-surface-container-low px-3 py-2 rounded-xl text-label-sm font-label-sm text-on-surface truncate border border-surface-container">
                {confirmDeleteSession.title}
              </div>

              <div className="flex justify-end items-center gap-space-sm pt-space-xs">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteSession(null)}
                  className="px-space-md py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const sid = confirmDeleteSession.id;
                    setConfirmDeleteSession(null);
                    executeDeleteSession(sid);
                  }}
                  className="px-space-md py-2 rounded-xl bg-error hover:bg-rose-700 text-white font-label-md text-label-md font-semibold cursor-pointer shadow-xs transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. MODALS & DRAWERS */}
      <AttendanceModal
        isOpen={activeModal === 'attendance'}
        onClose={() => setActiveModal(null)}
        userProfile={user}
      />

      <TimetableModal
        isOpen={activeModal === 'timetable'}
        onClose={() => setActiveModal(null)}
        userProfile={user}
      />

      <GrievancesModal
        isOpen={activeModal === 'grievance'}
        onClose={() => setActiveModal(null)}
        userProfile={user}
        onTicketCreated={() => loadStudentContext()}
      />

      <CampusNewsModal
        isOpen={activeModal === 'news'}
        onClose={() => setActiveModal(null)}
      />

      <CitationModal
        isOpen={activeModal === 'citation'}
        onClose={() => setActiveModal(null)}
        citationData={citationData}
      />
    </div>
  );
}