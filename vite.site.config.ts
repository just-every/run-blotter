import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Static site only: the Worker's plugins and private runtime inputs stay out.
export default defineConfig({ plugins: [react()] })
