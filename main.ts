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
        try {
            await this.loadSettings();
        
            if (!fs.existsSync(this.tempDirPath)) fs.mkdirSync(this.tempDirPath);
            if (!fs.existsSync(this.cachePath)) fs.writeFileSync(this.cachePath, '{}', 'utf8');
            this.removeOldCacheItems(this.cacheLifeTime);
        
            this.registerMarkdownCodeBlockProcessor('tex', async (source, el) => {
                const loadingEl = el.createDiv();
                loadingEl.innerHTML = `<pre>Loading...</pre>`;
                source = this.cleanTex(source);
                const cacheKey = this.generateCacheKey(source);
                const cacheItem = this.getCacheItem(cacheKey);
        
                if (cacheItem) {
                    loadingEl.remove();
                    this.createSvgElement(cacheItem.svg, el);
                    return;
                }
        
                const fileName = 'tmp';
                const texFilePath = path.join(this.tempDirPath, `${fileName}.tex`);
                this.createTexFile(source, texFilePath);
    
                const platform = process.platform;
                if (platform === 'darwin') {
                    const pdflatexPath = '/Library/TeX/texbin/pdflatex';
                    exec(`${pdflatexPath} -halt-on-error -output-directory=${this.tempDirPath} ${texFilePath}`, (error, stdout, stderr) => {
                        if (error) return loadingEl.innerHTML = this.errPreEl(`${stdout.match(/^.*LaTeX Error.*$/m)?.[0] || 'LaTeX Error'}`);
                        const pdfPath = path.join(this.tempDirPath, `${fileName}.pdf`);
                        const svgPath = path.join(this.tempDirPath, `${fileName}.svg`);
                        const pdf2svgPath = '/opt/homebrew/bin/pdf2svg';
                        exec(`${pdf2svgPath} ${pdfPath} ${svgPath}`, (error, stdout, stderr) => {
                            if (error) return loadingEl.innerHTML = this.errPreEl(stdout);
                            const svgContent = fs.readFileSync(svgPath, 'utf8');
                            loadingEl.remove();
                            this.createSvgElement(svgContent, el)
                            this.saveCacheItem(cacheKey, svgContent);
                        });
                    });
                } else if (platform === 'win32') {
                    exec(`pdflatex -halt-on-error -output-directory=${this.tempDirPath} ${texFilePath}`, (error, stdout, stderr) => {
                        if (error) return loadingEl.innerHTML = this.errPreEl(`${stdout.match(/^.*LaTeX Error.*$/m)?.[0] || 'LaTeX Error'}`);
                        exec(`dvisvgm --pdf --translate=2,2 --exact-bbox -o ${path.join(this.tempDirPath, `${fileName}.svg`)} ${path.join(this.tempDirPath, `${fileName}.pdf`)}`, (error, stdout, stderr) => {
                            if (error) return loadingEl.innerHTML = this.errPreEl(stdout);
                            const svgContent = fs.readFileSync(path.join(this.tempDirPath, `${fileName}.svg`), 'utf8');
                            loadingEl.remove();
                            this.createSvgElement(svgContent, el)
                            this.saveCacheItem(cacheKey, svgContent);
                        });
                    });
                }
            });
        } catch (err) {
            console.error("Error loading settings or processing:", err);
        }
    }
    
    createSvgElement(svgContent: string, el: HTMLElement) {
        const scale = 1.6;
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgContent, 'image/svg+xml');
        const svgEl = el.createDiv();
        svgEl.className = `tex-svg`; 

        const svg = doc.documentElement;
        const width = parseFloat(svg.getAttribute('width') || '0');
        const height = parseFloat(svg.getAttribute('height') || '0');
        // Apply the scale transform and set height/width
        // svg.setAttribute('style', `transform: scale(${scale});`);
        svg.setAttribute('width', `${width * scale}`);
        svg.setAttribute('height', `${height * scale}`);
        // Append the SVG
        svgEl.appendChild(svg);
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
        if (!tikzSource.trim().startsWith('\\documentclass')) {
            tikzSource = `\\documentclass{standalone}\n${tikzSource}`;
        }
        fs.writeFileSync(filePath, tikzSource);
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
