// ═══════════════════════════════════════
// TOAST NOTIFICATION SYSTEM
// ═══════════════════════════════════════

let toastContainer = null;

const ensureContainer = () => {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
};

/**
 * Tampilkan toast notifikasi
 * @param {string} message - Pesan yang ditampilkan
 * @param {'success'|'error'|'warning'|'info'} type - Jenis toast
 * @param {number} duration - Durasi dalam ms (default 3000)
 */
export const showToast = (message, type = 'info', duration = 3000) => {
  const container = ensureContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconMap = {
    success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
  };

  toast.innerHTML = `
    <div class="toast-icon">${iconMap[type]}</div>
    <div class="toast-message">${message}</div>
    <button class="toast-close" onclick="this.parentElement.classList.add('toast-exit')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;

  container.appendChild(toast);

  // Trigger animasi masuk
  requestAnimationFrame(() => {
    toast.classList.add('toast-enter');
  });

  // Auto-dismiss
  const timer = setTimeout(() => {
    dismissToast(toast);
  }, duration);

  // Klik tombol tutup
  toast.querySelector('.toast-close').addEventListener('click', () => {
    clearTimeout(timer);
    dismissToast(toast);
  });
};

const dismissToast = (toast) => {
  toast.classList.add('toast-exit');
  toast.addEventListener('animationend', () => {
    toast.remove();
  });
};

/**
 * Tampilkan dialog konfirmasi cantik (pengganti confirm())
 * @param {string} title - Judul dialog
 * @param {string} message - Pesan dialog
 * @param {'danger'|'warning'|'info'} type - Jenis dialog
 * @returns {Promise<boolean>}
 */
export const showConfirm = (title, message, type = 'danger') => {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-container');
    const modalBody = document.getElementById('modal-body');

    const colorMap = {
      danger: { bg: '#fef2f2', color: '#dc2626', icon: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`, btnBg: '#dc2626' },
      warning: { bg: '#fffbeb', color: '#d97706', icon: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`, btnBg: '#d97706' },
      info: { bg: '#ecfdf5', color: '#059669', icon: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`, btnBg: '#059669' }
    };

    const c = colorMap[type];

    modalBody.innerHTML = `
      <div style="text-align: center; padding: 12px;">
        <div style="background: ${c.bg}; width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: ${c.color};">
          ${c.icon}
        </div>
        <h3 style="margin-bottom: 8px; font-size: 1.1rem;">${title}</h3>
        <p style="color: var(--text-muted); margin-bottom: 28px; font-size: 0.9rem; line-height: 1.5;">${message}</p>
        <div style="display: flex; gap: 12px;">
          <button id="confirm-cancel" class="btn-primary" style="background: var(--border); color: var(--text); flex: 1; box-shadow: none;">Batal</button>
          <button id="confirm-ok" class="btn-primary" style="background: ${c.btnBg}; flex: 1;">Ya, Lanjutkan</button>
        </div>
      </div>
    `;

    modal.classList.add('active');

    document.getElementById('confirm-cancel').onclick = () => {
      modal.classList.remove('active');
      resolve(false);
    };

    document.getElementById('confirm-ok').onclick = () => {
      modal.classList.remove('active');
      resolve(true);
    };
  });
};
