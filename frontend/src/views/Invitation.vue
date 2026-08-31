<template>
  <!--
    `theme-surface` re-points the shadcn tokens at the event's palette (see
    src/assets/index.css), so every Button, Input and Card below is dressed by
    the selected theme rather than by the neutral admin palette.
  -->
  <div class="theme-surface relative flex min-h-full flex-col items-center justify-center overflow-hidden px-4 py-6">
    <div
      v-for="(emoji, i) in themeDef.decorations"
      :key="`${theme}-${i}`"
      class="pointer-events-none absolute animate-float text-3xl opacity-30 select-none"
      :class="decorationPositions[i % decorationPositions.length]"
      :style="{ animationDelay: `${i}s` }"
      aria-hidden="true"
    >{{ emoji }}</div>

    <main class="relative w-full max-w-[500px] animate-card-in overflow-hidden rounded-[20px] bg-card text-card-foreground shadow-[0_25px_50px_rgba(0,0,0,0.1)]">
      <header
        class="relative overflow-hidden px-6 py-8 text-center text-[color:var(--theme-header-text,#fff)] sm:px-8"
        :style="{ background: 'var(--theme-header-gradient, linear-gradient(135deg,#ff6b6b,#ff8e8e))' }"
      >
        <span
          class="pointer-events-none absolute inset-0 opacity-[0.18]"
          :style="{ background: 'radial-gradient(circle at 50% 0%, var(--theme-accent,#ffb703) 0%, transparent 60%)' }"
          aria-hidden="true"
        ></span>
        <div class="relative flex justify-center gap-3.5" aria-hidden="true">
          <span
            v-for="(e, i) in themeDef.heroEmojis"
            :key="i"
            class="animate-hero-float text-[2.4rem] drop-shadow-[0_3px_6px_rgba(0,0,0,0.25)]"
            :style="{ animationDelay: `${i}s` }"
          >{{ e }}</span>
        </div>
        <h1 class="relative mt-2.5 font-display text-2xl leading-tight font-bold tracking-wide sm:text-[2rem]">
          {{ themeDef.copy.title }}
        </h1>
        <p class="relative mt-2.5 text-lg opacity-90">{{ themeDef.copy.subtitle }}</p>
      </header>

      <div v-if="notFound" class="p-6 sm:p-8">
        <div class="rounded-2xl border-2 border-dashed bg-muted px-6 py-8 text-center">
          <h2 class="text-lg font-bold text-[color:var(--theme-primary-dark,#c9184a)]">🔍 Événement introuvable</h2>
          <p class="mt-2 text-muted-foreground">Cette invitation n'existe pas ou n'est plus disponible.</p>
        </div>
      </div>

      <div v-else class="p-6 sm:p-8">
        <div class="text-center">
          <p class="font-display text-[1.7rem] font-bold text-[color:var(--theme-primary,#ff6b6b)]">{{ birthdayPerson }}</p>
          <p
            v-if="age"
            class="mt-3 inline-block rounded-full px-5 py-2.5 text-lg font-bold text-[color:var(--theme-badge-text,#fff)] shadow-[0_0_0_4px_var(--theme-primary-soft,#ff6b6b55),0_4px_15px_rgba(0,0,0,0.18)]"
            :style="{ background: 'var(--theme-badge-gradient, linear-gradient(135deg,#ffd93d,#ff6b6b))' }"
          >{{ age }} ans</p>
        </div>

        <div v-if="countdown" class="my-6 flex flex-wrap items-stretch justify-center gap-3" role="status" :aria-label="countdownAria">
          <template v-if="countdown.isToday || countdown.isPast">
            <span
              class="inline-block rounded-full px-6 py-3 font-display font-bold text-[color:var(--theme-button-text,#fff)]"
              :style="{ background: 'var(--theme-button-gradient, linear-gradient(135deg,#4ecdc4,#44a08d))' }"
            >{{ countdown.isToday ? "🎉 C'est aujourd'hui !" : '🎂 Joyeux anniversaire !' }}</span>
          </template>
          <template v-else>
            <div
              v-for="unit in countdownUnits"
              :key="unit.label"
              class="flex min-w-14 flex-col items-center justify-center rounded-2xl px-2.5 py-3 sm:min-w-16"
              :style="{ background: 'var(--theme-primary-soft, #ff6b6b55)' }"
            >
              <span class="font-display text-2xl leading-none font-bold text-[color:var(--theme-primary,#ff6b6b)] tabular-nums sm:text-[1.9rem]">
                {{ unit.value }}
              </span>
              <span class="mt-1.5 text-[0.68rem] tracking-wider uppercase opacity-65">{{ unit.label }}</span>
            </div>
          </template>
        </div>

        <div class="my-6 grid gap-3 sm:grid-cols-2">
          <div
            v-for="detail in eventDetails"
            :key="detail.label"
            class="flex items-center gap-3 rounded-2xl bg-black/[0.035] p-3.5"
            :class="detail.wide && 'sm:col-span-2'"
          >
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-full text-[color:var(--theme-button-text,#fff)]"
              :style="{ background: 'var(--theme-badge-gradient, var(--theme-primary,#ff6b6b))' }"
            >
              <component :is="detail.icon" class="size-4" aria-hidden="true" />
            </span>
            <div class="flex min-w-0 flex-col">
              <span class="text-[0.72rem] tracking-wide uppercase opacity-60">{{ detail.label }}</span>
              <a
                v-if="detail.href"
                :href="detail.href"
                target="_blank"
                rel="noopener"
                class="font-semibold text-[color:var(--theme-primary,#ff6b6b)] underline underline-offset-2"
              >{{ detail.value }}</a>
              <span v-else class="font-semibold">{{ detail.value }}</span>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap justify-center gap-2.5">
          <Button as-child variant="outline" size="sm" class="rounded-full">
            <a :href="icsUrl"><DownloadIcon /> Calendrier (.ics)</a>
          </Button>
          <Button v-if="googleCalUrl" as-child variant="outline" size="sm" class="rounded-full">
            <a :href="googleCalUrl" target="_blank" rel="noopener"><CalendarPlusIcon /> Google Agenda</a>
          </Button>
          <Button type="button" variant="outline" size="sm" class="rounded-full" @click="share">
            <Share2Icon /> Partager
          </Button>
        </div>

        <div class="mt-8">
          <!-- ---------- Already answered ---------- -->
          <div
            v-if="hasConfirmedAttendance"
            class="rounded-2xl p-6 text-center text-white"
            :class="isAttending
              ? 'bg-linear-to-br from-[#43cea2] to-[#22a06b]'
              : 'bg-linear-to-br from-[#ff7675] to-[#fd79a8]'"
            role="status"
          >
            <template v-if="isAttending">
              <h2 class="text-xl font-bold">🎉 Merci {{ confirmedName }} !</h2>
              <p class="mt-2">Ta réponse est bien enregistrée. À très bientôt ! 🎈</p>
              <div class="mt-4 space-y-1 opacity-90">
                <p>👨‍👩‍👧‍👦 {{ confirmedGuests }} personne(s)</p>
                <p v-if="confirmedMessage">💌 {{ confirmedMessage }}</p>
              </div>
            </template>
            <template v-else>
              <h2 class="text-xl font-bold">Merci {{ confirmedName }}</h2>
              <p class="mt-2">Dommage que tu ne puisses pas venir. 😔</p>
              <p v-if="confirmedMessage" class="mt-4 opacity-90">💌 {{ confirmedMessage }}</p>
            </template>
            <Button
              variant="outline"
              class="mt-5 rounded-full border-white/30 bg-white/20 text-white hover:bg-white/30 hover:text-white"
              @click="resetForm"
            >Modifier ma réponse</Button>
          </div>

          <!-- ---------- Closed ---------- -->
          <div v-else-if="rsvpClosed" class="rounded-2xl border-2 border-dashed bg-muted px-6 py-6 text-center" role="status">
            <h2 class="text-lg font-bold text-[color:var(--theme-primary-dark,#c9184a)]">🙏 Réponses closes</h2>
            <p class="mt-2 text-muted-foreground">La date limite de réponse ({{ formatDeadline }}) est passée.</p>
          </div>

          <template v-else>
            <p v-if="formatDeadline" class="mb-4 text-center font-semibold text-[color:var(--theme-primary-dark,#c9184a)]">
              ⏳ Merci de répondre avant le {{ formatDeadline }}
            </p>

            <div v-if="!showRsvpForm && !showLookupForm" class="flex flex-col items-stretch gap-3">
              <Button
                size="lg"
                class="h-auto animate-rsvp-pulse rounded-full py-4 font-display text-lg text-[color:var(--theme-button-text,#fff)] shadow-lg hover:animate-none"
                :style="{ background: 'var(--theme-button-gradient, linear-gradient(135deg,#4ecdc4,#44a08d))' }"
                @click="openRsvpForm"
              >🎈 Je réponds à l'invitation</Button>
              <Button
                size="lg"
                class="h-auto rounded-full py-4 font-display text-lg text-[color:var(--theme-button-text,#fff)] shadow-lg"
                :style="{ background: 'linear-gradient(135deg, var(--theme-secondary,#667eea), var(--theme-primary-dark,#764ba2))' }"
                @click="openLookupForm"
              >✏️ Modifier ma réponse</Button>
            </div>

            <!-- ---------- RSVP form ---------- -->
            <form v-if="showRsvpForm" class="mt-5 space-y-5 rounded-2xl bg-muted p-5 sm:p-6" @submit.prevent="submitRSVP">
              <h2 class="text-center text-xl font-bold text-[color:var(--theme-primary,#ff6b6b)]">Réponds à l'invitation</h2>

              <fieldset class="space-y-3">
                <legend class="mb-3 font-medium">Statut <span class="text-destructive" aria-hidden="true">*</span></legend>
                <RadioGroup v-model="formData.attending" class="gap-3">
                  <div
                    v-for="opt in attendingOptions"
                    :key="opt.value"
                    class="flex items-center gap-3 rounded-xl border-2 bg-card p-3 transition-colors"
                    :class="formData.attending === opt.value
                      ? 'border-[color:var(--theme-primary,#ff6b6b)] bg-accent'
                      : 'hover:border-[color:var(--theme-primary,#ff6b6b)]/50'"
                  >
                    <RadioGroupItem :id="`attending-${opt.value}`" :value="opt.value" />
                    <Label :for="`attending-${opt.value}`" class="flex-1 cursor-pointer font-medium">{{ opt.label }}</Label>
                  </div>
                </RadioGroup>
              </fieldset>

              <div class="grid gap-2">
                <Label for="rsvp-name">👶 Nom de l'enfant <span class="text-destructive" aria-hidden="true">*</span></Label>
                <Input id="rsvp-name" v-model="formData.name" class="h-11 bg-card" type="text" required placeholder="Prénom de l'enfant" />
              </div>

              <div class="grid gap-2">
                <Label for="rsvp-phone">📱 Téléphone <span class="text-destructive" aria-hidden="true">*</span></Label>
                <Input id="rsvp-phone" v-model="formData.phone" class="h-11 bg-card" type="tel" inputmode="tel" autocomplete="tel" required placeholder="06 12 34 56 78" />
              </div>

              <div class="grid gap-2">
                <Label for="rsvp-email">✉️ Email du parent</Label>
                <Input id="rsvp-email" v-model="formData.email" class="h-11 bg-card" type="email" inputmode="email" autocomplete="email" autocapitalize="none" placeholder="parent@example.com" />
              </div>

              <div v-if="formData.attending === 'yes'" class="grid gap-2">
                <Label for="rsvp-guests">👨‍👩‍👧‍👦 Nombre de personnes</Label>
                <Select v-model="guestsValue">
                  <SelectTrigger id="rsvp-guests" class="h-11 w-full bg-card min-w-0 *:data-[slot=select-value]:min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="opt in guestOptions" :key="opt.value" :value="String(opt.value)">{{ opt.label }}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div v-if="formData.attending === 'yes'" class="grid gap-2">
                <Label for="rsvp-diet">🥜 Allergies / régime alimentaire</Label>
                <Textarea id="rsvp-diet" v-model="formData.dietary_restrictions" class="bg-card" placeholder="Allergies, intolérances, régime particulier..." />
              </div>

              <div class="grid gap-2">
                <Label for="rsvp-message">💌 Message (optionnel)</Label>
                <Textarea id="rsvp-message" v-model="formData.message" class="bg-card" :placeholder="messagePlaceholder" />
              </div>

              <Alert v-if="errorMessage" variant="destructive" role="alert">
                <CircleAlertIcon />
                <AlertDescription>{{ errorMessage }}</AlertDescription>
              </Alert>

              <div class="flex flex-col gap-3 sm:flex-row">
                <Button type="button" variant="outline" size="lg" class="flex-1" @click="cancelForm">Annuler</Button>
                <Button type="submit" size="lg" class="flex-1" :disabled="isSubmitting">
                  <Loader2Icon v-if="isSubmitting" class="animate-spin" />
                  {{ isSubmitting ? 'Envoi...' : 'Envoyer ma réponse' }}
                </Button>
              </div>
            </form>

            <!-- ---------- Lookup form ---------- -->
            <form v-if="showLookupForm" class="mt-5 space-y-5 rounded-2xl bg-muted p-5 sm:p-6" @submit.prevent="lookupRSVP">
              <h2 class="text-center text-xl font-bold text-[color:var(--theme-primary,#ff6b6b)]">Retrouver ma réponse</h2>
              <div class="grid gap-2">
                <Label for="lookup-phone">📱 Téléphone <span class="text-destructive" aria-hidden="true">*</span></Label>
                <Input id="lookup-phone" v-model="lookupPhoneNumber" class="h-11 bg-card" type="tel" inputmode="tel" autocomplete="tel" required placeholder="06 12 34 56 78" />
                <p class="text-sm text-muted-foreground">Le numéro utilisé lors de ta première réponse.</p>
              </div>
              <Alert v-if="errorMessage" variant="destructive" role="alert">
                <CircleAlertIcon />
                <AlertDescription>{{ errorMessage }}</AlertDescription>
              </Alert>
              <div class="flex flex-col gap-3 sm:flex-row">
                <Button type="button" variant="outline" size="lg" class="flex-1" @click="cancelForm">Annuler</Button>
                <Button type="submit" size="lg" class="flex-1" :disabled="isLookingUp">
                  <Loader2Icon v-if="isLookingUp" class="animate-spin" />
                  {{ isLookingUp ? 'Recherche...' : 'Rechercher' }}
                </Button>
              </div>
            </form>
          </template>
        </div>
      </div>
    </main>

    <!-- The admin entry used to be pinned to the viewport corner, where it sat
         on top of the build stamp on a phone. It is a host affordance, not a
         guest one, so it goes quietly at the end of the page. -->
    <div class="relative mt-6">
      <Button as-child variant="secondary" size="sm" class="rounded-full bg-white/90 text-slate-600 shadow-md hover:bg-white">
        <RouterLink to="/admin">🔐 Admin</RouterLink>
      </Button>
    </div>
  </div>
</template>

<script>
import { RouterLink } from 'vue-router';
import { toast } from 'vue-sonner';
import {
  Building2Icon, CalendarDaysIcon, CalendarPlusIcon, CircleAlertIcon, ClockIcon,
  DownloadIcon, Loader2Icon, MapPinIcon, Share2Icon, ShirtIcon
} from '@lucide/vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { eventConfig, apiBaseUrl } from '../env.js';
import { applyTheme, getTheme, DEFAULT_THEME } from '../themes.js';
import { applySeo, eventSeo, ogImageUrl } from '../seo.js';

export default {
  name: 'Invitation',
  components: {
    RouterLink,
    Alert, AlertDescription,
    Button, Input, Label,
    RadioGroup, RadioGroupItem,
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
    Textarea,
    CalendarPlusIcon, CircleAlertIcon, DownloadIcon, Loader2Icon, Share2Icon
  },
  props: {
    slug: { type: String, default: '' }
  },
  data() {
    // Only seed from the env.js fallback on the default route, to avoid a blank
    // flash; the API response is the source of truth and overrides this.
    const isDefault = !this.slug;
    return {
      theme: DEFAULT_THEME,
      now: Date.now(),
      // Where the floating emoji sit. Indexed by position in the theme's list,
      // so a theme with more or fewer decorations still scatters evenly.
      decorationPositions: [
        'top-[10%] left-[15%]',
        'top-[20%] right-[20%]',
        'top-[60%] left-[10%]',
        'top-[70%] right-[15%]',
        'bottom-[20%] left-[20%]',
        'bottom-[10%] right-[25%]'
      ],
      attendingOptions: [
        { value: 'yes', label: 'Oui, je viens ! 🎈' },
        { value: 'no', label: 'Non, je ne peux pas venir 😔' }
      ],
      notFound: false,
      rsvpClosed: false,
      birthdayPerson: isDefault ? eventConfig.birthdayPerson : '',
      age: isDefault ? eventConfig.age : '',
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
    // The Select works in strings; the payload and the option list are numbers.
    guestsValue: {
      get() {
        return String(this.formData.guests);
      },
      set(value) {
        this.formData.guests = Number(value);
      }
    },

    // The countdown as three labelled figures, so the template stays flat.
    countdownUnits() {
      if (!this.countdown || this.countdown.isToday || this.countdown.isPast) return [];
      return [
        { value: this.countdown.days, label: 'jours' },
        { value: this.countdown.hours, label: 'heures' },
        { value: this.countdown.minutes, label: 'min' }
      ];
    },

    // The filled-in facts, in display order. Building the list here keeps the
    // "hide what we do not know" rule in one place instead of a v-if per tile.
    eventDetails() {
      const tiles = [];
      if (this.formattedDate) tiles.push({ label: 'Date', value: this.formattedDate, icon: CalendarDaysIcon });
      if (this.eventTime) tiles.push({ label: 'Heure', value: this.eventTime, icon: ClockIcon });
      if (this.eventTown) tiles.push({ label: 'Ville', value: this.eventTown, icon: Building2Icon });
      if (this.eventLocation) {
        tiles.push({
          label: 'Lieu', value: this.eventLocation, icon: MapPinIcon,
          href: this.mapUrl || undefined, wide: true
        });
      }
      if (this.dresscode) tiles.push({ label: 'Tenue', value: this.dresscode, icon: ShirtIcon });
      return tiles;
    },

    effectiveSlug() {
      return this.slug || 'default';
    },
    themeDef() {
      return getTheme(this.theme);
    },
    // The three usual answers, plus the recorded value when a response the host
    // entered by hand carries more people than the form normally offers — the
    // select would otherwise render blank and silently drop the guest's count.
    guestOptions() {
      const options = [
        { value: 1, label: "1 personne (juste l'enfant)" },
        { value: 2, label: '2 personnes (enfant + 1 accompagnateur)' },
        { value: 3, label: '3 personnes (enfant + 2 accompagnateurs)' }
      ];
      const current = Number(this.formData.guests);
      if (Number.isInteger(current) && current > 3) {
        options.push({ value: current, label: `${current} personnes` });
      }
      return options;
    },
    messagePlaceholder() {
      return this.formData.attending === 'yes'
        ? 'Un petit mot pour nous dire votre joie de venir...'
        : "Un petit mot pour s'excuser...";
    },
    formattedDate() {
      return this.formatDate(this.eventDate);
    },
    eventStart() {
      if (!this.eventDate) return null;
      const d = this.eventDate instanceof Date ? this.eventDate : new Date(this.eventDate);
      return Number.isNaN(d.getTime()) ? null : d;
    },
    countdown() {
      if (!this.eventStart) return null;
      const diff = this.eventStart.getTime() - this.now;
      const dayMs = 86400000;
      if (this.eventStart.toDateString() === new Date(this.now).toDateString()) {
        return { isToday: true };
      }
      if (diff <= 0) return { isPast: true };
      return {
        days: Math.floor(diff / dayMs),
        hours: Math.floor((diff % dayMs) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000)
      };
    },
    countdownAria() {
      if (!this.countdown) return '';
      if (this.countdown.isToday) return "C'est aujourd'hui";
      if (this.countdown.isPast) return 'La fête est passée';
      return `Encore ${this.countdown.days} jours`;
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
    this._countdownTimer = setInterval(() => { this.now = Date.now(); }, 60000);
    // Paint the (fallback) theme immediately, then upgrade to the event's theme
    // once the public event endpoint responds.
    applyTheme(this.theme);
    // No updateSeo() here: the server already injected this event's tags into
    // the shell. Overwriting them with the seed values before the fetch lands
    // would only downgrade them (and lose them entirely if the fetch fails).
    this.loadEvent();
  },
  watch: {
    slug() {
      this.loadEvent();
    }
  },
  beforeUnmount() {
    clearInterval(this._countdownTimer);
  },
  methods: {
    async loadEvent() {
      this.notFound = false;
      try {
        const res = await fetch(`${apiBaseUrl}/events/${encodeURIComponent(this.effectiveSlug)}`);
        if (res.status === 404) {
          this.notFound = true;
          this.updateSeo();
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        this.birthdayPerson = data.person || '';
        // Free-form on the server ("5", "18 mois"): keep the string so the badge
        // and the title match the share card instead of blanking on a non-number.
        this.age = String(data.age ?? '').trim();
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
        this.updateSeo();
      } catch {
        // Keep whatever we have (fallback paint) when the event can't be fetched.
      }
    },
    // Keep the tab title, the share sheet and the canonical URL in step with the
    // event actually on screen. The first paint's tags come from the server.
    updateSeo() {
      if (this.notFound) {
        applySeo({
          title: 'Événement introuvable',
          description: 'Cette invitation n\'existe pas ou n\'est plus disponible.',
          robots: 'noindex, follow'
        });
        return;
      }
      const { title, description } = eventSeo({
        person: this.birthdayPerson,
        age: this.age,
        formattedDate: this.formattedDate,
        time: this.eventTime,
        town: this.eventTown,
        location: this.eventLocation,
        rsvpClosed: this.rsvpClosed
      });
      applySeo({ title, description, image: ogImageUrl(apiBaseUrl, this.slug) });
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
        // through to the clipboard path below.
        if (err && err.name === 'AbortError') return;
      }
      // No native share sheet (most desktops): copy the link and *offer*
      // WhatsApp rather than opening a tab the visitor never asked for.
      const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Lien copié', {
          action: { label: 'WhatsApp', onClick: () => window.open(whatsapp, '_blank', 'noopener') }
        });
      } catch {
        window.open(whatsapp, '_blank', 'noopener');
      }
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

