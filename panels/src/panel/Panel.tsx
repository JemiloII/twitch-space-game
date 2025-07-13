import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import Tabs from './Tabs/Tabs.tsx';
import { useTwitchStore } from '../stores/twitchStore';
import './Panel.scss'

export default function Panel() {
  const [, ...ships]= [...Array(9).keys()];
  const tabs = ['Space Ships', 'Colors'];
  const [activeTab, setActiveTab] = useState<string>(tabs[0]);
  const [selectedShip, setSelectedShip] = useState<number>(ships[0]);
  
  const {
    user,
    isIdShared,
    requestIdShare,
    auth,
    isAuthenticated,
    initializeTwitch
  } = useTwitchStore();

  // Initialize Twitch on component mount
  useEffect(() => {
    initializeTwitch();
  }, [initializeTwitch]);

  // Debug logging
  console.log('Panel render:', {
    user,
    isIdShared,
    isAuthenticated,
    auth: auth ? { userId: auth.userId, clientId: auth.clientId } : null
  });

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
