import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Tabs from './Tabs/Tabs.tsx';
import { useTwitchAuth } from '../hooks/useTwitchAuth';
import './Panel.scss'

export default function Panel() {
  const ships = [1, 2, 3, 8, 5, 6, 7, 9];
  const tabs = ['Space Ships', 'Colors'];
  const [activeTab, setActiveTab] = useState<string>(tabs[0]);
  const [selectedShip, setSelectedShip] = useState<number>(ships[0]);
  
  const {
    isAuthenticated,
    user,
    error
  } = useTwitchAuth();

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
        {isAuthenticated && user && (
          <div className="user-status">
            <span>Welcome, {user.displayName || user.id}!</span>
            <span className="role-badge">{user.role.toUpperCase()}</span>
          </div>
        )}
        {error && (
          <div className="error-status">
            <span>Not connected to Twitch</span>
          </div>
        )}
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
