import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon1.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Study Planner',
        short_name: 'StudyPlanner',
        description: 'Exam-focused study planner with spaced repetition',
        theme_color: '#646cff',
        background_color: '#fafafa',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icon1.png',
            sizes: '2000x2000',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon1.png',
            sizes: '2000x2000',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
