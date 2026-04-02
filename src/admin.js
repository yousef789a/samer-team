import { initChat } from './chat.js';

document.addEventListener('DOMContentLoaded', () => {
  const role = localStorage.getItem('loggedInRole');
  if (role !== 'admin') {
      window.location.href = './index.html';
      return;
  }
  initAdmin();
});

let selectedDays = [new Date().getDate()];
let users = [];

function initAdmin() {
  users = JSON.parse(localStorage.getItem('users') || '[]');
  
  renderAgentDropdown();
  renderSupervisorDropdown();
  renderUserTable();
  renderKanbanBoard();
  renderCalendar();
  updateDashboard();
  renderAnnouncementHierarchy();
  renderActiveAnnouncements();
  initChat();

  document.getElementById('agent-select').addEventListener('change', updateDashboard);
  document.getElementById('admin-select-all').addEventListener('click', toggleSelectAll);
  document.getElementById('create-agent-btn').addEventListener('click', createAgent);
  document.getElementById('post-announcement-btn').addEventListener('click', postAnnouncement);
  
  document.getElementById('logout-btn').addEventListener('click', () => {
      localStorage.removeItem('loggedInUserId');
      localStorage.removeItem('loggedInEmail');
      localStorage.removeItem('loggedInRole');
      window.location.href = './index.html';
  });

  document.getElementById('export-raw-btn').addEventListener('click', exportRawLogs);
  document.getElementById('export-perf-btn').addEventListener('click', exportPerformanceReport);
  
  // Modal listeners
  document.getElementById('cancel-edit-btn').addEventListener('click', closeEditModal);
  document.getElementById('save-edit-btn').addEventListener('click', saveUserEdit);
  
  // Role change listener
  document.getElementById('new-agent-role').addEventListener('change', (e) => {
    document.getElementById('new-agent-supervisor').style.display = e.target.value === 'supervisor' ? 'none' : 'block';
  });
}

function createAgent() {
  const name = document.getElementById('new-agent-name').value.trim();
  const email = document.getElementById('new-agent-email').value.trim();
  const pass = document.getElementById('new-agent-pass').value;
  const role = document.getElementById('new-agent-role').value;
  const supervisorId = role === 'agent' ? (document.getElementById('new-agent-supervisor').value || null) : null;
  const msg = document.getElementById('adminMessage');

  if (!name || !email || !pass) {
      msg.textContent = "Please fill all fields.";
      msg.style.color = "var(--danger)";
      msg.classList.add('visible');
      setTimeout(() => msg.classList.remove('visible'), 3000);
      return;
  }

  if (users.find(u => u.email === email)) {
      msg.textContent = "Email already exists.";
      msg.style.color = "var(--danger)";
      msg.classList.add('visible');
      setTimeout(() => msg.classList.remove('visible'), 3000);
      return;
  }

  const newUser = {
      id: 'user-' + Date.now(),
      email: email,
      password: pass,
      name: name,
      role: role,
      status: 'active',
      supervisorId: supervisorId
  };
  users.push(newUser);
  localStorage.setItem('users', JSON.stringify(users));

  msg.textContent = `${role === 'supervisor' ? 'Supervisor' : 'Agent'} created successfully!`;
  msg.style.color = "var(--success)";
  msg.classList.add('visible');
  setTimeout(() => msg.classList.remove('visible'), 3000);
  
  document.getElementById('new-agent-name').value = '';
  document.getElementById('new-agent-email').value = '';
  document.getElementById('new-agent-pass').value = '';
  document.getElementById('new-agent-supervisor').value = '';
  
  renderAgentDropdown();
  renderSupervisorDropdown();
  renderUserTable();
  renderKanbanBoard();
}

function renderSupervisorDropdown() {
  const select = document.getElementById('new-agent-supervisor');
  if (!select) return;
  select.innerHTML = '<option value="">No Supervisor</option>';
  
  const currentUsers = JSON.parse(localStorage.getItem('users') || '[]');
  const supervisors = currentUsers.filter(u => u.role === 'supervisor');
  
  supervisors.forEach(sup => {
    const opt = document.createElement('option');
    opt.value = sup.id;
    opt.textContent = sup.name;
    select.appendChild(opt);
  });
}

