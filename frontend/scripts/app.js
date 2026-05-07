(function() {
  'use strict';
  const API_BASE = '/api';
  const DEFAULT_PORTS = '21,22,23,25,53,80,110,143,443,3306,3389,5432,8080,8443';
  const STORAGE_KEY = 'net_scanner_session';
  
  const state = {
    key: '',
    usesLeft: 0,
    isScanning: false
  };

  const DOM = {
    steps: {
      key: document.getElementById('step-key'),
      config: document.getElementById('step-config'),
      results: document.getElementById('step-results')
    },
    keyForm: document.getElementById('key-form'),
    keyInput: document.getElementById('access-key'),
    keyMsg: document.getElementById('key-msg'),
    usesDisplay: document.getElementById('uses-display'),
    scanForm: document.getElementById('scan-form'),
    ipInput: document.getElementById('target-ip'),
    portsInput: document.getElementById('target-ports'),
    disclaimer: document.getElementById('disclaimer'),
    scanBtn: document.getElementById('scan-btn'),
    scanMsg: document.getElementById('scan-msg'),
    resultsMeta: document.getElementById('scan-meta'),
    resultsBody: document.getElementById('results-body'),
    resetBtn: document.getElementById('reset-btn'),
    exitBtn: document.getElementById('exit-btn'),
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text')
  };

  // Initialize
  DOM.portsInput.value = DEFAULT_PORTS;
  setupListeners();
  restoreSession(); // Check localStorage on page load

  function setupListeners() {
    DOM.keyForm.addEventListener('submit', handleKeyVerify);
    DOM.scanForm.addEventListener('submit', handleScanSubmit);
    DOM.resetBtn.addEventListener('click', resetToConfig);
    
    if (DOM.exitBtn) {
      DOM.exitBtn.addEventListener('click', handleExit);
    }
    
    DOM.disclaimer.addEventListener('change', updateScanButtonState);
    [DOM.ipInput, DOM.portsInput].forEach(el => el.addEventListener('input', updateScanButtonState));
  }

  function restoreSession() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.key && typeof data.usesLeft === 'number') {
          state.key = data.key;
          state.usesLeft = data.usesLeft;
          updateUsesDisplay();
          switchStep('config');
        }
      }
    } catch (e) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function saveSession() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ key: state.key, usesLeft: state.usesLeft }));
  }

  function handleExit() {
    localStorage.removeItem(STORAGE_KEY);
    state.key = '';
    state.usesLeft = 0;
    DOM.keyInput.value = '';
    DOM.ipInput.value = '';
    DOM.portsInput.value = DEFAULT_PORTS;
    DOM.disclaimer.checked = false;
    DOM.scanBtn.disabled = true;
    DOM.resultsBody.innerHTML = '';
    clearMessages();
    updateUsesDisplay();
    switchStep('key');
  }

  async function handleKeyVerify(e) {
    e.preventDefault();
    const key = DOM.keyInput.value.trim();
    if (!key) return;
    setLoading(true, 'Проверка ключа...');
    clearMessages();

    try {
      const res = await fetch(`${API_BASE}/keys/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });

      const data = await res.json();

      if (!res.ok || !data.valid) {
        throw new Error(data.message || 'Ключ доступа не подтверждён.');
      }

      state.key = key;
      state.usesLeft = data.usesLeft;
      updateUsesDisplay();
      saveSession(); // Save to localStorage
      switchStep('config');
      showMessage('key-msg', 'Ключ подтверждён.', 'success');
    } catch (err) {
      showMessage('key-msg', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleScanSubmit(e) {
    e.preventDefault();
    if (state.isScanning) return;
    const ip = DOM.ipInput.value.trim();
    const ports = DOM.portsInput.value.trim();

    if (!validateInputs(ip, ports)) return;

    setLoading(true, 'Пожалуйста, подождите...');
    clearMessages();
    state.isScanning = true;
    DOM.scanBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/scans/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: state.key,
          ip,
          ports,
          acceptedDisclaimer: true
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Не удалось провести сканирование портов.');
      }

      state.usesLeft--;
      updateUsesDisplay();
      saveSession(); // Update uses count in localStorage
      renderResults(ip, data.results, data.durationMs);
      switchStep('results');
    } catch (err) {
      showMessage('scan-msg', err.message, 'error');
      state.isScanning = false;
      DOM.scanBtn.disabled = false;
    } finally {
      setLoading(false);
    }
  }

  function validateInputs(ip, ports) {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) {
      showMessage('scan-msg', 'Неверный формат IP адреса.', 'error');
      return false;
    }
    const portRegex = /^(\d+)(\s*,\s*\d+)*$/;
    if (!portRegex.test(ports)) {
      showMessage('scan-msg', 'Используйте запятые в перечеслении портов.', 'error');
      return false;
    }
    const portList = ports.split(',').map(p => parseInt(p.trim(), 10));
    if (portList.some(p => p < 1 || p > 65535)) {
      showMessage('scan-msg', 'Диапазон портов: от 1 до 65535.', 'error');
      return false;
    }
    if (portList.length > 100) {
      showMessage('scan-msg', 'Лимит сканирования: 100 портов.', 'error');
      return false;
    }
    return true;
  }

  function renderResults(ip, results, durationMs) {
    DOM.resultsMeta.innerHTML = `
      <p><strong>IP-адрес:</strong> ${escapeHtml(ip)}</p>
      <p><strong>Заняло:</strong> ${durationMs}ms</p>
      <p><strong>Открытых портов:</strong> ${results.filter(r => r.state === 'OPEN').length}</p>
    `;
    DOM.resultsBody.innerHTML = '';
    results.forEach(r => {
      const tr = document.createElement('tr');
      tr.className = `port-${r.state.toLowerCase()}`.replace(/открыт/i, 'open').replace(/закрыт/i, 'closed');
      tr.innerHTML = `
        <td>${r.port}</td>
        <td><span class="badge">${r.state}</span></td>
        <td>${getCommonService(r.port)}</td>
      `;
      DOM.resultsBody.appendChild(tr);
    });
  }

  function getCommonService(port) {
    const map = {
      21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS',
      80: 'HTTP', 110: 'POP3', 143: 'IMAP', 443: 'HTTPS', 3306: 'MySQL',
      3389: 'RDP', 5432: 'PostgreSQL', 8080: 'HTTP-Alt', 8443: 'HTTPS-Alt'
    };
    return map[port] || 'Неизвестен';
  }

  function switchStep(stepName) {
    Object.values(DOM.steps).forEach(el => {
      el.classList.add('hidden');
      el.classList.remove('active');
    });
    DOM.steps[stepName].classList.remove('hidden');
    DOM.steps[stepName].classList.add('active');
  }

  function setLoading(loading, text) {
    state.isScanning = loading;
    DOM.loadingOverlay.classList.toggle('hidden', !loading);
    if (text) DOM.loadingText.textContent = text;
  }

  function updateScanButtonState() {
    const ip = DOM.ipInput.value.trim();
    const ports = DOM.portsInput.value.trim();
    const checked = DOM.disclaimer.checked;
    const validIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
    const validPorts = /^(\d+)(\s*,\s*\d+)*$/.test(ports) &&
      ports.split(',').map(p => parseInt(p.trim(), 10)).every(p => p >= 1 && p <= 65535);
    DOM.scanBtn.disabled = !(validIp && validPorts && checked && !state.isScanning);
  }

  function updateUsesDisplay() {
    DOM.usesDisplay.textContent = `Осталось сканирований: ${state.usesLeft}`;
    DOM.usesDisplay.style.background = state.usesLeft === 0 ? '#fee2e2' : '#e0f2fe';
    DOM.usesDisplay.style.color = state.usesLeft === 0 ? '#991b1b' : '#0369a1';
  }

  function showMessage(elementId, message, type) {
    const el = document.getElementById(elementId);
    el.textContent = message;
    el.className = `msg ${type}`;
    el.classList.remove('hidden');
  }

  function clearMessages() {
    ['key-msg', 'scan-msg'].forEach(id => {
      const el = document.getElementById(id);
      el.textContent = '';
      el.className = 'msg hidden';
    });
  }

  function resetToConfig() {
    DOM.ipInput.value = '';
    DOM.portsInput.value = DEFAULT_PORTS;
    DOM.disclaimer.checked = false;
    DOM.scanBtn.disabled = true;
    DOM.resultsBody.innerHTML = '';
    clearMessages();
    updateScanButtonState();
    switchStep('config');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();