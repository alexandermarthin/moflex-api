# Figma Export

Export Figma projects to JSON with images.

## Setup

1. Install dependencies:

    ```bash
    npm install
    ```

2. Get a Figma Personal Access Token:

    - Go to [Figma Developer Settings](https://www.figma.com/developers/api#access-tokens)
    - Click "Create new token"
    - Copy the token

3. Create a `.env` file:
    ```bash
    cp .env.example .env
    ```
    Then edit `.env` and paste your token.

## Usage

```bash
# Basic export (includes image fills)
node export.js https://www.figma.com/file/ABC123/MyDesign

# Export with top-level frames as PNG
node export.js ABC123 --export-frames

# Skip image downloads (JSON only)
node export.js ABC123 --skip-images
```

## Options

| Option            | Description                           |
| ----------------- | ------------------------------------- |
| `--skip-images`   | Skip downloading all images           |
| `--export-frames` | Export top-level frames as PNG images |

## Output Structure

```
output/
└── ProjectName/
    ├── project.json      # Full document data
    └── images/
        ├── fill_xxx.png  # Image fills (backgrounds, textures)
        └── frame_xxx.png # Exported frames (with --export-frames)
```

## What's Exported

### JSON Data

-   Full document tree with all nodes, frames, components
-   Image fill references (with local paths)
-   Styles (colors, text styles, effects)
-   Metadata (export time, file key, etc.)

### Images

-   **Image fills**: All images used as backgrounds or fills in shapes
-   **Frame exports**: Top-level frames rendered as PNG (2x scale)

## API Reference

This script uses the [Figma REST API](https://www.figma.com/developers/api):

-   `GET /v1/files/:key` - Get file data
-   `GET /v1/files/:key/images` - Get image fills
-   `GET /v1/files/:key/styles` - Get styles
-   `GET /v1/images/:key` - Render nodes as images
