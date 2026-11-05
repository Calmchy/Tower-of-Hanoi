# Logic Programming Project: Tower of Hanoi

**by Chyril S. Manatad, BSIT 3-A**

A Tower of Hanoi game where the game logic runs in **SWI-Prolog**. The browser
only draws the board and plays the animations. Prolog checks every move, solves
the puzzle for you, and prints a log of everything that happens in the console.

## Live demo

Try it in your browser: https://discern-bankable-washday.ngrok-free.dev/

The demo is hosted with [ngrok](https://ngrok.com/) from the author's mini-pc server,
so it only works while the SWI-Prolog server is running there. If the link does
not load, run the project yourself (see **Run it** below).

## Features

- **3 to 8 towers and 1 to 8 disks**, set from the page.
- **Move validation in Prolog.** Every move is sent to the server, which accepts
  it or refuses it (a disk can never sit on a smaller one).
- **Auto Solve that uses every tower.** Extra towers shorten the solution
  instead of being ignored. 8 disks on 8 towers takes 17 moves instead of 255.
- **Counters and timer** for valid moves, invalid moves and elapsed time.
- **Win screen** that shows your moves next to the fewest possible moves.
- **Console log** of every move, auto-solve and game event in the SWI-Prolog window.
- **Adjustable auto-solve speed** with a slider.

## Requirements

- A recent version of [SWI-Prolog](https://www.swi-prolog.org/) (the code uses tabling and the built-in HTTP libraries)
- Any modern web browser

## Run it

From the project folder:

```
swipl hanoi.pl
```

Then open http://localhost:8080 in your browser. The SWI-Prolog window prints a
"Server is Running" banner and then logs the game as you play. Leave it open
while you use the page.

## How to play

1. Click a tower to pick up its top disk, then click another tower to drop it.
   You can also pick a disk and press **Move To...** to type a tower number.
2. Move the whole stack from the first tower to the last one. A larger disk can
   never go on top of a smaller disk.
3. Press **Auto Solve** to watch Prolog solve it. Auto Solve is only available
   before you make your own first move.
4. Change **Towers** or **Disks**, or press **New Game**, to start over.

## How it works

```
Browser (index.html, js/game.js)        SWI-Prolog server (hanoi.pl)
-------------------------------        -----------------------------
click a tower            --/api/move-->  valid_move/4 checks the move
                         <-- new state   and logs it
Auto Solve               --/api/solve->  hanoi/5 builds the move list
                         <-- move list   (Frame-Stewart) and logs the plan
new game, win, auto done --/api/event->  logs the event
```

| Endpoint | What it does |
|---|---|
| `POST /api/move` | Validates one move and returns the new board, or says it is invalid |
| `POST /api/solve` | Returns the full list of moves for the chosen towers and disks |
| `POST /api/event` | Records page events (new game, auto-solve finished, solved) in the log |

### The Frame-Stewart algorithm

The usual 3-tower solution always takes 2^N - 1 moves. With more towers you can
do much better. For N disks and P towers, Prolog picks a number K and then:

1. Moves the top K disks onto one spare tower, using all P towers.
2. Moves the other N - K disks to the target, using P - 1 towers (the spare
   tower holding the K disks is blocked).
3. Moves the K disks from the spare tower onto the target, using all P towers.

Each step is the same problem with fewer disks or towers, so it is solved by
recursion. K is chosen by trying every value from 1 to N - 1 and keeping the
cheapest, and `:- table` remembers each answer so it is never calculated twice.
With 3 towers the best K is always N - 1, which gives the classic solution.

Fewest moves (rows are towers, columns are disks):

| Towers | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| 3 | 1 | 3 | 7 | 15 | 31 | 63 | 127 | 255 |
| 4 | 1 | 3 | 5 | 9 | 13 | 17 | 25 | 33 |
| 5 | 1 | 3 | 5 | 7 | 11 | 15 | 19 | 23 |
| 6 | 1 | 3 | 5 | 7 | 9 | 13 | 17 | 21 |
| 7 | 1 | 3 | 5 | 7 | 9 | 11 | 15 | 19 |
| 8 | 1 | 3 | 5 | 7 | 9 | 11 | 13 | 17 |

Frame-Stewart is proven optimal for 3 and 4 towers. For 5 or more towers it is
the best known answer and has matched every case checked so far.

### Prolog concepts used

| Idea | Where it appears in `hanoi.pl` |
|---|---|
| Facts and rules | `hanoi/5`, `valid_move/4`, `fs_cost/3` |
| Recursion | `hanoi/5` calls itself on smaller problems |
| Backtracking | `between/3` in `split_cost/6` tries each K in turn |
| Collecting solutions | `aggregate_all(min(...))` picks the cheapest K |
| Tabling (memoization) | `:- table fs_cost/3.` |
| Pattern matching | clauses for 0 disks, 1 disk and N disks |
| Immutable state | each move builds a new board with `replace_nth/4` |

## Console log

The server writes one line per event to the SWI-Prolog console. Towers are
numbered 1 to N from left to right, and each tower in a printed state is listed
from its bottom disk to its top disk.

```
[14:03:20] PAGE  opened    browser requested the game page
[14:03:20] GAME  new       3 disk(s), 4 towers (fewest possible moves: 5)
[14:03:25] AUTO  start     3 disk(s) on 4 towers: 5 moves planned (Frame-Stewart minimum 5)
[14:03:25] AUTO  plan      park the 1 smallest disk(s) on tower 2, move the other 2, then bring the 1 back
[14:03:25] MOVE  ok       disk 1: tower 1 -> tower 2   state [[3,2],[1],[],[]]
[14:03:26] MOVE  ok       disk 2: tower 1 -> tower 3   state [[3],[1],[2],[]]
[14:03:29] AUTO  DONE      5 moves played (minimum 5), time 00:03.8
[14:04:02] MOVE  INVALID  tower 1 -> tower 2   disk 3 cannot go on top of smaller disk 1
```

## Project structure

```
Tower-of-Hanoi/
├── hanoi.pl        SWI-Prolog server: game rules, Frame-Stewart solver, logging
├── index.html      Game page
├── css/style.css   Styling
├── js/game.js      Board drawing, animation and calls to the Prolog API
└── README.md
```