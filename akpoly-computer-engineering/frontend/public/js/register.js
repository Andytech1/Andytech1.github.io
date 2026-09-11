(function () {
  const roleButtons = document.querySelectorAll('.role-switch button');
  const roleInput = document.getElementById('role-input');
  const conditionalGroups = document.querySelectorAll('.conditional-fields');

  const registerStep = document.getElementById('register-step');
  const otpStep = document.getElementById('otp-step');
  const registerForm = document.getElementById('register-form');
  const otpForm = document.getElementById('otp-form');
  const registerBanner = document.getElementById('register-banner');
  const otpBanner = document.getElementById('otp-banner');
  const submitBtn = document.getElementById('register-submit');

  const fileInput = document.getElementById('receipt');
  const fileDropZone = document.getElementById('file-drop-zone');

  let pendingUserId = null;

  // --- Role switching -------------------------------------------------
  roleButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      roleButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const role = btn.dataset.role;
      roleInput.value = role;

      conditionalGroups.forEach((group) => {
        group.classList.toggle('active', group.dataset.for === role);
      });
    });
  });

  // --- File picker ------------------------------------------------------
  if (fileDropZone) {
    fileDropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) {
        fileDropZone.textContent = fileInput.files[0].name;
        fileDropZone.classList.add('has-file');
      }
    });
    fileDropZone.addEventListener('dragover', (e) => e.preventDefault());
    fileDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        fileDropZone.textContent = e.dataTransfer.files[0].name;
        fileDropZone.classList.add('has-file');
      }
    });
  }

  // --- Registration submit ----------------------------------------------
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideBanner(registerBanner);

    const role = roleInput.value;
    const formData = new FormData(registerForm);

    // Basic client-side sanity checks per role before hitting the API.
    if (role === 'student') {
      if (!formData.get('registration_number') || !formData.get('admission_year') || !formData.get('date_of_birth')) {
        showBanner(registerBanner, 'Please fill in registration number, admission year and date of birth.');
        return;
      }
    }
    if (role === 'lecturer' && !formData.get('staff_id')) {
      showBanner(registerBanner, 'Please provide your staff ID.');
      return;
    }
    if (role === 'hod' && !formData.get('admin_passcode')) {
      showBanner(registerBanner, 'HOD registration requires the admin security passcode.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account…';

    try {
      const data = await apiRequest('/auth/register', { method: 'POST', body: formData, isForm: true });
      pendingUserId = data.user_id;

      if (data.status === 'active') {
        // HOD path: account is instantly active, no OTP-gated approval needed,
        // but email verification still applies.
        showBanner(registerBanner, data.message, 'success');
      }

      registerStep.style.display = 'none';
      otpStep.classList.add('active');
    } catch (err) {
      showBanner(registerBanner, err.message || 'Registration failed. Please check your details and try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create account';
    }
  });

  // --- OTP verification ---------------------------------------------------
  otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideBanner(otpBanner);

    const code = document.getElementById('otp_code').value.trim();
    if (!pendingUserId) {
      showBanner(otpBanner, 'Something went wrong — please restart registration.');
      return;
    }

    try {
      const data = await apiRequest('/auth/verify-registration-otp', {
        method: 'POST',
        body: { user_id: pendingUserId, code },
      });
      showBanner(otpBanner, `${data.message} Redirecting to login…`, 'success');
      setTimeout(() => { window.location.href = 'login.html'; }, 1800);
    } catch (err) {
      showBanner(otpBanner, err.message || 'Verification failed.');
    }
  });
})();
