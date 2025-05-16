<template>
  <header class="app-header">
    <div class="header-container">
      <div class="logo-container">
        <router-link to="/" class="logo-link">
          <img src="/reown.svg" alt="Reown" width="40" height="40" />
          <h1 class="site-name">YO MAMA</h1>
        </router-link>
      </div>
      
      <nav class="main-nav">
        <router-link to="/" class="nav-link">Home</router-link>
        <router-link to="/game" class="nav-link">Game</router-link>
        <router-link to="/staking" class="nav-link">Staking</router-link>
        <router-link to="/referral" class="nav-link">Referrals</router-link>
      </nav>
      
      <div class="auth-container">
        <WalletConnection />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import WalletConnection from './WalletConnection.vue';
</script>

<style scoped>
.app-header {
  background-color: #ffffff;
  padding: 1rem 0;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.header-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo-container {
  display: flex;
  align-items: center;
}

.logo-link {
  display: flex;
  align-items: center;
  text-decoration: none;
  color: inherit;
}

.site-name {
  margin-left: 0.75rem;
  font-size: 1.5rem;
  font-weight: 800;
  background: linear-gradient(45deg, #6c5ce7, #fdcb6e);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.main-nav {
  display: flex;
  gap: 1.5rem;
}

.nav-link {
  color: #4a5568;
  text-decoration: none;
  font-weight: 500;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  transition: all 0.2s;
}

.nav-link:hover, .nav-link.router-link-active {
  background-color: #f7fafc;
  color: #6c5ce7;
}

.auth-container {
  display: flex;
  align-items: center;
}

@media (max-width: 768px) {
  .header-container {
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }
  
  .main-nav {
    order: 3;
    width: 100%;
    justify-content: center;
    overflow-x: auto;
    padding: 0.5rem 0;
  }
  
  .auth-container {
    order: 2;
  }
}
</style> 