function renderAnnouncementHierarchy() {
  const container = document.getElementById('announcement-hierarchy');
  if (!container) return;
  const currentUsers = JSON.parse(localStorage.getItem('users') || '[]');
  const supervisors = currentUsers.filter(u => u.role === 'supervisor');
  const agents = currentUsers.filter(u => u.role === 'agent');

  let html = `
    <div class="hierarchy-item">
      <label><input type="checkbox" id="announce-global" checked> <strong>All Agents (Global)</strong></label>
    </div>
    <div id="announce-teams-container" style="display: none; margin-top: 10px;">
  `;

  supervisors.forEach(sup => {
    const teamAgents = agents.filter(a => a.supervisorId === sup.id);
    html += `
      <div class="hierarchy-item">
        <label><input type="checkbox" class="announce-team-cb" value="${sup.id}"> Team: ${sup.name}</label>
        <div class="hierarchy-children" style="display: none;">
          ${teamAgents.map(a => `<label><input type="checkbox" class="announce-agent-cb" data-team="${sup.id}" value="${a.id}"> ${a.name}</label><br>`).join('')}
        </div>
      </div>
    `;
  });

  const unassigned = agents.filter(a => !a.supervisorId);
  if (unassigned.length > 0) {
    html += `
      <div class="hierarchy-item">
        <label><input type="checkbox" class="announce-team-cb" value="unassigned"> Unassigned Agents</label>
        <div class="hierarchy-children" style="display: none;">
          ${unassigned.map(a => `<label><input type="checkbox" class="announce-agent-cb" data-team="unassigned" value="${a.id}"> ${a.name}</label><br>`).join('')}
        </div>
      </div>
    `;
  }

  html += `</div>`;
  container.innerHTML = html;

  const globalCb = document.getElementById('announce-global');
  const teamsContainer = document.getElementById('announce-teams-container');
  
  globalCb.addEventListener('change', (e) => {
    teamsContainer.style.display = e.target.checked ? 'none' : 'block';
  });

  document.querySelectorAll('.announce-team-cb').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const childrenDiv = e.target.closest('.hierarchy-item').querySelector('.hierarchy-children');
      childrenDiv.style.display = e.target.checked ? 'none' : 'block';
      if (e.target.checked) {
        childrenDiv.querySelectorAll('.announce-agent-cb').forEach(child => child.checked = false);
      }
    });
  });
}

function postAnnouncement() {
  const text = document.getElementById('announcement-text').value.trim();
  if (!text) return alert("Announcement text cannot be empty.");

  const globalCb = document.getElementById('announce-global');
  let target = { type: 'users', ids: [] };

  if (globalCb.checked) {
    target = { type: 'global', ids: [] };
  } else {
    const selectedTeams = Array.from(document.querySelectorAll('.announce-team-cb:checked')).map(cb => cb.value);
    const selectedAgents = Array.from(document.querySelectorAll('.announce-agent-cb:checked')).map(cb => cb.value);

    if (selectedTeams.length === 0 && selectedAgents.length === 0) {
      return alert("Please select at least one target for the announcement.");
    }
    target = { type: 'mixed', teams: selectedTeams, users: selectedAgents };
  }

  const announcements = JSON.parse(localStorage.getItem('announcements') || '[]');
  announcements.push({
    id: 'ann_' + Date.now(),
    text,
    target,
    timestamp: Date.now()
  });
  localStorage.setItem('announcements', JSON.stringify(announcements));

  document.getElementById('announcement-text').value = '';
  window.renderActiveAnnouncements();
}

window.renderActiveAnnouncements = function() {
  const list = document.getElementById('active-announcements-list');
  if (!list) return;
  const announcements = JSON.parse(localStorage.getItem('announcements') || '[]');
  
  list.innerHTML = announcements.length === 0 ? '<div style="color: var(--text-dim); font-size: 13px;">No active announcements.</div>' : '';

  announcements.sort((a,b) => b.timestamp - a.timestamp).forEach(ann => {
    let targetText = 'Global';
    if (ann.target.type === 'mixed') {
      const t = [];
      if (ann.target.teams.length) t.push(`${ann.target.teams.length} Teams`);
      if (ann.target.users.length) t.push(`${ann.target.users.length} Users`);
      targetText = t.join(', ');
    }

    const div = document.createElement('div');
    div.style.cssText = 'background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; font-size: 13px; position: relative;';
    div.innerHTML = `
      <div style="margin-bottom: 5px; padding-right: 20px;">${ann.text}</div>
      <div style="font-size: 11px; color: var(--text-dim);">Target: ${targetText} &bull; ${new Date(ann.timestamp).toLocaleString()}</div>
      <button onclick="removeAnnouncement('${ann.id}')" style="position: absolute; top: 10px; right: 10px; background: none; border: none; color: var(--danger); cursor: pointer; font-size: 16px;" title="Remove">✕</button>
    `;
    list.appendChild(div);
  });
}

