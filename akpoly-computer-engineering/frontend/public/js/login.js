(function () {
  const tabButtons = document.querySelectorAll('.login-tabs button');
  const identifierLabel = document.getElementById('identifier-label');
  const identifierInput = document.getElementById('identifier');

  const loginStep = document.getElementById('login-step');
  const otpStep = document.getElementById('otp-step');
  const loginForm = document.getElementById('login-form');
  const otpForm = document.getElementById('otp-form');
  const loginBanner = document.getElementById('login-banner');
  const otpBanner = document.getElementById('otp-banner');
  const submitBtn = document.getElementById('login-submit');

  let pendingUserId = null;

  // --- Tab switching (changes the identifier field's label/placeholder only;
  // the backend auto-detects student vs staff by whether the value has an @) ---
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.mode === 'student') {
        identifierLabel.textContent = 'Registration number';
        identifierInput.placeholder = 'e.g. CE/ND/24/0123';
        identifierInput.type = 'text';
      } else {
        identifierLabel.textContent = 'Email address';
        identifierInput.placeholder = 'you@akwaibompoly.edu.ng';
        identifierInput.type = 'email';
      }
    });
  });

  function goToDashboard(data) {
    // In production the SPA/portal apps live at these routes behind the same domain.
    window.location.href = data.redirect || '/';
  }

  // --- Credentials submit -----------------------------------------------
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideBanner(loginBanner);

    const identifier = identifierInput.value.trim();
    const password = document.getElementById('password').value;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in…';

    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: { identifier, password, device_fingerprint: getDeviceFingerprint() },
      });

      if (data.otp_required) {
        pendingUserId = data.user_id;
        showBanner(loginBanner, data.message, 'success');
        loginStep.style.display = 'none';
        otpStep.classList.add('active');
      } else {
        goToDashboard(data);
      }
    } catch (err) {
      showBanner(loginBanner, err.message || 'Login failed. Check your credentials and try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log in';
    }
  });

  // --- Device OTP ----------------------------------------------------------
  otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideBanner(otpBanner);

    const code = document.getElementById('otp_code').value.trim();
    if (!pendingUserId) {
      showBanner(otpBanner, 'Session expired — please log in again.');
      return;
    }

    try {
      const data = await apiRequest('/auth/verify-login-otp', {
        method: 'POST',
        body: { user_id: pendingUserId, code, device_fingerprint: getDeviceFingerprint() },
      });
      goToDashboard(data);
    } catch (err) {
      showBanner(otpBanner, err.message || 'Verification failed.');
    }
  });
})();
