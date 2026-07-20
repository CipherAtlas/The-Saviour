<p align="center">
  <img src="public/assets/branding/the-saviour-primary.png" alt="The Saviour — Descend for her." width="100%">
</p>

<p align="center">
  <strong>A ten-floor descent. A missing princess. Five seconds to choose.</strong><br>
  Browser action roguelite · Three.js · Keyboard, mouse, controller, and touch
</p>

---

Princess Elowen is missing. Guided by the bond between their paired rings, Prince Zephyr takes up his scythe and descends into the dark beneath the kingdom. Ten floors, an ancient Witch, and a final choice stand between him and the woman he refuses to abandon.

## The descent

Every run is a fast, build-driven journey through ten increasingly dangerous floors.

- Clear three generated combat chambers on each floor.
- Enter the portal after a fight and choose an upgrade for the current run.
- Complete a floor to claim a powerful blessing and shape your build.
- Adapt to new biomes, enemy combinations, and volatile variants.
- Reach the final chamber, defeat the Witch, and decide how the story ends.

Choose **New Descent** for the complete story with your preferred difficulty, or **Speedrun** for a fixed Ruthless run with a dedicated timer and separate records.

## Fight with the scythe

Stay aggressive to build **Harvest** through close-range hits, critical strikes, kills, perfect charges, and well-timed dashes. The meter holds three segments; spend a filled segment on **Grave Line** or **Reaper's Claim**.

| Technique | Input | How it works |
| --- | --- | --- |
| **Scythe combo** | Tap `Left Mouse` | Chain three wide sweeps. Time repeated taps to continue through the full combo. |
| **Grave Line** | Hold `Left Mouse` | Charge a devastating straight-line strike. It costs one Harvest segment, allows one dash while charging, and fires automatically at full power. |
| **Charged Reap** | Hold `Q` or `Middle Mouse` | Charge and release a full-circle attack to clear space around Zephyr. |
| **Reaper's Claim** | Press `R` | Spend one Harvest segment to throw the scythe through enemies and recall it. Tap attack as it returns to turn the catch into a powerful cleave. |
| **Dash strike** | Attack during a dash | Carry Zephyr's attack through his movement and cut across the path ahead. |

## Controls

| Action | Keyboard and mouse |
| --- | --- |
| Move | `WASD` or arrow keys |
| Aim | Mouse |
| Dash | `Shift`, `Space`, or `Right Mouse` |
| Enter the next chamber | Walk into the center portal |
| Act during the final decision | `Left Mouse` or `E` |
| Pause | `Escape` |

Bindings can be changed in **Settings**. Controller and touch controls are also supported.

## Download and play

The game runs locally in your browser. Install [Node.js 22.12 or newer](https://nodejs.org/) first; Node.js includes `npm`, which handles the game’s setup.

### Download the ZIP

1. Click the green **Code** button at the top of this repository and choose **Download ZIP**.
2. Extract the ZIP, then open the extracted game folder.
3. Open a terminal in that folder. In VS Code, use **Terminal → New Terminal**.
4. Install the game’s dependencies and start it:

```bash
npm install
npm run dev
```

5. Open [http://127.0.0.1:5173/](http://127.0.0.1:5173/) in your browser. If that port is busy, use the address printed in the terminal instead.

### Or clone with Git

```bash
git clone https://github.com/CipherAtlas/The-Saviour.git
cd The-Saviour
npm install
npm run dev
```

After the first setup, you only need to open a terminal in the game folder and run `npm run dev`. Press `Ctrl+C` in the terminal when you want to stop the local server.