window.removeAnnouncement = function(id) {
  let announcements = JSON.parse(localStorage.getItem('announcements') || '[]');
  announcements = announcements.filter(a => a.id !== id);
  localStorage.setItem('announcements', JSON.stringify(announcements));
  window.renderActiveAnnouncements();
};

function renderAgentDropdown() {
  const select = document.getElementById('agent-select');
  select.innerHTML = '<option value="all">All Team</option>';
  
  const currentUsers = JSON.parse(localStorage.getItem('users') || '[]');
  const supervisors = currentUsers.filter(u => u.role === 'supervisor');
  const agents = currentUsers.filter(u => u.role === 'agent');
  
  // Add Unassigned Agents
  const unassigned = agents.filter(a => !a.supervisorId);
  if (unassigned.length > 0) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = "Unassigned Agents";
    unassigned.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = u.name;
      optgroup.appendChild(opt);
    });
    select.appendChild(optgroup);
  }
  
  // Add Agents grouped by Supervisor
  supervisors.forEach(sup => {
    const team = agents.filter(a => a.supervisorId === sup.id);
    const optgroup = document.createElement('optgroup');
    optgroup.label = `Team: ${sup.name}`;
    
    // Add the supervisor themselves
    const supOpt = document.createElement('option');
    supOpt.value = sup.id;
    supOpt.textContent = `${sup.name} (Supervisor)`;
    optgroup.appendChild(supOpt);

    team.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = u.name;
      optgroup.appendChild(opt);
    });
    select.appendChild(optgroup);
  });
}

