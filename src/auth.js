import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase-config";

export const initAuth = () => {
  const authView = document.getElementById('auth-view');
  const appView = document.getElementById('app-view');
  const loginForm = document.getElementById('login-form');

  // Listen for auth state changes
  onAuthStateChanged(auth, (user) => {
    if (user) {
      authView.classList.add('hidden');
      appView.classList.remove('hidden');
      updateAdminProfile(user);
      // Trigger navigation to initial page (e.g. POS)
      window.dispatchEvent(new CustomEvent('auth-success'));
    } else {
      authView.classList.remove('hidden');
      appView.classList.add('hidden');
    }
  });

  // Handle Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // For convenience, we'll append a dummy domain if it's not an email
    const email = username.includes('@') ? username : `${username}@gpdigalilea.com`;

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Login Error:", error);
      alert("Login Gagal: Username atau Password salah.");
    }
  });

  // Handle Logout
  document.getElementById('btn-logout').addEventListener('click', () => {
    if (confirm("Apakah Anda yakin ingin keluar dari sistem?")) {
      signOut(auth);
    }
  });

  // Handle Toggle Password
  const toggleBtn = document.getElementById('toggle-password');
  const passwordInput = document.getElementById('password');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      toggleBtn.innerHTML = type === 'password' ? '<i data-lucide="eye"></i>' : '<i data-lucide="eye-off"></i>';
      lucide.createIcons();
    });
  }
};

const updateAdminProfile = (user) => {
  const adminDisplayName = document.getElementById('admin-display-name');
  // Use email prefix as display name if no display name is set
  adminDisplayName.textContent = user.displayName || user.email.split('@')[0];
};
