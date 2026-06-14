import { createRouter, createWebHistory } from 'vue-router';
import Invitation from './views/Invitation.vue';
import Admin from './views/Admin.vue';

const routes = [
  { path: '/', name: 'invitation', component: Invitation },
  { path: '/admin', name: 'admin', component: Admin }
];

export default createRouter({ history: createWebHistory(), routes });
