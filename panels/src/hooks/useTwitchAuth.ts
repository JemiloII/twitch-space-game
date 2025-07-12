import { useState, useEffect } from 'react';
import type { TwitchAuth, TwitchContext, TwitchUser } from '../twitch-ext';

export const useTwitchAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [auth, setAuth] = useState<TwitchAuth | null>(null);
  const [context, setContext] = useState<TwitchContext | null>(null);
  const [user, setUser] = useState<TwitchUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (window?.Twitch?.ext) {
      console.log('Found Twitch Extension API');
      const { ext } = window.Twitch;

      // Handle authentication
      ext.onAuthorized((authData: TwitchAuth) => {
        console.log('Twitch Extension Authorized:', authData);
        setAuth(authData);
        setIsAuthenticated(true);
        
        // Extract user information
        const userData: TwitchUser = {
          id: authData.userId || ext.viewer.opaqueId, // Use actual ID if available, fallback to opaque ID
          opaqueId: ext.viewer.opaqueId,
          role: ext.viewer.role as 'broadcaster' | 'moderator' | 'viewer',
          displayName: authData.userId ? `User_${authData.userId.slice(0, 8)}` : `User_${ext.viewer.opaqueId.slice(0, 8)}`
        };
        
        setUser(userData);
      });

      // Handle context changes
      ext.onContext((contextData: TwitchContext) => {
        console.log('Twitch Context Changed:', contextData);
        setContext(contextData);
      });

      // Handle errors
      ext.onError((errorData: any) => {
        console.error('Twitch Extension Error:', errorData);
        setError(errorData.message || 'An error occurred with the Twitch extension');
      });

    } else {
      console.warn('Twitch Extension API not available');
      setError('Twitch Extension API not available');
    }
  }, []);

  const requestIdShare = () => {
    if (window.Twitch && window.Twitch.ext) {
      window.Twitch.ext.actions.requestIdShare();
    }
  };

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
    isAuthenticated,
    auth,
    context,
    user,
    error,
    requestIdShare,
    followChannel,
    minimize,
    features: window.Twitch?.ext?.features || {}
  };
};