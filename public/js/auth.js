// AshishVegan IoT - Authentication Handling

document.addEventListener('DOMContentLoaded', () => {
  // Check if user is already logged in
  const token = localStorage.getItem('ashishvegan_token');
  if (token) {
    fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success && window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
        window.location.href = '/dashboard.html';
      }
    })
    .catch(() => {
      localStorage.removeItem('ashishvegan_token');
      localStorage.removeItem('ashishvegan_user');
    });
  }

  // Auth Mode Toggle (Login vs Register)
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const loginFormContainer = document.getElementById('loginFormContainer');
  const registerFormContainer = document.getElementById('registerFormContainer');
  const authTitle = document.getElementById('authTitle');
  const authSubtitle = document.getElementById('authSubtitle');

  if (tabLogin && tabRegister) {
    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('bg-emerald-500', 'text-gray-950', 'shadow-lg');
      tabLogin.classList.remove('text-emerald-300', 'hover:text-white');
      tabRegister.classList.remove('bg-emerald-500', 'text-gray-950', 'shadow-lg');
      tabRegister.classList.add('text-emerald-300', 'hover:text-white');

      loginFormContainer.classList.remove('hidden');
      registerFormContainer.classList.add('hidden');
      if (authTitle) authTitle.innerText = 'Welcome Back';
      if (authSubtitle) authSubtitle.innerText = 'Log in to manage IoT environmental telemetry and devices';
    });

    tabRegister.addEventListener('click', () => {
      tabRegister.classList.add('bg-emerald-500', 'text-gray-950', 'shadow-lg');
      tabRegister.classList.remove('text-emerald-300', 'hover:text-white');
      tabLogin.classList.remove('bg-emerald-500', 'text-gray-950', 'shadow-lg');
      tabLogin.classList.add('text-emerald-300', 'hover:text-white');

      registerFormContainer.classList.remove('hidden');
      loginFormContainer.classList.add('hidden');
      if (authTitle) authTitle.innerText = 'Create Account';
      if (authSubtitle) authSubtitle.innerText = 'Join AshishVegan IoT Platform to monitor and automate';
    });
  }

  // Handle Login Submission
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      const btn = document.getElementById('loginSubmitBtn');
      const errBox = document.getElementById('loginError');

      if (errBox) errBox.classList.add('hidden');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Authenticating...';

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await response.json();

        if (data.success) {
          localStorage.setItem('ashishvegan_token', data.token);
          localStorage.setItem('ashishvegan_user', JSON.stringify(data.user));
          btn.innerHTML = '<i class="fa-solid fa-check mr-2"></i> Success! Redirecting...';
          btn.classList.remove('bg-emerald-500', 'hover:bg-emerald-400');
          btn.classList.add('bg-emerald-600');
          setTimeout(() => {
            window.location.href = '/dashboard.html';
          }, 600);
        } else {
          if (errBox) {
            errBox.innerText = data.message || 'Login failed. Please check credentials.';
            errBox.classList.remove('hidden');
          }
          btn.disabled = false;
          btn.innerHTML = '<span>Sign In to Dashboard</span><i class="fa-solid fa-arrow-right ml-2 text-xs"></i>';
        }
      } catch (err) {
        if (errBox) {
          errBox.innerText = 'Network error or server unreachable. Please try again.';
          errBox.classList.remove('hidden');
        }
        btn.disabled = false;
        btn.innerHTML = '<span>Sign In to Dashboard</span><i class="fa-solid fa-arrow-right ml-2 text-xs"></i>';
      }
    });
  }

  // Handle Register Submission
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('regName').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value;
      const btn = document.getElementById('regSubmitBtn');
      const errBox = document.getElementById('regError');

      if (errBox) errBox.classList.add('hidden');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Creating Account...';

      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });
        const data = await response.json();

        if (data.success) {
          localStorage.setItem('ashishvegan_token', data.token);
          localStorage.setItem('ashishvegan_user', JSON.stringify(data.user));
          btn.innerHTML = '<i class="fa-solid fa-check mr-2"></i> Registered! Opening Dashboard...';
          setTimeout(() => {
            window.location.href = '/dashboard.html';
          }, 600);
        } else {
          if (errBox) {
            errBox.innerText = data.message || 'Registration failed.';
            errBox.classList.remove('hidden');
          }
          btn.disabled = false;
          btn.innerHTML = '<span>Complete Registration</span><i class="fa-solid fa-user-plus ml-2 text-xs"></i>';
        }
      } catch (err) {
        if (errBox) {
          errBox.innerText = 'Network error or server unreachable. Please try again.';
          errBox.classList.remove('hidden');
        }
        btn.disabled = false;
        btn.innerHTML = '<span>Complete Registration</span><i class="fa-solid fa-user-plus ml-2 text-xs"></i>';
      }
    });
  }
});

// Global Logout function
window.logoutUser = async function() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {}
  localStorage.removeItem('ashishvegan_token');
  localStorage.removeItem('ashishvegan_user');
  window.location.href = '/index.html';
};
