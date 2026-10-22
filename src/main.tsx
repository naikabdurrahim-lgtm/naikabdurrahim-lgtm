import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Self-hosted Bangla fonts: works offline and keeps conjuncts correct.
import '@fontsource/noto-sans-bengali/400.css';
import '@fontsource/noto-sans-bengali/500.css';
import '@fontsource/noto-sans-bengali/600.css';
import '@fontsource/noto-sans-bengali/700.css';
import '@fontsource/hind-siliguri/400.css';
import '@fontsource/hind-siliguri/600.css';

import '@/styles/index.css';
import '@/lib/i18n';
import { App } from '@/app/App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root was not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
