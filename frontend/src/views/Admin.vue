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
          <p class="admin-header-subtitle">Gestion des événements et des confirmations</p>
        </div>
        <div class="header-actions">
          <router-link to="/" class="btn btn-ghost">← Voir l'invitation</router-link>
          <button class="btn btn-danger-soft" @click="logout">Déconnexion</button>
        </div>
      </header>

      <!-- ===================== EVENTS OVERVIEW ===================== -->
      <section class="events-panel">
        <div class="events-panel-head">
          <h2>🎈 Événements</h2>
          <div class="events-panel-actions">
            <button class="btn btn-secondary" @click="loadEvents">↻ Actualiser</button>
            <button class="btn btn-primary" @click="openCreateEventModal">+ Nouvel événement</button>
          </div>
        </div>

        <div v-if="eventsLoading && !events.length" class="loading" aria-live="polite">Chargement...</div>
        <div v-else-if="eventsError" class="error" role="alert">{{ eventsError }}</div>
        <div v-else-if="!events.length" class="no-data">Aucun événement pour le moment.</div>
        <div v-else class="events-grid">
          <div
            v-for="ev in events"
            :key="ev.id"
            class="event-card"
            :class="{ selected: ev.id === selectedEventId }"
          >
            <div class="event-card-top">
              <span class="event-theme-icon" aria-hidden="true">{{ themeIcon(ev.theme) }}</span>
              <span v-if="ev.is_default" class="event-badge">Actif</span>
            </div>
            <h3 class="event-card-title">{{ ev.person || 'Sans nom' }}</h3>
            <p class="event-card-meta">
              <span v-if="ev.date">{{ formatEventDate(ev.date) }}</span>
              <span v-if="ev.date && ev.town"> · </span>
              <span v-if="ev.town">{{ ev.town }}</span>
              <span v-if="!ev.date && !ev.town" class="event-card-meta-empty">Détails à compléter</span>
            </p>
            <p class="event-card-theme">{{ themeLabel(ev.theme) }}</p>
            <div class="event-card-stats">
              <span><strong>{{ ev.responses || 0 }}</strong> rép.</span>
              <span><strong>{{ ev.confirmations || 0 }}</strong> conf.</span>
              <span><strong>{{ ev.total_guests || 0 }}</strong> inv.</span>
            </div>
            <div class="event-card-actions">
              <button class="btn btn-primary btn-sm" @click="selectEvent(ev)">Gérer</button>
              <button class="btn btn-secondary btn-sm" @click="openEditEventModal(ev)">Modifier</button>
              <button v-if="!ev.is_default" class="btn btn-danger-soft btn-sm" @click="openDeleteEventModal(ev)">Supprimer</button>
            </div>
          </div>
        </div>
      </section>

      <!-- ===================== SELECTED EVENT MANAGEMENT ===================== -->
      <template v-if="selectedEvent">
        <div class="selected-head">
          <h2>Gestion : <span class="selected-name">{{ selectedEvent.person || 'Sans nom' }}</span></h2>
          <button class="btn btn-ghost" @click="clearSelection">Fermer</button>
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
            <button type="button" class="btn btn-primary" @click="copyLink">{{ linkCopied ? '✓ Copié' : 'Copier le lien' }}</button>
          </div>
          <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR code de l'invitation" class="qr-img" />
        </div>

        <div class="list-actions">
          <button class="btn btn-secondary" @click="loadEventData">↻ Actualiser</button>
          <a class="btn btn-secondary" :href="csvUrl">⬇ Exporter CSV</a>
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
    </template>

    <!-- ===================== RSVP EDIT/CREATE MODAL ===================== -->
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

    <!-- ===================== RSVP DELETE MODAL ===================== -->
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

    <!-- ===================== EVENT CREATE/EDIT MODAL ===================== -->
    <div v-if="showEventModal" class="modal-overlay">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="event-title">
        <div class="modal-header">
          <h3 id="event-title">{{ eventMode === 'create' ? 'Nouvel événement' : 'Modifier l\'événement' }}</h3>
          <button class="close-btn" ref="eventClose" @click="closeEventModal" aria-label="Fermer">×</button>
        </div>
        <form class="edit-form" @submit.prevent="saveEvent">
          <div class="form-group">
            <label for="event-person">Nom de l'enfant <span aria-hidden="true">*</span></label>
            <input id="event-person" ref="eventPerson" class="form-input" v-model="eventForm.person" required aria-required="true" />
          </div>
          <div class="form-row">
            <div class="form-group"><label for="event-age">Âge</label><input id="event-age" class="form-input" v-model="eventForm.age" placeholder="5" /></div>
            <div class="form-group"><label for="event-date">Date</label><input id="event-date" class="form-input" type="date" v-model="eventForm.date" /></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label for="event-time">Horaire</label><input id="event-time" class="form-input" v-model="eventForm.time" placeholder="15h00 - 17h00" /></div>
            <div class="form-group"><label for="event-town">Ville</label><input id="event-town" class="form-input" v-model="eventForm.town" /></div>
          </div>
          <div class="form-group"><label for="event-location">Lieu</label><textarea id="event-location" class="form-input" v-model="eventForm.location"></textarea></div>
          <div class="form-group"><label for="event-dress">Dress code</label><input id="event-dress" class="form-input" v-model="eventForm.dress_code" /></div>
          <div class="form-group"><label for="event-deadline">Date limite de réponse</label><input id="event-deadline" class="form-input" type="date" v-model="eventForm.rsvp_deadline" /></div>
          <div class="form-group">
            <label for="event-theme">Thème</label>
            <select id="event-theme" class="form-input" v-model="eventForm.theme">
              <option v-for="t in themes" :key="t.id" :value="t.id">{{ t.icon }} {{ t.label }}</option>
            </select>
          </div>
          <div class="form-group" v-if="!eventIsDefault">
            <label for="event-slug">Lien (slug)</label>
            <input id="event-slug" class="form-input" v-model="eventForm.slug" placeholder="laisser vide pour générer automatiquement" />
            <p class="field-hint">Laisser vide pour générer automatiquement.</p>
          </div>
          <div v-if="eventError" class="auth-error" role="alert">{{ eventError }}</div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" @click="closeEventModal">Annuler</button>
            <button type="submit" class="btn btn-primary" :disabled="eventSaving">{{ eventSaving ? 'Sauvegarde...' : (eventMode === 'create' ? 'Créer' : 'Sauvegarder') }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- ===================== EVENT DELETE MODAL ===================== -->
    <div v-if="showDeleteEventModal" class="modal-overlay">
      <div class="modal delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-event-title">
        <div class="modal-header">
          <h3 id="delete-event-title">Supprimer l'événement</h3>
          <button class="close-btn" ref="deleteEventClose" @click="closeDeleteEventModal" aria-label="Fermer">×</button>
        </div>
        <div class="modal-content">
          <p>Supprimer l'événement de <strong>{{ eventToDelete?.person }}</strong> ?</p>
          <p class="warning">Toutes les réponses associées seront perdues. Cette action est irréversible.</p>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" @click="closeDeleteEventModal">Annuler</button>
          <button type="button" class="btn btn-danger" @click="deleteEvent" :disabled="deleteEventLoading">{{ deleteEventLoading ? 'Suppression...' : 'Supprimer' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import QRCode from 'qrcode';
import { apiBaseUrl } from '../env.js';
import { authClient } from '../auth-client.js';
import { themeList, applyTheme, getTheme, DEFAULT_THEME } from '../themes.js';

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
      refreshInterval: null,

      // Events overview
      events: [],
      eventsLoading: false,
      eventsError: null,
      selectedEventId: null,

      // Selected-event RSVP data
      loading: false,
      error: null,
      stats: { total_responses: 0, confirmations: 0, declined: 0, total_guests: 0 },
      rsvps: [],

      // RSVP edit/create modal
      showEditModal: false,
      editMode: 'edit',
      editForm: { id: null, attending: 'yes', name: '', email: '', phone: '', guests: 1, dietary_restrictions: '', message: '' },
      editLoading: false,

      // RSVP delete modal
      showDeleteModal: false,
      rsvpToDelete: null,
      deleteLoading: false,

      // Event create/edit modal
      showEventModal: false,
      eventMode: 'create',
      eventIsDefault: false,
      eventForm: { id: null, person: '', age: '', date: '', time: '', town: '', location: '', dress_code: '', rsvp_deadline: '', theme: DEFAULT_THEME, slug: '' },
      eventSaving: false,
      eventError: null,

      // Event delete modal
      showDeleteEventModal: false,
      eventToDelete: null,
      deleteEventLoading: false,

      qrDataUrl: '',
      linkCopied: false,
      lastFocused: null
    };
  },
  computed: {
    selectedEvent() {
      return this.events.find((e) => e.id === this.selectedEventId) || null;
    },
    invitationUrl() {
      const ev = this.selectedEvent;
      if (!ev) return window.location.origin + '/';
      return ev.is_default
        ? window.location.origin + '/'
        : window.location.origin + '/e/' + ev.slug;
    },
    csvUrl() {
      if (!this.selectedEventId) return '#';
      return `${apiBaseUrl}/events/${this.selectedEventId}/rsvps/export.csv`;
    }
  },
  mounted() {
    window.addEventListener('keydown', this.handleKeydown);
    this.restoreSession();
  },
  beforeUnmount() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    window.removeEventListener('keydown', this.handleKeydown);
  },
  watch: {
    selectedEventId() {
      const ev = this.selectedEvent;
      if (ev) {
        this.currentTheme = ev.theme || DEFAULT_THEME;
        applyTheme(this.currentTheme);
        this.generateQr();
        this.loadEventData();
      }
    }
  },
  methods: {
    // ---- Theme metadata helpers (overview cards) ----
    themeIcon(id) {
      return getTheme(id).icon;
    },
    themeLabel(id) {
      return getTheme(id).label;
    },

    async generateQr() {
      try {
        this.qrDataUrl = await QRCode.toDataURL(this.invitationUrl);
      } catch {
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
      else if (this.showEventModal) this.closeEventModal();
      else if (this.showDeleteEventModal) this.closeDeleteEventModal();
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
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleString('fr-FR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    },
    formatEventDate(value) {
      if (!value) return '';
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return value;
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    },

    // ---- Auth / session ----
    async restoreSession() {
      try {
        const { data } = await authClient.getSession();
        if (data?.session) this.startSession();
      } catch {
        // No session / network error: stay on the login screen.
      }
    },
    startSession() {
      this.isAuthenticated = true;
      this.loadEvents();
      if (!this.refreshInterval) this.refreshInterval = setInterval(this.autoRefresh, 30000);
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
      this.selectedEventId = null;
      this.events = [];
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
      }
    },
    autoRefresh() {
      if (!this.isAuthenticated) return;
      this.loadEvents();
      if (this.selectedEventId) this.loadEventData();
    },

    // ---- Events overview ----
    async loadEvents() {
      if (!this.isAuthenticated) return;
      try {
        this.eventsLoading = true;
        this.eventsError = null;
        const res = await fetch(`${apiBaseUrl}/events`, { credentials: 'include' });
        if (!res.ok) {
          if (res.status === 401) { this.logout(); return; }
          throw new Error('Erreur lors de la récupération des événements');
        }
        const data = await res.json();
        this.events = data.events || [];
        // Clear selection if the selected event no longer exists.
        if (this.selectedEventId && !this.events.some((e) => e.id === this.selectedEventId)) {
          this.selectedEventId = null;
        }
      } catch (err) {
        this.eventsError = err.message;
      } finally {
        this.eventsLoading = false;
      }
    },
    selectEvent(ev) {
      this.selectedEventId = ev.id;
    },
    clearSelection() {
      this.selectedEventId = null;
    },

    // ---- Selected-event data ----
    async loadEventData() {
      if (!this.isAuthenticated || !this.selectedEventId) return;
      const id = this.selectedEventId;
      try {
        this.loading = true;
        this.error = null;
        const [countRes, listRes] = await Promise.all([
          fetch(`${apiBaseUrl}/events/${id}/rsvps/count`, { credentials: 'include' }),
          fetch(`${apiBaseUrl}/events/${id}/rsvps`, { credentials: 'include' })
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

    // ---- Theme picker (scoped to selected event) ----
    async selectTheme(id) {
      if (!this.selectedEventId || id === this.currentTheme || this.themeSaving) return;
      this.themeSaving = true;
      const previous = this.currentTheme;
      // Optimistically re-skin so the change is instant.
      this.currentTheme = id;
      applyTheme(id);
      try {
        const res = await fetch(`${apiBaseUrl}/events/${this.selectedEventId}`, {
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
        // Reflect the new theme in the local list.
        const ev = this.events.find((e) => e.id === this.selectedEventId);
        if (ev) ev.theme = data.theme;
      } catch (err) {
        this.currentTheme = previous;
        applyTheme(previous);
        alert(err.message);
      } finally {
        this.themeSaving = false;
      }
    },

    // ---- RSVP edit/create ----
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
      if (!this.selectedEventId) return;
      const id = this.selectedEventId;
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
          ? await fetch(`${apiBaseUrl}/events/${id}/rsvps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body
          })
          : await fetch(`${apiBaseUrl}/events/${id}/rsvp/${this.editForm.id}`, {
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
        await this.loadEventData();
        await this.loadEvents();
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
      if (!this.selectedEventId) return;
      const id = this.selectedEventId;
      this.deleteLoading = true;
      try {
        const res = await fetch(`${apiBaseUrl}/events/${id}/rsvp/${this.rsvpToDelete.id}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        if (!res.ok) {
          if (res.status === 401) { this.logout(); return; }
          const err = await res.json();
          throw new Error(err.error || 'Erreur lors de la suppression');
        }
        await this.loadEventData();
        await this.loadEvents();
        this.closeDeleteModal();
      } catch (err) {
        alert(err.message);
      } finally {
        this.deleteLoading = false;
      }
    },

    // ---- Event create/edit ----
    openCreateEventModal() {
      this.lastFocused = document.activeElement;
      this.eventMode = 'create';
      this.eventIsDefault = false;
      this.eventError = null;
      this.eventForm = {
        id: null, person: '', age: '', date: '', time: '', town: '',
        location: '', dress_code: '', rsvp_deadline: '', theme: DEFAULT_THEME, slug: ''
      };
      this.showEventModal = true;
      this.focusFirst('eventPerson');
    },
    openEditEventModal(ev) {
      this.lastFocused = document.activeElement;
      this.eventMode = 'edit';
      this.eventIsDefault = !!ev.is_default;
      this.eventError = null;
      this.eventForm = {
        id: ev.id,
        person: ev.person || '',
        age: ev.age || '',
        date: ev.date || '',
        time: ev.time || '',
        town: ev.town || '',
        location: ev.location || '',
        dress_code: ev.dress_code || '',
        rsvp_deadline: ev.rsvp_deadline || '',
        theme: ev.theme || DEFAULT_THEME,
        slug: ev.slug || ''
      };
      this.showEventModal = true;
      this.focusFirst('eventPerson');
    },
    closeEventModal() {
      this.showEventModal = false;
      this.eventError = null;
      this.restoreFocus();
    },
    async saveEvent() {
      this.eventError = null;
      if (!this.eventForm.person || !this.eventForm.person.trim()) {
        this.eventError = 'Le nom est requis';
        return;
      }
      this.eventSaving = true;
      try {
        const payload = {
          person: this.eventForm.person.trim(),
          age: this.eventForm.age,
          date: this.eventForm.date,
          time: this.eventForm.time,
          town: this.eventForm.town,
          location: this.eventForm.location,
          dress_code: this.eventForm.dress_code,
          rsvp_deadline: this.eventForm.rsvp_deadline,
          theme: this.eventForm.theme
        };
        // Slug is only sent for non-default events when provided.
        if (!this.eventIsDefault && this.eventForm.slug && this.eventForm.slug.trim()) {
          payload.slug = this.eventForm.slug.trim();
        }
        const res = this.eventMode === 'create'
          ? await fetch(`${apiBaseUrl}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
          })
          : await fetch(`${apiBaseUrl}/events/${this.eventForm.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
          });
        if (!res.ok) {
          if (res.status === 401) { this.logout(); return; }
          const err = await res.json();
          throw new Error(err.error || (this.eventMode === 'create' ? 'Erreur lors de la création' : 'Erreur lors de la modification'));
        }
        const saved = await res.json();
        await this.loadEvents();
        // Keep the selected event's theme preview in sync when editing it.
        if (this.eventMode === 'edit' && saved && saved.id === this.selectedEventId) {
          this.currentTheme = saved.theme || this.currentTheme;
          applyTheme(this.currentTheme);
          this.generateQr();
        }
        this.closeEventModal();
      } catch (err) {
        this.eventError = err.message;
      } finally {
        this.eventSaving = false;
      }
    },
    openDeleteEventModal(ev) {
      this.lastFocused = document.activeElement;
      this.eventToDelete = ev;
      this.showDeleteEventModal = true;
      this.focusFirst('deleteEventClose');
    },
    closeDeleteEventModal() {
      this.showDeleteEventModal = false;
      this.eventToDelete = null;
      this.restoreFocus();
    },
    async deleteEvent() {
      if (!this.eventToDelete) return;
      const id = this.eventToDelete.id;
      this.deleteEventLoading = true;
      try {
        const res = await fetch(`${apiBaseUrl}/events/${id}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        if (!res.ok) {
          if (res.status === 401) { this.logout(); return; }
          const err = await res.json();
          throw new Error(err.error || 'Erreur lors de la suppression');
        }
        if (this.selectedEventId === id) this.selectedEventId = null;
        await this.loadEvents();
        this.closeDeleteEventModal();
      } catch (err) {
        alert(err.message);
      } finally {
        this.deleteEventLoading = false;
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
.btn-sm{padding:7px 12px;font-size:.82rem}
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

/* ---- Events overview ------------------------------------------------ */
.events-panel{
  background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--r-lg);
  padding:24px 28px;margin-bottom:24px;box-shadow:var(--shadow-sm);
}
.events-panel-head{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;margin-bottom:18px}
.events-panel-head h2{font-size:1.1rem;font-weight:700;color:var(--c-text);margin:0}
.events-panel-actions{display:flex;gap:10px;flex-wrap:wrap}
.events-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
.event-card{
  display:flex;flex-direction:column;gap:8px;
  background:var(--c-surface-subtle);border:1px solid var(--c-border);border-radius:var(--r-md);
  padding:18px 20px;box-shadow:var(--shadow-xs);transition:border-color .15s ease,box-shadow .15s ease;
}
.event-card.selected{border-color:var(--c-accent);box-shadow:0 0 0 1px var(--c-accent)}
.event-card-top{display:flex;justify-content:space-between;align-items:center}
.event-theme-icon{font-size:1.8rem;line-height:1}
.event-badge{background:var(--c-success-soft);color:var(--c-success);font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:var(--r-full);text-transform:uppercase;letter-spacing:.04em}
.event-card-title{margin:0;font-size:1.1rem;font-weight:700;color:var(--c-text)}
.event-card-meta{margin:0;color:var(--c-text-muted);font-size:.85rem}
.event-card-meta-empty{font-style:italic;color:var(--c-text-subtle)}
.event-card-theme{margin:0;color:var(--c-text-subtle);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;font-weight:600}
.event-card-stats{display:flex;gap:14px;margin:4px 0 8px;color:var(--c-text-muted);font-size:.85rem}
.event-card-stats strong{color:var(--c-text);font-weight:700}
.event-card-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:auto}

/* ---- Selected event head ------------------------------------------- */
.selected-head{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;margin-bottom:18px}
.selected-head h2{font-size:1.2rem;font-weight:700;color:var(--c-text);margin:0}
.selected-name{color:var(--c-accent)}

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
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.field-hint{margin:6px 0 0;color:var(--c-text-subtle);font-size:.8rem}
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
  .form-row{grid-template-columns:1fr}
}
</style>
