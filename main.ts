import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { TFile, WorkspaceLeaf, WorkspaceSidedock, normalizePath, type ViewState } from 'obsidian';

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

interface Adiel_TexPluginSettings {
    mySetting: string;
    invertColorsInDarkMode: boolean;
}

const DEFAULT_SETTINGS: Adiel_TexPluginSettings = {
    mySetting: 'default',
    invertColorsInDarkMode: false
}

export default class Adiel_TexPlugin extends Plugin {
    settings: Adiel_TexPluginSettings;

    async onload() {
        await this.loadSettings();
        this.registerMarkdownCodeBlockProcessor('tex', async (source, el, ctx) => {

            const pluginDirName = "obsidian-tex-plugin";

            //@ts-ignore
            const tempDir = this.app.vault.adapter.basePath + `\\.obsidian\\plugins\\${pluginDirName}\\tmp\\`
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir);
            }

            const fileName = 'tmp';
            const texFilePath = path.join(tempDir, `${fileName}.tex`);
            this.createTexFile(source, texFilePath);

            // tex -> pdf (using `pdflatex`)
            exec(`pdflatex -output-directory=${path.dirname(texFilePath)} ${texFilePath}`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error running latex: ${stderr}`);
                    return;
                }
                // pdf -> svg (using `dvisvgm`).
                exec(`dvisvgm --pdf --scale=1.15 --translate=2,2 --exact-bbox -o ${path.join(tempDir, `${fileName}.svg`)} ${path.join(tempDir, `${fileName}.pdf`)}`, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Error running dvisvgm: ${stderr}`);
                        return;
                    }
                    const svgEl = el.createDiv();
                    svgEl.style.textAlign = 'center';
                    svgEl.className = `tex-svg`;
                    let svgContent = fs.readFileSync(path.join(tempDir, `${fileName}.svg`), 'utf8');
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
                    svgEl.appendChild(doc.documentElement);
                });
            });

        });

    }

    onunload() {
        // Perform any necessary cleanup here
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    createTexFile(tikzSource: string, filePath: string) {
        const texContent = `${tikzSource}`;
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
