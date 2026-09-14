import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import Tabs from './Tabs/Tabs.tsx';
import { useTwitchStore } from '../stores/twitchStore';
import { connect, listen, sendLatest } from '../Game/Socket';
import { getApiUrl } from '../Game/Backend';
import { bindPanelKeyboard } from './Keyboard';
import './Panel.scss'

export default function Panel() {
  const [, ...ships]= [...Array(9).keys()];
  const tabs = ['Space Ships', 'Colors'];
  const [activeTab, setActiveTab] = useState<string>(tabs[0]);
  const [selectedShip, setSelectedShip] = useState<number>(ships[0]);
  const [keyStates, setKeyStates] = useState<Record<string, boolean>>({});
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  
  const {
    auth,
    user,
    isIdShared,
    requestIdShare,
    isAuthenticated,
    initializeTwitch
  } = useTwitchStore();

  // Initialize Twitch and socket connection on component mount
  useEffect(() => {
    initializeTwitch();
    connect(); // Initialize socket connection
    return listen(message => {
      if (message.type === 'auth_error' || message.type === 'error') setConnectionError(message.reason);
      if (message.type === 'connected') setConnectionError('');
    });
  }, [initializeTwitch]);

  // Load player preferences when user is available
  useEffect(() => {
    const loadPlayerPreferences = async () => {
      if (!user || !auth || preferencesLoaded) return;
      
      try {
        const params = new URLSearchParams();
        if (user.id && isIdShared) {
          params.append('twitchUserId', user.id);
        }
        if (user.opaqueId) {
          params.append('twitchOpaqueId', user.opaqueId);
        }
        
        const response = await fetch(getApiUrl(`/api/players?${params}`), {
          headers: { Authorization: `Bearer ${auth.token}` }
        });
        if (response.ok) {
          const preferences = await response.json();
          
          console.log('API Response:', preferences);
          
          // Extract ship number from filename (e.g., "spaceShips_001.png" -> 1)
          const shipMatch = preferences.selectedShip.match(/spaceShips_00(\d)\.png/);
          if (shipMatch) {
            const shipNumber = parseInt(shipMatch[1]);
            console.log('Setting selected ship to:', shipNumber);
            setSelectedShip(shipNumber);
          }
          
          console.log('Loaded player preferences:', preferences);
          setPreferencesLoaded(true);
        } else {
          console.error('Failed to load preferences:', response.status);
          setPreferencesLoaded(true); // Still mark as loaded to prevent infinite loops
        }
      } catch (error) {
        console.error('Error loading player preferences:', error);
      }
    };
    
    loadPlayerPreferences();
  }, [user, auth, isIdShared, preferencesLoaded]);

  useEffect(() => bindPanelKeyboard(setKeyStates, () => {
    const { auth, isIdShared } = useTwitchStore.getState();
    if (!auth || !isIdShared) return;
    sendLatest('user_data', { authToken: auth.token, helixToken: auth.helixToken, keyPressed: '', keyActive: false });
    sendLatest('input', {
      authToken: auth.token, up: false, down: false, left: false, right: false,
      rotateLeft: false, rotateRight: false, space: false, shift: false
    });
  }), []);

  console.log('Panel render:', {
    user,
    isIdShared,
    isAuthenticated,
    auth: auth ? { userId: auth.userId, clientId: auth.clientId } : null
  });

  const getShipFilename = (shipIndex: number) => {
    return `spaceShips_00${shipIndex}.png`;
  };

  const validUser = Boolean(user?.displayName && isIdShared && auth);

  useEffect(() => {
    const pressedKeys = Object.keys(keyStates).filter(key => keyStates[key]);
    sendLatest('user_data', validUser ? {
      authToken: auth!.token,
      helixToken: auth!.helixToken,
      keyPressed: pressedKeys.join(','),
      keyActive: pressedKeys.length > 0
    } : null);
  }, [auth, validUser, keyStates]);

  useEffect(() => {
    sendLatest('ship_selection', validUser && preferencesLoaded ? {
      authToken: auth!.token,
      helixToken: auth!.helixToken,
      shipKey: getShipFilename(selectedShip)
    } : null);
  }, [auth, validUser, selectedShip, preferencesLoaded]);

  useEffect(() => {
    sendLatest('input', validUser ? {
      authToken: auth!.token,
      up: Boolean(keyStates['w'] || keyStates['ArrowUp']),
      down: Boolean(keyStates['s'] || keyStates['ArrowDown']),
      left: Boolean(keyStates['a'] || keyStates['ArrowLeft']),
      right: Boolean(keyStates['d'] || keyStates['ArrowRight']),
      rotateLeft: Boolean(keyStates['q']),
      rotateRight: Boolean(keyStates['e']),
      space: Boolean(keyStates[' ']),
      shift: Boolean(keyStates['Shift'])
    } : null);
  }, [auth, validUser, keyStates]);

  const handleShipSelect = (shipIndex: number) => {
    setSelectedShip(shipIndex);
    
    // Log user data for your reference
    console.log('Selected ship:', shipIndex, 'for user:', {
      id: user?.id,
      displayName: user?.displayName,
      role: user?.role,
      opaqueId: user?.opaqueId
    });
  };

  return (
    <main>
      <header>
        <h1>Space Shooter</h1>
      </header>
      <Tabs tabs={tabs} onTabChange={ setActiveTab } />
      <section>
        { activeTab === tabs[0] && (
          <div className="ships">
            { ships.map((key) => (
                <button
                  key={key}
                  className={selectedShip === key ? 'active' : ''}
                  onClick={() => handleShipSelect(key)}
                >
                  <img
                    src={`/ships/spaceShips_00${key}.png`}
                    alt={`Space Ship ${key}`}
                  />
                </button>
            )) }
          </div>
        ) }
        { activeTab === tabs[1] && (
            <>Tab 2</>
        ) }
      </section>
      <footer>
        {connectionError && <p role="alert">{connectionError}</p>}
        <div className="user-info">
          {user ? (
            <>
              <span className="username">
                {user.displayName || (isIdShared ? `User_${user.id}` : `Anon_${user.opaqueId}`)}
              </span>
              <span className="user-id">
                ID: {isIdShared ? user.id : user.opaqueId}
              </span>
              {!isIdShared && (
                <button
                  className="share-id-btn"
                  onClick={() => {
                    console.log('Share ID button clicked from Panel');
                    requestIdShare();
                  }}
                  title="Share your Twitch ID to show your real username"
                >
                  Share ID
                </button>
              )}
            </>
          ) : (
            <span>Loading user...</span>
          )}
        </div>
        <div className="keyboard-debug" style={{
          marginTop: '10px',
          padding: '8px',
          backgroundColor: Object.values(keyStates).some(Boolean) ? '#4CAF50' : '#f5f5f5',
          border: '1px solid #ddd',
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '14px',
          color: Object.values(keyStates).some(Boolean) ? 'white' : '#333'
        }}>
          <strong>Keys Pressed:</strong> {Object.keys(keyStates).filter(key => keyStates[key]).join(', ') || 'None'}
          {Object.values(keyStates).some(Boolean) && <span style={{ color: '#90EE90' }}> (ACTIVE)</span>}
        </div>
      </footer>
    </main>
  )
}

createRoot(document.getElementById('panel')!)
  .render(
    <StrictMode>
      <Panel />
    </StrictMode>
  );
