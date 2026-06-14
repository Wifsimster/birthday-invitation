<template>
  <div class="admin-container">
    <div v-if="!isAuthenticated" class="modal-overlay">
      <div class="modal login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
        <div class="modal-header"><h3 id="login-title"><span aria-hidden="true">🔐</span> Admin</h3></div>
        <form class="auth-form" @submit.prevent="authenticate">
          <div class="form-group">
            <label for="login-username"><span aria-hidden="true">👤</span> Nom d'utilisateur</label>
            <input id="login-username" class="form-input" type="text" v-model="credentials.username" required />
          </div>
          <div class="form-group">
            <label for="login-password"><span aria-hidden="true">🔐</span> Mot de passe</label>
            <input id="login-password" class="form-input" type="password" v-model="credentials.password" required />
          </div>
          <div v-if="authError" class="auth-error" role="alert">{{ authError }}</div>
          <div class="modal-actions">
            <button type="submit" class="save-btn" :disabled="authLoading">{{ authLoading ? 'Connexion...' : 'Se connecter' }}</button>
          </div>
        </form>
      </div>
    </div>

    <template v-else>
      <div class="admin-header">
        <h1>🎉 Administration</h1>
        <div class="header-actions">
          <button class="logout-btn" @click="logout">🚪 Déconnexion</button>
          <router-link to="/" class="back-link">← Retour</router-link>
        </div>
      </div>

      <div class="stats">
        <div class="stat-card">
          <div class="stat-number">{{ stats.total_responses }}</div>
          <div class="stat-label">Total réponses</div>
        </div>
        <div class="stat-card positive">
          <div class="stat-number">{{ stats.confirmations }}</div>
          <div class="stat-label">Confirmations</div>
        </div>
        <div class="stat-card negative">
          <div class="stat-number">{{ stats.declined }}</div>
          <div class="stat-label">Déclins</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">{{ stats.total_guests }}</div>
          <div class="stat-label">Total invités</div>
        </div>
      </div>

      <div class="theme-panel">
        <h2>🎨 Thème de l'invitation</h2>
        <p class="theme-hint">Choisis l'ambiance affichée aux invités. Le changement est immédiat.</p>
        <div class="theme-grid">
          <button
            v-for="t in themes"
            :key="t.id"
            type="button"
            class="theme-card"
            :class="{ active: t.id === currentTheme }"
            :disabled="themeSaving"
            @click="selectTheme(t.id)"
          >
            <span class="theme-icon">{{ t.icon }}</span>
            <span class="theme-label">{{ t.label }}</span>
            <span class="theme-swatches">
              <span class="swatch" :style="{ background: t.palette.primary }"></span>
              <span class="swatch" :style="{ background: t.palette.secondary }"></span>
              <span class="swatch" :style="{ background: t.palette.accent }"></span>
            </span>
            <span v-if="t.id === currentTheme" class="theme-check">✓ Actif</span>
          </button>
        </div>
      </div>

      <div class="share-panel">
        <h2><span aria-hidden="true">🔗</span> Partager l'invitation</h2>
        <p class="theme-hint">Diffuse ce lien ou ce QR code pour inviter tes convives.</p>
        <div class="share-row">
          <input class="form-input share-url" type="text" :value="invitationUrl" readonly aria-label="Lien de l'invitation" />
          <button type="button" class="save-btn" @click="copyLink">{{ linkCopied ? '✓ Copié' : 'Copier le lien' }}</button>
        </div>
        <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR code de l'invitation" class="qr-img" />
      </div>

      <div class="list-actions">
        <button class="refresh-btn" @click="loadData">🔄 Actualiser</button>
        <button class="add-btn" @click="openCreateModal">➕ Ajouter une réponse</button>
      </div>

      <div class="rsvp-list">
        <h2>Réponses</h2>
        <div v-if="loading" class="loading" aria-live="polite">Chargement...</div>
        <div v-else-if="error" class="error" role="alert">{{ error }}</div>
        <div v-else-if="rsvps.length === 0" class="no-data">Aucune réponse pour le moment.</div>
        <template v-else>
          <div v-for="rsvp in rsvps" :key="rsvp.id" class="rsvp-item" :class="{ declined: rsvp.attending === 'no' }" aria-live="polite">
            <div class="rsvp-header">
              <h3>
                <span class="status-indicator" :class="rsvp.attending === 'yes' ? 'accepted' : 'declined'" aria-hidden="true">{{ rsvp.attending === 'yes' ? '✅' : '❌' }}</span>
                {{ rsvp.name }}
              </h3>
              <div class="rsvp-actions">
                <button class="edit-btn" @click="openEditModal(rsvp)" title="Modifier" :aria-label="`Modifier la réponse de ${rsvp.name}`">✏️</button>
                <button class="delete-btn" @click="openDeleteModal(rsvp)" title="Supprimer" :aria-label="`Supprimer la réponse de ${rsvp.name}`">🗑️</button>
              </div>
            </div>
            <div class="rsvp-details">
              <div class="detail">
                <strong>Statut :</strong>
                <span :class="rsvp.attending === 'yes' ? 'status-accepted' : 'status-declined'">{{ rsvp.attending === 'yes' ? 'Confirmé' : 'Décliné' }}</span>
              </div>
              <div class="detail" v-if="rsvp.email"><strong>✉️ Email :</strong> {{ rsvp.email }}</div>
              <div class="detail"><strong>📱 Téléphone :</strong> {{ rsvp.phone }}</div>
              <div class="detail" v-if="rsvp.attending === 'yes'"><strong>👥 Nombre d'invités :</strong> {{ rsvp.guests }}</div>
              <div class="detail" v-if="rsvp.dietary_restrictions"><strong>🥜 Allergies :</strong> {{ rsvp.dietary_restrictions }}</div>
              <div class="detail"><strong>🕒 Mis à jour :</strong> {{ formatDate(rsvp.updated_at) }}</div>
            </div>
            <div v-if="rsvp.message" class="message">💌 {{ rsvp.message }}</div>
          </div>
        </template>
      </div>
    </template>

    <div v-if="showEditModal" class="modal-overlay">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="edit-title">
        <div class="modal-header">
          <h3 id="edit-title">{{ editMode === 'create' ? 'Ajouter une réponse' : 'Modifier la réponse' }}</h3>
          <button class="close-btn" ref="editClose" @click="closeEditModal" aria-label="Fermer">×</button>
        </div>
        <form class="edit-form" @submit.prevent="saveEdit">
          <div class="form-group">
            <label for="edit-status">Statut <span aria-hidden="true">*</span></label>
            <select id="edit-status" class="form-input" v-model="editForm.attending" required aria-required="true">
              <option value="yes">Confirmé</option>
              <option value="no">Décliné</option>
            </select>
          </div>
          <div class="form-group"><label for="edit-name">Nom <span aria-hidden="true">*</span></label><input id="edit-name" ref="editName" class="form-input" v-model="editForm.name" required aria-required="true" /></div>
          <div class="form-group"><label for="edit-email"><span aria-hidden="true">✉️</span> Email</label><input id="edit-email" class="form-input" type="email" v-model="editForm.email" /></div>
          <div class="form-group"><label for="edit-phone"><span aria-hidden="true">📱</span> Téléphone <span aria-hidden="true">*</span></label><input id="edit-phone" class="form-input" v-model="editForm.phone" required aria-required="true" /></div>
          <div class="form-group"><label for="edit-guests">Nombre d'invités</label><input id="edit-guests" class="form-input" type="number" min="0" max="10" v-model.number="editForm.guests" /></div>
          <div class="form-group"><label for="edit-diet"><span aria-hidden="true">🥜</span> Allergies / régime</label><textarea id="edit-diet" class="form-input" v-model="editForm.dietary_restrictions"></textarea></div>
          <div class="form-group"><label for="edit-message"><span aria-hidden="true">💌</span> Message</label><textarea id="edit-message" class="form-input" v-model="editForm.message"></textarea></div>
          <div class="modal-actions">
            <button type="button" class="cancel-btn" @click="closeEditModal">Annuler</button>
            <button type="submit" class="save-btn" :disabled="editLoading">{{ editLoading ? 'Sauvegarde...' : (editMode === 'create' ? 'Ajouter' : 'Sauvegarder') }}</button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="showDeleteModal" class="modal-overlay">
      <div class="modal delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
        <div class="modal-header">
          <h3 id="delete-title">Supprimer la réponse</h3>
          <button class="close-btn" ref="deleteClose" @click="closeDeleteModal" aria-label="Fermer">×</button>
        </div>
        <div class="modal-content">
          <p>Supprimer la réponse de <strong>{{ rsvpToDelete?.name }}</strong> ?</p>
          <p class="warning">Cette action est irréversible.</p>
        </div>
        <div class="modal-actions">
          <button type="button" class="cancel-btn" @click="closeDeleteModal">Annuler</button>
          <button type="button" class="delete-confirm-btn" @click="deleteRsvp" :disabled="deleteLoading">{{ deleteLoading ? 'Suppression...' : 'Supprimer' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import QRCode from 'qrcode';
import { apiBaseUrl } from '../env.js';
import { themeList, applyTheme, DEFAULT_THEME } from '../themes.js';

export default {
  name: 'Admin',
  data() {
    return {
      themes: themeList,
      currentTheme: DEFAULT_THEME,
      themeSaving: false,
      isAuthenticated: false,
      authHeader: '',
      credentials: { username: '', password: '' },
      authError: null,
      authLoading: false,
      loading: false,
      error: null,
      refreshInterval: null,
      stats: { total_responses: 0, confirmations: 0, declined: 0, total_guests: 0 },
      rsvps: [],
      showEditModal: false,
      editMode: 'edit',
      editForm: { id: null, attending: 'yes', name: '', email: '', phone: '', guests: 1, dietary_restrictions: '', message: '' },
      editLoading: false,
      showDeleteModal: false,
      rsvpToDelete: null,
      deleteLoading: false,
      qrDataUrl: '',
      linkCopied: false,
      lastFocused: null
    };
  },
  computed: {
    invitationUrl() {
      return window.location.origin + '/';
    }
  },
  mounted() {
    // The theme is public; load and apply it so the admin page matches the
    // live invitation.
    this.loadTheme();
    window.addEventListener('keydown', this.handleKeydown);
    const saved = localStorage.getItem('adminAuth');
    if (saved) {
      this.authHeader = saved;
      this.isAuthenticated = true;
      this.loadData();
      this.generateQr();
      this.refreshInterval = setInterval(this.loadData, 30000);
    }
  },
  beforeUnmount() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    window.removeEventListener('keydown', this.handleKeydown);
  },
  methods: {
    async generateQr() {
      try {
        this.qrDataUrl = await QRCode.toDataURL(this.invitationUrl);
      } catch {
        // Leave the QR empty when generation fails.
        this.qrDataUrl = '';
      }
    },
    async copyLink() {
      try {
        await navigator.clipboard.writeText(this.invitationUrl);
        this.linkCopied = true;
        setTimeout(() => { this.linkCopied = false; }, 2000);
      } catch {
        // Clipboard may be unavailable; the link stays visible to copy manually.
      }
    },
    handleKeydown(e) {
      if (e.key !== 'Escape') return;
      // The login modal is intentionally not dismissible.
      if (this.showEditModal) this.closeEditModal();
      else if (this.showDeleteModal) this.closeDeleteModal();
    },
    focusFirst(refName) {
      this.$nextTick(() => {
        const el = this.$refs[refName];
        if (el && typeof el.focus === 'function') el.focus();
      });
    },
    restoreFocus() {
      if (this.lastFocused && typeof this.lastFocused.focus === 'function') {
        this.lastFocused.focus();
      }
      this.lastFocused = null;
    },
    formatDate(value) {
      return new Date(value).toLocaleString('fr-FR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    },
    async loadTheme() {
      try {
        const res = await fetch(`${apiBaseUrl}/settings`);
        if (res.ok) {
          const { theme } = await res.json();
          if (theme) {
            this.currentTheme = theme;
            applyTheme(theme);
          }
        }
      } catch {
        // Keep the default theme when settings can't be fetched.
      }
    },
    async selectTheme(id) {
      if (id === this.currentTheme || this.themeSaving) return;
      this.themeSaving = true;
      const previous = this.currentTheme;
      // Optimistically re-skin so the change is instant.
      this.currentTheme = id;
      applyTheme(id);
      try {
        const res = await fetch(`${apiBaseUrl}/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: this.authHeader },
          body: JSON.stringify({ theme: id })
        });
        if (!res.ok) {
          if (res.status === 401) { this.logout(); return; }
          const err = await res.json();
          throw new Error(err.error || 'Erreur lors du changement de thème');
        }
        const data = await res.json();
        this.currentTheme = data.theme;
        applyTheme(data.theme);
      } catch (err) {
        this.currentTheme = previous;
        applyTheme(previous);
        alert(err.message);
      } finally {
        this.themeSaving = false;
      }
    },
    async authenticate() {
      this.authLoading = true;
      this.authError = null;
      try {
        const token = btoa(`${this.credentials.username}:${this.credentials.password}`);
        this.authHeader = `Basic ${token}`;
        const res = await fetch(`${apiBaseUrl}/rsvps/count`, { headers: { Authorization: this.authHeader } });
        if (!res.ok) throw new Error('Identifiants incorrects');
        this.isAuthenticated = true;
        localStorage.setItem('adminAuth', this.authHeader);
        await this.loadData();
        this.generateQr();
        this.refreshInterval = setInterval(this.loadData, 30000);
      } catch (err) {
        this.authError = err.message;
      } finally {
        this.authLoading = false;
      }
    },
    logout() {
      this.isAuthenticated = false;
      this.authHeader = '';
      this.credentials.username = '';
      this.credentials.password = '';
      localStorage.removeItem('adminAuth');
      if (this.refreshInterval) clearInterval(this.refreshInterval);
    },
    async loadData() {
      if (!this.isAuthenticated) return;
      try {
        this.loading = true;
        this.error = null;
        const [countRes, listRes] = await Promise.all([
          fetch(`${apiBaseUrl}/rsvps/count`, { headers: { Authorization: this.authHeader } }),
          fetch(`${apiBaseUrl}/rsvps`, { headers: { Authorization: this.authHeader } })
        ]);
        if (!countRes.ok || !listRes.ok) {
          if (countRes.status === 401 || listRes.status === 401) { this.logout(); return; }
          throw new Error('Erreur lors de la récupération des données');
        }
        const count = await countRes.json();
        const list = await listRes.json();
        this.stats = {
          total_responses: count.total_responses || 0,
          confirmations: count.confirmations || 0,
          declined: count.declined || 0,
          total_guests: count.total_guests || 0
        };
        this.rsvps = list.rsvps || [];
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },
    openEditModal(rsvp) {
      this.lastFocused = document.activeElement;
      this.editMode = 'edit';
      this.editForm = {
        id: rsvp.id,
        attending: rsvp.attending || 'yes',
        name: rsvp.name,
        email: rsvp.email || '',
        phone: rsvp.phone,
        guests: rsvp.guests || 1,
        dietary_restrictions: rsvp.dietary_restrictions || '',
        message: rsvp.message || ''
      };
      this.showEditModal = true;
      this.focusFirst('editName');
    },
    openCreateModal() {
      this.lastFocused = document.activeElement;
      this.editMode = 'create';
      this.editForm = {
        id: null,
        attending: 'yes',
        name: '',
        email: '',
        phone: '',
        guests: 1,
        dietary_restrictions: '',
        message: ''
      };
      this.showEditModal = true;
      this.focusFirst('editName');
    },
    closeEditModal() {
      this.showEditModal = false;
      this.restoreFocus();
    },
    async saveEdit() {
      this.editLoading = true;
      try {
        const body = JSON.stringify({
          attending: this.editForm.attending,
          name: this.editForm.name,
          email: this.editForm.email,
          phone: this.editForm.phone,
          guests: this.editForm.guests,
          dietary_restrictions: this.editForm.dietary_restrictions,
          message: this.editForm.message
        });
        const res = this.editMode === 'create'
          ? await fetch(`${apiBaseUrl}/rsvps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: this.authHeader },
            body
          })
          : await fetch(`${apiBaseUrl}/rsvp/${this.editForm.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: this.authHeader },
            body
          });
        if (!res.ok) {
          if (res.status === 401) { this.logout(); return; }
          const err = await res.json();
          throw new Error(err.error || (this.editMode === 'create' ? 'Erreur lors de l\'ajout' : 'Erreur lors de la modification'));
        }
        await this.loadData();
        this.closeEditModal();
      } catch (err) {
        alert(err.message);
      } finally {
        this.editLoading = false;
      }
    },
    openDeleteModal(rsvp) {
      this.lastFocused = document.activeElement;
      this.rsvpToDelete = rsvp;
      this.showDeleteModal = true;
      this.focusFirst('deleteClose');
    },
    closeDeleteModal() {
      this.showDeleteModal = false;
      this.rsvpToDelete = null;
      this.restoreFocus();
    },
    async deleteRsvp() {
      this.deleteLoading = true;
      try {
        const res = await fetch(`${apiBaseUrl}/rsvp/${this.rsvpToDelete.id}`, {
          method: 'DELETE',
          headers: { Authorization: this.authHeader }
        });
        if (!res.ok) {
          if (res.status === 401) { this.logout(); return; }
          const err = await res.json();
          throw new Error(err.error || 'Erreur lors de la suppression');
        }
        await this.loadData();
        this.closeDeleteModal();
      } catch (err) {
        alert(err.message);
      } finally {
        this.deleteLoading = false;
      }
    }
  }
};
</script>

<style scoped>
.admin-container{min-height:100vh;background:var(--theme-bg-gradient,linear-gradient(135deg,#667eea,#764ba2));background-size:200% 200%;animation:gradientShift 12s ease infinite;padding:20px;transition:background .4s ease}
@keyframes gradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}to{background-position:0% 50%}}
.admin-header{max-width:1200px;margin:0 auto 20px;background:var(--theme-header-gradient,#ff6b6b);color:var(--theme-header-text,#fff);padding:30px;text-align:center;border-radius:15px;box-shadow:0 20px 40px #0000001a}
.admin-header h1{font-family:var(--theme-font-display,inherit)}
.admin-header h1{font-size:2rem;margin-bottom:10px}
.header-actions{display:flex;gap:15px;align-items:center;margin-top:10px}
.logout-btn{background:#ff4757;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:.9rem;transition:background-color .3s ease}
.logout-btn:hover{background:#ff3838}
.back-link{display:inline-block;margin-top:15px;padding:10px 20px;background:#fff3;color:#fff;text-decoration:none;border-radius:25px;font-size:.9rem;transition:all .3s ease;border:2px solid rgba(255,255,255,.3)}
.back-link:hover{background:#ffffff4d;transform:translateY(-2px);box-shadow:0 5px 15px #0003}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;max-width:1200px;margin:0 auto 20px;padding:0 20px}
.stat-card{background:#fff;padding:20px;border-radius:10px;text-align:center;box-shadow:0 4px 10px #0000001a}
.stat-card.positive .stat-number{color:#1b9e77}
.stat-card.negative .stat-number{color:#d64545}
.stat-number{font-size:2.5rem;font-weight:700;color:var(--theme-primary-dark,#c9184a);margin-bottom:5px}
.stat-label{color:#666;font-size:.9rem}
.theme-panel{max-width:1200px;margin:0 auto 20px;background:#fff;border-radius:15px;padding:25px 30px;box-shadow:0 20px 40px #0000001a}
.theme-panel h2{color:#333;margin-bottom:4px}
.theme-hint{color:#777;font-size:.9rem;margin-bottom:18px}
.theme-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px}
.theme-card{display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 12px;border:2px solid #e6e6e6;border-radius:14px;background:#fafafa;cursor:pointer;transition:all .2s ease;font-family:inherit}
.theme-card:hover:not(:disabled){transform:translateY(-3px);border-color:var(--theme-primary,#ff6b6b);box-shadow:0 8px 20px #0000001f}
.theme-card:disabled{opacity:.6;cursor:not-allowed}
.theme-card.active{border-color:var(--theme-primary,#ff6b6b);background:#fff;box-shadow:0 0 0 3px var(--theme-primary-soft,#ff6b6b55)}
.theme-icon{font-size:2rem;line-height:1}
.theme-label{font-weight:600;color:#333;font-size:.95rem;text-align:center}
.theme-swatches{display:flex;gap:5px}
.swatch{width:18px;height:18px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #0000001a}
.theme-check{font-size:.78rem;font-weight:700;color:var(--theme-primary,#ff6b6b)}
.refresh-btn{background:var(--theme-primary,#ff6b6b);color:#fff;border:none;padding:12px 24px;border-radius:25px;cursor:pointer;font-size:1rem;margin:0 auto 20px;display:block;transition:filter .3s ease}
.refresh-btn:hover{filter:brightness(.92)}
.rsvp-list{max-width:1200px;margin:0 auto;background:#fff;border-radius:15px;padding:30px;box-shadow:0 20px 40px #0000001a}
.rsvp-list h2{margin-bottom:20px;color:#333}
.rsvp-item{background:#f8f9fa;border-left:4px solid var(--theme-primary,#ff6b6b);padding:20px;margin-bottom:15px;border-radius:0 10px 10px 0}
.rsvp-item.declined{border-left-color:#ff7675;background:#ffeaea}
.rsvp-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.rsvp-header h3{color:var(--theme-primary,#ff6b6b);margin:0}
.rsvp-actions{display:flex;gap:10px}
.edit-btn,.delete-btn{background:none;border:none;font-size:1.2rem;cursor:pointer;padding:5px 8px;border-radius:5px;transition:background-color .3s ease}
.edit-btn:hover{background-color:#e3f2fd}
.delete-btn:hover{background-color:#ffebee}
.rsvp-item h3{color:var(--theme-primary,#ff6b6b);margin-bottom:10px}
.rsvp-details{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:10px}
.detail{color:#666}
.detail strong{color:#333}
.message{background:#fff;padding:10px;border-radius:5px;margin-top:10px;font-style:italic}
.loading{text-align:center;padding:50px;color:#666}
.error{background:#ff4757;color:#fff;padding:20px;margin:20px 0;border-radius:10px;text-align:center}
.no-data{text-align:center;color:#666;padding:50px}
.status-indicator{font-size:1.2rem;margin-right:8px}
.status-indicator.accepted{color:#4ecdc4}
.status-indicator.declined{color:#ff7675}
.status-accepted{color:#4ecdc4;font-weight:600}
.status-declined{color:#ff7675;font-weight:600}
.form-input:disabled{background-color:#f5f5f5;color:#666;cursor:not-allowed}
.login-modal{width:400px;max-width:90vw}
.modal-overlay{position:fixed;inset:0;background:#00000080;display:flex;justify-content:center;align-items:center;z-index:1000}
.modal{background:#fff;border-radius:15px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 40px #0003}
.modal-header{display:flex;justify-content:space-between;align-items:center;padding:20px 25px;border-bottom:1px solid #eee}
.modal-header h3{margin:0;color:#333}
.close-btn{background:none;border:none;font-size:1.5rem;cursor:pointer;color:#999;padding:5px;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center}
.close-btn:hover{background:#f5f5f5;color:#333}
.modal-content,.edit-form{padding:20px 25px}
.form-group{margin-bottom:20px}
.form-group label{display:block;margin-bottom:5px;font-weight:500;color:#333}
.form-input{width:100%;padding:10px 15px;border:2px solid #ddd;border-radius:8px;font-size:1rem;transition:border-color .3s ease;box-sizing:border-box}
.form-input:focus{outline:none;border-color:var(--theme-primary,#ff6b6b)}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;padding:20px 25px;border-top:1px solid #eee}
.cancel-btn,.save-btn,.delete-confirm-btn{padding:10px 20px;border:none;border-radius:8px;cursor:pointer;font-size:1rem;transition:all .3s ease}
.cancel-btn{background:#f5f5f5;color:#666}
.cancel-btn:hover{background:#e0e0e0}
.save-btn{background:var(--theme-primary,#ff6b6b);color:#fff}
.save-btn:hover:not(:disabled){filter:brightness(.92)}
.save-btn:disabled{opacity:.7;cursor:not-allowed}
.delete-confirm-btn{background:#dc3545;color:#fff}
.delete-confirm-btn:hover:not(:disabled){background:#c82333}
.delete-confirm-btn:disabled{opacity:.7;cursor:not-allowed}
.delete-modal .modal-content{text-align:center}
.warning{color:#dc3545;font-weight:500;margin-top:10px}
.login-modal{max-width:400px;width:90%}
.auth-form{padding:25px}
.auth-error{color:#ff4757;background:#ffeaea;padding:10px;border-radius:5px;margin-top:10px;text-align:center}
</style>
