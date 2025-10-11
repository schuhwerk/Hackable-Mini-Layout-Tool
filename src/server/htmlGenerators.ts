import { readFile } from 'fs/promises';
import { POSITIONS_FILE } from './utils';

// Generate setup UI when settings.json doesn't exist or is incomplete
export async function generateSetupHtml(): Promise<string> {
  const setupHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Setup - Song Chords</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@400&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Comfortaa', cursive;
            background-color: #f5f5f5;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
        }
        .setup-container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            max-width: 500px;
            width: 100%;
        }
        h1 {
            margin-top: 0;
            color: #2e281e;
            font-size: 24px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            color: #2e281e;
            font-weight: 500;
        }
        input {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-family: 'Comfortaa', cursive;
            font-size: 14px;
            box-sizing: border-box;
        }
        input:focus {
            outline: none;
            border-color: #007bff;
        }
        button {
            width: 100%;
            padding: 12px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            font-family: 'Comfortaa', cursive;
            font-size: 16px;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        button:hover {
            background-color: #0056b3;
        }
        .help-text {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="setup-container">
        <h1>Welcome! Let's set up your workspace</h1>
        <form id="setup-form">
            <div class="form-group">
                <label for="pageCount">Number of Pages</label>
                <input type="number" id="pageCount" name="pageCount" value="2" min="1" max="10" required>
                <div class="help-text">How many pages do you want to work with?</div>
            </div>
            <div class="form-group">
                <label for="pageWidth">Page Width (cm)</label>
                <input type="number" id="pageWidth" name="pageWidth" value="14.8" step="0.1" min="1" required>
                <div class="help-text">Default is A5 width (14.8 cm)</div>
            </div>
            <div class="form-group">
                <label for="pageHeight">Page Height (cm)</label>
                <input type="number" id="pageHeight" name="pageHeight" value="21" step="0.1" min="1" required>
                <div class="help-text">Default is A5 height (21 cm)</div>
            </div>
            <div class="form-group">
                <label for="baseDir">Base Directory for Files</label>
                <input type="text" id="baseDir" name="baseDir" value="user" required>
                <div class="help-text">Directory where your files will be stored</div>
            </div>
            <button type="submit">Create Settings & Start</button>
        </form>
    </div>
    <script>
        document.getElementById('setup-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const settings = {
                pageCount: parseInt(formData.get('pageCount')),
                pageWidth: parseFloat(formData.get('pageWidth')),
                pageHeight: parseFloat(formData.get('pageHeight')),
                baseDir: formData.get('baseDir'),
                objects: []
            };
            
            try {
                const response = await fetch('/initialize-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(settings)
                });
                
                if (response.ok) {
                    window.location.reload();
                } else {
                    alert('Failed to create settings. Please try again.');
                }
            } catch (error) {
                console.error('Error creating settings:', error);
                alert('Error creating settings. Please try again.');
            }
        });
    </script>
</body>
</html>
  `;
  return setupHtml;
}

// Simplified HTML generation - no longer pre-renders items
export async function generateBaseHtml(): Promise<string> {
  // Load settings to get page configuration
  const data = await readFile(POSITIONS_FILE, 'utf-8');
  const settings = JSON.parse(data);
  const { pageCount, pageWidth, pageHeight } = settings;

  // Generate page containers based on pageCount
  let pagesHtml = '';
  for (let i = 0; i < pageCount; i++) {
    pagesHtml += `    <div class="page-container" id="page-${i}">
        <!-- Items will be loaded here by client-side JS -->
        ${i === 0 ? '' : '&nbsp; <!-- Keep for visibility if empty -->'}
    </div>\n`;
  }

  const baseHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Song Chords</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@400&display=swap" rel="stylesheet">
    <link href="/src/base-style.css" rel="stylesheet" type="text/css">
    <link href="/src/extra-style.css" rel="stylesheet" type="text/css">
    <style>
        /* Dynamic page dimensions from settings */
        .page-container {
            width: ${pageWidth}cm;
            height: ${pageHeight}cm;
        }
    </style>
</head>
<body>
    <div id="toast-container hide-on-print"></div>
${pagesHtml}
    <script type="module" src="/dist/interactions.js" defer></script>
</body>
</html>
  `;
  return baseHtml;
}
