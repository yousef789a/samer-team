import { initChat } from './chat.js';

function initDB() {
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  if (users.length === 0) {
    users.push({ id: 'admin-1', email: 'admin@admin.com', password: 'admin', name: 'Admin', role: 'admin' });
    localStorage.setItem('users', JSON.stringify(users));
  }
}
initDB();

function showMessage(message, divId) {
  var messageDiv = document.getElementById(divId);
  messageDiv.innerHTML = message;
  messageDiv.classList.add('visible');
  const likeButtons = document.querySelectorAll('button');
  likeButtons.forEach((button) => { button.addEventListener('click', () => { messageDiv.classList.remove('visible'); }); });
  const inputs = document.querySelectorAll('input');
  inputs.forEach((input) => { input.addEventListener('focus', () => { messageDiv.classList.remove('visible'); }); });
}

function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function validatePassword(password) { return password.length >= 6; }
function setButtonLoading(btn) { btn.disabled = true; btn.dataset.originalText = btn.textContent; btn.innerHTML = `<span class="btn-spinner"></span>`; }
function resetButton(btn) { btn.disabled = false; btn.innerHTML = btn.dataset.originalText; }

const signUp = document.getElementById('submitSignUp');
if (signUp) {
  signUp.addEventListener('click', (event) => {
    event.preventDefault();
    setButtonLoading(signUp);
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    if (!email || !validateEmail(email) || !password || !validatePassword(password)) {
      showMessage('Invalid email or password (min 6 chars).', 'signInMessage');
      resetButton(signUp);
      return;
    }
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    if (users.find(u => u.email === email)) {
      showMessage('Email already in use.', 'signInMessage');
      resetButton(signUp);
      return;
    }
    const newUser = { id: 'user-' + Date.now(), email: email, password: password, name: email.split('@')[0], role: 'agent' };
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('loggedInUserId', newUser.id);
    localStorage.setItem('loggedInEmail', newUser.email);
    localStorage.setItem('loggedInRole', newUser.role);
    saveData();
    showMessage('Account created!', 'signInMessage');
    resetButton(signUp);
    closeSignIn();
    updateUI();
  });
}

const signIn = document.getElementById('submitSignIn');
if (signIn) {
  signIn.addEventListener('click', (event) => {
    event.preventDefault();
    setButtonLoading(signIn);
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      if (user.status === 'inactive') {
        showMessage('Account deactivated. Contact admin.', 'signInMessage');
        return;
      }
      localStorage.setItem('loggedInUserId', user.id);
      localStorage.setItem('loggedInEmail', user.email);
      localStorage.setItem('loggedInRole', user.role);
      if (user.role === 'admin') {
        window.location.href = './admin.html';
        return;
      }
      showMessage('Login successful', 'signInMessage');
      resetButton(signIn);
      loadData().then(() => { closeSignIn(); updateUI(); });
    } else {
      showMessage('Invalid email or password.', 'signInMessage');
      resetButton(signIn);
    }
  });
}

window.addEventListener('storage', (e) => {
  if (e.key === 'announcements') {
    renderAnnouncements();
  }
});

