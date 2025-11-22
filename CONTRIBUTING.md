# Contributing

Thank you for your interest in contributing to the Kontent.ai Data-Ops Custom App!

## Development Setup

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Install the data-ops CLI tool:
```bash
npm install -g @kontent-ai/data-ops
```

4. Start the development server:
```bash
npm run dev
```

5. Open your browser to `http://localhost:3000`

## Building

To build the app for deployment:

```bash
npm run build
```

This will create a `dist/` directory with all the necessary files.

## Project Structure

- `index.html` - Main HTML file
- `styles.css` - Application styles
- `app-frontend.js` - Frontend application logic
- `server.js` - Backend server for executing data-ops commands
- `manifest.json` - Kontent.ai custom app manifest
- `package.json` - Node.js dependencies and scripts

## Testing

Make sure to test all commands with your Kontent.ai projects before deploying.

## Deployment

1. Build the app: `npm run build`
2. Zip the contents of the `dist/` directory
3. Upload to Kontent.ai as a custom app
4. Configure the app settings in Kontent.ai

## Issues and Pull Requests

Please open an issue for bugs or feature requests. Pull requests are welcome!
