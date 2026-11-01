import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import {VitePWA} from 'vite-plugin-pwa'
export default defineConfig({plugins:[react(),tailwind(),VitePWA({registerType:'autoUpdate',
 manifest:{name:'Safehouse',short_name:'Safehouse',description:'Covert ops in the real world.',display:'standalone',orientation:'portrait',background_color:'#E4E8DF',theme_color:'#13201A',start_url:'/',
  icons:[{src:'icon-192.png',sizes:'192x192',type:'image/png'},{src:'icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]},
 workbox:{importScripts:['sw-extra.js'],runtimeCaching:[{urlPattern:/tiles\.openfreemap\.org/,handler:'CacheFirst',options:{cacheName:'ofm',expiration:{maxEntries:2000,maxAgeSeconds:604800}}},{urlPattern:/tile\.openstreetmap\.org/,handler:'CacheFirst',options:{cacheName:'tiles',expiration:{maxEntries:800}}}]}})]})
