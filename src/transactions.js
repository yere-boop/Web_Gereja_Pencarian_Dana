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
        <div class="stat-label">Total Pemasukan Hari Ini</div>
        <div class="stat-value" id="pos-today-income">Rp ${totalIncomeToday.toLocaleString('id-ID')}</div>
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
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 10px;">
          <h3 style="margin: 0;">Keranjang</h3>
          <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">
            ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        
        <div class="form-group">
          <label>Nama Pembeli</label>
          <input type="text" id="buyer-name" class="form-input" placeholder="Nama Pembeli">
        </div>
        
        <div class="form-group">
          <label>Acara / Kegiatan</label>
          <input type="text" id="event-name" class="form-input" placeholder="Masukkan Nama Acara">
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
            <div style="display: flex; gap: 10px;">
              <button class="pay-method-btn active" data-method="Tunai" style="flex: 1; padding: 10px; border-radius: 10px; background: #eee;">Tunai</button>
              <button class="pay-method-btn" data-method="QRIS" style="flex: 1; padding: 10px; border-radius: 10px; background: #eee;">QRIS</button>
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
      methodBtns.forEach(b => b.classList.remove('active', 'btn-primary'));
      methodBtns.forEach(b => b.style.background = '#eee');
      methodBtns.forEach(b => b.style.color = 'inherit');
      
      btn.classList.add('active');
      btn.style.background = 'var(--primary)';
      btn.style.color = 'white';
      
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
      } else {
        payArea.innerHTML = `
          <div class="form-group">
            <label>Bukti Pembayaran QRIS</label>
            <input type="file" id="qris-proof" class="form-input" accept="image/*" capture="environment">
          </div>
        `;
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
      } else {
        const qrisFile = document.getElementById('qris-proof').files[0];
        if (!qrisFile) return alert("Mohon upload bukti QRIS.");
        
        try {
          const base64Proof = await compressImage(qrisFile, 600); // Slightly larger for receipt proof
          paymentDetails = { qrisUrl: base64Proof };
        } catch (error) {
          console.error("Proof compression error:", error);
          alert("Gagal memproses bukti pembayaran.");
          return;
        }
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
      document.getElementById('event-name').value = '';
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
  totalIncomeToday = snapshot.docs.reduce((sum, doc) => sum + doc.data().total, 0);
};

const showReceipt = async (transaction, id) => {
  const settings = await getSettings();
  const modal = document.getElementById('modal-container');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <div id="receipt-print" style="font-family: 'Courier New', Courier, monospace; color: #000; padding: 10px;">
      <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
        <h3 style="margin: 0;">${settings.churchName}</h3>
        <p style="font-size: 0.8rem; margin: 4px 0;">ID: ${id}</p>
        <p style="font-size: 0.8rem;">${new Date().toLocaleString('id-ID')}</p>
      </div>
      
      <div style="font-size: 0.9rem; margin-bottom: 10px;">
        <p>Pembeli: ${transaction.buyerName}</p>
        <p>Acara: ${transaction.eventName}</p>
      </div>
      
      <div style="border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
        ${transaction.items.map(item => `
          <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
            <span>${item.name} x${item.quantity}</span>
            <span>Rp ${(item.price * item.quantity).toLocaleString('id-ID')}</span>
          </div>
        `).join('')}
      </div>
      
      <div style="font-size: 1.1rem; font-weight: 700; display: flex; justify-content: space-between; margin-bottom: 10px;">
        <span>TOTAL</span>
        <span>Rp ${transaction.total.toLocaleString('id-ID')}</span>
      </div>
      
      <div style="font-size: 0.85rem; margin-bottom: 10px;">
        <p>Metode: ${transaction.paymentMethod}</p>
        ${transaction.paymentMethod === 'Tunai' ? `
          <p>Dibayar: Rp ${transaction.paymentDetails.received.toLocaleString('id-ID')}</p>
          <p>Kembali: Rp ${transaction.paymentDetails.change.toLocaleString('id-ID')}</p>
        ` : '<p>Status: LUNAS (QRIS)</p>'}
      </div>
      
      <div style="text-align: center; border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; font-size: 0.8rem;">
        <p>${settings.receiptFooter}</p>
      </div>
    </div>
    
    <div style="display: flex; gap: 10px; margin-top: 20px;">
      <button class="btn-primary" onclick="window.print()" style="flex: 1;">Cetak / Screenshot</button>
      <button class="btn-close-modal" style="flex: 1; padding: 12px; border-radius: 12px; background: #eee;">Tutup</button>
    </div>
  `;
  
  modal.classList.add('active');
  document.querySelector('.btn-close-modal').addEventListener('click', () => modal.classList.remove('active'));
};
