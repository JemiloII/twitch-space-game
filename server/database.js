import { createClient } from '@libsql/client';

// Initialize the database client for local SQLite
const client = createClient({
  url: 'file:./space_shooter.db'
});

// Initialize database tables
export async function initDatabase() {
  try {
    // Create players table to store player preferences
    await client.execute(`
      CREATE TABLE IF NOT EXISTS player_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        twitch_user_id TEXT UNIQUE,
        twitch_username TEXT,
        twitch_opaque_id TEXT,
        selected_ship TEXT DEFAULT 'spaceShips_001.png',
        ship_colors TEXT DEFAULT '{}',
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for faster lookups
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_twitch_user_id ON player_preferences(twitch_user_id)
    `);

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_twitch_opaque_id ON player_preferences(twitch_opaque_id)
    `);

    console.log('[database] Database initialized successfully');
  } catch (error) {
    console.error('[database] Error initializing database:', error);
  }
}

// Get player preferences by Twitch user ID or opaque ID
export async function getPlayerPreferences(twitchUserId, twitchOpaqueId) {
  try {
    let result;
    
    // First try to find by Twitch user ID (for linked accounts)
    if (twitchUserId) {
      result = await client.execute({
        sql: 'SELECT * FROM player_preferences WHERE twitch_user_id = ?',
        args: [twitchUserId]
      });
    }
    
    // If not found and we have an opaque ID, try that
    if ((!result || result.rows.length === 0) && twitchOpaqueId) {
      result = await client.execute({
        sql: 'SELECT * FROM player_preferences WHERE twitch_opaque_id = ?',
        args: [twitchOpaqueId]
      });
    }
    
    if (result && result.rows.length > 0) {
      const row = result.rows[0];
      return {
        selectedShip: row.selected_ship || 'spaceShips_001.png',
        shipColors: JSON.parse(row.ship_colors || '{}'),
        lastUpdated: row.last_updated
      };
    }
    
    // Return defaults if no preferences found
    return {
      selectedShip: 'spaceShips_001.png',
      shipColors: {},
      lastUpdated: null
    };
  } catch (error) {
    console.error('[database] Error getting player preferences:', error);
    return {
      selectedShip: 'spaceShips_001.png',
      shipColors: {},
      lastUpdated: null
    };
  }
}

// Save or update player preferences
export async function savePlayerPreferences(twitchUserId, twitchUsername, twitchOpaqueId, selectedShip, shipColors = {}) {
  try {
    const colorsJson = JSON.stringify(shipColors);
    
    // Use UPSERT (INSERT OR REPLACE) to handle both new and existing players
    await client.execute({
      sql: `
        INSERT INTO player_preferences (twitch_user_id, twitch_username, twitch_opaque_id, selected_ship, ship_colors, last_updated)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(twitch_user_id) DO UPDATE SET
          twitch_username = excluded.twitch_username,
          twitch_opaque_id = excluded.twitch_opaque_id,
          selected_ship = excluded.selected_ship,
          ship_colors = excluded.ship_colors,
          last_updated = CURRENT_TIMESTAMP
      `,
      args: [twitchUserId, twitchUsername, twitchOpaqueId, selectedShip, colorsJson]
    });
    
    console.log(`[database] Saved preferences for user ${twitchUsername}:`, {
      selectedShip,
      shipColors
    });
    
    return true;
  } catch (error) {
    console.error('[database] Error saving player preferences:', error);
    return false;
  }
}

// Get all player preferences (for debugging/admin purposes)
export async function getAllPlayerPreferences() {
  try {
    const result = await client.execute('SELECT * FROM player_preferences ORDER BY last_updated DESC');
    return result.rows.map(row => ({
      id: row.id,
      twitchUserId: row.twitch_user_id,
      twitchUsername: row.twitch_username,
      twitchOpaqueId: row.twitch_opaque_id,
      selectedShip: row.selected_ship,
      shipColors: JSON.parse(row.ship_colors || '{}'),
      lastUpdated: row.last_updated,
      createdAt: row.created_at
    }));
  } catch (error) {
    console.error('[database] Error getting all player preferences:', error);
    return [];
  }
}

// Clean up old preferences (optional - for maintenance)
export async function cleanupOldPreferences(daysOld = 30) {
  try {
    const result = await client.execute({
      sql: 'DELETE FROM player_preferences WHERE last_updated < datetime("now", "-' + daysOld + ' days")',
      args: []
    });
    
    console.log(`[database] Cleaned up ${result.rowsAffected} old preferences`);
    return result.rowsAffected;
  } catch (error) {
    console.error('[database] Error cleaning up old preferences:', error);
    return 0;
  }
}