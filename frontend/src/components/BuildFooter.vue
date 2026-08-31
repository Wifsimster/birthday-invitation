<template>
  <!--
    The build stamp used to be a fixed pill floating over the page, which sat on
    top of whatever happened to be at the bottom of the viewport — on a phone it
    covered the "pick an event" hint and the last stat card. It is a footnote,
    not chrome, so it now sits in the normal flow at the end of the document and
    scrolls away with everything else.
  -->
  <footer class="pointer-events-none flex justify-center px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
    <span
      class="pointer-events-auto rounded-full bg-black/25 px-3 py-[5px] text-[0.72rem] leading-none tracking-[0.02em] text-white backdrop-blur-[4px] select-all"
    >v{{ appVersion }} · build {{ buildLabel }}</span>
  </footer>
</template>

<script>
import { appVersion, buildTime } from '../build-info.js';

export default {
  name: 'BuildFooter',
  data() {
    return { appVersion, buildTime };
  },
  computed: {
    buildLabel() {
      if (!this.buildTime) return 'dev';
      const d = new Date(this.buildTime);
      if (Number.isNaN(d.getTime())) return this.buildTime;
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
    }
  }
};
</script>
