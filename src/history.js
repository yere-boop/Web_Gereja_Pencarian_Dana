import { collection, getDocs, deleteDoc, doc, query, orderBy, where, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase-config";
import { showToast } from "./toast";

export const renderHistory = async () => {
  return `
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #ecfdf5, #d1fae5); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
          <i data-lucide="history" style="color: var(--primary); width: 20px; height: 20px;"></i>
        </div>
        <h3 style="margin: 0;">Riwayat Transaksi</h3>
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <select id="filter-method" class="form-input" style="width: auto; padding: 8px 14px; font-size: 0.85rem;">
          <option value="all">Semua Metode</option>
          <option value="Tunai">💵 Tunai</option>
          <option value="QRIS">📱 QRIS</option>
          <option value="Utang">📋 Utang</option>
        </select>
        <input type="date" id="filter-date" class="form-input" style="width: auto; padding: 8px 14px; font-size: 0.85rem;">
      </div>
    </div>
    
    <div id="history-list">
      <div class="loading">Memuat riwayat...</div>
    </div>
  `;
};

export const initHistory = async () => {
  const historyList = document.getElementById('history-list');
  const filterMethod = document.getElementById('filter-method');
  const filterDate = document.getElementById('filter-date');

  const loadData = async () => {
    historyList.innerHTML = '<div class="loading">Memuat...</div>';
    try {
      let q = query(collection(db, "transactions"));
      
      if (filterMethod.value !== 'all') {
        q = query(collection(db, "transactions"), where("paymentMethod", "==", filterMethod.value));
      }
      
      if (filterDate.value) {
        q = query(collection(db, "transactions"), where("date", "==", filterDate.value));
      }

      const snapshot = await getDocs(q);
      const transactions = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

      if (transactions.length === 0) {
        historyList.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--text-muted);">Tidak ada transaksi ditemukan.</p>';
        return;
      }

      historyList.innerHTML = `
        <div class="card" style="padding: 0; overflow: hidden;">
    <div class="table-responsive">
      <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background: #f8f9fa; border-bottom: 1px solid var(--border);">
                <th style="padding: 16px;">Tanggal & ID</th>
                <th style="padding: 16px;">Pembeli / Acara</th>
                <th style="padding: 16px;">Produk</th>
                <th style="padding: 16px;">Total / Metode</th>
                <th style="padding: 16px;">Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${transactions.map(t => `
                <tr style="border-bottom: 1px solid var(--border);">
                  <td style="padding: 16px;">
                    <div style="font-weight: 600;">${t.timestamp ? new Date(t.timestamp.seconds * 1000).toLocaleDateString('id-ID') : 'N/A'}</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted);">#${t.id.substring(0,8)}</div>
                  </td>
                  <td style="padding: 16px;">
                    <div style="font-weight: 600;">${t.buyerName}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${t.eventName}</div>
                  </td>
                  <td style="padding: 16px;">
                    <div style="font-size: 0.85rem;">
                      ${t.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}
                    </div>
                  </td>
                  <td style="padding: 16px;">
                    <div style="font-weight: 700; color: var(--primary);">Rp ${t.total.toLocaleString('id-ID')}</div>
                    <span class="badge ${t.paymentMethod === 'Tunai' ? 'badge-cash' : (t.paymentMethod === 'QRIS' ? 'badge-qris' : 'badge-debt')}">${t.paymentMethod}</span>
                    ${t.paymentMethod === 'Tunai' ? `
                      <div style="font-size: 0.7rem; margin-top: 4px; color: var(--text-muted);">
                        💵 Dibayar: Rp ${t.paymentDetails?.received?.toLocaleString('id-ID') || 0}<br>
                        💰 Kembalian: Rp ${t.paymentDetails?.change?.toLocaleString('id-ID') || 0}
                      </div>
                    ` : (t.paymentMethod === 'QRIS' ? `
                      <div style="margin-top: 4px;">
                        <img src="${t.paymentDetails?.qrisUrl || ''}" class="qris-thumb" style="width: 30px; height: 30px; border-radius: 4px; cursor: pointer; object-fit: cover;">
                      </div>
                    ` : `
                      <div style="font-size: 0.7rem; margin-top: 4px; color: #b45309; font-weight: 500;">
                        📌 Belum Lunas
                      </div>
                    `)}
                  </td>
                  <td style="padding: 16px;">
                    <button class="btn-delete-tx" data-id="${t.id}" style="color: #dc2626; background: none; font-size: 0.8rem;">Hapus</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      `;
    } catch (error) {
      console.error("Load History Error:", error);
      historyList.innerHTML = `<p style="text-align: center; padding: 40px; color: #dc2626;">Gagal memuat data: ${error.message}</p>`;
    }
  };

  filterMethod.onchange = loadData;
  filterDate.onchange = loadData;
  
  // Event Delegation for Delete and QRIS View
  historyList.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.btn-delete-tx');
    const qrisThumb = e.target.closest('.qris-thumb');
    
    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id');
      showCustomConfirm("Hapus transaksi ini? Stok produk akan dikembalikan otomatis. Lanjutkan?", async () => {
        try {
          // 1. Get transaction data to restore stock
          const txRef = doc(db, "transactions", id);
          const txSnap = await getDoc(txRef);
          
          if (txSnap.exists()) {
            const txData = txSnap.data();
            // 2. Restore stocks
            for (const item of txData.items) {
              const prodRef = doc(db, "products", item.id);
              const prodSnap = await getDoc(prodRef);
              if (prodSnap.exists()) {
                await updateDoc(prodRef, {
                  stock: prodSnap.data().stock + item.quantity
                });
              }
            }
          }
          
          // 3. Delete transaction
          await deleteDoc(txRef);
          showToast("Transaksi dihapus dan stok dikembalikan.", "success");
          loadData();
        } catch (error) {
          console.error("Delete transaction error:", error);
          showToast("Gagal menghapus transaksi.", "error");
        }
      });
    }
    
    if (qrisThumb) {
      const modal = document.getElementById('modal-container');
      const modalBody = document.getElementById('modal-body');
      modalBody.innerHTML = `
        <h3 style="margin-bottom: 16px;">Bukti Pembayaran QRIS</h3>
        <img src="${qrisThumb.src}" style="width: 100%; border-radius: 12px; border: 1px solid var(--border);">
        <button class="btn-primary btn-close-modal" style="margin-top: 24px;">Tutup</button>
      `;
      modal.classList.add('active');
      document.querySelector('.btn-close-modal').onclick = () => modal.classList.remove('active');
    }
  });

  loadData();
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
