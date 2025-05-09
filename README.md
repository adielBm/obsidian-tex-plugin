An [Obsidian.md](https://obsidian.md/) plugin to compile TeX to SVG (using MikTeX (pdflatex) & dvisvgm)

I started making this plugin (hopefully I'll manage to make it usful for others) because I wanted to use some package that are not included in the [obsidian-tikzjax](https://github.com/artisticat1/obsidian-tikzjax) plugin.

> [!WARNING]
> - This is an **early** version of the plugin; it may not work as expected. 
> - You may need additional customization to make it work on your machine.
> - Desktop only.

# Prerequisites

- [MikTeX](https://miktex.org/download) (for compiling TeX to PDF using `pdflatex`)
- pdf to svg:
    - (for windows) [dvisvgm](https://dvisvgm.de/Downloads/) 
    - (for mac) https://github.com/dawbarton/pdf2svg (maybe in future it can use in https://github.com/jalios/pdf2svg-windows)
- Relevant packages have to be installed in MikTeX

# Installation

Currently, the plugin is not available in the Obsidian community plugins. 

You can clone the repository and build the plugin yourself, using `npm run build` and copying `main.js`, `styles.css`, and `manifest.json` to `YOUR_VAULT/.obsidian/plugins/obsidian-tex-plugin/`.

# Usage

- Use a code block with the `tex` language identifier
- _Don't_ add `\documentclass` (it's added automatically, with the `standalone` class)
- Add packages using `\usepackage` (no packages are included by default, not even `tikz` as it is in [obsidian-tikzjax](https://github.com/artisticat1/obsidian-tikzjax)).
- Add `\begin{document}` and `\end{document}`

# Example

![screenshot](screenshot.png)

```tex
\usepackage{chemfig}
\begin{document}
\chemfig{C(-[:0]H)(-[:90]H)(-[:180]H)(-[:270]H)}
\end{document}
```

# TODO 

- [x] add indicator for processing
- [x] dark mode support (using `filter: invert(1) hue-rotate(180deg);`)
- [x] show errors
- [ ] add settings (like: default packages, max age of cache)
- [ ] fix bugs   
- [ ] and more...
