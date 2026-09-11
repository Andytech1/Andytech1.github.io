// Shared helpers used by register.js and login.js

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:4000/api'
  : '/api';

/** Lightweight, non-cryptographic device fingerprint used for OTP "recognized device" checks. */
function getDeviceFingerprint() {
  const key = 'akpoly_device_fp';
  let fp = localStorage.getItem(key);
  if (!fp) {
    fp = `${navigator.userAgent}-${screen.width}x${screen.height}-${Math.random().toString(36).slice(2)}`;
    fp = btoa(fp).slice(0, 40);
    localStorage.setItem(key, fp);
  }
  return fp;
}

async function apiRequest(path, { method = 'GET', body, isForm = false } = {}) {
  const opts = {
    method,
    credentials: 'include',
    headers: isForm ? {} : { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = isForm ? body : JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  let data = {};
  try { data = await res.json(); } catch (_) { /* no body */ }

  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function showBanner(el, message, type = 'error') {
  el.textContent = message;
  el.className = `status-banner show ${type}`;
}

function hideBanner(el) {
  el.className = 'status-banner';
}
