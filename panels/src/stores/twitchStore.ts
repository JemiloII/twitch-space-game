import { create } from 'zustand';
import type { TwitchAuth, TwitchContext, TwitchUser } from '../twitch-ext';

interface TwitchStore {
  // State
  isAuthenticated: boolean;
  auth: TwitchAuth | null;
  context: TwitchContext | null;
  user: TwitchUser | null;
  error: string | null;
  isIdShared: boolean;
  
  // Actions
  setAuth: (auth: TwitchAuth) => void;
  setContext: (context: TwitchContext) => void;
  setUser: (user: TwitchUser | null) => void;
  setError: (error: string | null) => void;
  setIsIdShared: (isShared: boolean) => void;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  
  // Twitch actions
  requestIdShare: () => void;
  followChannel: (channelName: string) => void;
  minimize: () => void;
  
  // Complex actions
  updateUserData: (authData: TwitchAuth, ext: any) => void;
  fetchUserDisplayName: (userId: string, helixToken: string, clientId: string) => Promise<void>;
  initializeTwitch: () => void;
}

export const useTwitchStore = create<TwitchStore>((set, get) => ({
  // Initial state
  isAuthenticated: false,
  auth: null,
  context: null,
  user: null,
  error: null,
  isIdShared: false,
  
  // Basic setters
  setAuth: (auth) => set({ auth }),
  setContext: (context) => set({ context }),
  setUser: (user) => set({ user }),
  setError: (error) => set({ error }),
  setIsIdShared: (isShared) => set({ isIdShared: isShared }),
  setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  
  // Twitch actions
  requestIdShare: () => {
    console.log('=== requestIdShare called ===');
    console.log('window.Twitch exists:', !!window.Twitch);
    console.log('window.Twitch.ext exists:', !!(window.Twitch && window.Twitch.ext));
    console.log('window.Twitch.ext.actions exists:', !!(window.Twitch && window.Twitch.ext && window.Twitch.ext.actions));
    console.log('window.Twitch.ext.actions.requestIdShare exists:', !!(window.Twitch && window.Twitch.ext && window.Twitch.ext.actions && window.Twitch.ext.actions.requestIdShare));
    
    if (window.Twitch && window.Twitch.ext) {
      console.log('Full Twitch.ext object:', window.Twitch.ext);
      console.log('Available actions:', window.Twitch.ext.actions);
      console.log('Calling requestIdShare...');
      try {
        const result = window.Twitch.ext.actions.requestIdShare();
        console.log('requestIdShare result:', result);
      } catch (error) {
        console.error('Error calling requestIdShare:', error);
      }
    } else {
      console.error('Twitch Extension API not available for requestIdShare');
    }
  },
  
  followChannel: (channelName) => {
    if (window.Twitch && window.Twitch.ext) {
      window.Twitch.ext.actions.followChannel(channelName);
    }
  },
  
  minimize: () => {
    if (window.Twitch && window.Twitch.ext) {
      window.Twitch.ext.actions.minimize();
    }
  },
  
  // Complex actions
  updateUserData: (authData, ext) => {
    const isLinked = Boolean(ext.viewer.isLinked);
    
    console.log('=== updateUserData called ===');
    console.log('Full authData object:', authData);
    console.log('Full ext.viewer object:', ext.viewer);
    console.log('Comparison data:', {
      isLinked,
      viewerId: ext.viewer.id,
      opaqueId: ext.viewer.opaqueId,
      helixToken: authData.helixToken,
      viewerRole: ext.viewer.role,
      viewerSessionToken: ext.viewer.sessionToken
    });
    
    const userData: TwitchUser = {
      id: isLinked ? ext.viewer.id : ext.viewer.opaqueId,
      opaqueId: ext.viewer.opaqueId,
      role: ext.viewer.role as 'broadcaster' | 'moderator' | 'viewer',
      displayName: undefined // Will be populated via Helix API if needed
    };
    
    console.log('Setting user data:', userData);
    set({
      user: userData,
      isIdShared: isLinked
    });
    
    // If user is linked, we can get their display name via Helix API
    if (isLinked && authData.helixToken) {
      console.log('Fetching display name for linked user:', ext.viewer.id);
      get().fetchUserDisplayName(ext.viewer.id, authData.helixToken, authData.clientId);
    }
  },
  
  fetchUserDisplayName: async (userId, helixToken, clientId) => {
    try {
      const response = await fetch(`https://api.twitch.tv/helix/users?id=${userId}`, {
        headers: {
          'Authorization': `Extension ${helixToken}`,
          'Client-Id': clientId
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Helix API response:', data);
        if (data.data && data.data.length > 0) {
          const currentUser = get().user;
          if (currentUser) {
            console.log('Setting display name:', data.data[0].display_name);
            set({
              user: {
                ...currentUser,
                displayName: data.data[0].display_name
              }
            });
          }
        }
      } else {
        console.warn('Helix API response not ok:', response.status, response.statusText);
      }
    } catch (err) {
      console.warn('Could not fetch user display name:', err);
    }
  },
  
  initializeTwitch: () => {
    console.log('=== initializeTwitch called ===');
    console.log('window.Twitch exists:', !!window.Twitch);
    console.log('window.Twitch.ext exists:', !!(window.Twitch && window.Twitch.ext));
    
    if (window?.Twitch?.ext) {
      console.log('Found Twitch Extension API');
      console.log('Full window.Twitch.ext object:', window.Twitch.ext);
      const { ext } = window.Twitch;
      let currentAuth: TwitchAuth | null = null;
      
      const store = get();

      // Handle authentication
      ext.onAuthorized(async (authData: TwitchAuth) => {
        console.log('=== Twitch Extension Authorized ===');
        console.log('Full authData object:', authData);
        currentAuth = authData;
        set({
          auth: authData,
          isAuthenticated: true
        });
        
        // Check if user is linked and fetch display name directly
        if (ext.viewer.isLinked && authData.helixToken) {
          console.log('User is linked, fetching display name for:', ext.viewer.id);
          const response = await fetch(`https://api.twitch.tv/helix/users?id=${ext.viewer.id}`, {
            headers: {
              'Authorization': `Extension ${authData.helixToken}`,
              'Client-Id': authData.clientId
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('Username:', data.data.at(0)?.display_name);
            
            const userData: TwitchUser = {
              id: ext.viewer.id,
              opaqueId: ext.viewer.opaqueId,
              role: ext.viewer.role as 'broadcaster' | 'moderator' | 'viewer',
              displayName: data.data.at(0)?.display_name
            };
            
            set({
              user: userData,
              isIdShared: true
            });
          }
        } else {
          // User is not linked, use opaque ID
          const userData: TwitchUser = {
            id: ext.viewer.opaqueId,
            opaqueId: ext.viewer.opaqueId,
            role: ext.viewer.role as 'broadcaster' | 'moderator' | 'viewer',
            displayName: undefined
          };
          
          set({
            user: userData,
            isIdShared: false
          });
        }
      });

      // Handle identity changes (when user shares their ID)
      console.log('ext.identity exists:', !!ext.identity);
      console.log('ext.identity.onChanged exists:', !!(ext.identity && ext.identity.onChanged));
      
      if (ext.identity && ext.identity.onChanged) {
        console.log('Setting up identity change listener');
        ext.identity.onChanged(async () => {
          console.log('=== Identity changed - user may have shared their ID ===');
          console.log('Current auth at time of identity change:', currentAuth);
          if (currentAuth && ext.viewer.isLinked) {
            console.log('User is now linked, fetching display name for:', ext.viewer.id);
            const response = await fetch(`https://api.twitch.tv/helix/users?id=${ext.viewer.id}`, {
              headers: {
                'Authorization': `Extension ${currentAuth.helixToken}`,
                'Client-Id': currentAuth.clientId
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              console.log('Username after identity change:', data.data.at(0)?.display_name);
              
              const userData: TwitchUser = {
                id: ext.viewer.id,
                opaqueId: ext.viewer.opaqueId,
                role: ext.viewer.role as 'broadcaster' | 'moderator' | 'viewer',
                displayName: data.data.at(0)?.display_name
              };
              
              set({
                user: userData,
                isIdShared: true
              });
            }
          }
        });
      } else {
        console.warn('Identity change listener not available - ext.identity.onChanged not found');
      }

      // Handle context changes
      ext.onContext((contextData: TwitchContext) => {
        console.log('Twitch Context Changed:', contextData);
        set({ context: contextData });
      });

      // Handle errors
      ext.onError((errorData: any) => {
        console.error('Twitch Extension Error:', errorData);
        set({ error: errorData.message || 'An error occurred with the Twitch extension' });
      });

    } else {
      console.warn('Twitch Extension API not available');
      console.log('window object:', window);
      set({ error: 'Twitch Extension API not available' });
    }
  }
}));
