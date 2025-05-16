import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { validateRedisConfig } from '@/config/redis'
import { errorHandler } from '@/services/errorHandler'
import { appKit } from './config/appkit'

// Validate Redis configuration
try {
  validateRedisConfig()
} catch (error) {
  errorHandler.logError(
    error instanceof Error ? error : new Error('Failed to validate Redis configuration')
  )
  console.error('Redis configuration error:', error)
}

// Initialize the application
const app = createApp(App)
const pinia = createPinia()

// Register cleanup function for application shutdown 
app.config.globalProperties.$onBeforeUnmount = () => {
  // No need to call cleanupInvalidators as it's removed
}

// Note: The appKit is now imported from config/appkit.ts
// We don't need to initialize it here anymore

app.use(pinia)
app.mount('#app')
