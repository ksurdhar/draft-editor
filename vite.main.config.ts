import { defineConfig } from 'vite'
import { builtinModules } from 'module'

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    // Some libs that can run in both Web and Node.js, such as `axios`, we need to tell Vite to build them in Node.js.
    conditions: ['node'],
    mainFields: ['module', 'jsnext:main', 'jsnext'],
    alias: {
      // Use Node's crypto module
      crypto: 'crypto'
    }
  },
  build: {
    rollupOptions: {
      external: [
        'electron',
        'mongodb',
        'kerberos',
        'bson',
        'aws4',
        'mongodb-client-encryption',
        'snappy',
        '@mongodb-js/zstd',
        'gcp-metadata',
        '@aws-sdk/credential-providers',
        '@mongodb-js/saslprep',
        ...builtinModules,
      ]
    }
  }
})
