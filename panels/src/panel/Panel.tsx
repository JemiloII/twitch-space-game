import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import Tabs from './Tabs/Tabs.tsx';
import { useTwitchStore } from '../stores/twitchStore';
import { connect, send } from '../Game/Socket';
import './Panel.scss'

export default function Panel() {
  const [, ...ships]= [...Array(9).keys()];
  const tabs = ['Space Ships', 'Colors'];
  const [activeTab, setActiveTab] = useState<string>(tabs[0]);
  const [selectedShip, setSelectedShip] = useState<number>(ships[0]);
  const [keyStates, setKeyStates] = useState<Record<string, boolean>>({});
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  
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
  }, [initializeTwitch]);

  // Load player preferences when user is available
  useEffect(() => {
    const loadPlayerPreferences = async () => {
      if (!user || preferencesLoaded) return;
      
      try {
        const params = new URLSearchParams();
        if (user.id && isIdShared) {
          params.append('twitchUserId', user.id);
        }
        if (user.opaqueId) {
          params.append('twitchOpaqueId', user.opaqueId);
        }
        
        const response = await fetch(`https://game.shibiko.ai:2087/api/players?${params}`);
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
  }, [user, isIdShared, preferencesLoaded]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Normalize key to prevent modifier keys from affecting letters
      let key = event.key;
      
      // Convert uppercase letters to lowercase
      if (key.length === 1 && key >= 'A' && key <= 'Z') {
        key = key.toLowerCase();
      }
      
      setKeyStates(prev => ({ ...prev, [key]: true }));
    };
    
    const handleKeyUp = (event: KeyboardEvent) => {
      let { key } = event;
      if (key.length === 1 && key >= 'A' && key <= 'Z') {
        key = key.toLowerCase();
      }
      
      setKeyStates(prev => ({ ...prev, [key]: false }));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  console.log('Panel render:', {
    user,
    isIdShared,
    isAuthenticated,
    auth: auth ? { userId: auth.userId, clientId: auth.clientId } : null
  });

  const getShipFilename = (shipIndex: number) => {
    return `spaceShips_00${shipIndex}.png`;
  };

  const getUserDisplayName = () => {
    if (!user) return null;
    return user.displayName || (isIdShared ? `User_${user.id}` : `Anon_${user.opaqueId}`);
  };

  const isValidUser = () => {
    const displayName = getUserDisplayName();
    return displayName && !displayName.startsWith('Anon_') && user?.displayName;
  };

  const sendUserDataToServer = () => {
    if (!isValidUser()) {
      console.log('Not sending user data - invalid user:', {
        user: user?.displayName,
        isIdShared,
        getUserDisplayName: getUserDisplayName()
      });
      return;
    }
    
    const pressedKeys = Object.keys(keyStates).filter(key => keyStates[key]);
    const userData = {
      type: 'user_data',
      username: user?.displayName,
      userId: user?.id,
      opaqueId: user?.opaqueId,
      keyPressed: pressedKeys.join(','),
      keyActive: pressedKeys.length > 0
    };
    
    console.log('Sending user data to server:', userData);
    send(userData);
  };

  const sendShipSelectionToServer = () => {
    if (!isValidUser()) return;
    
    const shipData = {
      type: 'ship_selection',
      username: user?.displayName,
      userId: user?.id,
      opaqueId: user?.opaqueId,
      shipKey: getShipFilename(selectedShip)
    };
    
    console.log('Sending ship selection to server:', shipData);
    send(shipData);
  };

  const sendInputToServer = () => {
    if (!isValidUser()) return;
    
    // Map key states to movement input (keys are now normalized to lowercase)
    const inputData = {
      up: keyStates['w'] || keyStates['ArrowUp'],
      down: keyStates['s'] || keyStates['ArrowDown'],
      left: keyStates['a'] || keyStates['ArrowLeft'],
      right: keyStates['d'] || keyStates['ArrowRight'],
      rotateLeft: keyStates['q'],
      rotateRight: keyStates['e'],
      space: keyStates[' '],
      shift: keyStates['Shift']
    };
    
    console.log('Sending input to server:', inputData);
    send(inputData);
  };

  // Send user data to server when user or keystrokes change
  useEffect(() => {
    sendUserDataToServer();
    sendInputToServer();
  }, [user, keyStates, isIdShared]);

  // Send ship selection to server only when ship selection changes (but not during initial load)
  useEffect(() => {
    if (preferencesLoaded) {
      sendShipSelectionToServer();
    }
  }, [user, selectedShip, isIdShared, preferencesLoaded]);

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
