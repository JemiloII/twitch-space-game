# Game fix list

All 16 fixes below are saved on the `Redgarr` branch. Each fix has its own
commit. Click a fix number to see exactly what changed.

| Fix | What changed |
| --- | --- |
| [1](https://github.com/JemiloII/twitch-space-game/commit/a2515fa4aa560e82eecfff762ed78d246227231d) | Put back missing files so the game can load ships, guns, and shots. |
| [2](https://github.com/JemiloII/twitch-space-game/commit/1db585568d9a7b9f443935d56ea756b89394a224) | Fixed the settings that stopped the code check from finishing. |
| [3](https://github.com/JemiloII/twitch-space-game/commit/dea7f305c687f559eda5d3253f00717be2f837b8) | Let the game start on your computer without special files from another computer. |
| [4](https://github.com/JemiloII/twitch-space-game/commit/b5f58f3af1d517f789414eaee55a30d18c9e7cb5) | Made the home page open the game instead of a missing-page error. |
| [5](https://github.com/JemiloII/twitch-space-game/commit/6e5c401fcf50d76f2cce7b94fb8272189a9c0710) | Kept the secret key out of the code so people cannot use it to make fake player passes. |
| [6](https://github.com/JemiloII/twitch-space-game/commit/58119cfb427521ecedd49da9bb4073a9fe2422c4) | Checked each player's Twitch login before letting them change their saved ship. |
| [7](https://github.com/JemiloII/twitch-space-game/commit/040c2114bce3ff5ff77e9b01e7fe9569652c0227) | Kept game updates working after a lost connection comes back. |
| [8](https://github.com/JemiloII/twitch-space-game/commit/26d5258d538ad4405dfb29f4ee67ceb993d0bb78) | Remembered your latest ship choice while the game connects. |
| [9](https://github.com/JemiloII/twitch-space-game/commit/064cebf8759eafafc035afb9c73cec0d3690a98d) | Kept guns firing while you hold the fire key. |
| [10](https://github.com/JemiloII/twitch-space-game/commit/435047357711e8b12c9e9b4e5436b4e9461ae906) | Released held keys when you leave the Twitch panel, so controls do not get stuck. |
| [11](https://github.com/JemiloII/twitch-space-game/commit/ab6b6e742cb4cf6ed2b3a9da9b6638057284e0f2) | Removed an extra gun setting that the game did not use. |
| [12](https://github.com/JemiloII/twitch-space-game/commit/1e35e53d0fcc44b125987fffdc6c73e9543dea8a) | Showed the space view instead of green, with a message when the game is waiting for players. |
| [13](https://github.com/JemiloII/twitch-space-game/commit/524647290e9515d7865550d113cf2acd97073aa7) | Added practice play so you can fly and shoot without a Twitch login. |
| [14](https://github.com/JemiloII/twitch-space-game/commit/ba706a1a36db967edf1e2d71fe72df2b131596e6) | Used the right pictures so the engine flame animation can play all its steps. |
| [15](https://github.com/JemiloII/twitch-space-game/commit/e81e01ab71070e42401937083737ec6b109ead0a) | Stopped an old ship from causing an error if it finishes loading after you switch ships. |
| [16](https://github.com/JemiloII/twitch-space-game/commit/ecb86958f5de9eb0a6a95fa182770c7ed755edc6) | Kept a ship's colors when you choose that ship again. |

## Try practice play

Follow the [start steps](README.md#getting-started), open the game, and click
**Play practice**. Press **W** to fly, **A/D** to turn, and **Space** to shoot.
Use **Reset ship** to return to the middle. Ship 8 has no guns.

Practice runs in your browser. It does not change the live Twitch game or your
saved ship. Live Twitch play needs the Twitch settings listed in the README.

## Checks completed

After fix 16, all 16 tests passed. The code check and game build passed too.
The browser check covered the game screen, practice controls, shots, ship
choices, reset, and returning to the live view.
