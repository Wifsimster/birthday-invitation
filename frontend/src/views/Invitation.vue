<template>
  <div class="invitation-container">
    <div v-for="(emoji, i) in themeDef.decorations" :key="i" class="decoration">{{ emoji }}</div>

    <div class="invitation-card">
      <div class="invitation-header">
        <h1 class="birthday-title">{{ themeDef.copy.title }}</h1>
        <p class="birthday-subtitle">{{ themeDef.copy.subtitle }}</p>
      </div>

      <div class="invitation-body">
        <div class="birthday-person">{{ birthdayPerson }}</div>
        <div class="age-badge">{{ age }} ans</div>

        <div class="event-details">
          <div class="detail-item">
            <i class="fas fa-calendar-day detail-icon"></i>
            <span>{{ formatDate(eventDate) }}</span>
          </div>
          <div class="detail-item">
            <i class="fas fa-clock detail-icon"></i>
            <span>{{ eventTime }}</span>
          </div>
          <div class="detail-item" v-if="eventTown">
            <i class="fas fa-city detail-icon"></i>
            <span>{{ eventTown }}</span>
          </div>
          <div class="detail-item" v-if="eventLocation">
            <i class="fas fa-map-marker-alt detail-icon"></i>
            <span>{{ eventLocation }}</span>
          </div>
          <div class="detail-item" v-if="dresscode">
            <i class="fas fa-tshirt detail-icon"></i>
            <span>{{ dresscode }}</span>
          </div>
        </div>

        <div class="rsvp-section">
          <div v-if="hasConfirmedAttendance" class="confirmation-message" :class="{ declined: !isAttending }">
            <template v-if="isAttending">
              <h3>🎉 Merci {{ confirmedName }} !</h3>
              <p>Ta réponse est bien enregistrée. À très bientôt ! 🎈</p>
              <div class="confirmation-details">
                <p>👨‍👩‍👧‍👦 {{ confirmedGuests }} personne(s)</p>
                <p v-if="confirmedMessage">💌 {{ confirmedMessage }}</p>
              </div>
            </template>
            <template v-else>
              <h3>Merci {{ confirmedName }}</h3>
              <p>Dommage que tu ne puisses pas venir. 😔</p>
              <div class="confirmation-details" v-if="confirmedMessage">
                <p>💌 {{ confirmedMessage }}</p>
              </div>
            </template>
            <div class="reset-section">
              <button class="reset-button" @click="resetForm">Modifier ma réponse</button>
            </div>
          </div>

          <template v-else>
            <div class="rsvp-buttons" v-if="!showRsvpForm && !showLookupForm">
              <button class="rsvp-button" @click="showRsvpForm = true">🎈 Je réponds à l'invitation</button>
              <button class="lookup-button" @click="showLookupForm = true">✏️ Modifier ma réponse</button>
            </div>

            <form v-if="showRsvpForm" class="rsvp-form" @submit.prevent="submitRSVP">
              <h3 class="form-title">Réponds à l'invitation</h3>

              <div class="form-group">
                <label>Statut *</label>
                <div class="radio-group">
                  <label class="radio-option" :class="{ selected: formData.attending === 'yes' }">
                    <input type="radio" value="yes" v-model="formData.attending" />
                    <span class="radio-text">Oui, je viens ! 🎈</span>
                  </label>
                  <label class="radio-option" :class="{ selected: formData.attending === 'no' }">
                    <input type="radio" value="no" v-model="formData.attending" />
                    <span class="radio-text">Non, je ne peux pas venir 😔</span>
                  </label>
                </div>
              </div>

              <div class="form-group">
                <label>👶 Nom de l'enfant *</label>
                <input type="text" v-model="formData.name" required placeholder="Prénom de l'enfant" />
              </div>

              <div class="form-group">
                <label>📱 Téléphone *</label>
                <input type="tel" v-model="formData.phone" required placeholder="06 12 34 56 78" />
              </div>

              <div class="form-group">
                <label>✉️ Email du parent</label>
                <input type="email" v-model="formData.email" placeholder="parent@example.com" />
              </div>

              <div class="form-group" v-if="formData.attending === 'yes'">
                <label>👨‍👩‍👧‍👦 Nombre de personnes</label>
                <select v-model.number="formData.guests">
                  <option :value="1">1 personne (juste l'enfant)</option>
                  <option :value="2">2 personnes (enfant + 1 accompagnateur)</option>
                  <option :value="3">3 personnes (enfant + 2 accompagnateurs)</option>
                </select>
              </div>

              <div class="form-group">
                <label>💌 Message (optionnel)</label>
                <textarea v-model="formData.message" :placeholder="messagePlaceholder"></textarea>
              </div>

              <div v-if="errorMessage" class="rsvp-error"><i class="fas fa-exclamation-circle"></i> {{ errorMessage }}</div>

              <div class="form-actions">
                <button type="button" class="btn-cancel" @click="cancelForm">Annuler</button>
                <button type="submit" class="btn-submit" :disabled="isSubmitting">{{ isSubmitting ? 'Envoi...' : 'Envoyer ma réponse' }}</button>
              </div>
            </form>

            <form v-if="showLookupForm" class="lookup-form" @submit.prevent="lookupRSVP">
              <h3>Retrouver ma réponse</h3>
              <div class="form-group">
                <label>📱 Téléphone *</label>
                <input type="tel" v-model="lookupPhoneNumber" required placeholder="06 12 34 56 78" />
              </div>
              <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
              <div class="form-buttons">
                <button type="button" class="cancel-button" @click="cancelForm">Annuler</button>
                <button type="submit" class="submit-button" :disabled="isLookingUp">{{ isLookingUp ? 'Recherche...' : 'Rechercher' }}</button>
              </div>
            </form>
          </template>
        </div>
      </div>
    </div>

    <div class="admin-link">
      <router-link to="/admin" class="admin-button">🔐 Admin</router-link>
    </div>
  </div>
</template>

<script>
import { eventConfig, apiBaseUrl } from '../env.js';
import { applyTheme, getTheme, DEFAULT_THEME } from '../themes.js';

export default {
  name: 'Invitation',
  data() {
    return {
      theme: DEFAULT_THEME,
      birthdayPerson: eventConfig.birthdayPerson,
      age: eventConfig.age,
      eventDate: eventConfig.eventDate,
      eventTime: eventConfig.eventTime,
      eventTown: eventConfig.eventTown,
      eventLocation: eventConfig.eventLocation,
      dresscode: eventConfig.dresscode,
      showRsvpForm: false,
      showLookupForm: false,
      hasConfirmedAttendance: false,
      isAttending: true,
      confirmedName: '',
      confirmedGuests: 1,
      confirmedMessage: '',
      errorMessage: '',
      isSubmitting: false,
      isLookingUp: false,
      lookupPhoneNumber: '',
      formData: { attending: 'yes', name: '', phone: '', email: '', guests: 1, message: '' }
    };
  },
  computed: {
    themeDef() {
      return getTheme(this.theme);
    },
    messagePlaceholder() {
      return this.formData.attending === 'yes'
        ? 'Un petit mot pour nous dire votre joie de venir...'
        : "Un petit mot pour s'excuser...";
    }
  },
  async mounted() {
    // Paint the default theme immediately, then upgrade to the admin-selected
    // theme once the public settings endpoint responds.
    applyTheme(this.theme);
    try {
      const res = await fetch(`${apiBaseUrl}/settings`);
      if (res.ok) {
        const { theme } = await res.json();
        if (theme) {
          this.theme = theme;
          applyTheme(theme);
        }
      }
    } catch {
      // Keep the default theme when settings can't be fetched.
    }
  },
  methods: {
    formatDate(date) {
      return date.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    },
    cancelForm() {
      this.showRsvpForm = false;
      this.showLookupForm = false;
      this.errorMessage = '';
    },
    resetForm() {
      this.hasConfirmedAttendance = false;
      this.isAttending = true;
      this.confirmedName = '';
      this.confirmedGuests = 1;
      this.confirmedMessage = '';
      this.showRsvpForm = false;
      this.showLookupForm = false;
      this.errorMessage = '';
      this.lookupPhoneNumber = '';
      this.formData = { attending: 'yes', name: '', phone: '', email: '', guests: 1, message: '' };
    },
    async submitRSVP() {
      this.isSubmitting = true;
      this.errorMessage = '';
      try {
        const res = await fetch(`${apiBaseUrl}/rsvp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attending: this.formData.attending,
            name: this.formData.name,
            email: this.formData.email,
            phone: this.formData.phone,
            guests: this.formData.guests,
            message: this.formData.message
          })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Erreur lors de l'envoi");
        }
        this.hasConfirmedAttendance = true;
        this.isAttending = this.formData.attending === 'yes';
        this.confirmedName = this.formData.name;
        this.confirmedGuests = this.formData.guests;
        this.confirmedMessage = this.formData.message;
        this.showRsvpForm = false;
      } catch (err) {
        this.errorMessage = err.message;
      } finally {
        this.isSubmitting = false;
      }
    },
    async lookupRSVP() {
      this.isLookingUp = true;
      this.errorMessage = '';
      try {
        if (!this.lookupPhoneNumber || this.lookupPhoneNumber.trim().length === 0) {
          throw new Error('Le numéro de téléphone est requis');
        }
        const res = await fetch(`${apiBaseUrl}/rsvp/lookup/${encodeURIComponent(this.lookupPhoneNumber.trim())}`, {
          headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) {
          if (res.status === 404) throw new Error('Aucune réponse trouvée pour ce numéro de téléphone');
          const err = await res.json();
          throw new Error(err.error || 'Erreur lors de la recherche');
        }
        const data = await res.json();
        this.formData = {
          attending: data.attending || 'yes',
          name: data.name,
          email: data.email || '',
          phone: data.phone,
          guests: data.guests || 1,
          message: data.message || ''
        };
        this.showLookupForm = false;
        this.showRsvpForm = true;
        this.lookupPhoneNumber = '';
      } catch (err) {
        this.errorMessage = err.message;
      } finally {
        this.isLookingUp = false;
      }
    }
  }
};
</script>

<style scoped>
.invitation-container{min-height:100vh;background:var(--theme-bg-gradient,linear-gradient(135deg,#667eea,#764ba2));background-size:200% 200%;animation:gradientShift 12s ease infinite;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;position:relative;overflow:hidden;transition:background .4s ease}
@keyframes gradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}to{background-position:0% 50%}}
.decoration{position:absolute;font-size:2rem;opacity:.3;animation:float-781963a1 6s ease-in-out infinite;pointer-events:none}
.decoration:nth-child(1){top:10%;left:15%;animation-delay:0s}
.decoration:nth-child(2){top:20%;right:20%;animation-delay:1s}
.decoration:nth-child(3){top:60%;left:10%;animation-delay:2s}
.decoration:nth-child(4){top:70%;right:15%;animation-delay:3s}
.decoration:nth-child(5){bottom:20%;left:20%;animation-delay:4s}
.decoration:nth-child(6){bottom:10%;right:25%;animation-delay:5s}
@keyframes float-781963a1{0%,to{transform:translateY(0) rotate(0)}50%{transform:translateY(-20px) rotate(10deg)}}
.invitation-card{background:var(--theme-card-bg,#fff);color:var(--theme-card-text,#333);border-radius:20px;box-shadow:0 25px 50px #0000001a;max-width:500px;width:100%;overflow:hidden;animation:slideIn-781963a1 .8s ease-out}
@keyframes slideIn-781963a1{0%{opacity:0;transform:translateY(50px)}to{opacity:1;transform:translateY(0)}}
.invitation-header{background:var(--theme-header-gradient,linear-gradient(135deg,#ff6b6b,#ff8e8e));color:var(--theme-header-text,#fff);padding:34px 30px;text-align:center}
.birthday-title{font-family:var(--theme-font-display,'Comic Sans MS',cursive);font-size:2rem;line-height:1.15;margin-bottom:10px;font-weight:700;letter-spacing:.5px}
.birthday-subtitle{opacity:.92;font-size:1.1rem}
.invitation-body{padding:30px}
.birthday-person{font-family:var(--theme-font-display,'Comic Sans MS',cursive);text-align:center;color:var(--theme-primary,#ff6b6b);font-size:1.7rem;margin-bottom:15px;font-weight:700}
.age-badge{background:var(--theme-badge-gradient,linear-gradient(135deg,#ffd93d,#ff6b6b));color:#fff;padding:10px 22px;border-radius:25px;text-align:center;font-weight:700;font-size:1.2rem;margin:0 auto 25px;display:inline-block;box-shadow:0 4px 15px #0000002e;text-shadow:1px 1px 2px #0000003a}
.event-details{margin:25px 0}
.detail-item{display:flex;align-items:center;margin-bottom:15px;font-size:1rem;color:var(--theme-card-text,#333)}
.detail-icon{color:var(--theme-primary,#ff6b6b);margin-right:12px;width:20px;text-align:center}
.rsvp-section{margin-top:30px}
.rsvp-buttons{text-align:center;display:flex;flex-direction:column;gap:15px;align-items:center}
.rsvp-button,.lookup-button{font-family:var(--theme-font-display,inherit);color:#fff;border:none;padding:15px 30px;border-radius:25px;font-size:1.1rem;font-weight:600;cursor:pointer;transition:all .3s ease;min-width:200px}
.rsvp-button{background:var(--theme-button-gradient,linear-gradient(135deg,#4ecdc4,#44a08d));box-shadow:0 4px 15px #00000033}
.rsvp-button:hover{transform:translateY(-2px);box-shadow:0 8px 25px #00000040}
.lookup-button{background:linear-gradient(135deg,var(--theme-secondary,#667eea),var(--theme-primary-dark,#764ba2));box-shadow:0 4px 15px #00000033}
.lookup-button:hover{transform:translateY(-2px);box-shadow:0 8px 25px #00000040}
.lookup-form{background:#f0f4ff;padding:25px;border-radius:15px;margin-top:20px;border:2px solid #e1e5e9}
.lookup-form h3{color:var(--theme-primary,#667eea);margin-bottom:20px;text-align:center}
.rsvp-form{background:#f8f9fa;padding:25px;border-radius:15px;margin-top:20px}
.rsvp-form h3{color:var(--theme-primary,#ff6b6b);margin-bottom:20px;text-align:center}
.form-group{margin-bottom:20px}
.form-group label{display:block;margin-bottom:8px;color:#333;font-weight:500}
.form-group input,.form-group select{width:100%;padding:12px 15px;border:2px solid #e1e5e9;border-radius:10px;font-size:1rem;transition:border-color .3s ease}
.form-group input:focus,.form-group select:focus{outline:none;border-color:var(--theme-primary,#ff6b6b)}
.radio-group{display:flex;flex-direction:column;gap:12px}
.radio-option{display:flex;align-items:center;cursor:pointer;padding:12px;border:2px solid #e1e5e9;border-radius:10px;transition:all .3s ease}
.radio-option:hover{border-color:var(--theme-primary,#ff6b6b);background-color:#0000000a}
.radio-option input[type=radio]{display:none}
.radio-option.selected{border-color:var(--theme-primary,#ff6b6b);background-color:#00000010}
.radio-text{font-weight:500;color:#333}
.form-group textarea{width:100%;padding:12px 15px;border:2px solid #e1e5e9;border-radius:10px;font-size:1rem;transition:border-color .3s ease;resize:vertical;min-height:80px;font-family:inherit}
.form-group textarea:focus{outline:none;border-color:var(--theme-primary,#ff6b6b)}
.form-buttons{display:flex;gap:15px;margin-top:25px}
.cancel-button,.submit-button{flex:1;padding:12px 20px;border:none;border-radius:10px;font-size:1rem;font-weight:600;cursor:pointer;transition:all .3s ease}
.cancel-button{background:#e1e5e9;color:#666}
.cancel-button:hover{background:#d1d5d9}
.submit-button{background:var(--theme-button-gradient,linear-gradient(135deg,#ff6b6b,#ff8e8e));color:#fff}
.submit-button:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 15px #00000040}
.submit-button:disabled{opacity:.7;cursor:not-allowed}
.confirmation-message{background:linear-gradient(135deg,#43cea2,#22a06b);color:#fff;padding:25px;border-radius:15px;text-align:center;margin-top:20px}
.confirmation-message h3{margin-bottom:15px}
.confirmation-message.declined{background:linear-gradient(135deg,#ff7675,#fd79a8)}
.confirmation-details{margin-top:15px;opacity:.9}
.reset-section{margin-top:20px;text-align:center}
.reset-button{background:#fff3;color:#fff;border:2px solid rgba(255,255,255,.3);padding:10px 20px;border-radius:25px;font-size:.9rem;font-weight:500;cursor:pointer;transition:all .3s ease}
.reset-button:hover{background:#ffffff4d;transform:translateY(-1px)}
.error-message{background:#ff4757;color:#fff;padding:15px;border-radius:10px;margin-top:15px;text-align:center}
.admin-link{position:fixed;bottom:20px;right:20px}
.admin-button{background:#ffffffe6;color:#666;padding:12px 20px;border-radius:25px;text-decoration:none;font-size:.9rem;font-weight:500;box-shadow:0 4px 15px #0000001a;transition:all .3s ease;display:flex;align-items:center;gap:8px}
.admin-button:hover{background:#fff;transform:translateY(-2px);box-shadow:0 8px 25px #00000026}
@media (max-width: 768px){.invitation-container{padding:15px}.invitation-card{max-width:100%}.invitation-header,.invitation-body{padding:20px}.birthday-title{font-size:1.5rem}.form-buttons{flex-direction:column}.rsvp-buttons{flex-direction:column;gap:10px}.rsvp-button,.lookup-button{min-width:auto;width:100%}.admin-link{bottom:15px;right:15px}}
</style>
