const fs = require('fs');
const path = require('path');
const { setTimeout } = require('timers/promises');

const baseUrl = 'https://backend.wplace.live/files';
const season = 0;
const delay = 300;
const retryDelay = 1000;
const downloadPath = `./s${season}`;
const filename = 'x{x}-y{y}';
const averageSamples = 100;
const tilesX = 2048;
const tilesY = 2048;

const downloadTimes = [];
(async () => {
    for (let y = 0; y < tilesY; y++) {
        for (let x = 0; x < tilesX; x++) {
            const filePath = path.join(downloadPath, `${filename.replace(/{x}/g, x).replace(/{y}/g, y)}.png`);
            if (fs.existsSync(filePath)) continue; // Already downloaded

            const tile = await downloadTile(season, x, y, filePath);

            if (tile) {
                downloadTimes.push(tile.time);
                if (downloadTimes.length > averageSamples) downloadTimes.splice(0, downloadTimes.length - averageSamples);
                const averageDownloadTime = downloadTimes.reduce((acc, time) => acc + time, 0) / downloadTimes.length;
                const completionTime = (averageDownloadTime + delay) * (tilesX - x) * (tilesY - y);
                console.log(`Downloaded X${x} Y${y} (${tile.size}B) - Expected completion time: ${Math.floor(completionTime / 1000 / 60)} minute(s), ${Math.floor(completionTime / 1000 / 60 / 60)} hour(s)`);
            }
            if (delay) await setTimeout(delay);
        }
    }
})();

function downloadTile(season, x, y, filePath) {
    const startDate = Date.now();
    return fetch(`${baseUrl}/s${season}/tiles/${x}/${y}.png`).then(async res => {
        if (res.status === 404) return console.log(`No tile at X${x} Y${y}`);
        if (res.status !== 200) return retry(new Error(`Got status ${res.status} ${res.statusText}`));
        const buffer = Buffer.from(await res.arrayBuffer());

        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, buffer);

        return {
            season,
            x,
            y,
            filePath,
            time: Date.now() - startDate,
            size: buffer.length
        };
    }).catch(retry);
    
    async function retry(err) {    
        console.log(`Failed to download tile X${x} Y${y}: ${err.message}. Retrying in ${Math.floor(retryDelay / 1000)} second(s)`);
        await setTimeout(retryDelay);
        return downloadTile(season, x, y);
    }
}