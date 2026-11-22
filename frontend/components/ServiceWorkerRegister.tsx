'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '@/lib/pushNotifications';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return null;
}
