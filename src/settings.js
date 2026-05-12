import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { updatePassword, updateProfile } from "firebase/auth";
import { db, auth } from "./firebase-config";
import { showToast } from "./toast";

const SETTINGS_DOC_ID = "general";

export const getSettings = async () => {
  const docRef = doc(db, "settings", SETTINGS_DOC_ID);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data();
  } else {
    // Initial default settings
    const defaults = {
      churchName: "GPdI Galilea Tondano",
      receiptFooter: "Terima kasih atas partisipasi Anda dalam pencarian dana ini. Tuhan Yesus memberkati!"
    };
    await setDoc(docRef, defaults);
    return defaults;
  }
};

export const renderSettings = async () => {
  const settings = await getSettings();
  
  return `
    <div class="card" style="max-width: 600px; margin: 0 auto; padding: 32px;">
      <h3 style="margin-bottom: 24px;">Pengaturan Sistem</h3>
      
      <form id="settings-form">
        <div class="form-group">
          <label>Nama Gereja</label>
          <input type="text" id="set-church-name" class="form-input" value="${settings.churchName}" required>
        </div>
        
        <div class="form-group">
          <label>Ucapan Terima Kasih (Struk)</label>
          <textarea id="set-receipt-footer" class="form-input" rows="3" required>${settings.receiptFooter}</textarea>
        </div>
        
        <hr style="margin: 24px 0; border: none; border-top: 1px solid var(--border);">
        
        <h4 style="margin-bottom: 16px;">Ganti Kredensial Login</h4>
        
        <div class="form-group">
          <label>Username Baru</label>
          <input type="text" id="set-username" class="form-input" placeholder="Kosongkan jika tidak ingin ganti">
        </div>
        
        <div class="form-group">
          <label>Password Baru</label>
          <input type="password" id="set-password" class="form-input" placeholder="Kosongkan jika tidak ingin ganti">
        </div>
        
        <button type="submit" class="btn-primary" style="margin-top: 16px;">Simpan Perubahan</button>
      </form>
    </div>
  `;
};

export const initSettings = () => {
  const form = document.getElementById('settings-form');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const churchName = document.getElementById('set-church-name').value;
    const receiptFooter = document.getElementById('set-receipt-footer').value;
    const newUsername = document.getElementById('set-username').value;
    const newPassword = document.getElementById('set-password').value;
    
    try {
      // Update Firestore Settings
      const docRef = doc(db, "settings", SETTINGS_DOC_ID);
      await updateDoc(docRef, { churchName, receiptFooter });
      
      // Update UI Header
      document.getElementById('header-church-name').textContent = churchName;
      
      // Update Auth Profile if username changed
      if (newUsername) {
        await updateProfile(auth.currentUser, { displayName: newUsername });
        document.getElementById('admin-display-name').textContent = newUsername;
      }
      
      // Update Password if provided
      if (newPassword) {
        await updatePassword(auth.currentUser, newPassword);
      }
      
      showToast("Pengaturan berhasil disimpan! ✅", "success");
    } catch (error) {
      console.error("Settings Update Error:", error);
      showToast("Gagal menyimpan pengaturan. Pastikan Anda memiliki izin.", "error");
    }
  });
};
