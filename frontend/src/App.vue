<template>
  <router-view />
  <BuildFooter />
  <!-- One toaster for the whole app: views raise feedback with `toast()` from
       vue-sonner instead of owning a bespoke stack. -->
  <Toaster position="bottom-center" :offset="8" rich-colors close-button />
</template>

<script>
import BuildFooter from './components/BuildFooter.vue';
import { Toaster } from '@/components/ui/sonner';

export default { name: 'App', components: { BuildFooter, Toaster } };
</script>
