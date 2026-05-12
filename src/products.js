import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase-config";
import { showToast } from "./toast";

const PRODUCTS_COLLECTION = "products";

const formatNumber = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const parseNumber = (str) => {
  return parseInt(str.replace(/\./g, "")) || 0;
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

export const getProducts = async () => {
  const q = query(collection(db, PRODUCTS_COLLECTION), orderBy("name"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const renderProducts = async () => {
  return `
    <div class="page-header" style="display: flex; justify-content: space-between; align-items: center;">
      <h3>Kelola Produk Pencarian Dana</h3>
      <button id="btn-add-product" class="btn-primary" style="width: auto; padding: 10px 20px;">
        <i data-lucide="plus"></i> Tambah Produk
      </button>
    </div>
    
    <div id="products-list" class="product-grid">
      <div class="loading">Memuat produk...</div>
    </div>
  `;
};

export const initProducts = () => {
  const productsList = document.getElementById('products-list');
  const btnAdd = document.getElementById('btn-add-product');
  
  // Real-time listener
  const q = query(collection(db, PRODUCTS_COLLECTION), orderBy("name"));
  onSnapshot(q, (snapshot) => {
    productsList.innerHTML = snapshot.docs.map(doc => {
      const p = doc.data();
      const isLowStock = p.stock <= 5;
      return `
        <div class="card">
          <img src="${p.imageUrl || 'https://placehold.co/400x400?text=Produk'}" class="card-img" alt="${p.name}">
          <div class="card-content">
            <h4 class="card-title">${p.name}</h4>
            <div class="card-price">Rp ${p.price.toLocaleString('id-ID')}</div>
            <div class="card-stock ${isLowStock ? 'low-stock' : ''}">
              Stok: ${p.stock} ${isLowStock ? '(Hampir Habis!)' : ''}
            </div>
            <div style="margin-top: 12px; display: flex; gap: 8px;">
              <button class="btn-edit" data-id="${doc.id}" style="background: #e5e7eb; padding: 6px 12px; border-radius: 8px; font-size: 0.8rem;">Edit</button>
              <button class="btn-delete" data-id="${doc.id}" style="background: #fee2e2; color: #dc2626; padding: 6px 12px; border-radius: 8px; font-size: 0.8rem;">Hapus</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    // Re-initialize icons
    if (window.lucide) lucide.createIcons();
  });

  // Event Delegation for Edit and Delete
  productsList.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.btn-edit');
    const deleteBtn = e.target.closest('.btn-delete');
    
    if (editBtn) {
      const id = editBtn.getAttribute('data-id');
      const products = await getProducts();
      const product = products.find(p => p.id === id);
      showProductModal(product);
    }
    
    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id');
      showCustomConfirm("Hapus produk ini?", async () => {
        try {
          await deleteDoc(doc(db, PRODUCTS_COLLECTION, id));
        } catch (error) {
          console.error("Delete error:", error);
          showToast("Gagal menghapus produk.", "error");
        }
      });
    }
  });

  btnAdd.addEventListener('click', () => showProductModal());
};

const showProductModal = (product = null) => {
  const modal = document.getElementById('modal-container');
  const modalBody = document.getElementById('modal-body');
  
  modalBody.innerHTML = `
    <h3 style="margin-bottom: 20px;">${product ? 'Edit Produk' : 'Tambah Produk Baru'}</h3>
    <form id="product-form">
      <div class="form-group">
        <label>Nama Produk</label>
        <input type="text" id="prod-name" class="form-input" value="${product ? product.name : ''}" required>
      </div>
      <div class="form-group">
        <label>Harga (Rp)</label>
        <input type="text" id="prod-price" class="form-input" value="${product ? formatNumber(product.price) : ''}" required placeholder="Contoh: 10.000">
      </div>
      <div class="form-group">
        <label>Stok Awal</label>
        <input type="number" id="prod-stock" class="form-input" value="${product ? product.stock : ''}" required>
      </div>
      <div class="form-group">
        <label>Kategori</label>
        <select id="prod-category" class="form-input">
          <option value="Makanan" ${product?.category === 'Makanan' ? 'selected' : ''}>Makanan</option>
          <option value="Minuman" ${product?.category === 'Minuman' ? 'selected' : ''}>Minuman</option>
          <option value="Kue" ${product?.category === 'Kue' ? 'selected' : ''}>Kue</option>
          <option value="Lainnya" ${product?.category === 'Lainnya' ? 'selected' : ''}>Lainnya</option>
        </select>
      </div>
      <div class="form-group">
        <label>Foto Produk (Upload File)</label>
        <input type="file" id="prod-image" class="form-input" accept="image/*" capture="environment">
        <div id="image-preview-container" style="margin-top: 10px; text-align: center; display: none;">
          <img id="image-preview" src="" style="max-width: 100%; max-height: 200px; border-radius: 8px; border: 1px solid var(--border);">
          <p style="font-size: 0.75rem; color: var(--text-muted);">Preview Gambar</p>
        </div>
        <small style="color: var(--text-muted); display: block; margin-top: 4px;">Atau masukkan link gambar di bawah:</small>
      </div>
      <div class="form-group">
        <label>Link Gambar (Opsional)</label>
        <input type="url" id="prod-image-url" class="form-input" placeholder="https://..." value="${product?.imageUrl?.startsWith('http') ? product.imageUrl : ''}">
      </div>
      <div style="display: flex; gap: 12px; margin-top: 24px;">
        <button type="button" class="btn-close-modal" style="flex: 1; padding: 12px; border-radius: 12px; background: #eee;">Batal</button>
        <button type="submit" class="btn-primary" style="flex: 2; margin-top: 0;">Simpan</button>
      </div>
    </form>
  `;
  
  modal.classList.add('active');
  
  const fileInput = document.getElementById('prod-image');
  const previewImg = document.getElementById('image-preview');
  const previewContainer = document.getElementById('image-preview-container');
  const urlInput = document.getElementById('prod-image-url');
  const priceInput = document.getElementById('prod-price');

  priceInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, "");
    e.target.value = value ? formatNumber(value) : "";
  });

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const base64 = await compressImage(file);
        previewImg.src = base64;
        previewContainer.style.display = 'block';
        urlInput.value = ''; // Clear URL if file is selected
      } catch (err) {
        console.error("Preview error:", err);
      }
    }
  });

  const form = document.getElementById('product-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('prod-name').value;
    const price = parseNumber(document.getElementById('prod-price').value);
    const stock = parseInt(document.getElementById('prod-stock').value);
    const category = document.getElementById('prod-category').value;
    const imageFile = document.getElementById('prod-image').files[0];
    
    try {
      let imageUrl = product ? product.imageUrl : '';
      const manualUrl = document.getElementById('prod-image-url').value.trim();
      
      // 1. Use manual URL if provided and not empty
      if (manualUrl) {
        imageUrl = manualUrl;
      } 
      // 2. Use uploaded file if selected (converted to Base64)
      else if (imageFile) {
        try {
          imageUrl = await compressImage(imageFile);
        } catch (convError) {
          console.error("Image conversion error:", convError);
          showToast("Gagal memproses gambar. Coba gambar lain.", "error");
          return;
        }
      }
      
      const productData = { 
        name, 
        price: parseInt(price), 
        stock: parseInt(stock), 
        category, 
        imageUrl: imageUrl || 'https://placehold.co/400x400?text=Produk',
        updatedAt: new Date()
      };
      
      if (product) {
        await updateDoc(doc(db, PRODUCTS_COLLECTION, product.id), productData);
      } else {
        await addDoc(collection(db, PRODUCTS_COLLECTION), productData);
      }
      
      modal.classList.remove('active');
      showToast(product ? 'Produk berhasil diperbarui! ✅' : 'Produk baru berhasil ditambahkan! 🎉', 'success');
    } catch (error) {
      console.error("Product Save Error:", error);
      showToast("Gagal menyimpan produk. Pastikan database sudah aktif.", "error");
    }
  });

  document.querySelector('.btn-close-modal').addEventListener('click', () => {
    modal.classList.remove('active');
  });
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
