import { useEffect } from 'react';
import { appUsageService } from '@/lib/api';

export const useAppTracking = (action: string, details?: any) => {
  useEffect(() => {
    const trackAction = async () => {
      try {
        await appUsageService.track(action, details);
      } catch (error) {
        console.error('Error tracking app usage:', error);
      }
    };

    trackAction();
  }, [action, details]);
};

export const trackAppAction = async (action: string, details?: any) => {
  try {
    await appUsageService.track(action, details);
  } catch (error) {
    console.error('Error tracking app action:', error);
  }
}; 