// --- User Directory (Table) ---
function renderUserTable() {
  const tbody = document.getElementById('user-table-body');
  tbody.innerHTML = '';
  const currentUsers = JSON.parse(localStorage.getItem('users') || '[]');
  
  currentUsers.forEach(user => {
    if (user.role === 'admin') return; // Hide main admin
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${user.name}</td>
      <td>${user.email}</td>
      <td style="text-transform: capitalize;">${user.role}</td>
      <td><span style="color: ${user.status === 'inactive' ? 'var(--danger)' : 'var(--success)'}">${user.status || 'active'}</span></td>
      <td>
        <button class="action-btn" onclick="openEditModal('${user.id}')">Edit</button>
        <button class="action-btn" onclick="toggleUserStatus('${user.id}')">${user.status === 'inactive' ? 'Activate' : 'Deactivate'}</button>
        <button class="action-btn danger" onclick="deleteUser('${user.id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.openEditModal = function(id) {
  const currentUsers = JSON.parse(localStorage.getItem('users') || '[]');
  const user = currentUsers.find(u => u.id === id);
  if (!user) return;
  
  document.getElementById('edit-user-id').value = user.id;
  document.getElementById('edit-user-name').value = user.name;
  document.getElementById('edit-user-email').value = user.email;
  document.getElementById('edit-user-pass').value = user.password;
  
  document.getElementById('editModal').classList.add('active');
};

function closeEditModal() {
  document.getElementById('editModal').classList.remove('active');
}

function saveUserEdit() {
  const id = document.getElementById('edit-user-id').value;
  const name = document.getElementById('edit-user-name').value.trim();
  const email = document.getElementById('edit-user-email').value.trim();
  const pass = document.getElementById('edit-user-pass').value.trim();
  
  if (!name || !email || !pass) return alert("Fields cannot be empty.");
  
  let currentUsers = JSON.parse(localStorage.getItem('users') || '[]');
  const index = currentUsers.findIndex(u => u.id === id);
  if (index !== -1) {
    currentUsers[index].name = name;
    currentUsers[index].email = email;
    currentUsers[index].password = pass;
    localStorage.setItem('users', JSON.stringify(currentUsers));
    users = currentUsers; // update global ref
    renderUserTable();
    renderAgentDropdown();
    renderSupervisorDropdown();
    renderKanbanBoard();
    closeEditModal();
  }
}

window.toggleUserStatus = function(id) {
  let currentUsers = JSON.parse(localStorage.getItem('users') || '[]');
  const index = currentUsers.findIndex(u => u.id === id);
  if (index !== -1) {
    currentUsers[index].status = currentUsers[index].status === 'inactive' ? 'active' : 'inactive';
    localStorage.setItem('users', JSON.stringify(currentUsers));
    users = currentUsers;
    renderUserTable();
  }
};

window.deleteUser = function(id) {
  if (!confirm("Are you sure you want to delete this user? This cannot be undone.")) return;
  let currentUsers = JSON.parse(localStorage.getItem('users') || '[]');
  currentUsers = currentUsers.filter(u => u.id !== id);
  
  // If a supervisor is deleted, unassign their agents
  currentUsers.forEach(u => {
    if (u.supervisorId === id) u.supervisorId = null;
  });
  
  localStorage.setItem('users', JSON.stringify(currentUsers));
  users = currentUsers;
  renderUserTable();
  renderAgentDropdown();
  renderSupervisorDropdown();
  renderKanbanBoard();
};

// --- Kanban Board (Drag & Drop) ---
function renderKanbanBoard() {
  const board = document.getElementById('kanban-board');
  board.innerHTML = '';
  
  const currentUsers = JSON.parse(localStorage.getItem('users') || '[]');
  const supervisors = currentUsers.filter(u => u.role === 'supervisor');
  const agents = currentUsers.filter(u => u.role === 'agent');
  
  // Create Unassigned Column
  board.appendChild(createKanbanColumn('unassigned', 'Unassigned Agents', agents.filter(a => !a.supervisorId)));
  
  // Create Supervisor Columns
  supervisors.forEach(sup => {
    board.appendChild(createKanbanColumn(sup.id, sup.name, agents.filter(a => a.supervisorId === sup.id)));
  });
}

function createKanbanColumn(id, title, agents) {
  const col = document.createElement('div');
  col.className = 'kanban-column';
  col.dataset.supervisorId = id;
  
  col.innerHTML = `<div class="kanban-column-title">${title}</div>`;
  
  agents.forEach(agent => {
    const card = document.createElement('div');
    card.className = 'draggable-card';
    card.draggable = true;
    card.dataset.agentId = agent.id;
    card.innerHTML = `<span>${agent.name}</span> <span style="font-size:10px; opacity:0.5;">☰</span>`;
    
    card.addEventListener('dragstart', () => { card.classList.add('dragging'); });
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); });
    col.appendChild(card);
  });
  
  col.addEventListener('dragover', e => {
    e.preventDefault();
    const draggingCard = document.querySelector('.dragging');
    if (draggingCard) col.appendChild(draggingCard);
  });
  
  col.addEventListener('drop', e => {
    e.preventDefault();
    const draggingCard = document.querySelector('.dragging');
    if (draggingCard) {
      const agentId = draggingCard.dataset.agentId;
      const newSupId = col.dataset.supervisorId === 'unassigned' ? null : col.dataset.supervisorId;
      
      let currentUsers = JSON.parse(localStorage.getItem('users') || '[]');
      const agentIndex = currentUsers.findIndex(u => u.id === agentId);
      if (agentIndex !== -1) {
        currentUsers[agentIndex].supervisorId = newSupId;
        localStorage.setItem('users', JSON.stringify(currentUsers));
        users = currentUsers;
        renderAgentDropdown(); // Update dropdown grouping
        renderKanbanBoard(); // Re-render to ensure DOM is perfectly synced
      }
    }
  });
  
  return col;
}

function renderCalendar() {
  const grid = document.getElementById('admin-calendar-grid');
  grid.innerHTML = '';
  for (let i = 1; i <= 31; i++) {
      const btn = document.createElement('div');
      btn.className = 'day-btn';
      btn.innerText = i;
      if (selectedDays.includes(i)) btn.classList.add('active');
      btn.onclick = () => {
          if (selectedDays.includes(i)) {
              selectedDays = selectedDays.filter(d => d !== i);
          } else {
              selectedDays.push(i);
          }
          if (selectedDays.length === 0) selectedDays = [new Date().getDate()];
          renderCalendar();
          updateDashboard();
      };
      grid.appendChild(btn);
  }
}

function toggleSelectAll() {
  if (selectedDays.length === 31) {
      selectedDays = [new Date().getDate()];
  } else {
      selectedDays = Array.from({length: 31}, (_, i) => i + 1);
  }
  renderCalendar();
  updateDashboard();
}

function getAgentData(userId) {
  const data = localStorage.getItem(`counterData_v4_${userId}`);
  return data ? JSON.parse(data) : null;
}

