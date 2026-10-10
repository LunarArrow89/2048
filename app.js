document.addEventListener("DOMContentLoaded", () => {
    const grid = document.querySelector(".grid");
    const scoreDisplay = document.querySelector("#score");
    const resultDisplay = document.querySelector("#result");
    const width = 4;
    const cells = [];
    let tiles = [];
    let nextId = 1;
    let score = 0;
    let busy = false;
    let gameEnded = false;
    const saveKey = "moms2048SaveV1";

    grid.innerHTML = "";
    for (let i = 0; i < width * width; i++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        grid.appendChild(cell);
        cells.push(cell);
    }

    function saveGame() {
        try {
            localStorage.setItem(saveKey, JSON.stringify({
                tiles, nextId, score, gameEnded
            }));
        } catch (error) {
            console.warn("Could not save the game on this device.", error);
        }
    }

    function loadGame() {
        try {
            const raw = localStorage.getItem(saveKey);
            if (!raw) return false;
            const saved = JSON.parse(raw);
            if (!saved || !Array.isArray(saved.tiles) ||
                !Number.isFinite(saved.score) ||
                !saved.tiles.every(tile =>
                    Number.isInteger(tile.id) &&
                    Number.isInteger(tile.value) && tile.value > 0 &&
                    Number.isInteger(tile.row) && tile.row >= 0 && tile.row < width &&
                    Number.isInteger(tile.col) && tile.col >= 0 && tile.col < width
                ) ||
                saved.tiles.length > width * width ||
                new Set(saved.tiles.map(tile => tile.row + "," + tile.col)).size !== saved.tiles.length
            ) {
                localStorage.removeItem(saveKey);
                return false;
            }
            tiles = saved.tiles;
            score = saved.score;
            nextId = Number.isInteger(saved.nextId)
                ? Math.max(saved.nextId, ...tiles.map(tile => tile.id + 1), 1)
                : Math.max(1, ...tiles.map(tile => tile.id + 1));
            gameEnded = Boolean(saved.gameEnded);
            return true;
        } catch (error) {
            console.warn("Could not load the saved game.", error);
            return false;
        }
    }

    function resetGame() {
        tiles = [];
        nextId = 1;
        score = 0;
        busy = false;
        gameEnded = false;
        resultDisplay.innerHTML = 'A little game made with love 💜 Slide the tiles and reach <b>2048</b>!';
        grid.querySelectorAll(".tile").forEach(tile => tile.remove());
        spawnTile();
        spawnTile();
        renderAnimated();
        saveGame();
    }

    function makeTile(value, row, col) {
        return { id: nextId++, value, row, col };
    }

    function positionTile(el, row, col) {
        el.style.left = `calc(${col * 25}% + var(--tile-inset, 7px))`;
        el.style.top = `calc(${row * 25}% + var(--tile-inset, 7px))`;
    }

    function spawnTile() {
        const empty = [];
        for (let row = 0; row < width; row++) {
            for (let col = 0; col < width; col++) {
                if (!tiles.some(tile => tile.row === row && tile.col === col)) {
                    empty.push({ row, col });
                }
            }
        }
        if (!empty.length) return;
        const spot = empty[Math.floor(Math.random() * empty.length)];
        tiles.push(makeTile(Math.random() < 0.9 ? 2 : 4, spot.row, spot.col));
    }

    function renderAnimated(mergedIds = new Set()) {
        const existing = new Map();
        grid.querySelectorAll(".tile").forEach(el => existing.set(Number(el.dataset.id), el));

        const nextIds = new Set(tiles.map(tile => tile.id));
        existing.forEach((el, id) => {
            if (!nextIds.has(id)) el.remove();
        });

        tiles.forEach(tile => {
            let el = existing.get(tile.id);
            if (!el) {
                el = document.createElement("div");
                el.className = "tile";
                el.dataset.id = tile.id;
                el.dataset.value = tile.value;
                el.textContent = tile.value;
                el.style.transition = "none";
                positionTile(el, tile.row, tile.col);
                grid.appendChild(el);
                void el.offsetWidth;
                el.style.transition = "left 280ms cubic-bezier(.2,.75,.25,1), top 280ms cubic-bezier(.2,.75,.25,1), background-color 120ms ease";
                el.classList.add("tile-new");
                setTimeout(() => el.classList.remove("tile-new"), 220);
            } else {
                el.dataset.value = tile.value;
                el.textContent = tile.value;
                // Force the browser to commit the previous position before moving.
                void el.offsetWidth;
                positionTile(el, tile.row, tile.col);
                if (mergedIds.has(tile.id)) {
                    el.classList.remove("tile-merge");
                    void el.offsetWidth;
                    el.classList.add("tile-merge");
                    setTimeout(() => el.classList.remove("tile-merge"), 250);
                }
            }
        });
        scoreDisplay.textContent = score;
        saveGame();
    }

    function move(direction) {
        if (busy || gameEnded) return;

        const before = tiles.map(tile => ({ ...tile }));
        const beforeSignature = before.map(t => `${t.value}:${t.row}:${t.col}`).sort().join("|");
        const next = [];
        let gained = 0;
        const mergedIds = new Set();

        for (let line = 0; line < width; line++) {
            const lineTiles = before
                .filter(tile => direction === "left" || direction === "right"
                    ? tile.row === line : tile.col === line)
                .sort((a, b) => {
                    const av = direction === "left" || direction === "right" ? a.col : a.row;
                    const bv = direction === "left" || direction === "right" ? b.col : b.row;
                    return (direction === "right" || direction === "down") ? bv - av : av - bv;
                });

            const packed = [];
            for (let i = 0; i < lineTiles.length; i++) {
                const current = lineTiles[i];
                const following = lineTiles[i + 1];
                if (following && current.value === following.value) {
                    const value = current.value * 2;
                    const row = direction === "left" || direction === "right" ? line : packed.length;
                    const col = direction === "left" || direction === "right" ? packed.length : line;
                    packed.push(makeTile(value, row, col));
                    mergedIds.add(packed[packed.length - 1].id);
                    gained += value;
                    i++;
                } else {
                    packed.push({ ...current });
                }
            }

            packed.forEach((tile, index) => {
                if (direction === "right") tile.col = width - 1 - index;
                else if (direction === "left") tile.col = index;
                else if (direction === "down") tile.row = width - 1 - index;
                else tile.row = index;
                if (direction === "left" || direction === "right") tile.row = line;
                else tile.col = line;
                next.push(tile);
            });
        }

        const afterSignature = next.map(t => `${t.value}:${t.row}:${t.col}`).sort().join("|");
        if (beforeSignature === afterSignature) return;

        tiles = next;
        score += gained;
        busy = true;
        renderAnimated(mergedIds);

        // Wait until the 280ms slide finishes before adding the next tile.
        setTimeout(() => {
            spawnTile();
            renderAnimated();
            busy = false;
            finishTurn();
            saveGame();
        }, 300);
    }

    function finishTurn() {
        if (tiles.some(tile => tile.value >= 2048)) {
            resultDisplay.innerHTML = "You did it, Mom! <b>2048!</b> 💜";
            gameEnded = true;
            saveGame();
            return;
        }
        if (!hasMoves()) {
            resultDisplay.textContent = "No more moves — thanks for playing! 💙";
            gameEnded = true;
        }
        saveGame();
    }

    function hasMoves() {
        if (tiles.length < width * width) return true;
        const board = Array.from({ length: width }, () => Array(width).fill(0));
        tiles.forEach(tile => board[tile.row][tile.col] = tile.value);
        for (let row = 0; row < width; row++) {
            for (let col = 0; col < width; col++) {
                if (row < width - 1 && board[row][col] === board[row + 1][col]) return true;
                if (col < width - 1 && board[row][col] === board[row][col + 1]) return true;
            }
        }
        return false;
    }

    document.addEventListener("keydown", event => {
        const keys = {
            ArrowLeft: "left", ArrowRight: "right",
            ArrowUp: "up", ArrowDown: "down"
        };
        if (keys[event.key]) {
            event.preventDefault();
            move(keys[event.key]);
        }
    });

    let touchStartX = 0;
    let touchStartY = 0;
    grid.addEventListener("touchstart", event => {
        touchStartX = event.changedTouches[0].clientX;
        touchStartY = event.changedTouches[0].clientY;
    }, { passive: true });
    grid.addEventListener("touchend", event => {
        const dx = event.changedTouches[0].clientX - touchStartX;
        const dy = event.changedTouches[0].clientY - touchStartY;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 25) return;
        move(Math.abs(dx) > Math.abs(dy)
            ? (dx > 0 ? "right" : "left")
            : (dy > 0 ? "down" : "up"));
    }, { passive: true });

    const style = document.createElement("style");
    style.textContent = `
        .grid { --tile-inset: 7px; }
        .tile { background: var(--tile-color, #f4f1ff); }
        .tile[data-value="2"] { --tile-color: #f4f1ff; }
        .tile[data-value="4"] { --tile-color: #e5e5ff; }
        .tile[data-value="8"] { --tile-color: #cdeeff; }
        .tile[data-value="16"] { --tile-color: #b9dcff; }
        .tile[data-value="32"] { --tile-color: #c7caff; }
        .tile[data-value="64"] { --tile-color: #b8b8f4; }
        .tile[data-value="128"] { --tile-color: #b6d5ff; }
        .tile[data-value="256"] { --tile-color: #b5c5f5; }
        .tile[data-value="512"] { --tile-color: #9de0ff; }
        .tile[data-value="1024"] { --tile-color: #b7b0ff; }
        .tile[data-value="2048"] { --tile-color: #9c8ce8; }
        @media (max-width: 420px) { .grid { --tile-inset: 5px; } }
    `;
    document.head.appendChild(style);

    document.querySelector("#reset-button").addEventListener("click", () => {
        if (confirm("Start a new game? Your current board and score will be erased.")) {
            resetGame();
        }
    });

    grid.classList.add("sliding-board");
    cells.forEach((cell, index) => {
        positionTile(cell, Math.floor(index / width), index % width);
    });

    if (loadGame()) {
        renderAnimated();
        if (gameEnded) finishTurn();
    } else {
        spawnTile();
        spawnTile();
        renderAnimated();
        saveGame();
    }
});
