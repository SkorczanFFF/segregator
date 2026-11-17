import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  // The local API from api/src/dev.ts. In AWS, CloudFront sends /api to the Lambda.
  // Google and S3 accept the browser only from this port, as listed in the dev stack.
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3000' } },
})
