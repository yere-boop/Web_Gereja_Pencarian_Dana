import { collection, getDocs, deleteDoc, doc, writeBatch, query, orderBy } from "firebase/firestore";
import { db } from "./firebase-config";
import Chart from 'chart.js/auto';

export const renderReports = async () => {
  return `
    <div class="stats-grid">
      <div class="stat-card">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #ecfdf5, #d1fae5); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i data-lucide="trending-up" style="color: var(--primary); width: 22px; height: 22px;"></i>
          </div>
          <div>
            <div class="stat-label">Total Pemasukan</div>
            <div class="stat-value" id="rep-total-all">Rp 0</div>
          </div>
        </div>
      </div>
      <div class="stat-card">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #eff6ff, #dbeafe); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i data-lucide="receipt" style="color: #2563eb; width: 22px; height: 22px;"></i>
          </div>
          <div>
            <div class="stat-label">Total Transaksi</div>
            <div class="stat-value" id="rep-total-count" style="color: #2563eb;">0</div>
          </div>
        </div>
      </div>
      <div class="stat-card">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #f0fdf4, #dcfce7); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i data-lucide="calendar-check" style="color: #16a34a; width: 22px; height: 22px;"></i>
          </div>
          <div>
            <div class="stat-label">Pemasukan Hari Ini</div>
            <div class="stat-value" id="rep-total-today" style="color: #16a34a;">Rp 0</div>
          </div>
        </div>
      </div>
      <div class="stat-card" style="border-left: 3px solid #fbbf24;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #fffbeb, #fef3c7); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i data-lucide="clock" style="color: #d97706; width: 22px; height: 22px;"></i>
          </div>
          <div>
            <div class="stat-label">Total Piutang</div>
            <div class="stat-value" id="rep-total-debt" style="color: #d97706;">Rp 0</div>
          </div>
        </div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 20px; margin-bottom: 28px;">
      <div class="card" style="padding: 24px; border: 1px solid var(--border-light, #f1f5f9);">
        <h4 style="margin-bottom: 16px; font-size: 0.95rem; color: var(--text-secondary, #4a5568);">📊 Metode Pembayaran</h4>
        <canvas id="chart-methods"></canvas>
      </div>
      <div class="card" style="padding: 24px; border: 1px solid var(--border-light, #f1f5f9);">
        <h4 style="margin-bottom: 16px; font-size: 0.95rem; color: var(--text-secondary, #4a5568);">🏆 Produk Terlaris</h4>
        <canvas id="chart-products"></canvas>
      </div>
    </div>

    <div class="card" style="padding: 24px; margin-bottom: 28px; border: 1px solid var(--border-light, #f1f5f9);">
      <h4 style="margin-bottom: 20px; font-size: 0.95rem; color: var(--text-secondary, #4a5568);">📁 Ekspor Data & Manajemen</h4>
      <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
        <button id="btn-export-all" class="btn-primary" style="width: auto; padding: 10px 20px;">📥 Ekspor Semua CSV</button>
        <div style="display: flex; gap: 8px; align-items: center;">
          <select id="export-event-name" class="form-input" style="width: auto; padding: 8px 14px; font-size: 0.85rem;">
            <option value="Di dalam Gereja">Di dalam Gereja</option>
            <option value="Di luar Gereja">Di luar Gereja</option>
          </select>
          <button id="btn-export-event" class="btn-primary" style="width: auto; padding: 10px 20px; background: var(--primary-light);">📥 Ekspor Lokasi</button>
        </div>
        <button id="btn-delete-all" class="btn-primary" style="width: auto; padding: 10px 20px; background: #ef4444; box-shadow: 0 2px 8px rgba(239,68,68,0.25);">🗑️ Hapus Semua</button>
      </div>
    </div>
  `;
};

