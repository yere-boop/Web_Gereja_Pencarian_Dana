import { collection, addDoc, getDocs, doc, updateDoc, query, where, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase-config";
import { getSettings } from "./settings";

const TRANSACTIONS_COLLECTION = "transactions";
const PRODUCTS_COLLECTION = "products";

const formatNumber = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const parseNumber = (str) => {
  return parseInt(str.toString().replace(/\./g, "")) || 0;
};

const compressImage = (file, maxWidth = 400) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to JPEG with 0.7 quality to keep size small for Firestore
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

let cart = [];
let totalIncomeToday = 0;

export const renderPOS = async () => {
  await calculateTodayIncome();
  
  return `
    <div class="stats-grid">
      <div class="stat-card">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #ecfdf5, #d1fae5); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i data-lucide="wallet" style="color: var(--primary); width: 22px; height: 22px;"></i>
          </div>
          <div>
            <div class="stat-label">Pemasukan Hari Ini</div>
            <div class="stat-value" id="pos-today-income">Rp ${totalIncomeToday.toLocaleString('id-ID')}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="pos-layout">
      <!-- Product Selection -->
      <div class="pos-products">
        <div class="form-group">
          <input type="text" id="pos-search" class="form-input" placeholder="Cari produk...">
        </div>
        <div id="pos-product-grid" class="product-grid">
          <!-- Products will be loaded here -->
        </div>
      </div>

      <!-- Cart Panel -->
      <div class="cart-panel">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 12px;">
          <h3 style="margin: 0; font-size: 1.1rem;">🛒 Keranjang</h3>
          <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600; background: var(--bg); padding: 4px 12px; border-radius: 100px;">
            ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>
        
        <div class="form-group">
          <label>Nama Pembeli</label>
          <input type="text" id="buyer-name" class="form-input" placeholder="Nama Pembeli">
        </div>
        
        <div class="form-group">
          <label>Lokasi / Kegiatan</label>
          <select id="event-name" class="form-input">
            <option value="Di dalam Gereja">Di dalam Gereja</option>
            <option value="Di luar Gereja">Di luar Gereja</option>
          </select>
        </div>

        <div class="cart-items" id="cart-items">
          <p style="text-align: center; color: var(--text-muted); margin-top: 20px;">Keranjang kosong</p>
        </div>

        <div class="cart-summary">
          <div class="summary-row">
            <span>Total</span>
            <span id="cart-total" style="font-weight: 700;">Rp 0</span>
          </div>
          
          <div class="form-group" style="margin-top: 16px;">
            <label>Metode Pembayaran</label>
            <div style="display: flex; gap: 8px;">
              <button class="pay-method-btn active" data-method="Tunai" style="flex: 1; padding: 10px; border-radius: 10px;">💵 Tunai</button>
              <button class="pay-method-btn" data-method="QRIS" style="flex: 1; padding: 10px; border-radius: 10px;">📱 QRIS</button>
              <button class="pay-method-btn" data-method="Utang" style="flex: 1; padding: 10px; border-radius: 10px;">📋 Utang</button>
            </div>
          </div>

          <div id="payment-details-area">
            <div class="form-group">
              <label>Uang Diterima</label>
              <input type="text" id="cash-received" class="form-input" placeholder="0">
            </div>
            <div class="summary-row" style="margin-top: 8px;">
              <span>Kembalian</span>
              <span id="cash-change" style="font-weight: 600; color: var(--primary);">Rp 0</span>
            </div>
          </div>

          <button id="btn-save-transaction" class="btn-primary" style="margin-top: 20px;">Simpan Transaksi</button>
        </div>
      </div>
    </div>
  `;
};

export const initPOS = async () => {
  const productGrid = document.getElementById('pos-product-grid');
  const cartItems = document.getElementById('cart-items');
  const cartTotal = document.getElementById('cart-total');
  const btnSave = document.getElementById('btn-save-transaction');
  
  const productsSnapshot = await getDocs(collection(db, PRODUCTS_COLLECTION));
  const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const renderProductGrid = (filter = '') => {
    productGrid.innerHTML = products
      .filter(p => p.name.toLowerCase().includes(filter.toLowerCase()))
      .map(p => `
        <div class="card product-item" data-id="${p.id}" style="cursor: pointer;">
          <img src="${p.imageUrl || 'https://placehold.co/400x400?text=Produk'}" class="card-img" style="height: 120px;">
          <div class="card-content" style="padding: 12px;">
            <h4 style="font-size: 0.9rem;">${p.name}</h4>
            <div style="font-weight: 700; color: var(--primary);">Rp ${p.price.toLocaleString('id-ID')}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Stok: ${p.stock}</div>
          </div>
        </div>
      `).join('');
    
    document.querySelectorAll('.product-item').forEach(card => {
      card.onclick = () => {
        const id = card.getAttribute('data-id');
        const p = products.find(prod => prod.id === id);
        addToCart(p);
      };
    });
  };

  renderProductGrid();

  document.getElementById('pos-search').oninput = (e) => renderProductGrid(e.target.value);

  // Payment Method Switching
  let currentMethod = 'Tunai';
  const methodBtns = document.querySelectorAll('.pay-method-btn');
  const payArea = document.getElementById('payment-details-area');

  methodBtns.forEach(btn => {
    btn.onclick = () => {
      methodBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      currentMethod = btn.getAttribute('data-method');
      
      if (currentMethod === 'Tunai') {
        payArea.innerHTML = `
          <div class="form-group">
            <label>Uang Diterima</label>
            <input type="text" id="cash-received" class="form-input" placeholder="0">
          </div>
          <div class="summary-row" style="margin-top: 8px;">
            <span>Kembalian</span>
            <span id="cash-change" style="font-weight: 600; color: var(--primary);">Rp 0</span>
          </div>
        `;
        initCashLogic();
      } else if (currentMethod === 'QRIS') {
        payArea.innerHTML = `
          <div class="form-group">
            <label>Bukti Pembayaran QRIS</label>
            <input type="file" id="qris-proof" class="form-input" accept="image/*" capture="environment">
          </div>
        `;
      } else {
        payArea.innerHTML = `
          <div style="background: #fffbeb; border: 1px solid #fcd34d; padding: 12px; border-radius: 12px; display: flex; gap: 10px; align-items: flex-start; margin-top: 10px;">
            <i data-lucide="info" style="color: #b45309; width: 20px; height: 20px; flex-shrink: 0;"></i>
            <p style="font-size: 0.85rem; color: #b45309; margin: 0;">Transaksi akan dicatat sebagai <b>Utang/Piutang</b>. Pastikan Nama Pembeli sudah benar.</p>
          </div>
        `;
        if (window.lucide) lucide.createIcons();
      }
    };
  });

  const initCashLogic = () => {
    const cashInput = document.getElementById('cash-received');
    const changeDisplay = document.getElementById('cash-change');
    if (cashInput) {
      cashInput.oninput = (e) => {
        // Formatting as you type
        let rawValue = e.target.value.replace(/\D/g, "");
        e.target.value = rawValue ? formatNumber(rawValue) : "";
        
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const received = parseNumber(e.target.value);
        const change = received - total;
        changeDisplay.textContent = `Rp ${change.toLocaleString('id-ID')}`;
        
        if (change < 0) {
          changeDisplay.style.color = '#dc2626';
        } else {
          changeDisplay.style.color = 'var(--primary)';
        }
      };
    }
  };
  
  initCashLogic();

  const addToCart = (product) => {
    if (product.stock <= 0) {
      alert("Stok habis!");
      return;
    }
    
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        alert("Stok tidak cukup!");
        return;
      }
      existing.quantity++;
    } else {
      cart.push({ ...product, quantity: 1 });
    }
    updateCartUI();
  };

  const updateCartUI = () => {
    if (cart.length === 0) {
      cartItems.innerHTML = '<p style="text-align: center; color: var(--text-muted); margin-top: 20px;">Keranjang kosong</p>';
      cartTotal.textContent = 'Rp 0';
      return;
    }

    cartItems.innerHTML = cart.map((item, index) => `
      <div class="cart-item">
        <div class="item-info">
          <h4>${item.name}</h4>
          <p>${item.quantity} x Rp ${item.price.toLocaleString('id-ID')}</p>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <button class="btn-remove" data-index="${index}" style="color: #dc2626; background: none;">×</button>
        </div>
      </div>
    `).join('');

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    cartTotal.textContent = `Rp ${total.toLocaleString('id-ID')}`;

    document.querySelectorAll('.btn-remove').forEach(btn => {
      btn.onclick = () => {
        const index = btn.getAttribute('data-index');
        cart.splice(index, 1);
        updateCartUI();
      };
    });
    
    initCashLogic();
  };

  btnSave.onclick = async () => {
    if (cart.length === 0) return alert("Keranjang masih kosong!");
    
    const buyerName = document.getElementById('buyer-name').value;
    const eventName = document.getElementById('event-name').value;
    
    if (!buyerName || !eventName) return alert("Mohon isi nama pembeli dan acara.");

    try {
      let paymentDetails = {};
      if (currentMethod === 'Tunai') {
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const received = parseNumber(document.getElementById('cash-received').value);
        if (received < total) return alert("Uang diterima kurang!");
        paymentDetails = { received, change: received - total };
      } else if (currentMethod === 'QRIS') {
        const qrisFile = document.getElementById('qris-proof').files[0];
        if (!qrisFile) return alert("Mohon upload bukti QRIS.");
        
        try {
          const base64Proof = await compressImage(qrisFile, 600);
          paymentDetails = { qrisUrl: base64Proof };
        } catch (error) {
          console.error("Proof compression error:", error);
          alert("Gagal memproses bukti pembayaran.");
          return;
        }
      } else {
        paymentDetails = { note: "Belum Bayar (Utang)" };
      }

      const transaction = {
        buyerName,
        eventName,
        items: cart,
        total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        paymentMethod: currentMethod,
        paymentDetails,
        timestamp: Timestamp.now(),
        date: new Date().toISOString().split('T')[0]
      };

      // Save Transaction
      const docRef = await addDoc(collection(db, TRANSACTIONS_COLLECTION), transaction);
      
      // Update Stocks
      for (const item of cart) {
        const prodRef = doc(db, PRODUCTS_COLLECTION, item.id);
        await updateDoc(prodRef, { stock: item.stock - item.quantity });
      }

      // Show Receipt
      showReceipt(transaction, docRef.id);
      
      // Reset
      cart = [];
      updateCartUI();
      document.getElementById('buyer-name').value = '';
      await calculateTodayIncome();
      document.getElementById('pos-today-income').textContent = `Rp ${totalIncomeToday.toLocaleString('id-ID')}`;

    } catch (error) {
      console.error("Transaction Save Error:", error);
      alert("Gagal menyimpan transaksi.");
    }
  };
};

