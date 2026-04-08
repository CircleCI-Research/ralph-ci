# Project Plan: Classic Snake Game

## Project Overview

Build a classic Snake game using HTML, CSS, and vanilla JavaScript. The game should be playable in a web browser with arrow key controls.

## Requirements

- Grid-based game board (20x20 cells)
- Snake that moves continuously in the current direction
- Food that spawns randomly on the grid
- Snake grows when eating food
- Score tracking
- Game over when snake hits wall or itself
- Restart functionality
- Clean, retro-style visual design

## Technical Stack

- HTML5 Canvas for rendering
- Vanilla JavaScript (no frameworks)
- CSS for styling the container/UI

## File Structure

All source files should be created in the `src/` folder:

```
features/snake-game/
├── activity.md     # Activity log
├── plan.md         # This file
├── tasks.json      # Task list
├── prompt.md       # Agent instructions
├── ralphci.json    # Configuration
└── src/            # Source code output
    ├── index.html  # Main HTML file
    ├── style.css   # Styling
    ├── game.js     # Game logic
    └── README.md   # How to play
```

## Additional Context

This is a demonstration of RalphCI - the AI coding agent will build this game iteratively, committing working changes and verifying locally before moving on.
