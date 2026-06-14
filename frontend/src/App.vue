<template>
  <router-view />
</template>

<script>
export default { name: 'App' }
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
.invitation-container{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;position:relative}
.invitation-card{background:#fff;border-radius:25px;box-shadow:0 25px 50px #00000026;max-width:600px;width:100%;overflow:hidden;position:relative;animation:float 6s ease-in-out infinite;border:5px solid #fff;box-shadow:0 0 0 3px #ff6b6b,0 25px 50px #00000026}
@keyframes float{0%,to{transform:translateY(0)}50%{transform:translateY(-10px)}}
.invitation-header{background:#ff6b6b;padding:40px 30px;text-align:center;color:#fff;position:relative;overflow:hidden}
.invitation-header:before{content:"🎈🎉🎂🎁";position:absolute;top:-10px;left:-50px;font-size:2rem;opacity:.3;animation:bounce 2s infinite}
.invitation-header:after{content:"🚗⚽🦖🚀";position:absolute;bottom:-10px;right:-50px;font-size:2rem;opacity:.3;animation:bounce 2s infinite reverse}
.invitation-header:before{content:"";position:absolute;inset:0;background:url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="20" cy="20" r="2" fill="rgba(255,255,255,0.3)"/><circle cx="80" cy="40" r="1.5" fill="rgba(255,255,255,0.3)"/><circle cx="40" cy="60" r="1" fill="rgba(255,255,255,0.3)"/><circle cx="70" cy="80" r="2" fill="rgba(255,255,255,0.3)"/><circle cx="10" cy="70" r="1.5" fill="rgba(255,255,255,0.3)"/></svg>')}
.birthday-title{font-family:Comic Sans MS,Dancing Script,cursive;font-size:3.2rem;font-weight:700;margin-bottom:10px;text-shadow:3px 3px 0px #ff6b6b,-1px -1px 0px #4ecdc4;animation:wobble 3s ease-in-out infinite}
@keyframes wobble{0%,to{transform:rotate(0)}25%{transform:rotate(-3deg)}75%{transform:rotate(3deg)}}
.birthday-subtitle{font-size:1.4rem;font-weight:400;opacity:.95;font-family:Comic Sans MS,cursive}
.invitation-body{padding:40px 30px;text-align:center}
.birthday-person{font-size:2.8rem;font-family:Comic Sans MS,Dancing Script,cursive;color:#ff6b6b;margin-bottom:20px;font-weight:700;text-shadow:2px 2px 0px #4ecdc4;animation:pulse 2s ease-in-out infinite}
@keyframes pulse{0%,to{transform:scale(1)}50%{transform:scale(1.05)}}
.age-badge{display:inline-block;background:#ff6b6b;color:#fff;padding:15px 30px;border-radius:25px;font-size:1.8rem;font-weight:700;margin-bottom:30px;box-shadow:0 4px 10px #ff6b6b33;border:3px solid white;text-shadow:1px 1px 2px rgba(0,0,0,.3);font-family:Comic Sans MS,cursive}
.event-details{background:#f8f9fa;border-radius:15px;padding:25px;margin:30px 0}
.detail-item{display:flex;align-items:center;justify-content:center;margin-bottom:15px;font-size:1.1rem;color:#333}
.detail-item:last-child{margin-bottom:0}
.detail-icon{color:#ff6b6b;margin-right:15px;font-size:1.2rem;width:20px;text-align:center}
.rsvp-section{margin-top:30px}
.rsvp-button{background:linear-gradient(135deg,#ff6b6b,#4ecdc4,#45b7d1,#f7dc6f,#ff9ff3);color:#fff;border:none;padding:18px 35px;border-radius:30px;font-size:1.3rem;font-weight:700;cursor:pointer;transition:all .3s ease;box-shadow:0 8px 20px #ff6b6b66;border:3px solid white;font-family:Comic Sans MS,cursive;text-shadow:1px 1px 2px rgba(0,0,0,.3);animation:wiggle 3s ease-in-out infinite}
@keyframes wiggle{0%,to{transform:rotate(0)}25%{transform:rotate(1deg)}75%{transform:rotate(-1deg)}}
.rsvp-button:hover{transform:translateY(-3px) scale(1.05);box-shadow:0 12px 30px #ff6b6b80;animation:none}
.rsvp-confirmed{background:linear-gradient(135deg,#4caf50,#66bb6a,#81c784);color:#fff;border-radius:20px;padding:25px;text-align:center;box-shadow:0 8px 20px #4caf5066;border:3px solid white;font-family:Comic Sans MS,cursive;font-size:1.1rem;font-weight:600;animation:celebrate 2s ease-in-out infinite}
@keyframes celebrate{0%,to{transform:scale(1)}50%{transform:scale(1.02)}}
.rsvp-confirmed i{font-size:1.5rem;margin-right:10px}
.location-info{margin-top:10px;font-size:.9rem;opacity:.9}
.decoration{position:absolute;font-size:2rem;animation:bounce 2s infinite}
.decoration:nth-child(1){top:10%;left:10%;animation-delay:0s}
.decoration:nth-child(2){top:20%;right:10%;animation-delay:.5s}
.decoration:nth-child(3){bottom:20%;left:15%;animation-delay:1s}
.decoration:nth-child(4){bottom:10%;right:15%;animation-delay:1.5s}
@keyframes bounce{0%,20%,50%,80%,to{transform:translateY(0)}40%{transform:translateY(-10px)}60%{transform:translateY(-5px)}}
.rsvp-buttons{margin-bottom:20px}
.rsvp-form{background:#f8f9fa;border-radius:20px;padding:30px;margin:20px 0;border:3px solid #ff6b6b;box-shadow:0 8px 20px #ff6b6b33}
.form-title{font-family:Comic Sans MS,cursive;font-size:1.5rem;color:#ff6b6b;text-align:center;margin-bottom:25px;font-weight:700}
.form-group{margin-bottom:20px}
.form-group label{display:block;font-family:Comic Sans MS,cursive;font-weight:600;color:#333;margin-bottom:8px;font-size:1rem}
.form-group label i{color:#ff6b6b;margin-right:8px;width:16px;text-align:center}
.form-group input,.form-group select,.form-group textarea{width:100%;padding:12px 15px;border:2px solid #e0e0e0;border-radius:10px;font-size:1rem;font-family:Poppins,sans-serif;transition:all .3s ease;background:#fff}
.form-group input:focus,.form-group select:focus,.form-group textarea:focus{outline:none;border-color:#ff6b6b;box-shadow:0 0 0 3px #ff6b6b1a;transform:translateY(-1px)}
.form-group textarea{resize:vertical;min-height:60px}
.form-group select{cursor:pointer}
.form-actions{display:flex;gap:15px;justify-content:center;margin-top:25px}
.btn-cancel,.btn-submit{padding:12px 25px;border:none;border-radius:25px;font-family:Comic Sans MS,cursive;font-weight:600;font-size:1rem;cursor:pointer;transition:all .3s ease;border:2px solid transparent}
.btn-cancel{background:#6c757d;color:#fff;border-color:#6c757d}
.btn-cancel:hover{background:#5a6268;transform:translateY(-2px);box-shadow:0 4px 10px #0003}
.btn-submit{background:linear-gradient(135deg,#ff6b6b,#4ecdc4,#45b7d1);color:#fff;border-color:#fff;min-width:200px}
.btn-submit:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 6px 15px #ff6b6b66}
.btn-submit:disabled{opacity:.7;cursor:not-allowed}
.rsvp-error{background:#ff4757;color:#fff;padding:15px 20px;border-radius:15px;margin:20px 0;text-align:center;font-family:Comic Sans MS,cursive;font-weight:600;border:2px solid white;box-shadow:0 4px 10px #ff47574d}
.rsvp-error i{margin-right:8px}
@media (max-width: 768px){.birthday-title{font-size:2.5rem}.birthday-person{font-size:2rem}.invitation-header,.invitation-body{padding:30px 20px}.detail-item{font-size:1rem}.rsvp-form{padding:20px;margin:15px 0}.form-actions{flex-direction:column;align-items:center}.btn-cancel,.btn-submit{width:100%;max-width:250px}.form-title{font-size:1.3rem}}
</style>