function getAggregatedData(userId) {
  const data = getAgentData(userId);
  let result = { calls: 0, pay: 0, full: 0, coll: 0, rem: 0, post: 0, credits: 0, ap: 0, pp: 0 };
  if (!data) return result;
  
  selectedDays.forEach(day => {
      if (data[day]) {
          Object.keys(result).forEach(key => {
              result[key] += (data[day][key] || 0);
          });
      }
  });
  return result;
}

function updateDashboard() {
  const agentId = document.getElementById('agent-select').value;
  let agg = { calls: 0, pay: 0, full: 0, coll: 0, rem: 0, post: 0, ap: 0, pp: 0 };
  
  if (agentId === 'all') {
      document.getElementById('dashboard-title').textContent = "Team Performance";
      users.forEach(u => {
          if (u.role !== 'admin') {
              const uData = getAggregatedData(u.id);
              Object.keys(agg).forEach(k => agg[k] += (uData[k] || 0));
          }
      });
  } else {
      const user = users.find(u => u.id === agentId);
      document.getElementById('dashboard-title').textContent = `${user.name}'s Performance`;
      const uData = getAggregatedData(agentId);
      Object.keys(agg).forEach(k => agg[k] += (uData[k] || 0));
  }

  document.getElementById('admin-calls-val').textContent = agg.calls;
  document.getElementById('admin-calls-val2').textContent = agg.calls;
  document.getElementById('admin-coll-val').textContent = agg.coll;
  document.getElementById('admin-pay-val').textContent = agg.pay;
  document.getElementById('admin-full-val').textContent = agg.full;
  document.getElementById('admin-rem-val').textContent = agg.rem;
  document.getElementById('admin-ap-val').textContent = agg.ap;
  document.getElementById('admin-pp-val').textContent = agg.pp;

  const payPerc = agg.calls ? (agg.pay / agg.calls * 100) : 0;
  const fullPerc = agg.calls ? (agg.full / agg.calls * 100) : 0;
  const remPerc = agg.coll ? (agg.rem / agg.coll * 100) : 0;

  document.getElementById('admin-pay-perc').textContent = payPerc.toFixed(1) + '%';
  document.getElementById('admin-full-perc').textContent = fullPerc.toFixed(1) + '%';
  document.getElementById('admin-rem-perc').textContent = remPerc.toFixed(1) + '%';
  
  document.getElementById('admin-ap-perc').textContent = (agg.ap * 2).toFixed(1) + '$';
  document.getElementById('admin-pp-perc').textContent = (agg.pp).toFixed(1) + '$';
}

function exportRawLogs() {
  const logs = JSON.parse(localStorage.getItem('call_logs') || '[]');
  const filteredLogs = logs.filter(log => {
      const date = new Date(log.timestamp);
      return selectedDays.includes(date.getDate());
  });

  const wsData = [
      ["Agent Name/Email", "Account Number", "Sequence ID", "Outcome", "Timestamp"]
  ];

  filteredLogs.forEach(log => {
      wsData.push([
          log.agentEmail,
          log.accountNumber,
          log.sequenceId,
          log.outcome,
          new Date(log.timestamp).toLocaleString()
      ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Raw Call Logs");
  XLSX.writeFile(wb, "Raw_Call_Logs.xlsx");
}

function exportPerformanceReport() {
  const wsData = [
      ["Rep Name", "Calls Handled", "AHT", "Hold", "Payment Yield (%)", "Full Payment (%)", "% Collections Removed", "Deauth", "Payment Plan - Enrolled", "Autopay Added (#)", "Non-Recurring Credit ($)"]
  ];

  users.forEach(user => {
      if (user.role === 'admin') return;
      const data = getAggregatedData(user.id);
      
      const calls = data.calls || 0;
      const payYield = calls ? (data.pay / calls) : 0; 
      const fullPay = calls ? (data.full / calls) : 0;
      const collRem = data.coll ? (data.rem / data.coll) : 0;
      const deauth = data.coll ? (data.post / data.coll) : 0; 
      
      wsData.push([
          user.name || user.email,
          calls,
          0,
          0,
          payYield,
          fullPay,
          collRem,
          deauth,
          data.pp || 0,
          data.ap || 0,
          data.credits ? `($${data.credits.toFixed(2)})` : "$0.00"
      ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  for (let R = 1; R < wsData.length; ++R) {
      for (let C = 4; C <= 7; ++C) {
          const cellRef = XLSX.utils.encode_cell({r: R, c: C});
          if (ws[cellRef]) ws[cellRef].z = "0.00%";
      }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Performance Report");
  XLSX.writeFile(wb, "Performance_Report.xlsx");
}
