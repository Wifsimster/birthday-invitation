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
      <header class="topbar">
        <div class="topbar-inner">
          <div class="brand">
            <span class="brand-mark" aria-hidden="true">🎉</span>
            <div class="brand-text">
              <h1>Administration</h1>
              <p>Gestion des réponses à l'invitation</p>
            </div>
          </div>
          <div class="topbar-actions">
            <button class="icon-btn" @click="loadData" :disabled="loading" title="Actualiser" aria-label="Actualiser">
              <span aria-hidden="true" :class="{ spin: loading }">🔄</span>
            </button>
            <router-link to="/" class="ghost-btn">← Voir l'invitation</router-link>
            <button class="ghost-btn danger" @click="logout">🚪 Déconnexion</button>
          </div>
        </div>
        <nav class="tabs" aria-label="Sections d'administration">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="tab"
            :class="{ active: activeTab === tab.id }"
            :aria-current="activeTab === tab.id ? 'page' : undefined"
            @click="activeTab = tab.id"
          >
            <span aria-hidden="true">{{ tab.icon }}</span> {{ tab.label }}
          </button>
        </nav>
      </header>

      <main class="admin-main">
        <!-- Responses tab -->
        <section v-show="activeTab === 'responses'" class="panel-stack" aria-label="Réponses">
          <div class="stats">
            <div class="stat-card">
              <div class="stat-top"><span class="stat-icon" aria-hidden="true">📨</span><span class="stat-label">Total réponses</span></div>
              <div class="stat-number">{{ stats.total_responses }}</div>
            </div>
            <div class="stat-card positive">
              <div class="stat-top"><span class="stat-icon" aria-hidden="true">✅</span><span class="stat-label">Confirmations</span></div>
              <div class="stat-number">{{ stats.confirmations }}</div>
            </div>
            <div class="stat-card negative">
              <div class="stat-top"><span class="stat-icon" aria-hidden="true">❌</span><span class="stat-label">Déclins</span></div>
              <div class="stat-number">{{ stats.declined }}</div>
            </div>
            <div class="stat-card accent">
              <div class="stat-top"><span class="stat-icon" aria-hidden="true">👥</span><span class="stat-label">Total invités</span></div>
              <div class="stat-number">{{ stats.total_guests }}</div>
            </div>
            <div class="stat-card rate">
              <div class="stat-top"><span class="stat-icon" aria-hidden="true">📊</span><span class="stat-label">Taux d'acceptation</span></div>
              <div class="stat-number">{{ acceptanceRate }}%</div>
              <div class="rate-bar" role="img" :aria-label="`Taux d'acceptation ${acceptanceRate}%`">
                <span class="rate-fill" :style="{ width: acceptanceRate + '%' }"></span>
              </div>
            </div>
          </div>

          <div class="card list-card">
            <div class="list-toolbar">
              <div class="search-box">
                <span class="search-icon" aria-hidden="true">🔍</span>
                <input
                  class="search-input"
                  type="search"
                  v-model="search"
                  placeholder="Rechercher un nom, email, téléphone..."
                  aria-label="Rechercher une réponse"
                />
              </div>
              <div class="filter-chips" role="group" aria-label="Filtrer par statut">
                <button
                  v-for="f in filters"
                  :key="f.id"
                  type="button"
                  class="chip"
                  :class="{ active: statusFilter === f.id }"
                  :aria-pressed="statusFilter === f.id"
                  @click="statusFilter = f.id"
                >{{ f.label }} <span class="chip-count">{{ filterCount(f.id) }}</span></button>
              </div>
              <div class="toolbar-controls">
                <label class="sort-label" for="sort-select">Trier</label>
                <select id="sort-select" class="sort-select" v-model="sortBy" aria-label="Trier les réponses">
                  <option value="recent">Plus récentes</option>
                  <option value="name">Nom (A-Z)</option>
                  <option value="guests">Nombre d'invités</option>
                </select>
                <button class="tool-btn" @click="exportCsv" :disabled="rsvps.length === 0" title="Exporter en CSV">⬇️ CSV</button>
                <button class="tool-btn primary" @click="openCreateModal">➕ Ajouter</button>
              </div>
            </div>

            <div v-if="loading && rsvps.length === 0" class="loading" aria-live="polite">Chargement...</div>
            <div v-else-if="error" class="error" role="alert">{{ error }}</div>
            <div v-else-if="rsvps.length === 0" class="no-data">
              <span class="no-data-icon" aria-hidden="true">📭</span>
              <p>Aucune réponse pour le moment.</p>
            </div>
            <div v-else-if="filteredRsvps.length === 0" class="no-data">
              <span class="no-data-icon" aria-hidden="true">🔎</span>
              <p>Aucune réponse ne correspond à ta recherche.</p>
              <button class="tool-btn" @click="resetFilters">Réinitialiser les filtres</button>
            </div>
            <template v-else>
              <p class="result-count" aria-live="polite">{{ filteredRsvps.length }} réponse(s) affichée(s)</p>
              <ul class="rsvp-list">
                <li v-for="rsvp in filteredRsvps" :key="rsvp.id" class="rsvp-item" :class="{ declined: rsvp.attending === 'no' }">
                  <div class="rsvp-header">
                    <div class="rsvp-identity">
                      <span class="status-badge" :class="rsvp.attending === 'yes' ? 'accepted' : 'declined'">
                        {{ rsvp.attending === 'yes' ? '✅ Confirmé' : '❌ Décliné' }}
                      </span>
                      <h3>{{ rsvp.name }}</h3>
                    </div>
                    <div class="rsvp-actions">
                      <button class="edit-btn" @click="openEditModal(rsvp)" title="Modifier" :aria-label="`Modifier la réponse de ${rsvp.name}`">✏️</button>
                      <button class="delete-btn" @click="openDeleteModal(rsvp)" title="Supprimer" :aria-label="`Supprimer la réponse de ${rsvp.name}`">🗑️</button>
                    </div>
                  </div>
                  <div class="rsvp-details">
                    <div class="detail" v-if="rsvp.email"><span class="detail-key">✉️ Email</span><span>{{ rsvp.email }}</span></div>
                    <div class="detail"><span class="detail-key">📱 Téléphone</span><span>{{ rsvp.phone }}</span></div>
                    <div class="detail" v-if="rsvp.attending === 'yes'"><span class="detail-key">👥 Invités</span><span>{{ rsvp.guests }}</span></div>
                    <div class="detail" v-if="rsvp.dietary_restrictions"><span class="detail-key">🥜 Allergies</span><span>{{ rsvp.dietary_restrictions }}</span></div>
                    <div class="detail"><span class="detail-key">🕒 Mis à jour</span><span>{{ formatDate(rsvp.updated_at) }}</span></div>
                  </div>
                  <div v-if="rsvp.message" class="message">💌 {{ rsvp.message }}</div>
                </li>
              </ul>
            </template>
          </div>
        </section>

        <!-- Theme tab -->
        <section v-show="activeTab === 'theme'" class="panel-stack" aria-label="Thème">
          <div class="card theme-panel">
            <h2>🎨 Thème de l'invitation</h2>
            <p class="panel-hint">Choisis l'ambiance affichée aux invités. Le changement est immédiat.</p>
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
        </section>

        <!-- Share tab -->
        <section v-show="activeTab === 'share'" class="panel-stack" aria-label="Partage">
          <div class="card share-panel">
            <h2><span aria-hidden="true">🔗</span> Partager l'invitation</h2>
            <p class="panel-hint">Diffuse ce lien ou ce QR code pour inviter tes convives.</p>
            <div class="share-row">
              <input class="form-input share-url" type="text" :value="invitationUrl" readonly aria-label="Lien de l'invitation" />
              <button type="button" class="save-btn" @click="copyLink">{{ linkCopied ? '✓ Copié' : 'Copier le lien' }}</button>
            </div>
            <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR code de l'invitation" class="qr-img" />
          </div>
        </section>
      </main>
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

    <div class="toast-stack" aria-live="polite" aria-atomic="false">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="t.type" role="status">
        <span aria-hidden="true">{{ t.type === 'success' ? '✓' : '⚠️' }}</span> {{ t.message }}
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
      activeTab: 'responses',
      tabs: [
        { id: 'responses', label: 'Réponses', icon: '📋' },
        { id: 'theme', label: 'Thème', icon: '🎨' },
        { id: 'share', label: 'Partage', icon: '🔗' }
      ],
      search: '',
      statusFilter: 'all',
      filters: [
        { id: 'all', label: 'Toutes' },
        { id: 'yes', label: 'Confirmées' },
        { id: 'no', label: 'Déclinées' }
      ],
      sortBy: 'recent',
      showEditModal: false,
      editMode: 'edit',
      editForm: { id: null, attending: 'yes', name: '', email: '', phone: '', guests: 1, dietary_restrictions: '', message: '' },
      editLoading: false,
      showDeleteModal: false,
      rsvpToDelete: null,
      deleteLoading: false,
      qrDataUrl: '',
      linkCopied: false,
      lastFocused: null,
      toasts: [],
      toastSeq: 0
    };
  },
  computed: {
    invitationUrl() {
      return window.location.origin + '/';
    },
    acceptanceRate() {
      if (!this.stats.total_responses) return 0;
      return Math.round((this.stats.confirmations / this.stats.total_responses) * 100);
    },
    filteredRsvps() {
      const term = this.search.trim().toLowerCase();
      let list = this.rsvps.filter((r) => {
        if (this.statusFilter !== 'all' && r.attending !== this.statusFilter) return false;
        if (!term) return true;
        return [r.name, r.email, r.phone].some((v) => (v || '').toLowerCase().includes(term));
      });
      const sorted = [...list];
      if (this.sortBy === 'name') {
        sorted.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
      } else if (this.sortBy === 'guests') {
        sorted.sort((a, b) => (b.guests || 0) - (a.guests || 0));
      }
      // 'recent' keeps the server order (created_at DESC, id DESC).
      return sorted;
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
    toast(message, type = 'success') {
      const id = ++this.toastSeq;
      this.toasts.push({ id, message, type });
      setTimeout(() => {
        this.toasts = this.toasts.filter((t) => t.id !== id);
      }, 3500);
    },
    filterCount(id) {
      if (id === 'all') return this.rsvps.length;
      return this.rsvps.filter((r) => r.attending === id).length;
    },
    resetFilters() {
      this.search = '';
      this.statusFilter = 'all';
    },
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
    async exportCsv() {
      try {
        const res = await fetch(`${apiBaseUrl}/rsvps/export.csv`, { headers: { Authorization: this.authHeader } });
        if (!res.ok) {
          if (res.status === 401) { this.logout(); return; }
          throw new Error('Export impossible');
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'rsvps.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.toast('Export CSV téléchargé');
      } catch (err) {
        this.toast(err.message, 'error');
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
        this.toast('Thème mis à jour');
      } catch (err) {
        this.currentTheme = previous;
        applyTheme(previous);
        this.toast(err.message, 'error');
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
        this.toast(this.editMode === 'create' ? 'Réponse ajoutée' : 'Réponse mise à jour');
        this.closeEditModal();
      } catch (err) {
        this.toast(err.message, 'error');
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
        this.toast('Réponse supprimée');
        this.closeDeleteModal();
      } catch (err) {
        this.toast(err.message, 'error');
      } finally {
        this.deleteLoading = false;
      }
    }
  }
};
</script>

<style scoped>
.admin-container{min-height:100vh;background:var(--theme-bg-gradient,linear-gradient(135deg,#667eea,#764ba2));background-size:200% 200%;animation:gradientShift 12s ease infinite;padding-bottom:40px;transition:background .4s ease}
@keyframes gradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}to{background-position:0% 50%}}

/* Top bar */
.topbar{position:sticky;top:0;z-index:50;background:#ffffffe6;backdrop-filter:blur(10px);box-shadow:0 4px 20px #00000018;margin-bottom:24px}
.topbar-inner{max-width:1200px;margin:0 auto;display:flex;flex-wrap:wrap;gap:16px;justify-content:space-between;align-items:center;padding:16px 24px}
.brand{display:flex;align-items:center;gap:14px}
.brand-mark{font-size:2rem;line-height:1;filter:drop-shadow(0 2px 4px #00000022)}
.brand-text h1{font-family:var(--theme-font-display,inherit);font-size:1.5rem;color:#1f2333;margin:0;line-height:1.1}
.brand-text p{color:#6b7280;font-size:.85rem;margin:2px 0 0}
.topbar-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.icon-btn{background:#f1f3f9;border:none;width:40px;height:40px;border-radius:10px;cursor:pointer;font-size:1.1rem;display:flex;align-items:center;justify-content:center;transition:background .2s ease}
.icon-btn:hover:not(:disabled){background:#e3e7f2}
.icon-btn:disabled{opacity:.6;cursor:not-allowed}
.icon-btn .spin{display:inline-block;animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.ghost-btn{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;background:#f1f3f9;color:#374151;border:none;border-radius:10px;cursor:pointer;font-size:.9rem;text-decoration:none;transition:all .2s ease}
.ghost-btn:hover{background:#e3e7f2;transform:translateY(-1px)}
.ghost-btn.danger{background:#fdeaea;color:#c0392b}
.ghost-btn.danger:hover{background:#f9d6d6}
.tabs{max-width:1200px;margin:0 auto;display:flex;gap:4px;padding:0 24px;overflow-x:auto}
.tab{background:none;border:none;padding:12px 18px;cursor:pointer;font-size:.95rem;color:#6b7280;border-bottom:3px solid transparent;white-space:nowrap;transition:all .2s ease}
.tab:hover{color:#1f2333}
.tab.active{color:var(--theme-primary,#ff6b6b);border-bottom-color:var(--theme-primary,#ff6b6b);font-weight:700}

.admin-main{max-width:1200px;margin:0 auto;padding:0 24px}
.panel-stack{display:flex;flex-direction:column;gap:24px}
.card{background:#fff;border-radius:16px;box-shadow:0 20px 40px #0000001a}

/* Stats */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px}
.stat-card{background:#fff;padding:20px;border-radius:16px;box-shadow:0 10px 24px #0000001a;border-top:4px solid #d1d5db}
.stat-card.positive{border-top-color:#1b9e77}
.stat-card.negative{border-top-color:#d64545}
.stat-card.accent{border-top-color:var(--theme-secondary,#4361ee)}
.stat-card.rate{border-top-color:var(--theme-primary,#ff6b6b)}
.stat-top{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.stat-icon{font-size:1.2rem}
.stat-label{color:#6b7280;font-size:.85rem;font-weight:500}
.stat-number{font-size:2.4rem;font-weight:800;color:#1f2333;line-height:1}
.stat-card.positive .stat-number{color:#1b9e77}
.stat-card.negative .stat-number{color:#d64545}
.rate-bar{margin-top:12px;height:8px;background:#eef0f5;border-radius:99px;overflow:hidden}
.rate-fill{display:block;height:100%;background:var(--theme-primary,#ff6b6b);border-radius:99px;transition:width .5s ease}

/* List card + toolbar */
.list-card{padding:24px}
.list-toolbar{display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between;margin-bottom:20px}
.search-box{position:relative;flex:1 1 240px;min-width:200px}
.search-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:.95rem;opacity:.6}
.search-input{width:100%;padding:11px 14px 11px 40px;border:2px solid #e5e7eb;border-radius:10px;font-size:.95rem;box-sizing:border-box;transition:border-color .2s ease}
.search-input:focus{outline:none;border-color:var(--theme-primary,#ff6b6b)}
.filter-chips{display:flex;gap:8px;flex-wrap:wrap}
.chip{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border:2px solid #e5e7eb;background:#fff;border-radius:99px;cursor:pointer;font-size:.85rem;color:#4b5563;transition:all .2s ease}
.chip:hover{border-color:var(--theme-primary,#ff6b6b)}
.chip.active{background:var(--theme-primary,#ff6b6b);border-color:var(--theme-primary,#ff6b6b);color:var(--theme-button-text,#fff);font-weight:600}
.chip-count{background:#00000014;border-radius:99px;padding:1px 8px;font-size:.78rem;font-weight:700}
.chip.active .chip-count{background:#ffffff33}
.toolbar-controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.sort-label{color:#6b7280;font-size:.85rem}
.sort-select{padding:9px 12px;border:2px solid #e5e7eb;border-radius:10px;font-size:.9rem;cursor:pointer;background:#fff}
.sort-select:focus{outline:none;border-color:var(--theme-primary,#ff6b6b)}
.tool-btn{padding:9px 16px;border:2px solid #e5e7eb;background:#fff;border-radius:10px;cursor:pointer;font-size:.9rem;color:#374151;transition:all .2s ease}
.tool-btn:hover:not(:disabled){border-color:var(--theme-primary,#ff6b6b);transform:translateY(-1px)}
.tool-btn:disabled{opacity:.5;cursor:not-allowed}
.tool-btn.primary{background:var(--theme-primary,#ff6b6b);border-color:var(--theme-primary,#ff6b6b);color:var(--theme-button-text,#fff);font-weight:600}
.tool-btn.primary:hover{filter:brightness(.94)}
.result-count{color:#6b7280;font-size:.85rem;margin-bottom:12px}

/* RSVP list */
.rsvp-list{list-style:none;display:flex;flex-direction:column;gap:14px}
.rsvp-item{background:#f8f9fb;border-left:4px solid var(--theme-primary,#ff6b6b);padding:18px 20px;border-radius:0 12px 12px 0;transition:box-shadow .2s ease}
.rsvp-item:hover{box-shadow:0 6px 18px #0000000f}
.rsvp-item.declined{border-left-color:#ff7675;background:#fff3f3}
.rsvp-header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}
.rsvp-identity{display:flex;flex-direction:column;gap:6px}
.status-badge{align-self:flex-start;font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:99px}
.status-badge.accepted{background:#e3f7f0;color:#1b9e77}
.status-badge.declined{background:#ffe5e5;color:#d64545}
.rsvp-identity h3{color:#1f2333;margin:0;font-size:1.15rem}
.rsvp-actions{display:flex;gap:8px}
.edit-btn,.delete-btn{background:none;border:none;font-size:1.1rem;cursor:pointer;padding:6px 8px;border-radius:8px;transition:background-color .2s ease}
.edit-btn:hover{background-color:#e3f2fd}
.delete-btn:hover{background-color:#ffebee}
.rsvp-details{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px 18px;margin-bottom:10px}
.detail{display:flex;flex-direction:column;gap:2px;color:#374151;font-size:.92rem}
.detail-key{color:#9ca3af;font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.02em}
.message{background:#fff;padding:12px 14px;border-radius:10px;margin-top:6px;font-style:italic;color:#374151;border:1px solid #eef0f5}
.loading{text-align:center;padding:50px;color:#6b7280}
.error{background:#ff4757;color:#fff;padding:18px;margin:10px 0;border-radius:12px;text-align:center}
.no-data{text-align:center;color:#6b7280;padding:48px 20px;display:flex;flex-direction:column;align-items:center;gap:12px}
.no-data-icon{font-size:2.5rem}

/* Theme panel */
.theme-panel{padding:26px 30px}
.theme-panel h2{color:#1f2333;margin-bottom:4px}
.panel-hint{color:#6b7280;font-size:.9rem;margin-bottom:18px}
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

/* Share panel */
.share-panel{padding:26px 30px}
.share-panel h2{color:#1f2333;margin-bottom:4px}
.share-row{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}
.share-url{flex:1 1 260px;min-width:0}
.qr-img{display:block;width:200px;height:200px;border:8px solid #fff;border-radius:14px;box-shadow:0 8px 20px #0000001a}

/* Forms / modals */
.form-input:disabled{background-color:#f5f5f5;color:#666;cursor:not-allowed}
.modal-overlay{position:fixed;inset:0;background:#00000080;display:flex;justify-content:center;align-items:center;z-index:1000;padding:20px}
.modal{background:#fff;border-radius:16px;max-width:500px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 20px 40px #0003}
.login-modal{max-width:400px}
.modal-header{display:flex;justify-content:space-between;align-items:center;padding:20px 25px;border-bottom:1px solid #eee}
.modal-header h3{margin:0;color:#1f2333}
.close-btn{background:none;border:none;font-size:1.5rem;cursor:pointer;color:#999;padding:5px;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center}
.close-btn:hover{background:#f5f5f5;color:#333}
.modal-content,.edit-form,.auth-form{padding:20px 25px}
.form-group{margin-bottom:20px}
.form-group label{display:block;margin-bottom:5px;font-weight:500;color:#333}
.form-input{width:100%;padding:10px 15px;border:2px solid #ddd;border-radius:8px;font-size:1rem;transition:border-color .3s ease;box-sizing:border-box}
.form-input:focus{outline:none;border-color:var(--theme-primary,#ff6b6b)}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;padding:20px 25px;border-top:1px solid #eee}
.cancel-btn,.save-btn,.delete-confirm-btn{padding:10px 20px;border:none;border-radius:8px;cursor:pointer;font-size:1rem;transition:all .3s ease}
.cancel-btn{background:#f5f5f5;color:#666}
.cancel-btn:hover{background:#e0e0e0}
.save-btn{background:var(--theme-primary,#ff6b6b);color:var(--theme-button-text,#fff)}
.save-btn:hover:not(:disabled){filter:brightness(.92)}
.save-btn:disabled{opacity:.7;cursor:not-allowed}
.delete-confirm-btn{background:#dc3545;color:#fff}
.delete-confirm-btn:hover:not(:disabled){background:#c82333}
.delete-confirm-btn:disabled{opacity:.7;cursor:not-allowed}
.delete-modal .modal-content{text-align:center}
.warning{color:#dc3545;font-weight:500;margin-top:10px}
.auth-error{color:#ff4757;background:#ffeaea;padding:10px;border-radius:5px;margin-top:10px;text-align:center}

/* Toasts */
.toast-stack{position:fixed;bottom:24px;right:24px;display:flex;flex-direction:column;gap:10px;z-index:1100}
.toast{display:flex;align-items:center;gap:8px;background:#1f2333;color:#fff;padding:12px 18px;border-radius:12px;box-shadow:0 10px 30px #00000033;font-size:.92rem;animation:toastIn .25s ease}
.toast.success{background:#1b9e77}
.toast.error{background:#d64545}
@keyframes toastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}

@media (max-width:768px){
  .topbar-inner{padding:14px 16px}
  .admin-main{padding:0 16px}
  .tabs{padding:0 16px}
  .brand-text p{display:none}
  .list-toolbar{flex-direction:column;align-items:stretch}
  .toolbar-controls{justify-content:space-between}
  .toast-stack{left:16px;right:16px;bottom:16px}
}
</style>
