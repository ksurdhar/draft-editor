import { defineConfig } from 'vite'
import { builtinModules } from 'module'

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    // Some libs that can run in both Web and Node.js, such as `axios`, we need to tell Vite to build them in Node.js.
    conditions: ['node'],
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
  build: {
    rollupOptions: {
      external: [
        'electron',
        'crypto',
        ...builtinModules,
        // Exclude MongoDB optional dependencies
        'kerberos',
        'mongodb-client-encryption',
        'aws4',
        'snappy',
        '@mongodb-js/zstd',
        'bson-ext',
        'gcp-metadata'
      ]
    }
  }
})
