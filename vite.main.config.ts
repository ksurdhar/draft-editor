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
      crypto: 'crypto',
      // Handle MongoDB optional dependencies
      kerberos: 'false',
      'mongodb-client-encryption': 'false',
      'aws4': 'false',
      'snappy': 'false',
      '@mongodb-js/zstd': 'false',
      'bson-ext': 'false',
      'gcp-metadata': 'false'
    }
  },
  build: {
    rollupOptions: {
      external: [
        'electron',
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
