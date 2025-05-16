<template>
  <footer class="app-footer">
    <div class="footer-container">
      <div class="footer-main">
        <div class="footer-section">
          <h3 class="footer-title">YO MAMA</h3>
          <p class="footer-description">
            Play. Click. Earn. The ultimate Solana-powered gaming experience.
          </p>
        </div>
        
        <div class="footer-section links">
          <h3>Quick Links</h3>
          <nav class="footer-nav">
            <router-link to="/" class="footer-link">Home</router-link>
            <router-link to="/game" class="footer-link">Play Game</router-link>
            <router-link to="/staking" class="footer-link">Staking</router-link>
            <router-link to="/referral" class="footer-link">Referrals</router-link>
          </nav>
        </div>
        
        <div class="footer-section">
          <h3>Connect</h3>
          <div class="social-links">
            <a href="#" class="social-link" target="_blank" rel="noopener noreferrer">Twitter</a>
            <a href="#" class="social-link" target="_blank" rel="noopener noreferrer">Discord</a>
            <a href="#" class="social-link" target="_blank" rel="noopener noreferrer">Telegram</a>
          </div>
        </div>
      </div>
      
      <div class="footer-bottom">
        <p class="copyright">© 2025 YO MAMA | Powered by MAMA Token</p>
        <div class="footer-legal">
          <a href="#" class="legal-link">Terms of Service</a>
          <a href="#" class="legal-link">Privacy Policy</a>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
// No additional scripts needed
</script>

<style scoped>
.app-footer {
  background-color: #1a202c;
  color: #e2e8f0;
  padding: 3rem 0 1.5rem;
}

.footer-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.footer-main {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
}

.footer-section {
  display: flex;
  flex-direction: column;
}

.footer-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  background: linear-gradient(45deg, #6c5ce7, #fdcb6e);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.footer-description {
  color: #a0aec0;
  line-height: 1.6;
}

h3 {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #e2e8f0;
}

.footer-nav {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.footer-link, .social-link {
  color: #a0aec0;
  text-decoration: none;
  transition: color 0.2s;
  padding: 0.25rem 0;
}

.footer-link:hover, .social-link:hover {
  color: #fdcb6e;
}

.social-links {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.footer-bottom {
  padding-top: 1.5rem;
  border-top: 1px solid #2d3748;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.copyright {
  color: #a0aec0;
  font-size: 0.875rem;
}

.footer-legal {
  display: flex;
  gap: 1.5rem;
}

.legal-link {
  color: #a0aec0;
  text-decoration: none;
  font-size: 0.875rem;
  transition: color 0.2s;
}

.legal-link:hover {
  color: #fdcb6e;
}

@media (max-width: 768px) {
  .footer-bottom {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style> 