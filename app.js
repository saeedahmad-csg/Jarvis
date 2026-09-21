/* ==========================================
   JARVIS — Application Logic
   ========================================== */

const CONFIG = {
  API_KEY: CONFIG_API_KEY,
  API_URL: 'https://generativelanguage.googleapis.com/v1beta/interactions',
  MODEL: 'gemini-3.5-flash-lite',
  SYSTEM_INSTRUCTION: `You are JARVIS (Just A Rather Very Intelligent System), an advanced AI assistant inspired by Tony Stark's AI from the Marvel universe.

Personality traits:
- Polite, professional, and slightly witty — like a refined British butler with cutting-edge intelligence
- Address the user respectfully (occasionally say "Sir" or "Ma'am" naturally, not excessively)
- Confident and knowledgeable, but not arrogant
- Concise when possible, detailed when necessary
- You can use dry humor when appropriate

Response style:
- Use markdown formatting for clarity (headers, lists, code blocks, bold, etc.)
- For code, always specify the language in fenced code blocks
- Break complex explanations into clear sections
- Keep responses focused and well-structured`
};

// ==========================================
// State
// ==========================================
const state = {
  previousInteractionId: null,
  isProcessing: false,
  messages: []
};

// ==========================================
// DOM References
// ==========================================
const dom = {
  chatArea: document.getElementById('chatArea'),
  messagesContainer: document.getElementById('messagesContainer'),
  welcomeScreen: document.getElementById('welcomeScreen'),
  messageInput: document.getElementById('messageInput'),
  sendBtn: document.getElementById('sendBtn'),
  newChatBtn: document.getElementById('newChatBtn'),
  statusIndicator: document.getElementById('statusIndicator'),
  statusText: document.querySelector('.status-text'),
  greeting: document.getElementById('greeting'),
  suggestionChips: document.getElementById('suggestionChips')
};

// ==========================================
// Initialization
// ==========================================
function init() {
  setGreeting();
  setupEventListeners();
  dom.messageInput.focus();
}

function setGreeting() {
  const hour = new Date().getHours();
  let greeting;
  if (hour < 12) greeting = 'Morning';
  else if (hour < 17) greeting = 'Afternoon';
  else greeting = 'Evening';
  dom.greeting.textContent = greeting;
}

// ==========================================
// Event Listeners
// ==========================================
function setupEventListeners() {
  // Send message
  dom.sendBtn.addEventListener('click', sendMessage);

  // Input handling
  dom.messageInput.addEventListener('input', handleInput);
  dom.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // New chat
  dom.newChatBtn.addEventListener('click', startNewChat);

  // Suggestion chips
  dom.suggestionChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) {
      dom.messageInput.value = chip.dataset.prompt;
      handleInput();
      sendMessage();
    }
  });
}

function handleInput() {
  // Auto-resize textarea
  dom.messageInput.style.height = 'auto';
  dom.messageInput.style.height = Math.min(dom.messageInput.scrollHeight, 150) + 'px';

  // Toggle send button
  dom.sendBtn.disabled = !dom.messageInput.value.trim() || state.isProcessing;
}

// ==========================================
// Chat Management
// ==========================================
function startNewChat() {
  state.previousInteractionId = null;
  state.messages = [];
  dom.messagesContainer.innerHTML = '';
  dom.welcomeScreen.classList.remove('hidden');
  setStatus('online');
  dom.messageInput.focus();
}

async function sendMessage() {
  const text = dom.messageInput.value.trim();
  if (!text || state.isProcessing) return;

  // Hide welcome screen
  dom.welcomeScreen.classList.add('hidden');

  // Clear input
  dom.messageInput.value = '';
  dom.messageInput.style.height = 'auto';
  dom.sendBtn.disabled = true;

  // Add user message
  addMessage('user', text);
  state.messages.push({ role: 'user', content: text });

  // Process with AI
  await getJarvisResponse(text);
}

// ==========================================
// Message Rendering
// ==========================================
function addMessage(role, content, isStreaming = false) {
  const messageEl = document.createElement('div');
  messageEl.className = `message ${role}`;
  messageEl.id = `msg-${Date.now()}`;

  const avatarText = role === 'user' ? 'YOU' : 'J';
  const labelText = role === 'user' ? 'You' : 'JARVIS';

  messageEl.innerHTML = `
    <div class="message-avatar">${avatarText}</div>
    <div class="message-content">
      <div class="message-label">${labelText}</div>
      <div class="message-bubble">
        ${role === 'jarvis' && isStreaming ? '' : renderMarkdown(content)}
        ${isStreaming ? '<span class="typing-cursor"></span>' : ''}
      </div>
    </div>
  `;

  dom.messagesContainer.appendChild(messageEl);
  scrollToBottom();

  return messageEl;
}

function addThinkingMessage() {
  const messageEl = document.createElement('div');
  messageEl.className = 'message jarvis';
  messageEl.id = 'thinking-msg';

  messageEl.innerHTML = `
    <div class="message-avatar">J</div>
    <div class="message-content">
      <div class="message-label">JARVIS</div>
      <div class="thinking-indicator">
        <div class="thinking-dots">
          <span></span><span></span><span></span>
        </div>
        PROCESSING
      </div>
      <div class="message-bubble" style="display:none;"></div>
    </div>
  `;

  dom.messagesContainer.appendChild(messageEl);
  scrollToBottom();
  return messageEl;
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    dom.chatArea.scrollTop = dom.chatArea.scrollHeight;
  });
}