function renderAnnouncements() {
  const container = document.getElementById('announcement-banner-container');
  if (!container) return;
  container.innerHTML = '';

  const userId = localStorage.getItem('loggedInUserId');
  if (!userId) return;

  const users = JSON.parse(localStorage.getItem('users') || '[]');
  const currentUser = users.find(u => u.id === userId);
  if (!currentUser) return;

  const announcements = JSON.parse(localStorage.getItem('announcements') || '[]');
  
  announcements.forEach(ann => {
    let applies = false;
    if (ann.target.type === 'global') applies = true;
    else if (ann.target.type === 'mixed') {
      if (ann.target.teams.includes(currentUser.supervisorId || 'unassigned')) applies = true;
      if (ann.target.users.includes(currentUser.id)) applies = true;
    }

    if (applies) {
      const banner = document.createElement('div');
      banner.className = 'announcement-banner';
      banner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 18px;">📌</span>
          <span>${ann.text}</span>
        </div>
      `;
      container.appendChild(banner);
    }
  });
}

const title = document.getElementById('app-title');
let editbtn = document.querySelector(".editbtn");
if (editbtn) {
  editbtn.addEventListener('click', function() { title.style.pointerEvents='unset'; title.focus() });
}
if (title) {
  title.addEventListener('focusin', function(){ editbtn.style.visibility='hidden'; editbtn.style.cursor='default'; editbtn.style.pointerEvents='none'; });
  title.addEventListener('focusout', function(){ editbtn.style.visibility='unset'; editbtn.style.cursor='pointer'; editbtn.style.pointerEvents='all'; title.style.pointerEvents='none'; localStorage.setItem('title', title.value); saveData(); });
  title.addEventListener('keydown', function(e) { if (e.key === 'Enter') { title.blur(); } });
  const mirror = document.createElement('span');
  mirror.style.cssText = 'visibility:hidden;position:absolute;white-space:pre;font:inherit;font-size:32px;font-weight:800;letter-spacing:-0.04em;padding:4px;';
  document.body.appendChild(mirror);
  function resizeInput(input) { mirror.textContent = input.value; input.style.width = mirror.offsetWidth + 'px'; }
  resizeInput(title);
  title.addEventListener('input', () => resizeInput(title));
}

let myChartInstance = null;
function renderChart() {
  const canvas = document.getElementById('performanceChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const labels = []; const payData = []; const fullData = []; const postData = [];
  for (let i = 1; i <= 31; i++) {
    labels.push(i);
    const day = allData[i];
    const calls = day.calls || 0; const coll = day.coll|| 0;
    payData.push(calls > 0 ? (day.pay / calls * 100) : 0);
    fullData.push(calls > 0 ? (day.full / calls * 100) : 0);
    postData.push(coll > 0 ? (day.post / coll * 100) : 0);
  }
  if (myChartInstance) myChartInstance.destroy();
  myChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        { label: 'Pay %', data: payData, borderColor: '#f59e0b', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderWidth: 2, tension: 0.4, pointRadius: 1, fill: true },
        { label: 'Full %', data: fullData, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.05)', borderWidth: 2, tension: 0.4, pointRadius: 1, fill: true },
        { label: 'Rem %', data: postData, borderColor: '#22c55e', backgroundColor: 'rgba(100, 100, 50, 0.05)', borderWidth: 2, tension: 0.4, pointRadius: 1, fill: true }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { labels: { color: '#94a3b8', font: { size: 10, weight: 'bold' } } } }, scales: { x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 9 } } }, y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 9 }, stepSize: 25 } } } }
  });
}

const defaultDay = { calls: 0, pay: 0, full: 0, coll: 0, rem: 0, post:0, credits: 0, ap: 0, pp: 0 };
let allData = {};
for(let i=1; i<=31; i++) { allData[i] = {...defaultDay}; }
let selectedDays = [new Date().getDate()];
let lastUpdateTimestamp = parseInt(localStorage.getItem('lastUpdateTimestamp')) || Date.now();

const calendarGrid = document.getElementById('calendar-grid');
function renderCalendar() {
  if (!calendarGrid) return;
  calendarGrid.innerHTML = '';
  for (let i = 1; i <= 31; i++) {
    const btn = document.createElement('div');
    btn.className = 'day-btn';
    btn.innerText = i;
    const daySum = Object.values(allData[i]).reduce((a, b) => a + b, 0);
    if (daySum > 0) btn.classList.add('has-data');
    if (selectedDays.includes(i)) btn.classList.add('active');
    btn.onclick = () => toggleDay(i);
    calendarGrid.appendChild(btn);
  }
}

function toggleDay(day) {
  if (selectedDays.includes(day)) { selectedDays = selectedDays.filter(d => d !== day); } else { selectedDays.push(day); }
  updateUI();
}

function toggleSelectAll() {
  const daysWithData = Array.from(document.querySelectorAll('.day-btn.has-data')).map(el => parseInt(el.textContent));
  const allDataSelected = daysWithData.every(day => selectedDays.includes(day));
  if (allDataSelected) { selectedDays = [new Date().getDate()]; } else { selectedDays = daysWithData; }
  updateUI();
}

const selectAllBtn = document.querySelector('.select-all-btn');
if (selectAllBtn) selectAllBtn.addEventListener('click', toggleSelectAll);

function getAggregatedData() {
  let result = {...defaultDay};
  selectedDays.forEach(day => {
    const dData = allData[day];
    Object.keys(result).forEach(key => { result[key] += (dData[key] || 0); });
  });
  return result;
}

async function loadData() {
  const userId = localStorage.getItem('loggedInUserId');
  if (!userId) {
    const local = localStorage.getItem('counterData_v4');
    if (local) {
      allData = JSON.parse(local);
      for(let i=1; i<=31; i++) { if(!allData[i]) allData[i] = {...defaultDay}; }
    } else {
      allData = getDefaultData();
    }
    if (!localStorage.getItem('title')) localStorage.setItem('title', "Taha's Counter");
    updateUI();
    return;
  }
  const userRole = localStorage.getItem('loggedInRole');
  if (userRole === 'admin') { window.location.href = './admin.html'; return; }
  const userKey = `counterData_v4_${userId}`;
  const local = localStorage.getItem(userKey);
  if (local) {
    allData = JSON.parse(local);
    for(let i=1; i<=31; i++) { if(!allData[i]) allData[i] = {...defaultDay}; }
  } else {
    allData = getDefaultData();
  }
  
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  const currentUser = users.find(u => u.id === userId);
  const defaultTitle = currentUser ? `${currentUser.name}'s Counter` : "Taha's Counter";
  
  const title = localStorage.getItem(`title_${userId}`) || defaultTitle;
  const savedColor = localStorage.getItem(`primaryColor_${userId}`) || "#fdc9c9";
  localStorage.setItem('title', title);
  localStorage.setItem('primaryColor', savedColor);
  updateUI();
  renderAnnouncements();
  initChat();
}

async function saveData({ immediate = false } = {}) {
  const userId = localStorage.getItem('loggedInUserId');
  const usrName = localStorage.getItem('title');
  const savedColor = localStorage.getItem('primaryColor');
  if (!userId) {
    localStorage.setItem('counterData_v4', JSON.stringify(allData));
    localStorage.setItem('title', usrName);
    localStorage.setItem('primaryColor', savedColor);
  } else {
    localStorage.setItem(`counterData_v4_${userId}`, JSON.stringify(allData));
    localStorage.setItem(`title_${userId}`, usrName);
    localStorage.setItem(`primaryColor_${userId}`, savedColor);
  }
  updateUI();
}

function formatTime(totalMinutes) {
  const secondsTotal = Math.round(totalMinutes * 60);
  const h = Math.floor(secondsTotal / 3600);
  const m = Math.floor((secondsTotal % 3600) / 60);
  const s = secondsTotal % 60;
  const pad = (num) => num.toString().padStart(2, '0');
  if (h > 0) { return `${pad(h)}:${pad(m)}:${pad(s)}`; } else { return `${pad(m)}:${pad(s)}`; }
}

function updateEstimation() {
  const readyEl = document.getElementById('ready-val');
  if (!readyEl) return;
  const ready = parseFloat(readyEl.value) || 0;
  const inCall = parseFloat(document.getElementById('in-val').value) || 0;
  const callLen = parseFloat(document.getElementById('call-len-val').value) || 0;
  const displayElement = document.getElementById('est-avail');
  if (inCall === 0) { displayElement.innerText = "00:00"; return; }
  const totalMinutes = (ready * callLen) / inCall;
  displayElement.innerText = formatTime(totalMinutes);
}

function setLeftVisibility(visible) {
  const left = document.getElementById('left-panel');
  const right = document.getElementById('metrics-capture-area');
  const btn = document.getElementById('toggle-left-btn');
  if (!left || !btn) return;
  if (visible) {
    left.style.opacity='100'; left.style.transform = "translateX(0px)"; right.style.transform = "translateX(0px)"; btn.innerHTML = '&#10005;'; btn.title = 'Hide menu';
  } else {
    left.style.opacity='0'; left.style.transform = "translateX(210px)"; right.style.transform = "translateX(-210px)"; btn.innerHTML = '&#9776;'; btn.title = 'Show menu';
  }
  localStorage.setItem('leftVisible', visible ? '1' : '0');
}

function toggleLeft() {
  const current = localStorage.getItem('leftVisible');
  const visible = current === null ? true : current === '1';
  setLeftVisibility(!visible);
}
window.toggleLeft = toggleLeft;

document.addEventListener('DOMContentLoaded', () => {
  const leftState = localStorage.getItem('leftVisible');
  const visible = leftState === null ? true : leftState === '1';
  setLeftVisibility(visible);
  const inputs = ['ready-val', 'in-val', 'call-len-val'];
  inputs.forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('input', updateEstimation); });
  updateEstimation();
});

window.change = function(key, amt) {
  if (selectedDays.length !== 1) { alert("Please select a single day to edit data."); return; }
  const day = selectedDays[0];
  allData[day][key] = Math.max(0, (allData[day][key] || 0) + amt);
  const el = document.getElementById(key + '-val');
  el.classList.remove('update-pulse');
  void el.offsetWidth;
  el.classList.add('update-pulse');
  lastUpdateTimestamp = Date.now();
  localStorage.setItem('lastUpdateTimestamp', lastUpdateTimestamp);
  saveData();
  updateUI();
}

const credVal = document.getElementById('credits-val');
if (credVal) {
  credVal.addEventListener('change', (e) => {
    if (selectedDays.length !== 1) { e.target.value = getAggregatedData().credits; alert("Please select a single day to edit data."); return; }
    const day = selectedDays[0];
    allData[day].credits = parseInt(e.target.value) || 0;
    saveData();
    updateUI();
  });
}

function updateUI() {
  renderCalendar();
  const userId = localStorage.getItem('loggedInUserId');
  const loginBtn = document.getElementById('loginPopUp');
  if (loginBtn) { if (userId) { loginBtn.innerHTML="Logout"; } else { loginBtn.innerHTML="Login"; } }
  const data = getAggregatedData();
  const isMulti = selectedDays.length > 1;
  const title = localStorage.getItem("title");
  const savedColor = localStorage.getItem("primaryColor");
  const titleDOM = document.getElementById('app-title');
  if (titleDOM) {
    titleDOM.value = title;
    document.documentElement.style.setProperty('--primary', savedColor);
    const mirror = document.createElement('span');
    mirror.style.cssText = 'visibility:hidden;position:absolute;white-space:pre;font:inherit;font-size:32px;font-weight:800;letter-spacing:-0.04em;padding:4px;';
    document.body.appendChild(mirror);
    mirror.textContent = titleDOM.value; titleDOM.style.width = mirror.offsetWidth + 'px';
    mirror.remove();
  }
  const viewLabel = document.getElementById('view-label');
  const controls = document.querySelectorAll('.controls');
  if (selectedDays.length === 0) { selectedDays.length = 0; }
  if (viewLabel) {
    if (isMulti || selectedDays.length === 0) {
      viewLabel.innerText = `Viewing Total (${selectedDays.length} Days)`;
      controls.forEach(c => c.classList.add('locked'));
      if (document.getElementById('credits-val')) document.getElementById('credits-val').disabled = true;
    } else {
      viewLabel.innerText = `Day ${selectedDays[0]}`;
      controls.forEach(c => c.classList.remove('locked'));
      if (document.getElementById('credits-val')) document.getElementById('credits-val').disabled = false;
    }
  }
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
  setVal('calls-val', data.calls); setVal('pay-val', data.pay); setVal('full-val', data.full); setVal('coll-val', data.coll);
  setVal('rem-val', data.rem); setVal('post-val', data.post); setVal('ap-val', data.ap); setVal('pp-val', data.pp);
  if (document.getElementById('credits-val')) document.getElementById('credits-val').value = data.credits;
  const payRaw = data.calls ? (data.pay / data.calls * 100) : 0;
  const fullRaw = data.calls ? (data.full / data.calls * 100) : 0;
  const remRaw = data.coll ? (data.rem / data.coll * 100) : 0;
  const postRaw = data.coll ? (data.post / data.coll * 100) : 0;
  const apval= data.ap? (data.ap * 2) : 0;
  const ppval= data.pp? (data.pp) : 0;
  setVal('pay-perc', payRaw.toFixed(1) + "%"); setVal('full-perc', fullRaw.toFixed(1) + "%");
  setVal('rem-perc', remRaw.toFixed(1) + "%"); setVal('post-perc', postRaw.toFixed(1) + "%");
  setVal('ap-val-mon', apval.toFixed(1) + "$"); setVal('pp-val-mon', ppval.toFixed(1) + "$");
  updateTierUI('pay-tier', payRaw, 'pay', data.calls > 0);
  updateTierUI('full-tier', fullRaw, 'full', data.calls > 0);
  updateTierUI('rem-tier', remRaw, 'rem', data.coll > 0);
  updateTierUI('post-tier', postRaw, 'post', data.coll > 0);
  const credEl = document.getElementById('credits-val');
  if (credEl) {
    if (isMulti) { if (data.credits > 2000) credEl.style.color = 'var(--danger)'; else if (data.credits >= 1000) credEl.style.color = 'var(--warning)'; else credEl.style.color = 'var(--success)'; }
    else { if (data.credits > 180) credEl.style.color = 'var(--danger)'; else if (data.credits >= 100) credEl.style.color = 'var(--warning)'; else credEl.style.color = 'var(--success)'; }
  }
  renderChart();
}

function getTierInfo(value, type) {
  let tierNum = 1; let tierLabel = '1 - 0$';
  const thresholds = { pay: [60, 66, 73, 78, 100], full: [45, 48, 52, 55, 100], rem: [60, 65, 70, 75, 100], post: [60, 65, 70, 75, 100] };
  const labels = { pay: ['1 - 0$', '2 - 20$', '3 - 30$', '4 - 40$', '5 - 50$'], full: ['1 - 0$', '2 - 25$', '3 - 50$', '4 - 100$', '5 - 150$'], rem: ['1 - 0$', '2 - 30$', '3 - 70$', '4 - 135$', '5 - 250$'], post: ['1 - 0$', '2 - 30$', '3 - 70$', '4 - 135$', '5 - 250$'] };
  const typeThresholds = thresholds[type] || thresholds.pay;
  const typeLabels = labels[type] || labels.pay;
  const tierIndex = typeThresholds.findIndex(threshold => value < threshold);
  tierNum = tierIndex === -1 ? 5 : tierIndex + 1;
  tierLabel = typeLabels[tierNum - 1];
  const lowerBound = tierNum === 1 ? 0 : typeThresholds[tierNum - 2];
  const upperBound = typeThresholds[tierNum - 1];
  const color = `var(--tier-${tierNum})`;
  return { tier: tierLabel, color, tierNum, lowerBound, upperBound };
}

function updateTierUI(id, perc, type, hasData) {
  const badge = document.getElementById(id);
  const arrowIds = { pay: 'payArrow', full: 'fullArrow', post: 'postArrow' };
  const arrowEl = document.getElementById(arrowIds[type]);
  if (!hasData) { if (badge) badge.style.visibility = 'hidden'; if (arrowEl) arrowEl.style.display = 'none'; return; }
  const { tier, color, tierNum, lowerBound, upperBound } = getTierInfo(perc, type);
  if (badge) { badge.style.display = 'inline-block'; badge.style.visibility = 'visible'; badge.innerText = `TIER ${tier}`; badge.style.color = color; badge.style.borderColor = color; }
  if (arrowEl) {
    if (tierNum === 5) { arrowEl.style.display = 'none'; } else {
      arrowEl.style.display = 'block';
      const wrapper = arrowEl.parentElement;
      const badgeEl = wrapper ? wrapper.querySelector('.tier-badge') : null;
      const wrapperWidth = wrapper ? wrapper.clientWidth : 0;
      const arrowWidth = arrowEl.offsetWidth || 0;
      const badgeOffset = badgeEl ? badgeEl.offsetLeft : 0;
      const progress = upperBound === lowerBound ? 1 : (perc - lowerBound) / (upperBound - lowerBound);
      const clampedProgress = Math.min(Math.max(progress, 0), 1);
      const minLeft = Math.min(badgeOffset, Math.max(wrapperWidth - arrowWidth, 0));
      const maxLeft = Math.max(wrapperWidth - arrowWidth, 0);
      const pointPos = minLeft + (maxLeft - minLeft) * clampedProgress;
      arrowEl.style.left = `${pointPos}px`;
    }
  }
}

window.addEventListener('storage', (e) => {
  if (e.key === 'announcements') {
    renderAnnouncements();
  }
});

function renderAnnouncements() {
  const container = document.getElementById('announcement-banner-container');
  if (!container) return;
  container.innerHTML = '';

  const userId = localStorage.getItem('loggedInUserId');
  if (!userId) return;

  const users = JSON.parse(localStorage.getItem('users') || '[]');
  const currentUser = users.find(u => u.id === userId);
  if (!currentUser) return;

  const announcements = JSON.parse(localStorage.getItem('announcements') || '[]');
  
  announcements.forEach(ann => {
    let applies = false;
    if (ann.target.type === 'global') applies = true;
    else if (ann.target.type === 'mixed') {
      if (ann.target.teams.includes(currentUser.supervisorId || 'unassigned')) applies = true;
      if (ann.target.users.includes(currentUser.id)) applies = true;
    }

    if (applies) {
      const banner = document.createElement('div');
      banner.className = 'announcement-banner';
      banner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 18px;">📌</span>
          <span>${ann.text}</span>
        </div>
      `;
      container.appendChild(banner);
    }
  });
}

function getDefaultData() { const data = {}; for (let i = 1; i <= 31; i++) { data[i] = { ...defaultDay }; } return data; }

function loginPopUp() {
  const userId = localStorage.getItem('loggedInUserId');
  if (userId) {
    localStorage.removeItem('loggedInUserId');
    localStorage.removeItem('loggedInRole');
    localStorage.removeItem('loggedInEmail');
    window.location.reload();
    return;
  }
  const modal = document.getElementById('signIn');
  const overlay = document.getElementById('signinOverlay');
  if (modal && overlay) {
    modal.classList.add('active');
    overlay.classList.add('active');
    overlay.addEventListener('click', closeSignIn, { once: true });
  }
}

function closeSignIn() {
  const modal = document.getElementById('signIn');
  const overlay = document.getElementById('signinOverlay');
  if (modal) modal.classList.remove('active');
  if (overlay) overlay.classList.remove('active');
}

const loginBtn = document.getElementById('loginPopUp');
if (loginBtn) loginBtn.addEventListener('click', loginPopUp);

const fields = ['accNum', 'seqNum'];
const checks = ['pay', 'full', 'rem'];

function logData() {
  const data = {
    ...Object.fromEntries(fields.map(id => [id, document.getElementById(id).value])),
    ...Object.fromEntries(checks.map(id => [id, document.getElementById(`chk-${id}`).checked])),
  };
  if (fields.some(id => !document.getElementById(id).value.trim())) { return; }
  
  const logs = JSON.parse(localStorage.getItem('call_logs') || '[]');
  const currentUser = localStorage.getItem('loggedInEmail') || 'Anonymous Agent';
  
  let outcome = 'None';
  if (data.pay) outcome = 'Payment';
  else if (data.full) outcome = 'Full Payment';
  else if (data.rem) outcome = 'Remove';

  logs.push({
    agentEmail: currentUser,
    accountNumber: data.accNum,
    sequenceId: data.seqNum,
    outcome: outcome,
    timestamp: new Date().toISOString()
  });
  localStorage.setItem('call_logs', JSON.stringify(logs));

  fields.forEach(id => document.getElementById(id).value = '');
  checks.forEach(id => document.getElementById(`chk-${id}`).checked = false);
}

fields.forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('keydown', e => e.key === 'Enter' && logData());
});

const colorPicker = document.getElementById('colorPickerInput');
if (colorPicker) {
  colorPicker.addEventListener('input', () => { document.documentElement.style.setProperty('--primary', colorPicker.value); });
  colorPicker.addEventListener('change', () => { localStorage.setItem('primaryColor', colorPicker.value); saveData(); });
  const savedColor = localStorage.getItem('primaryColor');
  if (savedColor) { document.documentElement.style.setProperty('--primary', savedColor); colorPicker.value = savedColor; }
}

function updateTimer() {
  const now = Date.now();
  const diffInSeconds = Math.floor((now - lastUpdateTimestamp) / 1000);
  const hrs = Math.floor(diffInSeconds / 3600);
  const mins = Math.floor((diffInSeconds % 3600) / 60);
  const secs = diffInSeconds % 60;
  const formattedTime = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  const el = document.getElementById('last-updated');
  if (el) el.innerText = `Last Updated: ${formattedTime} ago`;
}
setInterval(updateTimer, 1000);

updateUI();
updateTimer();
