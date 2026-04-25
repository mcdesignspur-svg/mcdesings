// MC Designs site chatbot — floating bubble.
// Self-contained: injects its own styles + DOM, no deps.

(function () {
  if (window.__mcSiteChatLoaded) return;
  window.__mcSiteChatLoaded = true;

  const API_URL = '/api/site-chat';
  const STORAGE_SESSION = 'mc_site_chat_session';
  const STORAGE_HISTORY = 'mc_site_chat_history';
  const GREETING =
    '¡Hola! Soy el asistente de Miguel. Cuéntame brevemente de tu negocio o qué estás buscando y te ayudo a ver si MC Designs te sirve.';

  const css = `
    .mc-chat-bubble {
      position: fixed; right: 20px; bottom: 20px; z-index: 9999;
      width: 60px; height: 60px; border-radius: 50%;
      background: linear-gradient(135deg, #4DA6FF 0%, #2B7FE6 100%);
      color: white; border: none; cursor: pointer;
      box-shadow: 0 10px 30px rgba(77, 166, 255, 0.35), 0 4px 12px rgba(0,0,0,0.2);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .mc-chat-bubble:hover { transform: scale(1.06); box-shadow: 0 14px 38px rgba(77, 166, 255, 0.5); }
    .mc-chat-bubble:active { transform: scale(0.96); }
    .mc-chat-bubble svg { width: 26px; height: 26px; }
    .mc-chat-bubble .mc-dot {
      position: absolute; top: 6px; right: 6px; width: 12px; height: 12px;
      background: #10b981; border-radius: 50%; border: 2px solid #0B0D12;
    }

    .mc-chat-panel {
      position: fixed; right: 20px; bottom: 94px; z-index: 9999;
      width: min(380px, calc(100vw - 32px));
      height: min(560px, calc(100vh - 120px));
      background: #0B0D12; color: #F3F4F6;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 18px; overflow: hidden;
      display: none; flex-direction: column;
      box-shadow: 0 24px 60px rgba(0,0,0,0.5);
      font-family: 'Inter', system-ui, sans-serif;
      animation: mc-chat-slide 0.22s ease-out;
    }
    .mc-chat-panel.open { display: flex; }
    @keyframes mc-chat-slide {
      from { opacity: 0; transform: translateY(10px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .mc-chat-header {
      padding: 14px 16px; display: flex; align-items: center; gap: 12px;
      background: linear-gradient(180deg, rgba(77,166,255,0.1), transparent);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .mc-chat-avatar {
      width: 38px; height: 38px; border-radius: 50%;
      background: linear-gradient(135deg, #4DA6FF, #2B7FE6);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Anton', Impact, sans-serif; font-size: 18px; color: white;
    }
    .mc-chat-title { font-size: 14px; font-weight: 600; line-height: 1.2; }
    .mc-chat-subtitle { font-size: 11px; color: #8a94a6; display: flex; align-items: center; gap: 6px; margin-top: 2px; }
    .mc-chat-subtitle::before {
      content: ''; width: 6px; height: 6px; background: #10b981; border-radius: 50%;
    }
    .mc-chat-reset, .mc-chat-close {
      background: transparent; border: none; color: #8a94a6;
      cursor: pointer; padding: 6px; border-radius: 6px;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .mc-chat-reset { margin-left: auto; }
    .mc-chat-reset:hover, .mc-chat-close:hover { background: rgba(255,255,255,0.06); color: #F3F4F6; }

    .mc-chat-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .mc-chat-messages::-webkit-scrollbar { width: 6px; }
    .mc-chat-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }

    .mc-msg {
      max-width: 85%; padding: 10px 13px; border-radius: 14px;
      font-size: 14px; line-height: 1.45; word-wrap: break-word;
    }
    .mc-msg.user {
      align-self: flex-end; background: #4DA6FF; color: #0B0D12;
      border-bottom-right-radius: 4px;
    }
    .mc-msg.assistant {
      align-self: flex-start; background: #14171E; color: #F3F4F6;
      border-bottom-left-radius: 4px;
      border: 1px solid rgba(255,255,255,0.05);
    }
    .mc-msg.tool {
      align-self: center; font-size: 11px; color: #10b981;
      background: rgba(16,185,129,0.08); padding: 6px 10px; border-radius: 10px;
    }

    .mc-cta {
      align-self: flex-start; max-width: 85%;
      background: linear-gradient(135deg, #4DA6FF 0%, #2B7FE6 100%);
      color: #ffffff !important; text-decoration: none;
      padding: 10px 14px; border-radius: 12px; font-size: 13px; font-weight: 600;
      display: inline-block; transition: transform 0.15s, box-shadow 0.15s;
      box-shadow: 0 4px 14px rgba(77,166,255,0.25);
    }
    .mc-cta:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(77,166,255,0.4); }

    .mc-typing { display: inline-flex; gap: 3px; align-items: center; }
    .mc-typing span {
      width: 6px; height: 6px; background: #8a94a6; border-radius: 50%;
      animation: mc-typing 1.3s infinite;
    }
    .mc-typing span:nth-child(2) { animation-delay: 0.15s; }
    .mc-typing span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes mc-typing {
      0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
      30% { opacity: 1; transform: translateY(-3px); }
    }

    .mc-chat-input-wrap {
      padding: 12px; border-top: 1px solid rgba(255,255,255,0.06);
      display: flex; gap: 8px; align-items: flex-end;
    }
    .mc-chat-input {
      flex: 1; background: #14171E; color: #F3F4F6;
      border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
      padding: 10px 12px; font-size: 14px; font-family: inherit;
      resize: none; max-height: 100px; min-height: 40px;
      outline: none; transition: border-color 0.15s;
    }
    .mc-chat-input:focus { border-color: #4DA6FF; }
    .mc-chat-send {
      width: 40px; height: 40px; border-radius: 50%;
      background: #4DA6FF; color: #0B0D12; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s, transform 0.1s;
    }
    .mc-chat-send:hover:not(:disabled) { background: #6ab6ff; }
    .mc-chat-send:active:not(:disabled) { transform: scale(0.92); }
    .mc-chat-send:disabled { opacity: 0.4; cursor: not-allowed; }

    .mc-chat-footer {
      text-align: center; font-size: 10px; color: #5c6578;
      padding: 6px 0 10px; letter-spacing: 0.03em;
    }

    @media (max-width: 480px) {
      .mc-chat-panel {
        right: 10px; left: 10px; bottom: 84px;
        width: auto; height: calc(100vh - 100px);
      }
    }
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const bubble = document.createElement('button');
  bubble.className = 'mc-chat-bubble';
  bubble.setAttribute('aria-label', 'Abrir chat');
  bubble.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
    </svg>
    <span class="mc-dot"></span>
  `;

  const panel = document.createElement('div');
  panel.className = 'mc-chat-panel';
  panel.innerHTML = `
    <div class="mc-chat-header">
      <div class="mc-chat-avatar">M</div>
      <div>
        <div class="mc-chat-title">Miguel · MC Designs</div>
        <div class="mc-chat-subtitle">Usualmente responde rápido</div>
      </div>
      <button class="mc-chat-reset" aria-label="Nueva conversación" title="Empezar conversación nueva">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
      </button>
      <button class="mc-chat-close" aria-label="Cerrar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
    <div class="mc-chat-messages" id="mc-chat-messages"></div>
    <div class="mc-chat-input-wrap">
      <textarea class="mc-chat-input" id="mc-chat-input" rows="1" placeholder="Escribe un mensaje..."></textarea>
      <button class="mc-chat-send" id="mc-chat-send" aria-label="Enviar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
      </button>
    </div>
    <div class="mc-chat-footer">Powered by MC Designs · AI</div>
  `;

  document.body.appendChild(bubble);
  document.body.appendChild(panel);

  const messagesEl = panel.querySelector('#mc-chat-messages');
  const inputEl = panel.querySelector('#mc-chat-input');
  const sendEl = panel.querySelector('#mc-chat-send');
  const closeEl = panel.querySelector('.mc-chat-close');
  const resetEl = panel.querySelector('.mc-chat-reset');

  let history = [];
  let sessionId = null;
  let streaming = false;

  try {
    sessionId = localStorage.getItem(STORAGE_SESSION);
    const saved = localStorage.getItem(STORAGE_HISTORY);
    if (saved) history = JSON.parse(saved);
  } catch {}

  function saveState() {
    try {
      if (sessionId) localStorage.setItem(STORAGE_SESSION, sessionId);
      localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history.slice(-30)));
    } catch {}
  }

  function renderMessage(role, text, opts = {}) {
    const el = document.createElement('div');
    el.className = `mc-msg ${role}`;
    el.textContent = text;
    if (opts.id) el.id = opts.id;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }

  function renderTool(text) {
    const el = document.createElement('div');
    el.className = 'mc-msg tool';
    el.textContent = text;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }

  function renderCTA(label, url) {
    const a = document.createElement('a');
    a.className = 'mc-cta';
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = label + ' →';
    messagesEl.appendChild(a);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderTyping() {
    const el = document.createElement('div');
    el.className = 'mc-msg assistant';
    el.innerHTML = '<span class="mc-typing"><span></span><span></span><span></span></span>';
    el.id = 'mc-typing-indicator';
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }

  function hydrate() {
    messagesEl.innerHTML = '';
    if (history.length === 0) {
      renderMessage('assistant', GREETING);
    } else {
      for (const m of history) {
        if (typeof m.content === 'string') {
          renderMessage(m.role, m.content);
        }
      }
    }
  }

  function openPanel() {
    panel.classList.add('open');
    bubble.style.display = 'none';
    if (messagesEl.childNodes.length === 0) hydrate();
    setTimeout(() => inputEl.focus(), 100);
  }

  function closePanel() {
    panel.classList.remove('open');
    bubble.style.display = 'flex';
  }

  function resetConversation() {
    if (streaming) return;
    history = [];
    sessionId = null;
    try {
      localStorage.removeItem(STORAGE_HISTORY);
      localStorage.removeItem(STORAGE_SESSION);
    } catch {}
    hydrate();
    inputEl.focus();
  }

  bubble.addEventListener('click', openPanel);
  closeEl.addEventListener('click', closePanel);
  resetEl.addEventListener('click', resetConversation);

  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + 'px';
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  sendEl.addEventListener('click', send);

  async function send() {
    if (streaming) return;
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    inputEl.style.height = 'auto';

    history.push({ role: 'user', content: text });
    renderMessage('user', text);
    saveState();

    streaming = true;
    sendEl.disabled = true;
    const typingEl = renderTyping();
    let assistantEl = null;
    let assistantText = '';
    let pendingCTA = null;        // {label, url} — rendered on 'done'
    const savingIndicators = [];  // tool indicator elements, may be removed

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          messages: history,
          context: {
            referrer: document.referrer || null,
            page: window.location.pathname,
            utm_source: new URLSearchParams(window.location.search).get('utm_source'),
            utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign'),
          },
        }),
      });

      if (res.status === 429) {
        let body = {};
        try { body = await res.json(); } catch {}
        typingEl.remove();
        renderMessage('assistant', body.error || 'Estás escribiendo muy rápido — espera un ratito.');
        return;
      }
      if (!res.ok || !res.body) throw new Error('network');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const raw of events) {
          const lines = raw.split('\n');
          let event = 'message';
          let data = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) event = line.slice(7).trim();
            else if (line.startsWith('data: ')) data += line.slice(6);
          }
          if (!data) continue;
          let payload;
          try { payload = JSON.parse(data); } catch { continue; }

          if (event === 'session') {
            sessionId = payload.session_id;
            saveState();
          } else if (event === 'text') {
            if (!assistantEl) {
              typingEl.remove();
              assistantEl = renderMessage('assistant', '');
            }
            assistantText += payload.delta;
            assistantEl.textContent = assistantText;
            messagesEl.scrollTop = messagesEl.scrollHeight;
          } else if (event === 'tool_use') {
            if (payload.tool === 'save_lead') savingIndicators.push(renderTool('Guardando tu info...'));
            else if (payload.tool === 'schedule_discovery_call') savingIndicators.push(renderTool('Agendando discovery call...'));
          } else if (event === 'tool_result') {
            if (payload.tool === 'save_lead' && payload.result?.ok) {
              if (payload.result.already_saved) {
                // Lead was already saved earlier — drop the redundant indicator.
                const last = savingIndicators.pop();
                if (last) last.remove();
              } else {
                renderTool('✓ Miguel recibió tu info');
              }
            } else if (payload.tool === 'schedule_discovery_call' && payload.result?.ok) {
              if (payload.result.booking_url) {
                // Defer the CTA so it appears AFTER the assistant's closing text.
                pendingCTA = { label: 'Reservar slot ahora', url: payload.result.booking_url };
              } else {
                renderTool('✓ Miguel te escribe en las próximas horas');
              }
            }
          } else if (event === 'error') {
            typingEl.remove();
            const msg = payload.message || 'Hubo un error. Intenta otra vez.';
            renderMessage('assistant', payload.detail ? `${msg}\n\n[debug: ${payload.detail}]` : msg);
          } else if (event === 'done') {
            if (!assistantEl) typingEl.remove();
            if (pendingCTA) {
              renderCTA(pendingCTA.label, pendingCTA.url);
              pendingCTA = null;
            }
          }
        }
      }

      if (assistantText) {
        history.push({ role: 'assistant', content: assistantText });
        saveState();
      }
    } catch (err) {
      typingEl.remove();
      renderMessage('assistant', 'Perdí la conexión. Intenta otra vez en un momentito.');
    } finally {
      streaming = false;
      sendEl.disabled = false;
      inputEl.focus();
    }
  }
})();
