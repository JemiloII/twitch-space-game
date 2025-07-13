import { useEffect } from 'react';
import { useTwitchStore } from '../stores/twitchStore';

export const useTwitchAuth = () => {
  const store = useTwitchStore();
  
  // Initialize Twitch when the hook is first used
  useEffect(() => {
    store.initializeTwitch();
  }, [store]);

  // Helper functions that use the store
  const followChannel = (channelName: string) => {
    if (window.Twitch && window.Twitch.ext) {
      window.Twitch.ext.actions.followChannel(channelName);
    }
  };

  const minimize = () => {
    if (window.Twitch && window.Twitch.ext) {
      window.Twitch.ext.actions.minimize();
    }
  };

  return {
    ...store,
    followChannel,
    minimize,
    features: window.Twitch?.ext?.features || {}
  };
};