export const initReports = async () => {
  const snapshot = await getDocs(collection(db, "transactions"));
  const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  if (transactions.length === 0) return;

  const totalAll = transactions
    .filter(t => t.paymentMethod !== 'Utang')
    .reduce((sum, t) => sum + t.total, 0);
    
  const totalDebt = transactions
    .filter(t => t.paymentMethod === 'Utang')
    .reduce((sum, t) => sum + t.total, 0);

  const today = new Date().toISOString().split('T')[0];
  const totalToday = transactions
    .filter(t => t.date === today && t.paymentMethod !== 'Utang')
    .reduce((sum, t) => sum + t.total, 0);
  
  document.getElementById('rep-total-all').textContent = `Rp ${totalAll.toLocaleString('id-ID')}`;
  document.getElementById('rep-total-count').textContent = transactions.length;
  document.getElementById('rep-total-today').textContent = `Rp ${totalToday.toLocaleString('id-ID')}`;
  document.getElementById('rep-total-debt').textContent = `Rp ${totalDebt.toLocaleString('id-ID')}`;

  // Charts
  renderMethodChart(transactions);
  renderProductChart(transactions);

  // Actions
  document.getElementById('btn-export-all').onclick = () => exportToCSV(transactions);
  document.getElementById('btn-export-event').onclick = () => {
    const event = document.getElementById('export-event-name').value;
    if (!event) return alert("Masukkan nama acara!");
    const filtered = transactions.filter(t => t.eventName.toLowerCase().includes(event.toLowerCase()));
    exportToCSV(filtered, `Laporan_${event}`);
  };
  
  document.getElementById('btn-delete-all').onclick = async () => {
    showCustomConfirm("PERINGATAN: Ini akan menghapus SELURUH data transaksi. Tindakan ini tidak bisa dibatalkan. Lanjutkan?", async () => {
      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      alert("Semua data transaksi telah dihapus.");
      location.reload();
    });
  };
};

const renderMethodChart = (transactions) => {
  const ctx = document.getElementById('chart-methods');
  const data = {
    Tunai: transactions.filter(t => t.paymentMethod === 'Tunai').length,
    QRIS: transactions.filter(t => t.paymentMethod === 'QRIS').length
  };

  new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Tunai', 'QRIS'],
      datasets: [{
        data: [data.Tunai, data.QRIS],
        backgroundColor: ['#10b981', '#3b82f6']
      }]
    }
  });
};

const renderProductChart = (transactions) => {
  const ctx = document.getElementById('chart-products');
  const productSales = {};
  
  transactions.forEach(t => {
    t.items.forEach(item => {
      productSales[item.name] = (productSales[item.name] || 0) + item.quantity;
    });
  });

  const sorted = Object.entries(productSales).sort((a,b) => b[1] - a[1]).slice(0, 5);

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(s => s[0]),
      datasets: [{
        label: 'Jumlah Terjual',
        data: sorted.map(s => s[1]),
        backgroundColor: '#064e3b'
      }]
    },
    options: { indexAxis: 'y' }
  });
};

const exportToCSV = (data, filename = 'Laporan_Transaksi') => {
  if (data.length === 0) return alert("Tidak ada data untuk diekspor.");
  
  const headers = ['ID', 'Tanggal', 'Pembeli', 'Acara', 'Total', 'Metode', 'Produk'];
  const rows = data.map(t => [
    t.id,
    new Date(t.timestamp.seconds * 1000).toLocaleString('id-ID'),
    t.buyerName || '',
    t.eventName || '',
    t.total,
    t.paymentMethod,
    t.items.map(i => `${i.name}(${i.quantity})`).join(' | ')
  ]);

  const separator = ";";
  let csvContent = "sep=" + separator + "\r\n";
  csvContent += headers.join(separator) + "\r\n";
  csvContent += rows.map(r => r.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(separator)).join("\r\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  // Sanitize filename: replace spaces with underscore and remove non-alphanumeric
  const safeFilename = filename.replace(/\s+/g, '_').replace(/[^a-z0-9_]/gi, '');
  
  link.href = url;
  link.setAttribute("download", `${safeFilename}.csv`);
  link.style.visibility = 'hidden';
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  
  // Cleanup after a short delay
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
};

const showCustomConfirm = (message, onConfirm) => {
  const modal = document.getElementById('modal-container');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <div style="text-align: center; padding: 20px;">
      <div style="background: #fee2e2; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: #dc2626;">
        <i data-lucide="alert-triangle" style="width: 32px; height: 32px;"></i>
      </div>
      <h3 style="margin-bottom: 12px;">Konfirmasi Hapus</h3>
      <p style="color: var(--text-muted); margin-bottom: 30px;">${message}</p>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button id="confirm-cancel" class="btn-primary" style="background: #e5e7eb; color: var(--text); flex: 1;">Batal</button>
        <button id="confirm-ok" class="btn-primary" style="background: #dc2626; flex: 1;">Hapus</button>
      </div>
    </div>
  `;
  
  modal.classList.add('active');
  if (window.lucide) lucide.createIcons();

  document.getElementById('confirm-cancel').onclick = () => modal.classList.remove('active');
  document.getElementById('confirm-ok').onclick = async () => {
    modal.classList.remove('active');
    await onConfirm();
  };
};
