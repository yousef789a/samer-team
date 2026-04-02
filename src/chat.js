export function initChat() {
  if (document.getElementById('chat-toggle-btn')) return; // Already initialized

  const chatHTML = `
    <button id="chat-toggle-btn" style="position: fixed; bottom: 20px; right: 20px; width: 50px; height: 50px; border-radius: 50%; background: var(--primary); color: var(--bg); border: none; font-size: 24px; cursor: pointer; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">💬</button>
    <div id="chat-panel" style="position: fixed; bottom: 80px; right: 20px; width: 350px; height: 450px; background: var(--card); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; display: none; flex-direction: column; z-index: 1000; box-shadow: 0 8px 24px rgba(0,0,0,0.4); overflow: hidden;">
      <div style="padding: 15px; background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
        <h3 id="chat-header-title" style="margin: 0; font-size: 16px;">Messages</h3>
        <button id="close-chat-btn" style="background: none; border: none; color: white; cursor: pointer; font-size: 16px;">✕</button>
      </div>
      <div style="display: flex; flex: 1; overflow: hidden;">
        <div id="chat-sidebar" style="width: 120px; border-right: 1px solid rgba(255,255,255,0.05); overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 5px;">
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; background: rgba(0,0,0,0.1);">
          <div id="chat-messages" style="flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 10px;">
            <div style="color: var(--text-dim); font-size: 12px; text-align: center; margin-top: 20px;">Select a chat to start messaging</div>
          </div>
          <div style="padding: 10px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; gap: 5px; background: var(--card);">
            <input type="text" id="chat-input" class="manual-input" placeholder="Type a message..." style="width: 100%; font-size: 13px; padding: 8px;" disabled>
            <div style="display: flex; gap: 5px;">
              <button id="send-chat-btn" class="btn-main" style="flex: 1; padding: 6px; font-size: 12px;" disabled>Send</button>
              <button id="pin-chat-btn" class="btn-main btn-secondary" style="padding: 6px; font-size: 12px; display: none;" title="Pin as Announcement">📌</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', chatHTML);

  let activeChatId = null;

  document.getElementById('chat-toggle-btn').addEventListener('click', () => {
    const panel = document.getElementById('chat-panel');
    panel.style.display = panel.style.display === 'none' || panel.style.display === '' ? 'flex' : 'none';
    if (panel.style.display === 'flex') {
      renderChatSidebar();
    }
  });

  document.getElementById('close-chat-btn').addEventListener('click', () => {
    document.getElementById('chat-panel').style.display = 'none';
  });

  function renderChatSidebar() {
    const sidebar = document.getElementById('chat-sidebar');
    sidebar.innerHTML = '';
    const userId = localStorage.getItem('loggedInUserId');
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const currentUser = users.find(u => u.id === userId);
    if (!currentUser) return;

    let chats = [];
    if (currentUser.role === 'admin') {
      users.filter(u => u.role === 'supervisor').forEach(sup => {
        chats.push({ id: `group_${sup.id}`, name: `Team: ${sup.name}`, type: 'group' });
      });
      users.forEach(u => {
        if (u.id !== currentUser.id) chats.push({ id: `dm_${[currentUser.id, u.id].sort().join('_')}`, name: u.name, type: 'dm' });
      });
    } else if (currentUser.role === 'supervisor') {
      chats.push({ id: `group_${currentUser.id}`, name: `My Team`, type: 'group' });
      users.filter(u => u.role === 'admin').forEach(admin => {
        chats.push({ id: `dm_${[currentUser.id, admin.id].sort().join('_')}`, name: `Admin (${admin.name})`, type: 'dm' });
      });
      users.filter(u => u.supervisorId === currentUser.id).forEach(agent => {
        chats.push({ id: `dm_${[currentUser.id, agent.id].sort().join('_')}`, name: agent.name, type: 'dm' });
      });
    } else {
      if (currentUser.supervisorId) {
        const sup = users.find(u => u.id === currentUser.supervisorId);
        if (sup) {
          chats.push({ id: `group_${sup.id}`, name: `Team: ${sup.name}`, type: 'group' });
          chats.push({ id: `dm_${[currentUser.id, sup.id].sort().join('_')}`, name: `Sup: ${sup.name}`, type: 'dm' });
        }
      }
      users.filter(u => u.role === 'admin').forEach(admin => {
        chats.push({ id: `dm_${[currentUser.id, admin.id].sort().join('_')}`, name: `Admin (${admin.name})`, type: 'dm' });
      });
    }

    chats.forEach(chat => {
      const div = document.createElement('div');
      div.className = `chat-contact ${activeChatId === chat.id ? 'active' : ''}`;
      div.textContent = chat.name;
      div.onclick = () => {
        activeChatId = chat.id;
        document.getElementById('chat-header-title').textContent = chat.name;
        document.getElementById('chat-input').disabled = false;
        document.getElementById('send-chat-btn').disabled = false;
        
        const pinBtn = document.getElementById('pin-chat-btn');
        if (currentUser.role === 'admin' || currentUser.role === 'supervisor') {
          pinBtn.style.display = 'block';
          pinBtn.onclick = () => pinCurrentMessageAsAnnouncement(chat);
        } else {
          pinBtn.style.display = 'none';
        }
        
        renderChatSidebar();
        renderMessages();
      };
      sidebar.appendChild(div);
    });
  }

  function renderMessages() {
    if (!activeChatId) return;
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.innerHTML = '';
    
    const allMessages = JSON.parse(localStorage.getItem('chat_messages') || '[]');
    const chatMessages = allMessages.filter(m => m.chatId === activeChatId).sort((a,b) => a.timestamp - b.timestamp);
    
    const userId = localStorage.getItem('loggedInUserId');
    const users = JSON.parse(localStorage.getItem('users') || '[]');

    chatMessages.forEach(msg => {
      const sender = users.find(u => u.id === msg.senderId);
      const isMe = msg.senderId === userId;
      const div = document.createElement('div');
      div.className = `chat-message ${isMe ? 'sent' : 'received'}`;
      div.innerHTML = `
        <div class="chat-message-header">${isMe ? 'You' : (sender ? sender.name : 'Unknown')}</div>
        <div>${msg.text}</div>
      `;
      messagesContainer.appendChild(div);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function sendMessage() {
    if (!activeChatId) return;
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    const userId = localStorage.getItem('loggedInUserId');
    const allMessages = JSON.parse(localStorage.getItem('chat_messages') || '[]');
    allMessages.push({
      id: 'msg_' + Date.now(),
      chatId: activeChatId,
      senderId: userId,
      text: text,
      timestamp: Date.now()
    });
    localStorage.setItem('chat_messages', JSON.stringify(allMessages));
    input.value = '';
    renderMessages();
  }

  document.getElementById('send-chat-btn').addEventListener('click', sendMessage);
  document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  function pinCurrentMessageAsAnnouncement(chat) {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return alert("Type a message to pin as an announcement.");

    let target = { type: 'global', ids: [] };
    if (chat.type === 'group') {
      const supId = chat.id.replace('group_', '');
      target = { type: 'mixed', teams: [supId], users: [] };
    } else if (chat.type === 'dm') {
      const ids = chat.id.replace('dm_', '').split('_');
      const otherId = ids.find(id => id !== localStorage.getItem('loggedInUserId'));
      target = { type: 'mixed', teams: [], users: [otherId] };
    }

    const announcements = JSON.parse(localStorage.getItem('announcements') || '[]');
    announcements.push({
      id: 'ann_' + Date.now(),
      text: text,
      target: target,
      timestamp: Date.now()
    });
    localStorage.setItem('announcements', JSON.stringify(announcements));
    
    sendMessage();
    alert("Message pinned as announcement!");
    
    if (window.renderActiveAnnouncements) window.renderActiveAnnouncements();
  }

  window.addEventListener('storage', (e) => {
    if (e.key === 'chat_messages') {
      renderMessages();
    }
  });
}
