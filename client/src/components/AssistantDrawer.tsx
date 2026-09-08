import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  action?: 'REQUEST_LOCATION' | 'SHOW_NEARBY' | 'CONFIRM_JOB' | 'JOB_CREATED' | 'JOB_STATUS' | 'JOB_CANCELLED';
  data?: any;
  quickReplies?: string[];
}

interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_W = 420;
const DEFAULT_H = 620;
const MIN_W = 320;
const MIN_H = 400;
const STORAGE_KEY = 'fixitnow_chat_window';

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function loadWindowState(): WindowState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  // Default: bottom-right corner
  return {
    x: window.innerWidth - DEFAULT_W - 20,
    y: window.innerHeight - DEFAULT_H - 20,
    width: DEFAULT_W,
    height: DEFAULT_H,
  };
}

function saveWindowState(state: WindowState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

const AssistantDrawer: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<any>({});

  const [winState, setWinState] = useState<WindowState>(loadWindowState);
  const preMaxState = useRef<WindowState | null>(null);

  const dragging = useRef(false);
  const resizing = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const bodyRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Persist window position/size
  useEffect(() => {
    if (!maximized) saveWindowState(winState);
  }, [winState, maximized]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Welcome message
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          text: "👋 Hi! Welcome to **FixItNow**.\n\nTell me what home service or repair you need, and I'll help you find a suitable professional nearby.",
          quickReplies: [
            '🔧 Leaking pipe or tap',
            '⚡ Sparking electrical switch',
            '❄️ AC not cooling',
            '🧹 Deep home cleaning',
            '📋 Check my order status',
          ],
        },
      ]);
    }
  }, [open, messages.length]);

  // ── Drag logic ────────────────────────────────────────────────────────────
  const onDragStart = useCallback((e: React.MouseEvent) => {
    if (maximized) return;
    dragging.current = true;
    dragOffset.current = { x: e.clientX - winState.x, y: e.clientY - winState.y };
    e.preventDefault();
  }, [maximized, winState]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (dragging.current) {
        const x = clamp(e.clientX - dragOffset.current.x, 0, window.innerWidth - winState.width);
        const y = clamp(e.clientY - dragOffset.current.y, 0, window.innerHeight - 40);
        setWinState((prev) => ({ ...prev, x, y }));
      }
      if (resizing.current) {
        const newW = clamp(resizeStart.current.w + (e.clientX - resizeStart.current.x), MIN_W, window.innerWidth - winState.x);
        const newH = clamp(resizeStart.current.h + (e.clientY - resizeStart.current.y), MIN_H, window.innerHeight - winState.y);
        setWinState((prev) => ({ ...prev, width: newW, height: newH }));
      }
    };
    const onMouseUp = () => {
      dragging.current = false;
      resizing.current = false;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [winState.x, winState.y, winState.width]);

  // ── Resize logic ───────────────────────────────────────────────────────────
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    if (maximized) return;
    resizing.current = true;
    resizeStart.current = { x: e.clientX, y: e.clientY, w: winState.width, h: winState.height };
    e.preventDefault();
    e.stopPropagation();
  }, [maximized, winState]);

  // ── Maximize / restore ────────────────────────────────────────────────────
  const toggleMaximize = () => {
    if (!maximized) {
      preMaxState.current = winState;
      setMaximized(true);
    } else {
      if (preMaxState.current) setWinState(preMaxState.current);
      setMaximized(false);
    }
  };

  // ── API call ──────────────────────────────────────────────────────────────
  const postMessage = async (msg: string, extra?: { locationUpdate?: any }) => {
    if (loading) return;
    setMessages((prev) => [...prev, { role: 'user', text: msg }]);
    setLoading(true);

    const payload: any = { message: msg, context };
    if (extra?.locationUpdate) payload.locationUpdate = extra.locationUpdate;

    try {
      const data = await api.post<any>('/api/assistant/chat', payload);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.message || '',
          action: data.action,
          data: data.data,
          quickReplies: data.quickReplies || [],
        },
      ]);
      if (data.context) setContext(data.context);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: '⚠️ Connection issue. Please try again.',
          quickReplies: ['Try Again'],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const requestGpsLocation = () => {
    if (!navigator.geolocation) {
      postMessage('My location: Bengaluru, Karnataka');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          address: `GPS (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`,
        };
        postMessage('📍 Shared my current location', { locationUpdate: location });
      },
      () => {
        setLoading(false);
        postMessage('Puducherry, Grand Bazaar');
      },
      { timeout: 8000 }
    );
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    postMessage(trimmed);
    setInput('');
  };

  const handleQuickReply = (text: string) => {
    if (text.includes('Share My') || text.includes('Share Location') || text.startsWith('📍')) {
      requestGpsLocation();
    } else {
      postMessage(text);
    }
  };

  const renderText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <span key={i} className="block min-h-[1.2rem]">
          {parts.map((p, idx) => {
            if (p.startsWith('**') && p.endsWith('**')) {
              return <strong key={idx} className="font-semibold text-slate-900">{p.slice(2, -2)}</strong>;
            }
            return p;
          })}
        </span>
      );
    });
  };

  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');

  // ── Computed window style ─────────────────────────────────────────────────
  const windowStyle: React.CSSProperties = maximized
    ? { position: 'fixed', inset: 0, width: '100vw', height: '100vh', borderRadius: 0 }
    : {
        position: 'fixed',
        left: winState.x,
        top: winState.y,
        width: winState.width,
        height: winState.height,
        borderRadius: '1.5rem',
        // On mobile, force full-width bottom sheet
      };

  return (
    <>
      {/* Floating Trigger Button — visible when closed or minimized */}
      {(!open || minimized) && (
        <button
          onClick={() => { setOpen(true); setMinimized(false); }}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-600 to-teal-500 px-4 py-3 text-white font-semibold shadow-xl shadow-teal-700/20 hover:scale-105 active:scale-95 transition-all duration-200"
          aria-label="Open FixItNow Service Assistant"
        >
          <span className="text-xl">✨</span>
          <span className="text-sm font-bold tracking-tight hidden sm:inline">FixItNow</span>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-200 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
          </span>
        </button>
      )}

      {/* Floating Window */}
      {open && !minimized && (
        <div
          style={{ ...windowStyle, zIndex: 50 }}
          className="bg-white shadow-2xl border border-slate-100 flex flex-col overflow-hidden
                     max-sm:!left-0 max-sm:!top-auto max-sm:!bottom-0 max-sm:!w-full max-sm:!h-[85vh] max-sm:!rounded-t-3xl max-sm:!rounded-b-none"
        >
          {/* ── Header (drag handle) ─────────────────────────────────────── */}
          <div
            onMouseDown={onDragStart}
            className={`flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 text-white ${maximized ? '' : 'cursor-grab active:cursor-grabbing'} select-none`}
            style={{ borderRadius: maximized ? '0' : '1.5rem 1.5rem 0 0' }}
          >
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-500/20 border border-teal-400/30 text-teal-300 text-lg shrink-0">
                ⚡
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold tracking-tight text-white">
                  FixItNow Service Assistant
                </h2>
                <p className="text-[11px] text-slate-300 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                  Ready to help with repairs &amp; bookings
                </p>
              </div>
            </div>

            {/* Window controls */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Minimize */}
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setMinimized(true)}
                title="Minimise"
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition text-sm"
              >
                —
              </button>
              {/* Maximise / Restore */}
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={toggleMaximize}
                title={maximized ? 'Restore' : 'Maximise'}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition text-xs"
              >
                {maximized ? '⧉' : '⬜'}
              </button>
              {/* Close */}
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => { setOpen(false); setMaximized(false); }}
                title="Close"
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:text-white hover:bg-rose-500/80 transition text-sm"
              >
                ✕
              </button>
            </div>
          </div>

          {/* ── Chat body ────────────────────────────────────────────────── */}
          <div ref={bodyRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs ${
                    msg.role === 'user'
                      ? 'bg-teal-600 text-white rounded-tr-xs'
                      : 'bg-white border border-slate-200/70 text-slate-700 rounded-tl-xs'
                  }`}
                >
                  {renderText(msg.text)}

                  {/* Location request card */}
                  {msg.action === 'REQUEST_LOCATION' && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100">
                      <button
                        onClick={requestGpsLocation}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-50 border border-teal-200/80 px-3 py-2 text-xs font-bold text-teal-700 hover:bg-teal-100 transition shadow-xs"
                      >
                        <span>📍</span> Share My Location
                      </button>
                    </div>
                  )}

                  {/* Confirmation card */}
                  {msg.action === 'CONFIRM_JOB' && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2">
                      {msg.data?.specialists && msg.data.specialists.length > 0 && (
                        <div className="space-y-1.5 mb-2">
                          <p className="text-[11px] font-bold text-slate-800">Available Nearby Professionals:</p>
                          {msg.data.specialists.map((sp: any, i: number) => (
                            <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-[11px] border border-slate-100">
                              <div>
                                <p className="font-bold text-slate-800">{sp.name}</p>
                                <p className="text-[10px] text-slate-500">★ {sp.avgRating?.toFixed(1) || '5.0'} • {sp.distanceKm ? `${sp.distanceKm.toFixed(1)} km away` : 'Nearby'}</p>
                              </div>
                              <span className="font-bold text-teal-700 text-[11px]">₹{sp.hourlyRate || 500}/hr</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => postMessage('Confirm Service Request')}
                        className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 px-3 py-2 text-xs font-bold text-white transition shadow-sm"
                      >
                        <span>✓</span> Confirm Service Request
                      </button>
                    </div>
                  )}

                  {/* Job created card */}
                  {msg.action === 'JOB_CREATED' && msg.data?.bookingId && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2">
                      <div className="rounded-xl bg-teal-50 border border-teal-200 p-2.5 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-teal-800">Booking Reference</p>
                        <p className="text-base font-extrabold text-teal-900 tracking-wider font-mono">
                          {msg.data.bookingCode || `#${msg.data.bookingId.slice(-6).toUpperCase()}`}
                        </p>
                      </div>
                      <button
                        onClick={() => { setOpen(false); navigate(`/track/${msg.data.bookingId}`); }}
                        className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 px-3 py-2 text-xs font-bold text-white transition shadow-sm"
                      >
                        <span>🗺️</span> Track Service
                      </button>
                    </div>
                  )}

                  {/* Job status card */}
                  {msg.action === 'JOB_STATUS' && msg.data?.bookingId && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2">
                      <button
                        onClick={() => { setOpen(false); navigate(`/track/${msg.data.bookingId}`); }}
                        className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 px-3 py-2 text-xs font-bold text-white transition shadow-sm"
                      >
                        <span>🗺️</span> Track Service
                      </button>
                      {msg.data.canCancel && (
                        <button
                          onClick={() => postMessage(`Cancel order ${msg.data.bookingCode || msg.data.bookingId}`)}
                          className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200 hover:bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700 transition"
                        >
                          <span>✕</span> Cancel This Booking
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-slate-500 text-xs px-2 py-1">
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-teal-500 animate-bounce"></span>
                  <span className="h-2 w-2 rounded-full bg-teal-500 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="h-2 w-2 rounded-full bg-teal-500 animate-bounce [animation-delay:0.4s]"></span>
                </div>
                <span className="text-[11px]">Finding your service…</span>
              </div>
            )}
          </div>

          {/* Quick-reply chips */}
          {lastAssistantMsg?.quickReplies && lastAssistantMsg.quickReplies.length > 0 && !loading && (
            <div className="px-4 py-2 border-t border-slate-100 bg-white flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {lastAssistantMsg.quickReplies.map((qr, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickReply(qr)}
                  className="rounded-full bg-slate-100 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 border border-slate-200/60 px-3 py-1 text-[11px] font-medium text-slate-700 transition"
                >
                  {qr}
                </button>
              ))}
            </div>
          )}

          {/* Input bar */}
          <div className="p-3 border-t border-slate-100 bg-white flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Describe your issue (e.g. leaking sink)…"
              disabled={loading}
              className="flex-1 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition"
            >
              Send
            </button>
          </div>

          {/* ── Resize handle (bottom-right corner) ──────────────────────── */}
          {!maximized && (
            <div
              onMouseDown={onResizeStart}
              className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize flex items-end justify-end p-1 max-sm:hidden"
              title="Resize"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default AssistantDrawer;
