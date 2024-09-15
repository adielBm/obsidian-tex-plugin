# TeX Plugin for Obsidian

An [obsidian.md](https://obsidian.md/) plugin to compile TeX to svg (u/ MikTeX (pdflatex) & dvisvgm)

i start making this plugin (hopefully i'll manage to finish it) because i wanted some package that are not included in [obsidian-tikzjax](https://github.com/artisticat1/obsidian-tikzjax) plugin.

> [!WARNING]
> - This is an **early** version of the plugin, it may not work as expected. 
> - The plugin is tested on Windows, probably will not work on other platforms.
> - you may need more customization to make it work on your machine.
> - desktop only.

# Prerequisites

- [MikTeX](https://miktex.org/download) (for compiling tex to pdf using `pdflatex`)
- [dvisvgm](https://dvisvgm.de/Downloads/) (for converting pdf to svg, `dvisvgm`)
- relevant packages for the TeX code you want to compile

# Installation

currently, the plugin is not available in the obsidian community plugins. you can clone the repository and build the plugin yourself.

# Usage

- code block with `tex`
- include `\documentclass` in the beginning

![alt text](image.png)

# TODO 

- [ ] add indicator for the processing
- [ ] better dark mode support
- [ ] a lot of things