import { Plugin } from 'obsidian';

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

/* interface Adiel_TexPluginSettings {
    mySetting: string;
    invertColorsInDarkMode: boolean;
}

const DEFAULT_SETTINGS: Adiel_TexPluginSettings = {
    mySetting: 'default',
    invertColorsInDarkMode: false
} */

export default class Adiel_TexPlugin extends Plugin {
    
    // settings: Adiel_TexPluginSettings;

    // CONSTANTS
    pluginDirName: string = "obsidian-tex-plugin";
    //@ts-ignore
    pluginDirPath = path.join(this.app.vault.adapter.basePath, '.obsidian', 'plugins', this.pluginDirName);
    tempDirPath = path.join(this.pluginDirPath, 'tmp');
    cachePath = path.join(this.pluginDirPath, 'cache.json');

    // cache life time of 1 day
    cacheLifeTime = 1000 * 60 * 60 * 24;

    // Generate a cache key by hashing the LaTeX code (simple example)
    generateCacheKey(tex: string): string {
        return require('crypto').createHash('sha256').update(tex).digest('hex');
    }
    
    // Helper to write to the JSON cache file
    saveCache(cache: { [cacheKey: string]: { lastAccessed: string; createdAt: string; svg: string; }; }) {
        fs.writeFileSync(this.cachePath, JSON.stringify(cache, null, 2), 'utf8');
    }

    // Helper to read and parse the JSON cache file
    loadCache(): { [cacheKey: string]: 
        {
            lastAccessed: string;
            createdAt: string;
            svg: string;
        }
     } {
        return JSON.parse(fs.readFileSync(this.cachePath, 'utf8'));
    }

    // get cache item by cache key
    getCacheItem(cacheKey: string): { lastAccessed: string; createdAt: string; svg: string; } | null {
        const cache = this.loadCache();
        const item = cache[cacheKey];
        if (item) {
            cache[cacheKey].lastAccessed = new Date().toISOString();
            this.saveCache(cache);
            return item;
        }
        return null;
    }

    // save cache item by cache key
    saveCacheItem(cacheKey: string, svg: string) {
        const cache = this.loadCache();
        const now = new Date().toISOString();
        // search for existing cache item by cache key
        let item = cache[cacheKey];
        if (!item) {
            cache[cacheKey] = {
                svg,
                lastAccessed: now,
                createdAt: now
            };
        }
        this.saveCache(cache);
    }

    // remove cache items that are accessed more than `maxAge` milliseconds ago
    removeOldCacheItems(maxAge: number) {
        const cache = this.loadCache();
        const now = new Date().getTime();
        for (const cacheKey in cache) {
            const item = cache[cacheKey];
            const lastAccessed = new Date(item.lastAccessed).getTime();
            if (now - lastAccessed > maxAge) {
                delete cache[cacheKey];
            }
        }
        this.saveCache(cache);
    }

    // function to remove empty lines and commnet lines (or inline commnets) from tex (that doen't effect on svg output so we can remove them to avoid unnecessary compilation and cache)
    cleanTex(tex: string): string {
        return tex.split('\n').filter((line) => {
            return line.trim() !== '' && !line.trim().startsWith('%');
        }).join('\n');
    }

    errPreEl(err: string): string {
        err = err.substring(0, 1000);
        return `<pre style="font-family: var(--font-monospace);">${err}</pre>`;
    }

    async onload() {
        await this.loadSettings();
        
        if (!fs.existsSync(this.tempDirPath)) {
            fs.mkdirSync(this.tempDirPath);
        }
        
        // Create `cache.json` if it doesn't exist
        if (!fs.existsSync(this.cachePath)) {
            fs.writeFileSync(this.cachePath, '{}', 'utf8');
        }

        // clean cache
        this.removeOldCacheItems(this.cacheLifeTime);

        // Register for markdown code
        this.registerMarkdownCodeBlockProcessor('tex', async (source, el, ctx) => {
           
            // loading indicator
            const loadingEl = el.createDiv();
            loadingEl.innerHTML = `<pre>Loading...</pre>`;

            // clean tex
            source = this.cleanTex(source);

            // check if it's in cache
            const cacheKey = this.generateCacheKey(source);
            const cacheItem = this.getCacheItem(cacheKey);
            if (cacheItem) {
                loadingEl.remove();
                this.createSvgElement(cacheItem.svg, el);
                // console.log('from cache');
                return;
            }

            // if it not in cache
            const fileName = 'tmp';
            const texFilePath = path.join(this.tempDirPath, `${fileName}.tex`);
            this.createTexFile(source, texFilePath);

            // tex -> pdf (using `pdflatex`)
            exec(`pdflatex -halt-on-error -output-directory=${this.tempDirPath} ${texFilePath}`, (error, stdout, stderr) => {
                // console.log('pdflatex started');
                if (error) {
                    console.error(`Error running latex: \n ${stdout}`);
                    loadingEl.innerHTML = this.errPreEl(`${stdout.match(/^.*LaTeX Error.*$/m)?.[0] || 'LaTeX Error'}\n(see console for full error message)`);
                    return;
                }

                // pdf -> svg (using `dvisvgm`).
                exec(`dvisvgm --pdf --scale=1.15 --translate=2,2 --exact-bbox -o ${path.join(this.tempDirPath, `${fileName}.svg`)} ${path.join(this.tempDirPath, `${fileName}.pdf`)}`, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Error running dvisvgm: ${stdout}`);
                        loadingEl.innerHTML = this.errPreEl(stdout);
                        return;
                    }
                    let svgContent = fs.readFileSync(path.join(this.tempDirPath, `${fileName}.svg`), 'utf8');
                    loadingEl.remove();
                    this.createSvgElement(svgContent, el);
                    // save to cache
                    this.saveCacheItem(cacheKey, svgContent);
                });
            });

        });

    }

    createSvgElement(svgContent: string, el: HTMLElement) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgContent, 'image/svg+xml');
        const svgEl = el.createDiv();
        svgEl.style.textAlign = 'center';
        svgEl.className = `tex-svg`;
        svgEl.appendChild(doc.documentElement);
    }

    onunload() {
        this.removeOldCacheItems(this.cacheLifeTime);
    }

    async loadSettings() {
        // this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        // await this.saveData(this.settings);
    }

    createTexFile(tikzSource: string, filePath: string) {
        const texContent = `\\documentclass{standalone}\n${tikzSource}`;
        fs.writeFileSync(filePath, texContent);
    }
}

/* class SampleModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.setText('Woah!');
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}
 */


/* class SampleSettingTab extends PluginSettingTab {
    plugin: MyPlugin;

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName('Setting #1')
            .setDesc('It\'s a secret')
            .addText(text => text
                .setPlaceholder('Enter your secret')
                .setValue(this.plugin.settings.mySetting)
                .onChange(async (value) => {
                    this.plugin.settings.mySetting = value;
                    await this.plugin.saveSettings();
                }));
    }
} */
