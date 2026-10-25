/**
 * API client service for CampusMind AI.
 * Handles authentication headers, token storage, and backend communication.
 */

const rawBase = (import.meta.env.VITE_API_BASE || '').trim().replace(/\/+$/, '');
export const API_BASE = rawBase ? (rawBase.endsWith('/api') ? rawBase : `${rawBase}/api`) : '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('campusmind_token');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 55000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('Connection timed out. The server may be waking up, please try again.');
      timeoutErr.status = 408;
      throw timeoutErr;
    }
    throw err;
  }
}

async function parseResponse(res, defaultErrorMsg = 'Request failed') {
  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    const message = (data && data.detail) || res.statusText || defaultErrorMsg;
    const error = new Error(typeof message === 'string' ? message : JSON.stringify(message));
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  // Authentication
  async register(userData) {
    const res = await fetchWithTimeout(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    return parseResponse(res, 'Registration failed');
  },

  async login(credentials) {
    const res = await fetchWithTimeout(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    return parseResponse(res, 'Login failed');
  },

  async getProfile() {
    const res = await fetchWithTimeout(`${API_BASE}/user/profile`, {
      headers: getAuthHeaders(),
    });
    return parseResponse(res, 'Failed to fetch profile');
  },

  // Chat & RAG
  async sendMessage(message, preferredLanguage = null, sessionId = null) {
    const res = await fetchWithTimeout(`${API_BASE}/chat`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        message,
        preferred_language: preferredLanguage,
        session_id: sessionId,
      }),
    });
    return parseResponse(res, 'Failed to send message');
  },

  async sendMessageStream(message, preferredLanguage = null, sessionId = null, onToken = null, onDone = null) {
    const res = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        message,
        preferred_language: preferredLanguage,
        session_id: sessionId,
      }),
    });

    if (!res.ok) {
      let data;
      try { data = await res.json(); } catch { data = {}; }
      const err = new Error(data.detail || res.statusText || 'Streaming request failed');
      err.status = res.status;
      throw err;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedText = '';
    let finalDoneData = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          let event;
          try {
            event = JSON.parse(trimmed.slice(6));
          } catch (pe) {
            console.debug('SSE parse notice:', pe);
            continue;
          }

          if (event.type === 'token') {
            accumulatedText += event.token;
            if (onToken) onToken(event.token, accumulatedText);
          } else if (event.type === 'done') {
            finalDoneData = event;
            if (onDone) onDone(event);
          } else if (event.type === 'error') {
            throw new Error(event.detail || 'Streaming error');
          }
        }
      }
    }

    return finalDoneData || { answer: accumulatedText };
  },

  async getChatSessions() {
    const res = await fetchWithTimeout(`${API_BASE}/chat/sessions`, {
      headers: getAuthHeaders(),
    });
    return parseResponse(res, 'Failed to fetch chat sessions');
  },

  async createChatSession(title = 'New Chat') {
    const res = await fetchWithTimeout(`${API_BASE}/chat/sessions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title }),
    });
    return parseResponse(res, 'Failed to create chat session');
  },

  async getSessionMessages(sessionId) {
    const res = await fetchWithTimeout(`${API_BASE}/chat/sessions/${sessionId}/messages`, {
      headers: getAuthHeaders(),
    });
    return parseResponse(res, 'Failed to fetch session messages');
  },

  async deleteChatSession(sessionId) {
    const res = await fetchWithTimeout(`${API_BASE}/chat/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return parseResponse(res, 'Failed to delete chat session');
  },

  async getChatHistory() {
    const res = await fetchWithTimeout(`${API_BASE}/chat/history`, {
      headers: getAuthHeaders(),
    });
    return parseResponse(res, 'Failed to fetch chat history');
  },

  async clearChatHistory() {
    const res = await fetchWithTimeout(`${API_BASE}/chat/history`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return parseResponse(res, 'Failed to clear chat history');
  },

  // Tickets & Grievance Actions
  async createTicket(ticketData) {
    const res = await fetchWithTimeout(`${API_BASE}/tickets/create`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(ticketData),
    });
    return parseResponse(res, 'Failed to create ticket');
  },

  async getMyTickets() {
    const res = await fetchWithTimeout(`${API_BASE}/tickets/my-tickets`, {
      headers: getAuthHeaders(),
    });
    return parseResponse(res, 'Failed to fetch tickets');
  },

  getTickets() {
    return this.getMyTickets();
  },

  // Dynamic Student Endpoints
  async getAttendance() {
    const res = await fetchWithTimeout(`${API_BASE}/student/attendance`, {
      headers: getAuthHeaders(),
    });
    return parseResponse(res, 'Failed to fetch attendance');
  },

  async getCourses() {
    const res = await fetchWithTimeout(`${API_BASE}/student/courses`, {
      headers: getAuthHeaders(),
    });
    return parseResponse(res, 'Failed to fetch courses');
  },

  async getNews() {
    const res = await fetchWithTimeout(`${API_BASE}/student/news`, {
      headers: getAuthHeaders(),
    });
    return parseResponse(res, 'Failed to fetch news');
  },

  async getTimetable() {
    const res = await fetchWithTimeout(`${API_BASE}/student/timetable`, {
      headers: getAuthHeaders(),
    });
    return parseResponse(res, 'Failed to fetch timetable');
  },

  async getFirebaseStatus() {
    const res = await fetchWithTimeout(`${API_BASE}/firebase/status`);
    return parseResponse(res, 'Failed to fetch Firebase status');
  },
};
