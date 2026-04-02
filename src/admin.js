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
  const agentSelect = document.getElementById('agent-select');
  users.forEach(u => {
      if (u.role !== 'admin') {
          const opt = document.createElement('option');
          opt.value = u.id;
          opt.textContent = u.name || u.email;
          agentSelect.appendChild(opt);
      }
  });

  renderCalendar();
  updateDashboard();

  document.getElementById('agent-select').addEventListener('change', updateDashboard);
  document.getElementById('admin-select-all').addEventListener('click', toggleSelectAll);
  document.getElementById('create-agent-btn').addEventListener('click', createAgent);
  
  document.getElementById('logout-btn').addEventListener('click', () => {
      localStorage.removeItem('loggedInUserId');
      localStorage.removeItem('loggedInEmail');
      localStorage.removeItem('loggedInRole');
      window.location.href = './index.html';
  });

  document.getElementById('export-raw-btn').addEventListener('click', exportRawLogs);
  document.getElementById('export-perf-btn').addEventListener('click', exportPerformanceReport);
}

function createAgent() {
  const name = document.getElementById('new-agent-name').value.trim();
  const email = document.getElementById('new-agent-email').value.trim();
  const pass = document.getElementById('new-agent-pass').value;
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
      role: 'agent'
  };
  users.push(newUser);
  localStorage.setItem('users', JSON.stringify(users));

  const opt = document.createElement('option');
  opt.value = newUser.id;
  opt.textContent = newUser.name;
  document.getElementById('agent-select').appendChild(opt);

  msg.textContent = "Agent created successfully!";
  msg.style.color = "var(--success)";
  msg.classList.add('visible');
  setTimeout(() => msg.classList.remove('visible'), 3000);
  
  document.getElementById('new-agent-name').value = '';
  document.getElementById('new-agent-email').value = '';
  document.getElementById('new-agent-pass').value = '';
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
  let agg = { calls: 0, pay: 0, full: 0, coll: 0, rem: 0, post: 0 };
  
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

  const payPerc = agg.calls ? (agg.pay / agg.calls * 100) : 0;
  const fullPerc = agg.calls ? (agg.full / agg.calls * 100) : 0;
  const remPerc = agg.coll ? (agg.rem / agg.coll * 100) : 0;

  document.getElementById('admin-pay-perc').textContent = payPerc.toFixed(1) + '%';
  document.getElementById('admin-full-perc').textContent = fullPerc.toFixed(1) + '%';
  document.getElementById('admin-rem-perc').textContent = remPerc.toFixed(1) + '%';
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