// ==========================================
// Gemini API — Streaming via SSE
// ==========================================
async function getJarvisResponse(userMessage) {
  state.isProcessing = true;
  setStatus('processing');

  const thinkingEl = addThinkingMessage();
  const bubbleEl = thinkingEl.querySelector('.message-bubble');
  const thinkingIndicator = thinkingEl.querySelector('.thinking-indicator');

  let fullText = '';

  try {
    const body = {
      model: CONFIG.MODEL,
      system_instruction: CONFIG.SYSTEM_INSTRUCTION,
      input: userMessage,
      stream: true,
      generation_config: {
        thinking_level: 'minimal'
      }
    };

    if (state.previousInteractionId) {
      body.previous_interaction_id = state.previousInteractionId;
    }

    const response = await fetch(`${CONFIG.API_URL}?alt=sse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': CONFIG.API_KEY
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API Error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let interactionId = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process SSE lines
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const event = JSON.parse(jsonStr);

            // Capture interaction ID
            if (event.id && !interactionId) {
              interactionId = event.id;
            }

            // Handle text deltas
            if (event.event_type === 'step.delta' && event.delta) {
              if (event.delta.type === 'text' && event.delta.text) {
                // Hide thinking indicator on first text
                if (!fullText) {
                  thinkingIndicator.style.display = 'none';
                  bubbleEl.style.display = '';
                }

                fullText += event.delta.text;
                bubbleEl.innerHTML = renderMarkdown(fullText) + '<span class="typing-cursor"></span>';
                scrollToBottom();
              }
            }

            // Handle completion
            if (event.event_type === 'interaction.completed') {
              if (event.id) interactionId = event.id;
            }
          } catch (parseErr) {
            // Skip malformed JSON chunks
          }
        }
      }
    }

    // Finalize
    if (interactionId) {
      state.previousInteractionId = interactionId;
    }

    // Remove cursor and finalize markdown
    bubbleEl.innerHTML = renderMarkdown(fullText);
    addCopyButtons(bubbleEl);

    state.messages.push({ role: 'jarvis', content: fullText });

  } catch (error) {
    console.error('Jarvis error:', error);

    // Show error in thinking message
    thinkingIndicator.style.display = 'none';
    bubbleEl.style.display = '';
    bubbleEl.classList.add('message-error');
    bubbleEl.innerHTML = `<span class="error-text">⚠ I apologize, Sir. I've encountered an issue: ${escapeHtml(error.message)}</span>`;
  } finally {
    state.isProcessing = false;
    setStatus('online');
    dom.sendBtn.disabled = !dom.messageInput.value.trim();
    dom.messageInput.focus();
  }
}

// ==========================================
// Status Management
// ==========================================
function setStatus(status) {
  const indicator = dom.statusIndicator;
  const text = dom.statusText;

  indicator.classList.remove('processing');

  if (status === 'processing') {
    indicator.classList.add('processing');
    text.textContent = 'PROCESSING';
  } else {
    text.textContent = 'ONLINE';
  }
}

// ==========================================
// Markdown Renderer (lightweight)
// ==========================================
function renderMarkdown(text) {
  if (!text) return '';

  let html = escapeHtml(text);

  // Code blocks with language
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const langLabel = lang ? `<span style="position:absolute;top:6px;left:10px;font-size:0.65rem;color:var(--color-text-muted);font-family:var(--font-mono);letter-spacing:1px;text-transform:uppercase;">${lang}</span>` : '';
    return `<div class="code-block-wrapper"><pre>${langLabel}<code>${code.trim()}</code></pre></div>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers (## before #)
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold & italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Blockquote
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr>');

  // Unordered lists
  html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Tables
  html = html.replace(/^(\|.+\|)\n(\|[\-\s|:]+\|)\n((?:\|.+\|\n?)+)/gm, (_, header, sep, body) => {
    const headers = header.split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
    const rows = body.trim().split('\n').map(row => {
      const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
  });

  // Paragraphs — wrap loose text in <p> tags
  html = html.replace(/\n\n/g, '</p><p>');

  // Line breaks
  html = html.replace(/\n/g, '<br>');

  // Wrap in paragraph if needed
  if (!html.startsWith('<')) {
    html = '<p>' + html + '</p>';
  }

  return html;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==========================================
// Copy Button for Code Blocks
// ==========================================
function addCopyButtons(container) {
  container.querySelectorAll('.code-block-wrapper').forEach(wrapper => {
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.innerHTML = '⎘ Copy';
    btn.addEventListener('click', () => {
      const code = wrapper.querySelector('code').textContent;
      navigator.clipboard.writeText(code).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = '✓ Copied';
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = '⎘ Copy';
        }, 2000);
      });
    });
    wrapper.appendChild(btn);
  });
}

// ==========================================
// Start
// ==========================================
document.addEventListener('DOMContentLoaded', init);
