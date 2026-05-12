import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          catalog: path.resolve(__dirname, 'catalog.html'),
          about: path.resolve(__dirname, 'about.html'),
          contacts: path.resolve(__dirname, 'contacts.html'),
          account: path.resolve(__dirname, 'account.html'),
          admin: path.resolve(__dirname, 'admin.html'),
        },
      },
    },
  };
});
