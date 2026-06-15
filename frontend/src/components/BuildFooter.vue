<template>
  <footer class="build-footer">
    <span class="build-footer__text">v{{ appVersion }} · build {{ buildLabel }}</span>
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

<style scoped>
.build-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  padding: 6px 12px;
  pointer-events: none;
  z-index: 50;
}
.build-footer__text {
  font-family: Poppins, sans-serif;
  font-size: 0.72rem;
  line-height: 1;
  color: #fff;
  background: rgba(0, 0, 0, 0.28);
  border-radius: 999px;
  padding: 5px 12px;
  letter-spacing: 0.02em;
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  pointer-events: auto;
}
</style>