const calculateTodayIncome = async () => {
  const today = new Date().toISOString().split('T')[0];
  const q = query(collection(db, TRANSACTIONS_COLLECTION), where("date", "==", today));
  const snapshot = await getDocs(q);
  totalIncomeToday = snapshot.docs.reduce((sum, doc) => {
    const data = doc.data();
    // Only count Tunai and QRIS as income
    if (data.paymentMethod !== 'Utang') {
      return sum + data.total;
    }
    return sum;
  }, 0);
};

const showReceipt = async (transaction, id) => {
  const settings = await getSettings();
  const modal = document.getElementById('modal-container');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <div id="receipt-print" style="font-family: 'Plus Jakarta Sans', sans-serif; color: #1a202c; padding: 8px;">
      <div style="text-align: center; border-bottom: 2px dashed var(--border); padding-bottom: 16px; margin-bottom: 16px;">
        <div style="font-size: 1.15rem; font-weight: 800; color: var(--primary);">${settings.churchName}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">ID: ${id.substring(0,12)}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${new Date().toLocaleString('id-ID')}</div>
      </div>
      
      <div style="font-size: 0.88rem; margin-bottom: 16px; display: grid; grid-template-columns: auto 1fr; gap: 4px 12px;">
        <span style="color: var(--text-muted);">Pembeli</span><span style="font-weight: 600;">${transaction.buyerName}</span>
        <span style="color: var(--text-muted);">Lokasi</span><span style="font-weight: 600;">${transaction.eventName}</span>
      </div>
      
      <div style="border-bottom: 2px dashed var(--border); padding-bottom: 12px; margin-bottom: 12px;">
        ${transaction.items.map(item => `
          <div style="display: flex; justify-content: space-between; font-size: 0.88rem; padding: 4px 0;">
            <span style="color: var(--text-secondary);">${item.name} <span style="color: var(--text-muted);">×${item.quantity}</span></span>
            <span style="font-weight: 600;">Rp ${(item.price * item.quantity).toLocaleString('id-ID')}</span>
          </div>
        `).join('')}
      </div>
      
      <div style="font-size: 1.2rem; font-weight: 800; display: flex; justify-content: space-between; margin-bottom: 12px; color: var(--primary);">
        <span>TOTAL</span>
        <span>Rp ${transaction.total.toLocaleString('id-ID')}</span>
      </div>
      
      <div style="font-size: 0.82rem; margin-bottom: 12px; background: var(--bg); padding: 10px 14px; border-radius: 10px;">
        <div style="display: flex; justify-content: space-between;"><span style="color: var(--text-muted);">Metode</span><span class="badge ${transaction.paymentMethod === 'Tunai' ? 'badge-cash' : (transaction.paymentMethod === 'QRIS' ? 'badge-qris' : 'badge-debt')}">${transaction.paymentMethod}</span></div>
        ${transaction.paymentMethod === 'Tunai' ? `
          <div style="display: flex; justify-content: space-between; margin-top: 6px;"><span style="color: var(--text-muted);">Dibayar</span><span style="font-weight: 600;">Rp ${transaction.paymentDetails.received.toLocaleString('id-ID')}</span></div>
          <div style="display: flex; justify-content: space-between; margin-top: 4px;"><span style="color: var(--text-muted);">Kembali</span><span style="font-weight: 700; color: var(--primary);">Rp ${transaction.paymentDetails.change.toLocaleString('id-ID')}</span></div>
        ` : (transaction.paymentMethod === 'Utang' ? '<div style="margin-top: 6px; color: #d97706;">📌 Dicatat sebagai piutang</div>' : '<div style="margin-top: 6px; color: var(--primary);">✅ Lunas via QRIS</div>')}
      </div>
      
      <div style="text-align: center; border-top: 2px dashed var(--border); padding-top: 12px; margin-top: 8px; font-size: 0.78rem; color: var(--text-muted);">
        ${settings.receiptFooter}
      </div>
    </div>
    
    <div style="display: flex; gap: 10px; margin-top: 20px;">
      <button class="btn-primary" onclick="window.print()" style="flex: 1;">🖨️ Cetak</button>
      <button class="btn-close-modal" style="flex: 1; padding: 12px; border-radius: var(--radius); background: var(--bg); font-weight: 600; color: var(--text-secondary);">Tutup</button>
    </div>
  `;
  
  modal.classList.add('active');
  document.querySelector('.btn-close-modal').addEventListener('click', () => modal.classList.remove('active'));
};
