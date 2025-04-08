<template>
  <div class="pages">
     <img src="/reown.svg" alt="Reown" width="150" height="150" />
     <h1>AppKit solana vue Example</h1>

     <appkit-button />
     <ActionButtonList />
     <div className="advice">
        <p>
          This projectId only works on localhost. <br/>
          Go to <a href="https://cloud.reown.com" target="_blank" className="link-button" rel="Reown Cloud">Reown Cloud</a> to get your own.
        </p>
      </div>
     <InfoList />
     
     <!-- Add test connection button -->
     <button 
       class="px-4 py-2 mt-4 text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
       @click="testDbConnection"
       :disabled="isLoading"
     >
       {{ isLoading ? 'Testing...' : 'Test DB Connection' }}
     </button>
     <p v-if="connectionStatus" class="mt-2" :class="connectionStatus.success ? 'text-green-600' : 'text-red-600'">
       {{ connectionStatus.success ? 'Connection Successful!' : 'Connection Failed' }}
     </p>
   </div>
</template>


<script lang="ts">
import {
  createAppKit,
} from '@reown/appkit/vue'
import {solanaWeb3JsAdapter , networks, projectId } from './config/index'
import { ref } from 'vue'
import { testConnection } from './lib/supabase'

import ActionButtonList from "./components/ActionButton.vue"
import InfoList from "./components/InfoList.vue";

// Initialize AppKit
createAppKit({
  adapters: [solanaWeb3JsAdapter],
  networks,
  projectId,
  themeMode: 'light',
  features: {
    analytics: true // Optional - defaults to your Cloud configuration
  },
  metadata: {
    name: 'AppKit Vue Example',
    description: 'AppKit Vue Example',
    url: 'https://reown.com/appkit',
    icons: ['https://avatars.githubusercontent.com/u/179229932?s=200&v=4']
  },
  themeVariables: {
    '--w3m-accent': '#000000',
  }
})

export default {
  name: "App",
  components: {
    ActionButtonList,
    InfoList
  },
  setup() {
    const isLoading = ref(false)
    const connectionStatus = ref<{ success: boolean; error?: any } | null>(null)

    const testDbConnection = async () => {
      isLoading.value = true
      connectionStatus.value = null
      
      try {
        const result = await testConnection()
        connectionStatus.value = result
      } catch (error) {
        console.error('Error testing connection:', error)
        connectionStatus.value = { success: false, error }
      } finally {
        isLoading.value = false
      }
    }

    return {
      isLoading,
      connectionStatus,
      testDbConnection
    }
  }
};
</script>