declare global {
  interface Window {
    Twitch: {
      ext: {
        onAuthorized: (callback: (auth: TwitchAuth) => void) => void;
        onContext: (callback: (context: TwitchContext) => void) => void;
        onError: (callback: (error: any) => void) => void;
        configuration: {
          broadcaster?: any;
          developer?: any;
          global?: any;
          set: (segment: string, version: string, content: string) => void;
          onChanged: (callback: () => void) => void;
        };
        bits: {
          getProducts: () => Promise<any>;
          onTransactionComplete: (callback: (transaction: any) => void) => void;
          onTransactionCancelled: (callback: (transaction: any) => void) => void;
          useBits: (sku: string) => void;
        };
        actions: {
          followChannel: (channelName: string) => void;
          minimize: () => void;
          onFollow: (callback: (didFollow: boolean, channelName: string) => void) => void;
          requestIdShare: () => void;
        };
        features: {
          isBitsEnabled: boolean;
          isChatEnabled: boolean;
          isSubscriptionStatusAvailable: boolean;
        };
        viewer: {
          helixToken: string;
          id: string;
          opaqueId: string;
          role: string;
          sessionToken: string;
          subscriptionStatus?: {
            tier: string;
          };
        };
        rig: {
          log: (message: string) => void;
        };
      };
    };
  }
}

export interface TwitchAuth {
  channelId: string;
  clientId: string;
  token: string;
  userId: string;
  helixToken: string;
}

export interface TwitchContext {
  arePlayerControlsVisible: boolean;
  bitrate: number;
  bufferSize: number;
  displayResolution: string;
  game: string;
  hlsLatencyBroadcaster: number;
  isFullScreen: boolean;
  isMuted: boolean;
  isPaused: boolean;
  isTheatreMode: boolean;
  language: string;
  mode: string;
  playbackMode: string;
  theme: string;
  videoResolution: string;
  volume: number;
}

export interface TwitchUser {
  id: string;        // Twitch user ID (if shared) or opaque ID
  opaqueId: string;  // Always available opaque ID
  displayName?: string;
  role: 'broadcaster' | 'moderator' | 'viewer';
}

export {};