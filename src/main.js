import './style.css';
import { initAuth } from './auth';
import { renderPOS, initPOS } from './transactions';
import { renderProducts, initProducts } from './products';
import { renderHistory, initHistory } from './history';
import { renderReports, initReports } from './reports';
import { renderSettings, initSettings, getSettings } from './settings';

document.addEventListener('DOMContentLoaded', async () => {
  initAuth();
  initRouting();
  
  // Initial check for settings to update header
  try {
    const settings = await getSettings();
    const headerChurchName = document.getElementById('header-church-name');
    if (headerChurchName) headerChurchName.textContent = settings.churchName;
  } catch (e) {
    console.log("Waiting for auth to fetch settings...");
  }
});

const initRouting = () => {
  const navLinks = document.querySelectorAll('.nav-link[data-page], .mobile-nav-link[data-page]');
  const currentTitle = document.getElementById('current-view-title');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.getAttribute('data-page');
      
      // Update Active State for all links (mobile & desktop)
      navLinks.forEach(l => l.classList.remove('active'));
      document.querySelectorAll(`[data-page="${page}"]`).forEach(l => l.classList.add('active'));

      // Update Title
      const titleMap = {
        'pos': 'Transaksi Baru',
        'products': 'Manajemen Produk',
        'history': 'Riwayat Transaksi',
        'reports': 'Laporan Keuangan',
        'settings': 'Pengaturan Sistem'
      };
      currentTitle.textContent = titleMap[page] || 'Menu';

      // Load Page Content
      loadPage(page);
    });
  });

  // Listen for login success to load initial page
  window.addEventListener('auth-success', async () => {
    // Re-fetch settings on login
    const settings = await getSettings();
    document.getElementById('header-church-name').textContent = settings.churchName;
    loadPage('pos');
  });
};

export const loadPage = async (page) => {
  const contentArea = document.getElementById('content-area');
  contentArea.innerHTML = '<div class="loading" style="padding: 40px; text-align: center;">Memuat...</div>';

  try {
    switch (page) {
      case 'pos':
        contentArea.innerHTML = await renderPOS();
        await initPOS();
        break;
      case 'products':
        contentArea.innerHTML = await renderProducts();
        await initProducts();
        break;
      case 'history':
        contentArea.innerHTML = await renderHistory();
        await initHistory();
        break;
      case 'reports':
        contentArea.innerHTML = await renderReports();
        await initReports();
        break;
      case 'settings':
        contentArea.innerHTML = await renderSettings();
        await initSettings();
        break;
      default:
        contentArea.innerHTML = '<h3>Halaman tidak ditemukan</h3>';
    }
    
    // Re-initialize Lucide icons for new content
    if (window.lucide) {
      lucide.createIcons();
    }
  } catch (error) {
    console.error("Navigation Error:", error);
    contentArea.innerHTML = '<div class="error" style="color: #dc2626; padding: 40px; text-align: center;">Gagal memuat halaman. Pastikan koneksi internet stabil dan Firebase sudah terkonfigurasi.</div>';
  }
};
