<template>
  <div class="invitation-container">
    <div v-for="(emoji, i) in themeDef.decorations" :key="i" class="decoration" aria-hidden="true">{{ emoji }}</div>

    <main class="invitation-card">
      <header class="invitation-header">
        <h1 class="birthday-title">{{ themeDef.copy.title }}</h1>
        <p class="birthday-subtitle">{{ themeDef.copy.subtitle }}</p>
      </header>

      <div v-if="notFound" class="invitation-body">
        <div class="event-not-found" role="status">
          <h2>🔍 Événement introuvable</h2>
          <p>Cette invitation n'existe pas ou n'est plus disponible.</p>
        </div>
      </div>

      <div v-else class="invitation-body">
        <div class="birthday-person">{{ birthdayPerson }}</div>
        <div class="age-badge" v-if="age">{{ age }} ans</div>

        <div class="event-details">
          <div class="detail-item" v-if="formattedDate">
            <i class="fas fa-calendar-day detail-icon" aria-hidden="true"></i>
            <span>{{ formattedDate }}</span>
          </div>
          <div class="detail-item" v-if="eventTime">
            <i class="fas fa-clock detail-icon" aria-hidden="true"></i>
            <span>{{ eventTime }}</span>
          </div>
          <div class="detail-item" v-if="eventTown">
            <i class="fas fa-city detail-icon" aria-hidden="true"></i>
            <span>{{ eventTown }}</span>
          </div>
          <div class="detail-item" v-if="eventLocation">
            <i class="fas fa-map-marker-alt detail-icon" aria-hidden="true"></i>
            <a v-if="mapUrl" :href="mapUrl" target="_blank" rel="noopener" class="map-link">{{ eventLocation }}</a>
            <span v-else>{{ eventLocation }}</span>
          </div>
          <div class="detail-item" v-if="dresscode">
            <i class="fas fa-tshirt detail-icon" aria-hidden="true"></i>
            <span>{{ dresscode }}</span>
          </div>
        </div>

        <div class="action-row">
          <a class="action-chip" :href="icsUrl"><i class="fas fa-calendar-plus" aria-hidden="true"></i> Calendrier (.ics)</a>
          <a class="action-chip" :href="googleCalUrl" target="_blank" rel="noopener"><i class="fab fa-google" aria-hidden="true"></i> Google Agenda</a>
          <button type="button" class="action-chip" @click="share"><i class="fas fa-share-nodes" aria-hidden="true"></i> Partager</button>
        </div>

        <div class="rsvp-section">
          <div v-if="hasConfirmedAttendance" class="confirmation-message" :class="{ declined: !isAttending }" role="status">
            <template v-if="isAttending">
              <h2>🎉 Merci {{ confirmedName }} !</h2>
              <p>Ta réponse est bien enregistrée. À très bientôt ! 🎈</p>
              <div class="confirmation-details">
                <p>👨‍👩‍👧‍👦 {{ confirmedGuests }} personne(s)</p>
                <p v-if="confirmedMessage">💌 {{ confirmedMessage }}</p>
              </div>
            </template>
            <template v-else>
              <h2>Merci {{ confirmedName }}</h2>
              <p>Dommage que tu ne puisses pas venir. 😔</p>
              <div class="confirmation-details" v-if="confirmedMessage">
                <p>💌 {{ confirmedMessage }}</p>
              </div>
            </template>
            <div class="reset-section">
              <button class="reset-button" @click="resetForm">Modifier ma réponse</button>
            </div>
          </div>

          <div v-else-if="rsvpClosed" class="rsvp-closed" role="status">
            <h2>🙏 Réponses closes</h2>
            <p>La date limite de réponse ({{ formatDeadline }}) est passée.</p>
          </div>

          <template v-else>
            <p v-if="formatDeadline" class="deadline-note">⏳ Merci de répondre avant le {{ formatDeadline }}</p>

            <div class="rsvp-buttons" v-if="!showRsvpForm && !showLookupForm">
              <button class="rsvp-button" @click="openRsvpForm">🎈 Je réponds à l'invitation</button>
              <button class="lookup-button" @click="openLookupForm">✏️ Modifier ma réponse</button>
            </div>

            <form v-if="showRsvpForm" class="rsvp-form" @submit.prevent="submitRSVP">
              <h2 class="form-title">Réponds à l'invitation</h2>

              <fieldset class="form-group radio-fieldset">
                <legend>Statut <span aria-hidden="true">*</span></legend>
                <div class="radio-group">
                  <label class="radio-option" :class="{ selected: formData.attending === 'yes' }">
                    <input type="radio" class="visually-hidden" value="yes" v-model="formData.attending" name="attending" />
                    <span class="radio-text">Oui, je viens ! 🎈</span>
                  </label>
                  <label class="radio-option" :class="{ selected: formData.attending === 'no' }">
                    <input type="radio" class="visually-hidden" value="no" v-model="formData.attending" name="attending" />
                    <span class="radio-text">Non, je ne peux pas venir 😔</span>
                  </label>
                </div>
              </fieldset>

              <div class="form-group">
                <label for="rsvp-name">👶 Nom de l'enfant <span aria-hidden="true">*</span></label>
                <input id="rsvp-name" type="text" v-model="formData.name" required aria-required="true" placeholder="Prénom de l'enfant" />
              </div>

              <div class="form-group">
                <label for="rsvp-phone">📱 Téléphone <span aria-hidden="true">*</span></label>
                <input id="rsvp-phone" type="tel" inputmode="tel" v-model="formData.phone" required aria-required="true" placeholder="06 12 34 56 78" />
              </div>

              <div class="form-group">
                <label for="rsvp-email">✉️ Email du parent</label>
                <input id="rsvp-email" type="email" v-model="formData.email" placeholder="parent@example.com" />
              </div>

              <div class="form-group" v-if="formData.attending === 'yes'">
                <label for="rsvp-guests">👨‍👩‍👧‍👦 Nombre de personnes</label>
                <select id="rsvp-guests" v-model.number="formData.guests">
                  <option :value="1">1 personne (juste l'enfant)</option>
                  <option :value="2">2 personnes (enfant + 1 accompagnateur)</option>
                  <option :value="3">3 personnes (enfant + 2 accompagnateurs)</option>
                </select>
              </div>

              <div class="form-group" v-if="formData.attending === 'yes'">
                <label for="rsvp-diet">🥜 Allergies / régime alimentaire</label>
                <textarea id="rsvp-diet" v-model="formData.dietary_restrictions" placeholder="Allergies, intolérances, régime particulier..."></textarea>
              </div>

              <div class="form-group">
                <label for="rsvp-message">💌 Message (optionnel)</label>
                <textarea id="rsvp-message" v-model="formData.message" :placeholder="messagePlaceholder"></textarea>
              </div>

              <div v-if="errorMessage" class="rsvp-error" role="alert"><i class="fas fa-exclamation-circle" aria-hidden="true"></i> {{ errorMessage }}</div>

              <div class="form-actions">
                <button type="button" class="btn-cancel" @click="cancelForm">Annuler</button>
                <button type="submit" class="btn-submit" :disabled="isSubmitting">{{ isSubmitting ? 'Envoi...' : 'Envoyer ma réponse' }}</button>
              </div>
            </form>

            <form v-if="showLookupForm" class="lookup-form" @submit.prevent="lookupRSVP">
              <h2>Retrouver ma réponse</h2>
              <div class="form-group">
                <label for="lookup-phone">📱 Téléphone <span aria-hidden="true">*</span></label>
                <input id="lookup-phone" type="tel" inputmode="tel" v-model="lookupPhoneNumber" required aria-required="true" placeholder="06 12 34 56 78" />
              </div>
              <div v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</div>
              <div class="form-buttons">
                <button type="button" class="cancel-button" @click="cancelForm">Annuler</button>
                <button type="submit" class="submit-button" :disabled="isLookingUp">{{ isLookingUp ? 'Recherche...' : 'Rechercher' }}</button>
              </div>
            </form>
          </template>
        </div>
      </div>
    </main>

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
  props: {
    slug: { type: String, default: '' }
  },
  data() {
    // Only seed from the env.js fallback on the default route, to avoid a blank
    // flash; the API response is the source of truth and overrides this.
    const isDefault = !this.slug;
    return {
      theme: DEFAULT_THEME,
      notFound: false,
      rsvpClosed: false,
      birthdayPerson: isDefault ? eventConfig.birthdayPerson : '',
      age: isDefault ? eventConfig.age : 0,
      eventDate: isDefault ? eventConfig.eventDate : null,
      eventTime: isDefault ? eventConfig.eventTime : '',
      eventTown: isDefault ? eventConfig.eventTown : '',
      eventLocation: isDefault ? eventConfig.eventLocation : '',
      dresscode: isDefault ? eventConfig.dresscode : '',
      rsvpDeadline: isDefault ? eventConfig.rsvpDeadline : '',
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
      formData: { attending: 'yes', name: '', phone: '', email: '', guests: 1, dietary_restrictions: '', message: '' }
    };
  },
  computed: {
    effectiveSlug() {
      return this.slug || 'default';
    },
    themeDef() {
      return getTheme(this.theme);
    },
    messagePlaceholder() {
      return this.formData.attending === 'yes'
        ? 'Un petit mot pour nous dire votre joie de venir...'
        : "Un petit mot pour s'excuser...";
    },
    formattedDate() {
      return this.formatDate(this.eventDate);
    },
    formatDeadline() {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(this.rsvpDeadline)) return '';
      return new Date(`${this.rsvpDeadline}T12:00:00`)
        .toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    },
    icsUrl() {
      return `${apiBaseUrl}/events/${encodeURIComponent(this.effectiveSlug)}/event.ics`;
    },
    mapUrl() {
      const q = [this.eventLocation, this.eventTown].filter(Boolean).join(', ');
      return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : '';
    },
    googleCalUrl() {
      const d = this.eventDate instanceof Date ? this.eventDate : new Date(this.eventDate);
      if (Number.isNaN(d.getTime())) return '';
      const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      // All-day event spanning the party date (end is exclusive next day).
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const dayNext = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, '0')}${String(next.getDate()).padStart(2, '0')}`;
      const title = `Anniversaire de ${this.birthdayPerson}${this.age ? ` (${this.age} ans)` : ''}`;
      const details = [this.eventTime, this.dresscode].filter(Boolean).join(' — ');
      const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title,
        dates: `${day}/${dayNext}`,
        details,
        location: [this.eventLocation, this.eventTown].filter(Boolean).join(', ')
      });
      return `https://calendar.google.com/calendar/render?${params.toString()}`;
    }
  },
  mounted() {
    // Paint the (fallback) theme immediately, then upgrade to the event's theme
    // once the public event endpoint responds.
    applyTheme(this.theme);
    this.loadEvent();
  },
  watch: {
    slug() {
      this.loadEvent();
    }
  },
  methods: {
    async loadEvent() {
      this.notFound = false;
      try {
        const res = await fetch(`${apiBaseUrl}/events/${encodeURIComponent(this.effectiveSlug)}`);
        if (res.status === 404) {
          this.notFound = true;
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        this.birthdayPerson = data.person || '';
        this.age = Number(data.age) || 0;
        this.eventDate = data.date ? new Date(data.date) : null;
        this.eventTime = data.time || '';
        this.eventTown = data.town || '';
        this.eventLocation = data.location || '';
        this.dresscode = data.dress_code || '';
        this.rsvpDeadline = data.rsvp_deadline || '';
        this.rsvpClosed = !!data.rsvp_closed;
        if (data.theme) {
          this.theme = data.theme;
          applyTheme(data.theme);
        }
      } catch {
        // Keep whatever we have (fallback paint) when the event can't be fetched.
      }
    },
    formatDate(date) {
      const d = date instanceof Date ? date : (date ? new Date(date) : null);
      if (!d || Number.isNaN(d.getTime())) return '';
      return d.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    },
    openRsvpForm() {
      this.errorMessage = '';
      this.showRsvpForm = true;
    },
    openLookupForm() {
      this.errorMessage = '';
      this.showLookupForm = true;
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
      this.formData = { attending: 'yes', name: '', phone: '', email: '', guests: 1, dietary_restrictions: '', message: '' };
    },
    async share() {
      const url = window.location.href;
      const title = `Anniversaire de ${this.birthdayPerson}`;
      const text = `${title} — tu es invité(e) ! 🎉`;
      try {
        if (navigator.share) {
          await navigator.share({ title, text, url });
          return;
        }
      } catch (err) {
        // User dismissed the native sheet — done. Any other failure falls
        // through to the WhatsApp/clipboard fallback below.
        if (err && err.name === 'AbortError') return;
      }
      // Fallback: WhatsApp share, then clipboard.
      try {
        await navigator.clipboard?.writeText(url);
        this.errorMessage = '';
      } catch { /* ignore clipboard failures */ }
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener');
    },
    async submitRSVP() {
      this.isSubmitting = true;
      this.errorMessage = '';
      try {
        const res = await fetch(`${apiBaseUrl}/events/${encodeURIComponent(this.effectiveSlug)}/rsvp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attending: this.formData.attending,
            name: this.formData.name,
            email: this.formData.email,
            phone: this.formData.phone,
            guests: this.formData.guests,
            dietary_restrictions: this.formData.dietary_restrictions,
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
        const res = await fetch(`${apiBaseUrl}/events/${encodeURIComponent(this.effectiveSlug)}/rsvp/lookup/${encodeURIComponent(this.lookupPhoneNumber.trim())}`, {
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
          dietary_restrictions: data.dietary_restrictions || '',
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
.age-badge{background:var(--theme-badge-gradient,linear-gradient(135deg,#ffd93d,#ff6b6b));color:var(--theme-badge-text,#fff);padding:10px 22px;border-radius:25px;text-align:center;font-weight:700;font-size:1.2rem;margin:0 auto 25px;display:inline-block;box-shadow:0 4px 15px #0000002e}
.map-link{color:var(--theme-primary,#ff6b6b);text-decoration:underline}
.action-row{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:10px 0 6px}
.action-chip{display:inline-flex;align-items:center;gap:7px;background:#00000008;border:1.5px solid #0000001f;color:var(--theme-card-text,#333);border-radius:20px;padding:8px 14px;font-size:.85rem;font-weight:600;cursor:pointer;text-decoration:none;transition:all .2s ease;font-family:inherit}
.action-chip:hover{border-color:var(--theme-primary,#ff6b6b);transform:translateY(-1px)}
.deadline-note{text-align:center;font-size:.95rem;font-weight:600;color:var(--theme-primary-dark,#c9184a);margin-bottom:14px}
.rsvp-closed{background:#f3f4f6;border:2px dashed #cbd5e1;border-radius:15px;padding:24px;text-align:center;color:#44505f}
.rsvp-closed h2{margin-bottom:8px;color:var(--theme-primary-dark,#c9184a)}
.event-not-found{background:#f3f4f6;border:2px dashed #cbd5e1;border-radius:15px;padding:30px 24px;text-align:center;color:#44505f}
.event-not-found h2{margin-bottom:10px;color:var(--theme-primary-dark,#c9184a)}
.event-details{margin:25px 0}
.detail-item{display:flex;align-items:center;margin-bottom:15px;font-size:1rem;color:var(--theme-card-text,#333)}
.detail-icon{color:var(--theme-primary,#ff6b6b);margin-right:12px;width:20px;text-align:center}
.rsvp-section{margin-top:30px}
.rsvp-buttons{text-align:center;display:flex;flex-direction:column;gap:15px;align-items:center}
.rsvp-button,.lookup-button{font-family:var(--theme-font-display,inherit);color:var(--theme-button-text,#fff);border:none;padding:15px 30px;border-radius:25px;font-size:1.1rem;font-weight:600;cursor:pointer;transition:all .3s ease;min-width:200px}
.rsvp-button{background:var(--theme-button-gradient,linear-gradient(135deg,#4ecdc4,#44a08d));box-shadow:0 4px 15px #00000033}
.rsvp-button:hover{transform:translateY(-2px);box-shadow:0 8px 25px #00000040}
.lookup-button{background:linear-gradient(135deg,var(--theme-secondary,#667eea),var(--theme-primary-dark,#764ba2));box-shadow:0 4px 15px #00000033}
.lookup-button:hover{transform:translateY(-2px);box-shadow:0 8px 25px #00000040}
.lookup-form{background:#f0f4ff;padding:25px;border-radius:15px;margin-top:20px;border:2px solid #e1e5e9}
.lookup-form h2{color:var(--theme-primary,#667eea);font-size:1.3rem;margin-bottom:20px;text-align:center}
.rsvp-form{background:#f8f9fa;padding:25px;border-radius:15px;margin-top:20px}
.rsvp-form h2,.form-title{color:var(--theme-primary,#ff6b6b);font-size:1.3rem;margin-bottom:20px;text-align:center}
.form-group{margin-bottom:20px}
.radio-fieldset{border:none;padding:0;margin:0 0 20px}
.radio-fieldset legend{margin-bottom:8px;color:#333;font-weight:500;padding:0}
.form-group label{display:block;margin-bottom:8px;color:#333;font-weight:500}
.form-group input,.form-group select{width:100%;padding:12px 15px;border:2px solid #e1e5e9;border-radius:10px;font-size:1rem;transition:border-color .3s ease}
.form-group input:focus,.form-group select:focus{outline:none;border-color:var(--theme-primary,#ff6b6b)}
.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.radio-group{display:flex;flex-direction:column;gap:12px}
.radio-option{display:flex;align-items:center;cursor:pointer;padding:12px;border:2px solid #e1e5e9;border-radius:10px;transition:all .3s ease}
.radio-option:hover{border-color:var(--theme-primary,#ff6b6b);background-color:#0000000a}
.radio-option:focus-within{outline:3px solid var(--theme-primary-soft,#ff6b6b55);outline-offset:2px;border-color:var(--theme-primary,#ff6b6b)}
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
.confirmation-message h2{font-size:1.4rem;margin-bottom:15px}
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
