import { collection, getDocs, deleteDoc, doc, writeBatch, query, orderBy } from "firebase/firestore";
import { db } from "./firebase-config";
import Chart from 'chart.js/auto';

export const renderReports = async () => {
  return `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Pemasukan (Semua)</div>
        <div class="stat-value" id="rep-total-all">Rp 0</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Transaksi Selesai</div>
        <div class="stat-value" id="rep-total-count">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Pemasukan Hari Ini</div>
        <div class="stat-value" id="rep-total-today">Rp 0</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px; margin-bottom: 32px;">
      <div class="card" style="padding: 24px;">
        <h4 style="margin-bottom: 16px;">Metode Pembayaran</h4>
        <canvas id="chart-methods"></canvas>
      </div>
      <div class="card" style="padding: 24px;">
        <h4 style="margin-bottom: 16px;">Produk Terlaris</h4>
        <canvas id="chart-products"></canvas>
      </div>
    </div>

    <div class="card" style="padding: 24px; margin-bottom: 32px;">
      <h4 style="margin-bottom: 20px;">Ekspor Data & Manajemen</h4>
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <button id="btn-export-all" class="btn-primary" style="width: auto;">Ekspor Semua ke CSV</button>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="export-event-name" class="form-input" placeholder="Nama Acara" style="width: 200px;">
          <button id="btn-export-event" class="btn-primary" style="width: auto; background: var(--primary-light);">Ekspor per Acara</button>
        </div>
        <button id="btn-delete-all" class="btn-primary" style="width: auto; background: #dc2626;">Hapus Semua Data Transaksi</button>
      </div>
    </div>
  `;
};

export const initReports = async () => {
  const snapshot = await getDocs(collection(db, "transactions"));
  const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  if (transactions.length === 0) return;

  const totalAll = transactions.reduce((sum, t) => sum + t.total, 0);
  const today = new Date().toISOString().split('T')[0];
  const totalToday = transactions.filter(t => t.date === today).reduce((sum, t) => sum + t.total, 0);
  
  document.getElementById('rep-total-all').textContent = `Rp ${totalAll.toLocaleString('id-ID')}`;
  document.getElementById('rep-total-count').textContent = transactions.length;
  document.getElementById('rep-total-today').textContent = `Rp ${totalToday.toLocaleString('id-ID')}`;

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
    `"${t.id}"`,
    `"${new Date(t.timestamp.seconds * 1000).toLocaleString('id-ID').replace(/"/g, '""')}"`,
    `"${(t.buyerName || '').replace(/"/g, '""')}"`,
    `"${(t.eventName || '').replace(/"/g, '""')}"`,
    `"${t.total}"`,
    `"${t.paymentMethod}"`,
    `"${t.items.map(i => `${i.name}(${i.quantity})`).join('|').replace(/"/g, '""')}"`
  ]);

  let csvContent = "data:text/csv;charset=utf-8," 
    + headers.join(",") + "\n"
    + rows.map(e => e.join(",")).join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
