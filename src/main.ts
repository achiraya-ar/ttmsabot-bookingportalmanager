import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

// Global styles (Tailwind v4 + custom CSS)
import './assets/main.css'

const app = createApp(App)

app.use(createPinia())

app.mount('#app')
