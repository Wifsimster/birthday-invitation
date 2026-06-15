<template>
  <router-view />
  <BuildFooter />
</template>

<script>
import BuildFooter from './components/BuildFooter.vue';

export default { name: 'App', components: { BuildFooter } }
</script>

<style>
#app{min-height:100vh}
*{margin:0;padding:0;box-sizing:border-box}
/* Respect users who ask for less motion: freeze the looping animations and the
   moving background gradient site-wide (WCAG 2.3.3). */
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
  body{background-size:100% 100%!important}
}
body{font-family:var(--theme-font-body,Poppins,sans-serif);background:var(--theme-bg-gradient,linear-gradient(135deg,#FF5C8A,#7B5BFF,#21D4FD));background-size:200% 200%;animation:gradientShift 12s ease infinite;min-height:100vh;overflow-x:hidden;transition:background .4s ease}
@keyframes gradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}to{background-position:0% 50%}}
</style>
