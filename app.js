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
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Empty spaces stay in place while the number tiles slide above them.
    grid.innerHTML = "";
    for (let i = 0; i < width * width; i++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        grid.appendChild(cell);
        cells.push(cell);
    }

    function makeTile(value, row, col) {
        return { id: nextId++, value, row, col };
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

    function render() {
        grid.querySelectorAll(".tile").forEach(tile => tile.remove());
        tiles.forEach(tile => {
            const el = document.createElement("div");
            el.className = "tile" + (tile.isNew ? " tile-new" : "");
            el.textContent = tile.value;
            el.dataset.value = tile.value;
            el.style.setProperty("--row", tile.row);
            el.style.setProperty("--col", tile.col);
            grid.appendChild(el);
            tile.isNew = false;
        });
        scoreDisplay.textContent = score;
    }

    function renderAnimated(oldTiles, mergedIds = new Set()) {
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
                el.textContent = tile.value;
                el.dataset.value = tile.value;
                el.style.left = `calc(${tile.col * 25}% + 7px)`;
                el.style.top = `calc(${tile.row * 25}% + 7px)`;
                el.style.transition = "none";
                grid.appendChild(el);
                void el.offsetWidth;
                el.style.transition = "";
                el.classList.add("tile-new");
                setTimeout(() => el.classList.remove("tile-new"), 220);
            } else {
                el.dataset.value = tile.value;
                el.textContent = tile.value;
                el.style.left = `calc(${tile.col * 25}% + 7px)`;
                el.style.top = `calc(${tile.row * 25}% + 7px)`;
                if (mergedIds.has(tile.id)) {
                    el.classList.remove("tile-merge");
                    void el.offsetWidth;
                    el.classList.add("tile-merge");
                    setTimeout(() => el.classList.remove("tile-merge"), 250);
                }
            }
        });
        scoreDisplay.textContent = score;
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
        busy = !reduceMotion;
        renderAnimated(before, mergedIds);
        if (reduceMotion) {
            spawnTile();
            renderAnimated(before);
            finishTurn();
        } else {
            setTimeout(() => {
                spawnTile();
                renderAnimated(before);
                busy = false;
                finishTurn();
            }, 150);
        }
    }

    function finishTurn() {
        if (tiles.some(tile => tile.value >= 2048)) {
            resultDisplay.innerHTML = "You did it, Mom! <b>2048!</b> 💜";
            gameEnded = true;
            return;
        }
        if (!hasMoves()) {
            resultDisplay.textContent = "No more moves — thanks for playing! 💙";
            gameEnded = true;
        }
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

    // Keep the colors in the same soft blue and lavender family.
    function colorFor(value) {
        const colors = {
            2: "#f4f1ff", 4: "#e5e5ff", 8: "#cdeeff",
            16: "#b9dcff", 32: "#c7caff", 64: "#b8b8f4",
            128: "#b6d5ff", 256: "#b5c5f5", 512: "#9de0ff",
            1024: "#b7b0ff", 2048: "#9c8ce8"
        };
        return colors[value] || "#8573d0";
    }

    const style = document.createElement("style");
    style.textContent = `
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
    `;
    document.head.appendChild(style);

    // Rebuild the board with positioned tiles so their movement can animate.
    grid.classList.add("sliding-board");
    grid.querySelectorAll(".cell").forEach(cell => {
        const index = cells.indexOf(cell);
        cell.style.left = `calc(${(index % width) * 25}% + 7px)`;
        cell.style.top = `calc(${Math.floor(index / width) * 25}% + 7px)`;
    });
    tiles = [];
    spawnTile();
    spawnTile();
    renderAnimated([]);
});
