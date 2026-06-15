<template>
  <div class="admin-container">
    <div v-if="!isAuthenticated" class="modal-overlay">
      <div class="modal login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
        <div class="modal-header"><h3 id="login-title"><span aria-hidden="true">🔐</span> Admin</h3></div>
        <form class="auth-form" @submit.prevent="authenticate">
          <div class="form-group">
            <label for="login-email"><span aria-hidden="true">✉️</span> Email</label>
            <input id="login-email" class="form-input" type="email" autocomplete="username" v-model="credentials.email" required />
          </div>
          <div class="form-group">
            <label for="login-password"><span aria-hidden="true">🔐</span> Mot de passe</label>
            <input id="login-password" class="form-input" type="password" autocomplete="current-password" v-model="credentials.password" required />
          </div>
          <div v-if="authError" class="auth-error" role="alert">{{ authError }}</div>
          <div class="modal-actions">
            <button type="submit" class="btn btn-primary btn-block" :disabled="authLoading">{{ authLoading ? 'Connexion...' : 'Se connecter' }}</button>
          </div>
        </form>
      </div>
    </div>

    <template v-else>
      <header class="admin-header">
        <div class="admin-header-title">
          <h1>Administration</h1>
          <p class="admin-header-subtitle">Gestion des confirmations pour l'anniversaire</p>
        </div>
        <div class="header-actions">
          <router-link to="/" class="btn btn-ghost">← Retour à l'invitation</router-link>
          <button class="btn btn-danger-soft" @click="logout">Déconnexion</button>
        </div>
      </header>

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
          <button type="button" class="btn btn-primary" @click="copyLink">{{ linkCopied ? '✓ Copié' : 'Copier le lien' }}</button>
        </div>
        <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR code de l'invitation" class="qr-img" />
      </div>

      <div class="list-actions">
        <button class="btn btn-secondary" @click="loadData">↻ Actualiser</button>
        <button class="btn btn-primary" @click="openCreateModal">+ Ajouter une réponse</button>
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
            <button type="button" class="btn btn-secondary" @click="closeEditModal">Annuler</button>
            <button type="submit" class="btn btn-primary" :disabled="editLoading">{{ editLoading ? 'Sauvegarde...' : (editMode === 'create' ? 'Ajouter' : 'Sauvegarder') }}</button>
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
          <button type="button" class="btn btn-secondary" @click="closeDeleteModal">Annuler</button>
          <button type="button" class="btn btn-danger" @click="deleteRsvp" :disabled="deleteLoading">{{ deleteLoading ? 'Suppression...' : 'Supprimer' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import QRCode from 'qrcode';
import { apiBaseUrl } from '../env.js';
import { authClient } from '../auth-client.js';
import { themeList, applyTheme, DEFAULT_THEME } from '../themes.js';

export default {
  name: 'Admin',
  data() {
    return {
      themes: themeList,
      currentTheme: DEFAULT_THEME,
      themeSaving: false,
      isAuthenticated: false,
      credentials: { email: '', password: '' },
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
    // Restore an existing admin session (Better Auth cookie) if one is present.
    this.restoreSession();
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
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
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
    async restoreSession() {
      // Ask the server whether a valid admin session cookie is already set.
      try {
        const { data } = await authClient.getSession();
        if (data?.session) this.startSession();
      } catch {
        // No session / network error: stay on the login screen.
      }
    },
    // Mark the admin authenticated and kick off the data loading + polling.
    startSession() {
      this.isAuthenticated = true;
      this.loadData();
      this.generateQr();
      if (!this.refreshInterval) this.refreshInterval = setInterval(this.loadData, 30000);
    },
    async authenticate() {
      this.authLoading = true;
      this.authError = null;
      try {
        const { error } = await authClient.signIn.email({
          email: this.credentials.email,
          password: this.credentials.password
        });
        if (error) throw new Error('Identifiants incorrects');
        this.credentials.password = '';
        this.startSession();
      } catch (err) {
        this.authError = err.message || 'Identifiants incorrects';
      } finally {
        this.authLoading = false;
      }
    },
    async logout() {
      try {
        await authClient.signOut();
      } catch {
        // Best-effort: clear local state even if the network call fails.
      }
      this.isAuthenticated = false;
      this.credentials.email = '';
      this.credentials.password = '';
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
      }
    },
    async loadData() {
      if (!this.isAuthenticated) return;
      try {
        this.loading = true;
        this.error = null;
        const [countRes, listRes] = await Promise.all([
          fetch(`${apiBaseUrl}/rsvps/count`, { credentials: 'include' }),
          fetch(`${apiBaseUrl}/rsvps`, { credentials: 'include' })
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
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body
          })
          : await fetch(`${apiBaseUrl}/rsvp/${this.editForm.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
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
          credentials: 'include'
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
/*
 * Admin design system — deliberately generic and theme-independent.
 *
 * The public invitation re-skins itself from the selected palette (the
 * --theme-* custom properties), but the admin dashboard stays neutral so it
 * reads as a tool regardless of which festive theme is live. All admin chrome
 * is driven by the local design tokens below; the only place we surface the
 * invitation palette is the theme picker (swatches + active state), where it
 * acts as a genuine preview.
 */
.admin-container{
  /* Color tokens */
  --c-bg:#f1f5f9;
  --c-surface:#ffffff;
  --c-surface-subtle:#f8fafc;
  --c-border:#e2e8f0;
  --c-border-strong:#cbd5e1;
  --c-text:#0f172a;
  --c-text-muted:#64748b;
  --c-text-subtle:#94a3b8;
  --c-accent:#4f46e5;
  --c-accent-hover:#4338ca;
  --c-accent-soft:#eef2ff;
  --c-success:#059669;
  --c-success-soft:#ecfdf5;
  --c-danger:#dc2626;
  --c-danger-hover:#b91c1c;
  --c-danger-soft:#fef2f2;
  --c-focus-ring:rgba(79,70,229,.25);
  /* Radii */
  --r-sm:8px;
  --r-md:12px;
  --r-lg:16px;
  --r-full:9999px;
  /* Shadows */
  --shadow-xs:0 1px 2px rgba(15,23,42,.06);
  --shadow-sm:0 1px 3px rgba(15,23,42,.08),0 1px 2px rgba(15,23,42,.04);
  --shadow-md:0 4px 12px rgba(15,23,42,.08);
  /* Spacing rhythm for the page */
  --content-max:1100px;

  min-height:100vh;
  background:var(--c-bg);
  color:var(--c-text);
  font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  padding:24px 20px 48px;
  -webkit-font-smoothing:antialiased;
}
.admin-container > *{max-width:var(--content-max);margin-left:auto;margin-right:auto}

/* ---- Buttons -------------------------------------------------------- */
.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  font:inherit;font-size:.9rem;font-weight:600;line-height:1;
  padding:10px 18px;border:1px solid transparent;border-radius:var(--r-sm);
  cursor:pointer;text-decoration:none;white-space:nowrap;
  transition:background-color .15s ease,border-color .15s ease,color .15s ease,box-shadow .15s ease,transform .05s ease;
}
.btn:focus-visible{outline:none;box-shadow:0 0 0 3px var(--c-focus-ring)}
.btn:active{transform:translateY(1px)}
.btn:disabled{opacity:.55;cursor:not-allowed}
.btn-block{width:100%}
.btn-primary{background:var(--c-accent);color:#fff}
.btn-primary:hover:not(:disabled){background:var(--c-accent-hover)}
.btn-secondary{background:var(--c-surface);color:var(--c-text);border-color:var(--c-border)}
.btn-secondary:hover:not(:disabled){background:var(--c-surface-subtle);border-color:var(--c-border-strong)}
.btn-ghost{background:transparent;color:var(--c-text-muted);border-color:transparent}
.btn-ghost:hover:not(:disabled){background:var(--c-surface);color:var(--c-text);box-shadow:var(--shadow-xs)}
.btn-danger{background:var(--c-danger);color:#fff}
.btn-danger:hover:not(:disabled){background:var(--c-danger-hover)}
.btn-danger-soft{background:var(--c-danger-soft);color:var(--c-danger);border-color:transparent}
.btn-danger-soft:hover:not(:disabled){background:#fee2e2}

/* ---- Header --------------------------------------------------------- */
.admin-header{
  display:flex;flex-wrap:wrap;gap:16px;justify-content:space-between;align-items:center;
  background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--r-lg);
  padding:24px 28px;margin-bottom:24px;box-shadow:var(--shadow-sm);
}
.admin-header h1{font-size:1.5rem;font-weight:700;letter-spacing:-.02em;margin:0;color:var(--c-text)}
.admin-header-subtitle{margin:4px 0 0;color:var(--c-text-muted);font-size:.9rem}
.header-actions{display:flex;gap:10px;align-items:center}

/* ---- Stats ---------------------------------------------------------- */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px}
.stat-card{
  background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--r-md);
  padding:20px 22px;box-shadow:var(--shadow-xs);
}
.stat-number{font-size:2rem;font-weight:700;line-height:1;letter-spacing:-.02em;color:var(--c-text);margin-bottom:8px}
.stat-card.positive .stat-number{color:var(--c-success)}
.stat-card.negative .stat-number{color:var(--c-danger)}
.stat-label{color:var(--c-text-muted);font-size:.8rem;font-weight:500;text-transform:uppercase;letter-spacing:.04em}

/* ---- Panels (theme + share) ---------------------------------------- */
.theme-panel,.share-panel{
  background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--r-lg);
  padding:24px 28px;margin-bottom:24px;box-shadow:var(--shadow-sm);
}
.theme-panel h2,.share-panel h2,.rsvp-list h2{font-size:1.1rem;font-weight:700;color:var(--c-text);margin:0 0 4px}
.theme-hint{color:var(--c-text-muted);font-size:.875rem;margin:0 0 18px}
.theme-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.theme-card{
  display:flex;flex-direction:column;align-items:center;gap:8px;
  padding:16px 12px;border:1px solid var(--c-border);border-radius:var(--r-md);
  background:var(--c-surface-subtle);cursor:pointer;font:inherit;
  transition:border-color .15s ease,box-shadow .15s ease,transform .1s ease,background-color .15s ease;
}
.theme-card:hover:not(:disabled){transform:translateY(-2px);border-color:var(--c-border-strong);box-shadow:var(--shadow-sm);background:var(--c-surface)}
.theme-card:focus-visible{outline:none;box-shadow:0 0 0 3px var(--c-focus-ring)}
.theme-card:disabled{opacity:.6;cursor:not-allowed}
.theme-card.active{border-color:var(--c-accent);background:var(--c-accent-soft);box-shadow:0 0 0 1px var(--c-accent)}
.theme-icon{font-size:1.9rem;line-height:1}
.theme-label{font-weight:600;color:var(--c-text);font-size:.9rem;text-align:center}
.theme-swatches{display:flex;gap:5px}
.swatch{width:16px;height:16px;border-radius:var(--r-full);border:2px solid var(--c-surface);box-shadow:0 0 0 1px var(--c-border-strong)}
.theme-check{font-size:.75rem;font-weight:700;color:var(--c-accent)}

/* ---- Share panel ---------------------------------------------------- */
.share-row{display:flex;gap:10px;align-items:stretch;flex-wrap:wrap;margin-bottom:16px}
.share-url{flex:1;min-width:220px}
.qr-img{display:block;width:160px;height:160px;border:1px solid var(--c-border);border-radius:var(--r-md);padding:8px;background:var(--c-surface)}

/* ---- List actions --------------------------------------------------- */
.list-actions{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-bottom:24px}

/* ---- RSVP list ------------------------------------------------------ */
.rsvp-list{background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--r-lg);padding:24px 28px;box-shadow:var(--shadow-sm)}
.rsvp-list h2{margin-bottom:18px}
.rsvp-item{
  background:var(--c-surface);border:1px solid var(--c-border);border-left:3px solid var(--c-success);
  padding:18px 20px;margin-bottom:12px;border-radius:var(--r-md);
}
.rsvp-item:last-child{margin-bottom:0}
.rsvp-item.declined{border-left-color:var(--c-danger);background:var(--c-danger-soft)}
.rsvp-header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}
.rsvp-header h3,.rsvp-item h3{display:flex;align-items:center;gap:8px;color:var(--c-text);font-size:1rem;font-weight:700;margin:0}
.rsvp-actions{display:flex;gap:6px}
.edit-btn,.delete-btn{
  background:transparent;border:1px solid transparent;font-size:1rem;cursor:pointer;
  padding:6px 8px;border-radius:var(--r-sm);line-height:1;transition:background-color .15s ease,border-color .15s ease;
}
.edit-btn:hover{background:var(--c-accent-soft);border-color:var(--c-border)}
.delete-btn:hover{background:var(--c-danger-soft);border-color:var(--c-border)}
.rsvp-details{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px 16px;margin-bottom:12px}
.detail{color:var(--c-text-muted);font-size:.9rem}
.detail strong{color:var(--c-text);font-weight:600}
.message{background:var(--c-surface-subtle);border:1px solid var(--c-border);padding:12px 14px;border-radius:var(--r-sm);margin-top:12px;font-style:italic;color:var(--c-text-muted);font-size:.9rem}
.loading,.no-data{text-align:center;padding:48px 20px;color:var(--c-text-muted)}
.error{background:var(--c-danger-soft);color:var(--c-danger);border:1px solid #fecaca;padding:16px;margin:16px 0;border-radius:var(--r-md);text-align:center;font-weight:500}
.status-indicator{font-size:1.05rem}
.status-accepted{color:var(--c-success);font-weight:600}
.status-declined{color:var(--c-danger);font-weight:600}

/* ---- Forms ---------------------------------------------------------- */
.form-group{margin-bottom:18px}
.form-group label{display:block;margin-bottom:6px;font-weight:600;color:var(--c-text);font-size:.875rem}
.form-input{
  width:100%;padding:10px 12px;border:1px solid var(--c-border-strong);border-radius:var(--r-sm);
  font:inherit;font-size:.95rem;color:var(--c-text);background:var(--c-surface);box-sizing:border-box;
  transition:border-color .15s ease,box-shadow .15s ease;
}
.form-input::placeholder{color:var(--c-text-subtle)}
.form-input:focus{outline:none;border-color:var(--c-accent);box-shadow:0 0 0 3px var(--c-focus-ring)}
.form-input:disabled{background:var(--c-surface-subtle);color:var(--c-text-muted);cursor:not-allowed}
textarea.form-input{min-height:80px;resize:vertical}

/* ---- Modals --------------------------------------------------------- */
.modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);backdrop-filter:blur(2px);display:flex;justify-content:center;align-items:center;z-index:1000;padding:20px}
.modal{background:var(--c-surface);border-radius:var(--r-lg);max-width:520px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 20px 50px rgba(15,23,42,.25);border:1px solid var(--c-border)}
.modal-header{display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid var(--c-border)}
.modal-header h3{margin:0;color:var(--c-text);font-size:1.1rem;font-weight:700}
.close-btn{background:transparent;border:none;font-size:1.4rem;cursor:pointer;color:var(--c-text-subtle);width:32px;height:32px;border-radius:var(--r-sm);display:flex;align-items:center;justify-content:center;transition:background-color .15s ease,color .15s ease}
.close-btn:hover{background:var(--c-surface-subtle);color:var(--c-text)}
.modal-content,.edit-form{padding:20px 24px}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;padding:18px 24px;border-top:1px solid var(--c-border)}
.delete-modal .modal-content{text-align:center}
.delete-modal .modal-content p{color:var(--c-text-muted);margin:0 0 8px}
.warning{color:var(--c-danger);font-weight:600;margin-top:8px!important}
.login-modal{max-width:400px}
.auth-form{padding:24px}
.auth-error{color:var(--c-danger);background:var(--c-danger-soft);border:1px solid #fecaca;padding:10px 12px;border-radius:var(--r-sm);margin-top:12px;text-align:center;font-size:.875rem}

@media (max-width:600px){
  .admin-header{flex-direction:column;align-items:flex-start}
  .header-actions{width:100%}
  .header-actions .btn{flex:1}
}
</style>
