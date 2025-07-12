import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Tabs from './Tabs/Tabs.tsx';
import { useTwitchAuth } from '../hooks/useTwitchAuth';
import './Panel.scss'

export default function Panel() {
  const [, ...ships]= [...Array(9).keys()];
  const tabs = ['Space Ships', 'Colors'];
  const [activeTab, setActiveTab] = useState<string>(tabs[0]);
  const [selectedShip, setSelectedShip] = useState<number>(ships[0]);
  
  const {
    user
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
        <span>User: {user?.opaqueId || 'Loading...'}</span>
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
