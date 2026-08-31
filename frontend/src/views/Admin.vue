<template>
  <div class="flex min-h-full flex-col bg-background">
    <!-- ===================== TOPBAR =====================
      The actions used to sit side by side and simply ran out of room on a
      phone, squeezing the brand down to a bare emoji. The invitation link and
      sign-out now collapse into a menu below `sm`, so the bar keeps its title
      and every control keeps a 44px touch target. -->
    <header class="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div class="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4">
        <span class="text-xl" aria-hidden="true">🎉</span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold leading-tight">Administration</p>
          <p class="truncate text-xs leading-tight text-muted-foreground">Événements et confirmations</p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          :disabled="refreshing"
          title="Tout actualiser"
          aria-label="Tout actualiser"
          @click="refreshAll"
        >
          <RefreshCwIcon :class="refreshing && 'animate-spin'" />
        </Button>

        <Button as-child variant="outline" size="sm" class="hidden sm:inline-flex">
          <RouterLink to="/">
            <ExternalLinkIcon />
            Voir l'invitation
          </RouterLink>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon" aria-label="Menu du compte">
              <CircleUserIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuLabel class="truncate font-normal text-muted-foreground">
              {{ session.user?.email || 'Compte' }}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem as-child class="sm:hidden">
              <RouterLink to="/">
                <ExternalLinkIcon />
                Voir l'invitation
              </RouterLink>
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" @select="logout">
              <LogOutIcon />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

    <main class="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-5">
      <!-- ===================== EVENTS OVERVIEW ===================== -->
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <span aria-hidden="true">🎈</span> Événements
          </CardTitle>
          <CardDescription>Sélectionne une fête pour gérer ses réponses, son thème et son lien.</CardDescription>
          <CardAction>
            <Button size="sm" @click="openCreateEventModal">
              <PlusIcon />
              Nouvel événement
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent>
          <div v-if="eventsLoading && !events.length" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
            <span class="sr-only">Chargement des événements...</span>
            <Skeleton v-for="n in 3" :key="n" class="h-44 w-full rounded-xl" />
          </div>

          <Alert v-else-if="eventsError" variant="destructive" role="alert">
            <CircleAlertIcon />
            <AlertTitle>Chargement impossible</AlertTitle>
            <AlertDescription>{{ eventsError }}</AlertDescription>
          </Alert>

          <div v-else-if="!events.length" class="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center">
            <span class="text-3xl" aria-hidden="true">🎂</span>
            <div>
              <p class="font-medium">Aucun événement pour le moment</p>
              <p class="text-sm text-muted-foreground">Crée une première fête pour ouvrir les invitations.</p>
            </div>
            <Button size="sm" @click="openCreateEventModal">
              <PlusIcon />
              Nouvel événement
            </Button>
          </div>

          <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <!-- The whole card selects the event: the title button carries a
                 stretched hit area so there is still exactly one focusable
                 control for it, and the menu sits above that layer. -->
            <div
              v-for="ev in events"
              :key="ev.id"
              class="relative flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors"
              :class="ev.id === selectedEventId
                ? 'border-primary ring-3 ring-ring/25'
                : 'hover:border-primary/40 hover:bg-accent/40'"
            >
              <div class="flex items-start justify-between gap-2">
                <span class="text-2xl" aria-hidden="true">{{ themeIcon(ev.theme) }}</span>
                <div class="relative z-10 flex items-center gap-1">
                  <Badge v-if="ev.is_default" class="bg-success text-success-foreground">Actif</Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="icon-sm" :aria-label="`Actions pour ${ev.person || 'cet événement'}`">
                        <EllipsisVerticalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem @select="openEditEventModal(ev)">
                        <PencilIcon />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem @select="copyEventLink(ev)">
                        <LinkIcon />
                        Copier le lien
                      </DropdownMenuItem>
                      <template v-if="!ev.is_default">
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" @select="openDeleteEventModal(ev)">
                          <Trash2Icon />
                          Supprimer
                        </DropdownMenuItem>
                      </template>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div class="min-w-0">
                <h3 class="truncate font-semibold">
                  <button
                    type="button"
                    class="text-left outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
                    :aria-pressed="ev.id === selectedEventId"
                    @click="selectEvent(ev)"
                  >{{ ev.person || 'Sans nom' }}</button>
                </h3>
                <p class="mt-0.5 text-sm text-muted-foreground">
                  <template v-if="ev.date || ev.town">
                    <span v-if="ev.date">{{ formatEventDate(ev.date) }}</span>
                    <span v-if="ev.date && ev.town"> · </span>
                    <span v-if="ev.town">{{ ev.town }}</span>
                  </template>
                  <em v-else class="not-italic opacity-70">Détails à compléter</em>
                </p>
                <p class="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{{ themeLabel(ev.theme) }}</p>
              </div>

              <dl class="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <div class="flex items-baseline gap-1">
                  <dt class="order-2 text-muted-foreground">rép.</dt>
                  <dd class="order-1 font-semibold">{{ ev.responses || 0 }}</dd>
                </div>
                <div class="flex items-baseline gap-1">
                  <dt class="order-2 text-muted-foreground">conf.</dt>
                  <dd class="order-1 font-semibold text-success">{{ ev.confirmations || 0 }}</dd>
                </div>
                <div class="flex items-baseline gap-1">
                  <dt class="order-2 text-muted-foreground">inv.</dt>
                  <dd class="order-1 font-semibold">{{ ev.total_guests || 0 }}</dd>
                </div>
              </dl>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- ===================== SECTION TABS ===================== -->
      <Tabs v-model="activeTab" class="gap-4">
        <!-- Full width on a phone so the four tabs share the strip; back to
             shadcn's content width once there is room to spare. -->
        <TabsList class="w-full justify-start overflow-x-auto sm:w-fit">
          <!-- Four labels plus their emoji overflow a 390px strip and the last
               one gets clipped mid-word; the emoji are decoration, so they are
               the part that goes. -->
          <TabsTrigger v-for="tab in tabs" :key="tab.id" :value="tab.id" class="text-xs sm:text-sm">
            <span class="hidden sm:inline" aria-hidden="true">{{ tab.icon }}</span>
            {{ tab.label }}
            <Badge v-if="tab.id === 'responses' && selectedEvent" variant="secondary">{{ stats.total_responses }}</Badge>
            <Badge v-if="tab.id === 'access'" variant="secondary">{{ users.length }}</Badge>
          </TabsTrigger>
        </TabsList>

        <!-- Shared "no event picked yet" state for the per-event tabs. -->
        <template v-for="tab in tabs" :key="`empty-${tab.id}`">
          <TabsContent v-if="tab.needsEvent && !selectedEvent" :value="tab.id">
            <div class="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
              <span class="text-3xl" aria-hidden="true">👆</span>
              <p class="font-medium">Choisis un événement</p>
              <p class="text-sm text-muted-foreground">Sélectionne une fête ci-dessus pour voir cette section.</p>
            </div>
          </TabsContent>
        </template>

        <!-- ---------- Responses ---------- -->
        <TabsContent v-if="selectedEvent" value="responses" class="space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-lg font-semibold">
              Gestion : <span class="text-primary">{{ selectedEvent.person || 'Sans nom' }}</span>
            </h2>
            <Button variant="ghost" size="sm" @click="clearSelection">
              <XIcon />
              Fermer
            </Button>
          </div>

          <!-- Two columns on a phone instead of one: the cards were stacking
               full-width, so the five figures took a whole screen to read. -->
          <div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div class="rounded-xl border bg-card p-4">
              <div class="text-lg" aria-hidden="true">📨</div>
              <div class="mt-1 text-2xl font-bold tabular-nums">{{ stats.total_responses }}</div>
              <div class="text-xs uppercase tracking-wide text-muted-foreground">Total réponses</div>
            </div>
            <div class="rounded-xl border bg-card p-4">
              <div class="text-lg" aria-hidden="true">✅</div>
              <div class="mt-1 text-2xl font-bold tabular-nums text-success">{{ stats.confirmations }}</div>
              <div class="text-xs uppercase tracking-wide text-muted-foreground">Confirmations</div>
            </div>
            <div class="rounded-xl border bg-card p-4">
              <div class="text-lg" aria-hidden="true">❌</div>
              <div class="mt-1 text-2xl font-bold tabular-nums text-destructive">{{ stats.declined }}</div>
              <div class="text-xs uppercase tracking-wide text-muted-foreground">Déclins</div>
            </div>
            <div class="rounded-xl border bg-card p-4">
              <div class="text-lg" aria-hidden="true">👥</div>
              <div class="mt-1 text-2xl font-bold tabular-nums">{{ stats.total_guests }}</div>
              <div class="text-xs uppercase tracking-wide text-muted-foreground">Total invités</div>
            </div>
            <div class="col-span-2 rounded-xl border bg-card p-4 lg:col-span-1">
              <div class="text-lg" aria-hidden="true">📊</div>
              <div class="mt-1 text-2xl font-bold tabular-nums">{{ acceptanceRate }}%</div>
              <Progress
                :model-value="acceptanceRate"
                class="my-2"
                :aria-label="`Taux d'acceptation ${acceptanceRate} %`"
              />
              <div class="text-xs uppercase tracking-wide text-muted-foreground">Taux d'acceptation</div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Réponses</CardTitle>
              <CardDescription>Les réponses arrivent en direct, la liste se rafraîchit toute seule.</CardDescription>
              <CardAction class="flex flex-wrap justify-end gap-2">
                <Button variant="outline" size="sm" :disabled="loading" @click="loadEventData">
                  <RefreshCwIcon :class="loading && 'animate-spin'" />
                  <span class="sr-only sm:not-sr-only">Actualiser</span>
                </Button>
                <Button as-child variant="outline" size="sm">
                  <a :href="csvUrl">
                    <DownloadIcon />
                    <span class="sr-only sm:not-sr-only">Exporter CSV</span>
                  </a>
                </Button>
                <Button size="sm" @click="openCreateModal">
                  <PlusIcon />
                  Ajouter
                </Button>
              </CardAction>
            </CardHeader>

            <CardContent class="space-y-4">
              <!-- Search, status filter and sort. All client-side over the
                   already loaded list, so filtering never costs a request. -->
              <div v-if="rsvps.length" class="grid gap-2 sm:grid-cols-[1fr_auto]">
                <div class="relative">
                  <SearchIcon class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref="search"
                    v-model.trim="searchQuery"
                    class="pl-9"
                    type="search"
                    placeholder="Rechercher un nom, un email, un téléphone..."
                    aria-label="Rechercher une réponse"
                  />
                </div>
                <Select v-model="sortBy">
                  <SelectTrigger class="w-full sm:w-48 min-w-0 *:data-[slot=select-value]:min-w-0" aria-label="Trier les réponses">
                    <ArrowUpDownIcon />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Plus récentes</SelectItem>
                    <SelectItem value="name">Nom (A→Z)</SelectItem>
                    <SelectItem value="guests">Nombre d'invités</SelectItem>
                  </SelectContent>
                </Select>
                <div class="flex flex-wrap gap-2 sm:col-span-2" role="group" aria-label="Filtrer par statut">
                  <Button
                    v-for="f in statusFilters"
                    :key="f.id"
                    type="button"
                    size="sm"
                    :variant="statusFilter === f.id ? 'default' : 'outline'"
                    :aria-pressed="statusFilter === f.id"
                    @click="statusFilter = f.id"
                  >
                    {{ f.label }}
                    <Badge :variant="statusFilter === f.id ? 'secondary' : 'outline'">{{ statusCounts[f.id] }}</Badge>
                  </Button>
                </div>
              </div>

              <div v-if="loading && !rsvps.length" class="space-y-3" aria-live="polite">
                <span class="sr-only">Chargement des réponses...</span>
                <Skeleton v-for="n in 3" :key="n" class="h-28 w-full rounded-xl" />
              </div>

              <Alert v-else-if="error" variant="destructive" role="alert">
                <CircleAlertIcon />
                <AlertTitle>Chargement impossible</AlertTitle>
                <AlertDescription>{{ error }}</AlertDescription>
              </Alert>

              <div v-else-if="!rsvps.length" class="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
                <span class="text-3xl" aria-hidden="true">📭</span>
                <p class="font-medium">Aucune réponse pour le moment</p>
                <p class="text-sm text-muted-foreground">Partage le lien de l'invitation pour lancer les réponses.</p>
                <Button variant="outline" size="sm" @click="activeTab = 'share'">
                  <LinkIcon />
                  Partager l'invitation
                </Button>
              </div>

              <div v-else-if="!filteredRsvps.length" class="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
                <span class="text-3xl" aria-hidden="true">🔍</span>
                <p class="font-medium">Aucun résultat</p>
                <p class="text-sm text-muted-foreground">Aucune réponse ne correspond à cette recherche.</p>
                <Button variant="outline" size="sm" @click="resetFilters">Réinitialiser</Button>
              </div>

              <template v-else>
                <p class="text-sm text-muted-foreground" aria-live="polite">
                  {{ filteredRsvps.length }} réponse{{ filteredRsvps.length > 1 ? 's' : '' }} affichée{{ filteredRsvps.length > 1 ? 's' : '' }}
                  <template v-if="filteredRsvps.length !== rsvps.length">sur {{ rsvps.length }}</template>
                </p>

                <ul class="space-y-3">
                  <li
                    v-for="rsvp in filteredRsvps"
                    :key="rsvp.id"
                    class="rounded-xl border bg-card p-4"
                    :class="rsvp.attending === 'yes' ? 'border-l-4 border-l-success' : 'border-l-4 border-l-destructive'"
                  >
                    <div class="flex items-start justify-between gap-2">
                      <h3 class="flex min-w-0 items-center gap-2 font-semibold">
                        <span aria-hidden="true">{{ rsvp.attending === 'yes' ? '✅' : '❌' }}</span>
                        <span class="truncate">{{ rsvp.name }}</span>
                      </h3>
                      <div class="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          :aria-label="`Modifier la réponse de ${rsvp.name}`"
                          @click="openEditModal(rsvp)"
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          :aria-label="`Supprimer la réponse de ${rsvp.name}`"
                          @click="openDeleteModal(rsvp)"
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    </div>

                    <dl class="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                      <div class="flex gap-2">
                        <dt class="font-medium text-muted-foreground">Statut</dt>
                        <dd :class="rsvp.attending === 'yes' ? 'font-semibold text-success' : 'font-semibold text-destructive'">
                          {{ rsvp.attending === 'yes' ? 'Confirmé' : 'Décliné' }}
                        </dd>
                      </div>
                      <div v-if="rsvp.email" class="flex min-w-0 gap-2">
                        <dt class="font-medium text-muted-foreground">✉️ Email</dt>
                        <dd class="truncate">
                          <a class="underline-offset-4 hover:underline" :href="`mailto:${rsvp.email}`">{{ rsvp.email }}</a>
                        </dd>
                      </div>
                      <div class="flex gap-2">
                        <dt class="font-medium text-muted-foreground">📱 Téléphone</dt>
                        <dd>
                          <a class="underline-offset-4 hover:underline" :href="`tel:${rsvp.phone}`">{{ rsvp.phone }}</a>
                        </dd>
                      </div>
                      <div v-if="rsvp.attending === 'yes'" class="flex gap-2">
                        <dt class="font-medium text-muted-foreground">👥 Invités</dt>
                        <dd>{{ rsvp.guests }}</dd>
                      </div>
                      <div v-if="rsvp.dietary_restrictions" class="flex gap-2 sm:col-span-2">
                        <dt class="font-medium text-muted-foreground">🥜 Allergies</dt>
                        <dd>{{ rsvp.dietary_restrictions }}</dd>
                      </div>
                      <div class="flex gap-2 sm:col-span-2">
                        <dt class="font-medium text-muted-foreground">🕒 Mis à jour</dt>
                        <dd class="text-muted-foreground">{{ formatDate(rsvp.updated_at) }}</dd>
                      </div>
                    </dl>

                    <p v-if="rsvp.message" class="mt-3 rounded-lg bg-muted px-3 py-2 text-sm">💌 {{ rsvp.message }}</p>
                  </li>
                </ul>
              </template>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- ---------- Theme ---------- -->
        <TabsContent v-if="selectedEvent" value="theme">
          <Card>
            <CardHeader>
              <CardTitle class="flex items-center gap-2"><span aria-hidden="true">🎨</span> Thème de l'invitation</CardTitle>
              <CardDescription>Choisis l'ambiance affichée aux invités. Le changement est immédiat.</CardDescription>
            </CardHeader>
            <CardContent>
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <button
                  v-for="t in themes"
                  :key="t.id"
                  type="button"
                  class="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
                  :class="t.id === currentTheme ? 'border-primary ring-3 ring-ring/25' : 'hover:border-primary/40 hover:bg-accent/40'"
                  :disabled="themeSaving"
                  :aria-pressed="t.id === currentTheme"
                  @click="selectTheme(t.id)"
                >
                  <span class="text-2xl" aria-hidden="true">{{ t.icon }}</span>
                  <span class="text-sm font-medium">{{ t.label }}</span>
                  <span class="flex gap-1" aria-hidden="true">
                    <span class="size-3 rounded-full ring-1 ring-black/10" :style="{ background: t.palette.primary }"></span>
                    <span class="size-3 rounded-full ring-1 ring-black/10" :style="{ background: t.palette.secondary }"></span>
                    <span class="size-3 rounded-full ring-1 ring-black/10" :style="{ background: t.palette.accent }"></span>
                  </span>
                  <Badge v-if="t.id === currentTheme" class="bg-success text-success-foreground">
                    <CheckIcon />
                    Actif
                  </Badge>
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- ---------- Share ---------- -->
        <TabsContent v-if="selectedEvent" value="share">
          <Card>
            <CardHeader>
              <CardTitle class="flex items-center gap-2"><span aria-hidden="true">🔗</span> Partager l'invitation</CardTitle>
              <CardDescription>Diffuse ce lien ou ce QR code pour inviter tes convives.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="flex flex-col gap-2 sm:flex-row">
                <Input :model-value="invitationUrl" readonly aria-label="Lien de l'invitation" @focus="$event.target.select()" />
                <Button class="shrink-0" @click="copyLink">
                  <CheckIcon v-if="linkCopied" />
                  <CopyIcon v-else />
                  {{ linkCopied ? 'Copié' : 'Copier le lien' }}
                </Button>
              </div>
              <div class="flex flex-wrap gap-2">
                <Button as-child variant="outline" size="sm">
                  <a :href="whatsAppShareUrl" target="_blank" rel="noopener">
                    <SendIcon />
                    Envoyer sur WhatsApp
                  </a>
                </Button>
                <Button as-child variant="outline" size="sm">
                  <a :href="invitationUrl" target="_blank" rel="noopener">
                    <ExternalLinkIcon />
                    Ouvrir l'invitation
                  </a>
                </Button>
                <Button v-if="qrDataUrl" as-child variant="outline" size="sm">
                  <a :href="qrDataUrl" :download="qrFileName">
                    <DownloadIcon />
                    Télécharger le QR
                  </a>
                </Button>
              </div>
              <img
                v-if="qrDataUrl"
                :src="qrDataUrl"
                alt="QR code de l'invitation"
                class="mx-auto size-48 rounded-xl border bg-white p-2 sm:mx-0"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <!-- ---------- Access / users ---------- -->
        <TabsContent value="access">
          <Card>
            <CardHeader>
              <CardTitle class="flex items-center gap-2"><span aria-hidden="true">👥</span> Accès</CardTitle>
              <CardDescription>
                Toute personne peut créer un compte, mais seuls les comptes
                <strong class="font-medium">administrateur</strong> accèdent à cette page.
              </CardDescription>
              <CardAction>
                <Button variant="outline" size="sm" :disabled="usersLoading" @click="loadUsers">
                  <RefreshCwIcon :class="usersLoading && 'animate-spin'" />
                  <span class="sr-only sm:not-sr-only">Actualiser</span>
                </Button>
              </CardAction>
            </CardHeader>

            <CardContent>
              <div v-if="usersLoading && !users.length" class="space-y-2" aria-live="polite">
                <span class="sr-only">Chargement des comptes...</span>
                <Skeleton v-for="n in 3" :key="n" class="h-14 w-full rounded-lg" />
              </div>

              <Alert v-else-if="usersError" variant="destructive" role="alert">
                <CircleAlertIcon />
                <AlertTitle>Chargement impossible</AlertTitle>
                <AlertDescription>{{ usersError }}</AlertDescription>
              </Alert>

              <!-- A table below `sm` turned into stacked cells with no headers,
                   so small screens get purpose-built rows instead. -->
              <template v-else>
                <ul class="divide-y sm:hidden">
                  <li v-for="u in users" :key="u.id" class="flex flex-col gap-2 py-3">
                    <div class="min-w-0">
                      <p class="flex items-center gap-2 font-medium">
                        <span class="truncate">{{ u.name || '—' }}</span>
                        <Badge v-if="u.id === currentUserId" variant="secondary">vous</Badge>
                      </p>
                      <p class="truncate text-sm text-muted-foreground">{{ u.email }}</p>
                      <div class="mt-1 flex flex-wrap gap-1">
                        <Badge :variant="u.role === 'admin' ? 'default' : 'outline'">
                          {{ u.role === 'admin' ? 'Administrateur' : 'Utilisateur' }}
                        </Badge>
                        <Badge v-if="!u.emailVerified" variant="outline" class="text-muted-foreground">non confirmé</Badge>
                      </div>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <Button
                        v-if="u.role !== 'admin'"
                        size="sm"
                        :disabled="userBusyId === u.id"
                        @click="setUserRole(u, 'admin')"
                      >Donner l'accès</Button>
                      <Button
                        v-else
                        variant="secondary"
                        size="sm"
                        :disabled="userBusyId === u.id || u.id === currentUserId"
                        @click="setUserRole(u, 'user')"
                      >Retirer l'accès</Button>
                      <Button
                        variant="outline"
                        size="sm"
                        class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        :disabled="userBusyId === u.id || u.id === currentUserId"
                        @click="askDeleteUser(u)"
                      >Supprimer</Button>
                    </div>
                  </li>
                </ul>

                <div class="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Compte</TableHead>
                        <TableHead>Rôle</TableHead>
                        <TableHead class="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow v-for="u in users" :key="u.id">
                        <TableCell>
                          <div class="flex items-center gap-2 font-medium">
                            {{ u.name || '—' }}
                            <Badge v-if="u.id === currentUserId" variant="secondary">vous</Badge>
                          </div>
                          <div class="flex items-center gap-2 text-sm text-muted-foreground">
                            {{ u.email }}
                            <Badge v-if="!u.emailVerified" variant="outline" title="Email non confirmé">non confirmé</Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge :variant="u.role === 'admin' ? 'default' : 'outline'">
                            {{ u.role === 'admin' ? 'Administrateur' : 'Utilisateur' }}
                          </Badge>
                        </TableCell>
                        <TableCell class="text-right whitespace-nowrap">
                          <Button
                            v-if="u.role !== 'admin'"
                            size="sm"
                            :disabled="userBusyId === u.id"
                            @click="setUserRole(u, 'admin')"
                          >Donner l'accès</Button>
                          <Button
                            v-else
                            variant="secondary"
                            size="sm"
                            :disabled="userBusyId === u.id || u.id === currentUserId"
                            @click="setUserRole(u, 'user')"
                          >Retirer l'accès</Button>
                          <Button
                            variant="outline"
                            size="sm"
                            class="ml-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            :disabled="userBusyId === u.id || u.id === currentUserId"
                            @click="askDeleteUser(u)"
                          >Supprimer</Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </template>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>

    <!-- ===================== RSVP CREATE/EDIT ===================== -->
    <Dialog v-model:open="showEditModal">
      <DialogScrollContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ editMode === 'create' ? 'Ajouter une réponse' : 'Modifier la réponse' }}</DialogTitle>
          <DialogDescription>
            {{ editMode === 'create'
              ? 'Enregistre une réponse reçue par téléphone ou de vive voix.'
              : 'Mets à jour la réponse de cet invité.' }}
          </DialogDescription>
        </DialogHeader>

        <form id="rsvp-form" class="grid gap-4" @submit.prevent="saveEdit">
          <div class="grid gap-2">
            <Label for="edit-status">Statut <span class="text-destructive" aria-hidden="true">*</span></Label>
            <Select v-model="editForm.attending">
              <SelectTrigger id="edit-status" class="w-full min-w-0 *:data-[slot=select-value]:min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Confirmé</SelectItem>
                <SelectItem value="no">Décliné</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2">
            <Label for="edit-name">Nom <span class="text-destructive" aria-hidden="true">*</span></Label>
            <Input id="edit-name" ref="editName" v-model="editForm.name" required />
          </div>
          <div class="grid gap-2">
            <Label for="edit-phone"><span aria-hidden="true">📱</span> Téléphone <span class="text-destructive" aria-hidden="true">*</span></Label>
            <Input id="edit-phone" v-model="editForm.phone" type="tel" inputmode="tel" required />
          </div>
          <div class="grid gap-2">
            <Label for="edit-email"><span aria-hidden="true">✉️</span> Email</Label>
            <Input id="edit-email" v-model="editForm.email" type="email" inputmode="email" autocapitalize="none" />
          </div>
          <div v-if="editForm.attending === 'yes'" class="grid gap-2">
            <Label for="edit-guests">Nombre d'invités</Label>
            <Input id="edit-guests" v-model.number="editForm.guests" type="number" min="0" max="10" inputmode="numeric" />
          </div>
          <div class="grid gap-2">
            <Label for="edit-diet"><span aria-hidden="true">🥜</span> Allergies / régime</Label>
            <Textarea id="edit-diet" v-model="editForm.dietary_restrictions" />
          </div>
          <div class="grid gap-2">
            <Label for="edit-message"><span aria-hidden="true">💌</span> Message</Label>
            <Textarea id="edit-message" v-model="editForm.message" />
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" @click="showEditModal = false">Annuler</Button>
          <Button type="submit" form="rsvp-form" :disabled="editLoading">
            <Loader2Icon v-if="editLoading" class="animate-spin" />
            {{ editLoading ? 'Sauvegarde...' : (editMode === 'create' ? 'Ajouter' : 'Sauvegarder') }}
          </Button>
        </DialogFooter>
      </DialogScrollContent>
    </Dialog>

    <!-- ===================== EVENT CREATE/EDIT ===================== -->
    <Dialog v-model:open="showEventModal">
      <DialogScrollContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{{ eventMode === 'create' ? 'Nouvel événement' : "Modifier l'événement" }}</DialogTitle>
          <DialogDescription>Seul le nom est obligatoire — le reste peut être complété plus tard.</DialogDescription>
        </DialogHeader>

        <form id="event-form" class="grid gap-4" @submit.prevent="saveEvent">
          <div class="grid gap-2">
            <Label for="event-person">Nom de l'enfant <span class="text-destructive" aria-hidden="true">*</span></Label>
            <Input id="event-person" ref="eventPerson" v-model="eventForm.person" required />
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="grid gap-2">
              <Label for="event-age">Âge</Label>
              <Input id="event-age" v-model="eventForm.age" placeholder="5" />
            </div>
            <div class="grid gap-2">
              <Label for="event-date">Date</Label>
              <Input id="event-date" v-model="eventForm.date" type="date" />
            </div>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="grid gap-2">
              <Label for="event-time">Horaire</Label>
              <Input id="event-time" v-model="eventForm.time" placeholder="15h00 - 17h00" />
            </div>
            <div class="grid gap-2">
              <Label for="event-town">Ville</Label>
              <Input id="event-town" v-model="eventForm.town" />
            </div>
          </div>
          <div class="grid gap-2">
            <Label for="event-location">Lieu</Label>
            <Textarea id="event-location" v-model="eventForm.location" />
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="grid gap-2">
              <Label for="event-dress">Dress code</Label>
              <Input id="event-dress" v-model="eventForm.dress_code" />
            </div>
            <div class="grid gap-2">
              <Label for="event-deadline">Date limite de réponse</Label>
              <Input id="event-deadline" v-model="eventForm.rsvp_deadline" type="date" />
            </div>
          </div>
          <div class="grid gap-2">
            <Label for="event-theme">Thème</Label>
            <Select v-model="eventForm.theme">
              <SelectTrigger id="event-theme" class="w-full min-w-0 *:data-[slot=select-value]:min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="t in themes" :key="t.id" :value="t.id">{{ t.icon }} {{ t.label }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div v-if="!eventIsDefault" class="grid gap-2">
            <Label for="event-slug">Lien (slug)</Label>
            <Input id="event-slug" v-model="eventForm.slug" placeholder="laisser vide pour générer automatiquement" />
            <p class="text-sm text-muted-foreground">Laisser vide pour générer automatiquement.</p>
          </div>
          <Alert v-if="eventError" variant="destructive" role="alert">
            <CircleAlertIcon />
            <AlertDescription>{{ eventError }}</AlertDescription>
          </Alert>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" @click="showEventModal = false">Annuler</Button>
          <Button type="submit" form="event-form" :disabled="eventSaving">
            <Loader2Icon v-if="eventSaving" class="animate-spin" />
            {{ eventSaving ? 'Sauvegarde...' : (eventMode === 'create' ? 'Créer' : 'Sauvegarder') }}
          </Button>
        </DialogFooter>
      </DialogScrollContent>
    </Dialog>

    <!-- ===================== DESTRUCTIVE CONFIRMATIONS ===================== -->
    <AlertDialog v-model:open="showDeleteModal">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer la réponse</AlertDialogTitle>
          <AlertDialogDescription>
            La réponse de <strong class="font-medium text-foreground">{{ rsvpToDelete?.name }}</strong> sera
            définitivement supprimée. Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            :class="buttonVariants({ variant: 'destructive' })"
            :disabled="deleteLoading"
            @click.prevent="deleteRsvp"
          >
            <Loader2Icon v-if="deleteLoading" class="animate-spin" />
            {{ deleteLoading ? 'Suppression...' : 'Supprimer' }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog v-model:open="showDeleteEventModal">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer l'événement</AlertDialogTitle>
          <AlertDialogDescription>
            L'événement de <strong class="font-medium text-foreground">{{ eventToDelete?.person }}</strong> et
            toutes ses réponses seront perdus. Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            :class="buttonVariants({ variant: 'destructive' })"
            :disabled="deleteEventLoading"
            @click.prevent="deleteEvent"
          >
            <Loader2Icon v-if="deleteEventLoading" class="animate-spin" />
            {{ deleteEventLoading ? 'Suppression...' : 'Supprimer' }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog :open="!!userToDelete" @update:open="(v) => { if (!v) userToDelete = null; }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer le compte</AlertDialogTitle>
          <AlertDialogDescription>
            <strong class="font-medium text-foreground">{{ userToDelete?.email }}</strong> perdra immédiatement
            son accès. Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            :class="buttonVariants({ variant: 'destructive' })"
            :disabled="!!userBusyId"
            @click.prevent="deleteUser"
          >
            <Loader2Icon v-if="userBusyId" class="animate-spin" />
            {{ userBusyId ? 'Suppression...' : 'Supprimer' }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
<script>
import QRCode from 'qrcode';
import { RouterLink } from 'vue-router';
import { toast } from 'vue-sonner';
import {
  ArrowUpDownIcon, CheckIcon, CircleAlertIcon, CircleUserIcon, CopyIcon, DownloadIcon,
  EllipsisVerticalIcon, ExternalLinkIcon, LinkIcon, Loader2Icon, LogOutIcon, PencilIcon,
  PlusIcon, RefreshCwIcon, SearchIcon, SendIcon, Trash2Icon, XIcon
} from '@lucide/vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogDescription, DialogFooter, DialogHeader, DialogScrollContent, DialogTitle
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { apiBaseUrl } from '../env.js';
import { session, refresh, signOut } from '../session.js';
import { themeList, applyTheme, getTheme, DEFAULT_THEME } from '../themes.js';
import { applySeo } from '../seo.js';

export default {
  name: 'Admin',
  components: {
    RouterLink,
    Alert, AlertDescription, AlertTitle,
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    Badge, Button,
    Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle,
    Dialog, DialogDescription, DialogFooter, DialogHeader, DialogScrollContent, DialogTitle,
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
    DropdownMenuSeparator, DropdownMenuTrigger,
    Input, Label, Progress,
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
    Skeleton,
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
    Tabs, TabsContent, TabsList, TabsTrigger,
    Textarea,
    ArrowUpDownIcon, CheckIcon, CircleAlertIcon, CircleUserIcon, CopyIcon, DownloadIcon,
    EllipsisVerticalIcon, ExternalLinkIcon, LinkIcon, Loader2Icon, LogOutIcon, PencilIcon,
    PlusIcon, RefreshCwIcon, SearchIcon, SendIcon, Trash2Icon, XIcon
  },
  data() {
    return {
      session,
      buttonVariants,
      themes: themeList,
      currentTheme: DEFAULT_THEME,
      themeSaving: false,

      // Section tabs. `needsEvent` marks the ones that operate on the selected
      // event; "Accès" is account-level and works without one.
      activeTab: 'responses',
      tabs: [
        { id: 'responses', label: 'Réponses', icon: '📋', needsEvent: true },
        { id: 'theme', label: 'Thème', icon: '🎨', needsEvent: true },
        { id: 'share', label: 'Partage', icon: '🔗', needsEvent: true },
        { id: 'access', label: 'Accès', icon: '👥', needsEvent: false }
      ],

      // Response list controls (client-side over the loaded list).
      searchQuery: '',
      statusFilter: 'all',
      sortBy: 'recent',
      statusFilters: [
        { id: 'all', label: 'Toutes' },
        { id: 'yes', label: 'Confirmées' },
        { id: 'no', label: 'Déclinées' }
      ],

      refreshing: false,
      refreshInterval: null,

      // Accounts / access management
      users: [],
      usersLoading: false,
      usersError: null,
      userBusyId: null,
      userToDelete: null,

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

      // RSVP edit/create dialog
      showEditModal: false,
      editMode: 'edit',
      editForm: { id: null, attending: 'yes', name: '', email: '', phone: '', guests: 1, dietary_restrictions: '', message: '' },
      editLoading: false,

      // RSVP delete confirmation
      showDeleteModal: false,
      rsvpToDelete: null,
      deleteLoading: false,

      // Event create/edit dialog
      showEventModal: false,
      eventMode: 'create',
      eventIsDefault: false,
      eventForm: { id: null, person: '', age: '', date: '', time: '', town: '', location: '', dress_code: '', rsvp_deadline: '', theme: DEFAULT_THEME, slug: '' },
      eventSaving: false,
      eventError: null,

      // Event delete confirmation
      showDeleteEventModal: false,
      eventToDelete: null,
      deleteEventLoading: false,

      qrDataUrl: '',
      linkCopied: false
    };
  },
  computed: {
    // The signed-in admin, so the users table can mark "vous" and disable the
    // actions the server would refuse anyway (self-demotion, self-deletion).
    currentUserId() {
      return session.user?.id ?? null;
    },

    // Any open dialog pauses the 30s poll: replacing the list under an admin
    // who is mid-edit was how a half-typed response got wiped.
    anyDialogOpen() {
      return this.showEditModal || this.showEventModal || this.showDeleteModal
        || this.showDeleteEventModal || !!this.userToDelete;
    },

    // Share of answers that are a yes. 0 when nobody has replied, rather than
    // NaN from dividing by zero.
    acceptanceRate() {
      const total = this.stats.total_responses;
      return total ? Math.round((this.stats.confirmations / total) * 100) : 0;
    },

    // Counts behind the filter buttons, so each one shows its own size.
    statusCounts() {
      return {
        all: this.rsvps.length,
        yes: this.rsvps.filter((r) => r.attending === 'yes').length,
        no: this.rsvps.filter((r) => r.attending === 'no').length
      };
    },

    filteredRsvps() {
      const q = this.searchQuery.toLowerCase();
      const rows = this.rsvps.filter((r) => {
        if (this.statusFilter !== 'all' && r.attending !== this.statusFilter) return false;
        if (!q) return true;
        return [r.name, r.email, r.phone].some((v) => (v || '').toLowerCase().includes(q));
      });
      // Sort a copy: this.rsvps is the fetched order and the auto-refresh
      // replaces it wholesale.
      if (this.sortBy === 'name') {
        return [...rows].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
      }
      if (this.sortBy === 'guests') {
        return [...rows].sort((a, b) => (b.guests || 0) - (a.guests || 0));
      }
      return rows;
    },
    selectedEvent() {
      return this.events.find((e) => e.id === this.selectedEventId) || null;
    },
    invitationUrl() {
      return this.eventUrl(this.selectedEvent);
    },
    whatsAppShareUrl() {
      const person = this.selectedEvent?.person || '';
      const text = person
        ? `Tu es invité(e) à l'anniversaire de ${person} ! 🎉 ${this.invitationUrl}`
        : `Tu es invité(e) ! 🎉 ${this.invitationUrl}`;
      return `https://wa.me/?text=${encodeURIComponent(text)}`;
    },
    qrFileName() {
      const person = (this.selectedEvent?.person || 'invitation')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return `qr-${person || 'invitation'}.png`;
    },
    csvUrl() {
      if (!this.selectedEventId) return '#';
      return `${apiBaseUrl}/events/${this.selectedEventId}/rsvps/export.csv`;
    }
  },
  mounted() {
    // The console is behind a login and has nothing to offer a search engine.
    applySeo({
      title: 'Administration | Invitation d\'anniversaire',
      description: 'Console d\'administration des invitations et des réponses.',
      robots: 'noindex, nofollow'
    });
    // Restore the tab from the URL before the events land, so a reload does not
    // flash the default tab first.
    const tab = this.$route.query.tab;
    if (this.tabs.some((t) => t.id === tab)) this.activeTab = tab;

    window.addEventListener('keydown', this.handleKeydown);
    this.loadEvents().then(this.restoreSelectionFromRoute);
    this.loadUsers();
    this.refreshInterval = setInterval(this.autoRefresh, 30000);
  },
  beforeUnmount() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    window.removeEventListener('keydown', this.handleKeydown);
  },
  watch: {
    selectedEventId() {
      const ev = this.selectedEvent;
      this.syncRoute();
      if (!ev) return;
      // A newly picked event starts unfiltered on its responses, rather than
      // inheriting the search left over from the previous one.
      if (!this.tabs.find((t) => t.id === this.activeTab)?.needsEvent) this.activeTab = 'responses';
      this.resetFilters();
      this.currentTheme = ev.theme || DEFAULT_THEME;
      applyTheme(this.currentTheme);
      this.generateQr();
      this.loadEventData();
    },
    activeTab() {
      this.syncRoute();
    },
    // Closing the event dialog by any route (button, overlay, Escape) has to
    // clear the error it may be showing.
    showEventModal(open) {
      if (!open) this.eventError = null;
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

    eventUrl(ev) {
      if (!ev) return `${window.location.origin}/`;
      return ev.is_default ? `${window.location.origin}/` : `${window.location.origin}/e/${ev.slug}`;
    },

    // Keep the selected event and tab in the URL so a reload, a share, or the
    // back button return to the same place instead of the empty dashboard.
    syncRoute() {
      const query = { ...this.$route.query };
      if (this.selectedEventId) query.event = String(this.selectedEventId);
      else delete query.event;
      query.tab = this.activeTab;
      if (query.event === this.$route.query.event && query.tab === this.$route.query.tab) return;
      this.$router.replace({ query }).catch(() => {});
    },

    restoreSelectionFromRoute() {
      const wanted = this.$route.query.event;
      const match = wanted && this.events.find((e) => String(e.id) === String(wanted));
      if (match) {
        this.selectedEventId = match.id;
        return;
      }
      // Nothing asked for: open the default event straight away. Landing on a
      // dashboard that shows nothing until you press "Gérer" was a wasted step,
      // and most deployments only ever run one party at a time.
      if (this.selectedEventId === null && this.events.length) {
        const preferred = this.events.find((e) => e.is_default) || this.events[0];
        this.selectedEventId = preferred.id;
      }
    },

    async generateQr() {
      try {
        this.qrDataUrl = await QRCode.toDataURL(this.invitationUrl, { width: 512, margin: 1 });
      } catch {
        this.qrDataUrl = '';
      }
    },
    async copyLink() {
      const ok = await this.copyText(this.invitationUrl);
      if (!ok) return;
      this.linkCopied = true;
      setTimeout(() => { this.linkCopied = false; }, 2000);
    },
    async copyEventLink(ev) {
      if (await this.copyText(this.eventUrl(ev))) toast.success('Lien copié');
    },
    async copyText(value) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {
        // Clipboard is unavailable outside a secure context; the link stays on
        // screen to copy by hand, so say so rather than failing silently.
        toast.error('Copie impossible, sélectionne le lien à la main.');
        return false;
      }
    },
    handleKeydown(e) {
      // "/" jumps to the response search, the way every list view on the web
      // does. Ignored while typing, and Escape is the dialogs' own business.
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
      if (this.anyDialogOpen || this.activeTab !== 'responses' || !this.rsvps.length) return;
      e.preventDefault();
      this.focusFirst('search');
    },
    focusFirst(refName) {
      this.$nextTick(() => {
        const ref = this.$refs[refName];
        // Refs on a shadcn component resolve to the component instance, so
        // unwrap to its root element before focusing.
        const el = ref?.$el ?? ref;
        if (el && typeof el.focus === 'function') el.focus();
      });
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

    resetFilters() {
      this.searchQuery = '';
      this.statusFilter = 'all';
    },

    // Topbar refresh: reload everything the console is showing.
    async refreshAll() {
      this.refreshing = true;
      try {
        await Promise.all([
          this.loadEvents(),
          this.loadUsers(),
          this.selectedEventId ? this.loadEventData() : Promise.resolve()
        ]);
      } finally {
        this.refreshing = false;
      }
    },
    // ---- Session / access ----
    //
    // The router guard has already established that this visitor is an admin
    // (see router.js), so the view no longer owns a sign-in form. It only has
    // to react to *losing* that access mid-session — an admin revoked while the
    // tab is open — which surfaces as a 401/403 on any admin call.
    async logout() {
      await signOut();
      this.$router.replace('/login');
    },

    // Called by every admin fetch. Returns true when the response means "you
    // are no longer allowed here", after sending the visitor somewhere useful.
    //
    // Both failure modes end up here: 401 is a session that ended, 403 the
    // `not_admin` guard on an account demoted while the tab was open. Either
    // way the 30s poll has to stop — otherwise the dashboard sits on an error
    // and keeps spending the admin rate limit — and the cached session has to
    // be re-read, or the router guard would wave the stale user straight back
    // into /admin. Where to send them follows that re-read rather than the
    // status: a session that survived means "no access yet", not "signed out".
    async handleAuthFailure(res) {
      if (res.status !== 401 && res.status !== 403) return false;
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
      }
      const user = await refresh();
      this.$router.replace(user ? '/pending' : '/login');
      return true;
    },

    // Poll only the data that actually moves: events and their RSVPs. The
    // account list changes rarely and has its own refresh button, and every
    // extra polled call eats into the admin rate limit.
    autoRefresh() {
      if (this.anyDialogOpen) return;
      this.loadEvents();
      if (this.selectedEventId) this.loadEventData();
    },

    // ---- Accounts / access ----
    async loadUsers() {
      try {
        this.usersLoading = true;
        this.usersError = null;
        const res = await fetch(`${apiBaseUrl}/users`, { credentials: 'include' });
        if (await this.handleAuthFailure(res)) return;
        if (!res.ok) throw new Error('Chargement des comptes impossible');
        this.users = (await res.json()).users;
      } catch (err) {
        this.usersError = err.message || 'Chargement des comptes impossible';
      } finally {
        this.usersLoading = false;
      }
    },

    async setUserRole(user, role) {
      this.userBusyId = user.id;
      this.usersError = null;
      try {
        const res = await fetch(`${apiBaseUrl}/users/${user.id}/role`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ role })
        });
        if (await this.handleAuthFailure(res)) return;
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Modification impossible');
        await this.loadUsers();
        toast.success(role === 'admin'
          ? `${user.email} a maintenant accès à l'administration.`
          : `L'accès de ${user.email} a été retiré.`);
      } catch (err) {
        this.usersError = err.message || 'Modification impossible';
        toast.error(this.usersError);
      } finally {
        this.userBusyId = null;
      }
    },

    askDeleteUser(user) {
      this.userToDelete = user;
    },

    async deleteUser() {
      const target = this.userToDelete;
      if (!target) return;
      this.userBusyId = target.id;
      this.usersError = null;
      try {
        const res = await fetch(`${apiBaseUrl}/users/${target.id}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        if (await this.handleAuthFailure(res)) return;
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Suppression impossible');
        this.userToDelete = null;
        await this.loadUsers();
        toast.success('Compte supprimé.');
      } catch (err) {
        this.usersError = err.message || 'Suppression impossible';
        toast.error(this.usersError);
      } finally {
        this.userBusyId = null;
      }
    },

    // ---- Events overview ----
    async loadEvents() {
      try {
        this.eventsLoading = true;
        this.eventsError = null;
        const res = await fetch(`${apiBaseUrl}/events`, { credentials: 'include' });
        if (!res.ok) {
          if (await this.handleAuthFailure(res)) return;
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
      if (!this.selectedEventId) return;
      const id = this.selectedEventId;
      try {
        this.loading = true;
        this.error = null;
        const [countRes, listRes] = await Promise.all([
          fetch(`${apiBaseUrl}/events/${id}/rsvps/count`, { credentials: 'include' }),
          fetch(`${apiBaseUrl}/events/${id}/rsvps`, { credentials: 'include' })
        ]);
        if (!countRes.ok || !listRes.ok) {
          if (await this.handleAuthFailure(countRes) || await this.handleAuthFailure(listRes)) return;
          throw new Error('Erreur lors de la récupération des données');
        }
        const count = await countRes.json();
        const list = await listRes.json();
        // A slow response for an event the admin has since navigated away from
        // must not overwrite the one now on screen.
        if (this.selectedEventId !== id) return;
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
          if (await this.handleAuthFailure(res)) return;
          const err = await res.json();
          throw new Error(err.error || 'Erreur lors du changement de thème');
        }
        const data = await res.json();
        this.currentTheme = data.theme;
        applyTheme(data.theme);
        // Reflect the new theme in the local list.
        const ev = this.events.find((e) => e.id === this.selectedEventId);
        if (ev) ev.theme = data.theme;
        toast.success(`Thème « ${getTheme(data.theme).label} » appliqué.`);
      } catch (err) {
        this.currentTheme = previous;
        applyTheme(previous);
        toast.error(err.message);
      } finally {
        this.themeSaving = false;
      }
    },

    // ---- RSVP edit/create ----
    openEditModal(rsvp) {
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
          if (await this.handleAuthFailure(res)) return;
          const err = await res.json();
          throw new Error(err.error || (this.editMode === 'create' ? 'Erreur lors de l\'ajout' : 'Erreur lors de la modification'));
        }
        const wasCreate = this.editMode === 'create';
        await this.loadEventData();
        await this.loadEvents();
        this.showEditModal = false;
        toast.success(wasCreate ? 'Réponse ajoutée.' : 'Réponse mise à jour.');
      } catch (err) {
        toast.error(err.message);
      } finally {
        this.editLoading = false;
      }
    },
    openDeleteModal(rsvp) {
      this.rsvpToDelete = rsvp;
      this.showDeleteModal = true;
    },
    async deleteRsvp() {
      if (!this.selectedEventId || !this.rsvpToDelete) return;
      const id = this.selectedEventId;
      this.deleteLoading = true;
      try {
        const res = await fetch(`${apiBaseUrl}/events/${id}/rsvp/${this.rsvpToDelete.id}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        if (!res.ok) {
          if (await this.handleAuthFailure(res)) return;
          const err = await res.json();
          throw new Error(err.error || 'Erreur lors de la suppression');
        }
        await this.loadEventData();
        await this.loadEvents();
        this.showDeleteModal = false;
        this.rsvpToDelete = null;
        toast.success('Réponse supprimée.');
      } catch (err) {
        toast.error(err.message);
      } finally {
        this.deleteLoading = false;
      }
    },

    // ---- Event create/edit ----
    openCreateEventModal() {
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
        const wasCreate = this.eventMode === 'create';
        const res = wasCreate
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
          if (await this.handleAuthFailure(res)) return;
          const err = await res.json();
          throw new Error(err.error || (wasCreate ? 'Erreur lors de la création' : 'Erreur lors de la modification'));
        }
        const saved = await res.json();
        await this.loadEvents();
        // Keep the selected event's theme preview in sync when editing it.
        if (!wasCreate && saved && saved.id === this.selectedEventId) {
          this.currentTheme = saved.theme || this.currentTheme;
          applyTheme(this.currentTheme);
          this.generateQr();
        }
        this.showEventModal = false;
        toast.success(wasCreate ? `Événement « ${saved.person} » créé.` : 'Événement mis à jour.');
        // A brand new event is almost always the one you want to work on next.
        if (wasCreate && saved?.id) this.selectedEventId = saved.id;
      } catch (err) {
        this.eventError = err.message;
      } finally {
        this.eventSaving = false;
      }
    },
    openDeleteEventModal(ev) {
      this.eventToDelete = ev;
      this.showDeleteEventModal = true;
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
          if (await this.handleAuthFailure(res)) return;
          const err = await res.json();
          throw new Error(err.error || 'Erreur lors de la suppression');
        }
        if (this.selectedEventId === id) this.selectedEventId = null;
        await this.loadEvents();
        this.showDeleteEventModal = false;
        this.eventToDelete = null;
        toast.success('Événement supprimé.');
      } catch (err) {
        toast.error(err.message);
      } finally {
        this.deleteEventLoading = false;
      }
    }
  }
};
</script>
