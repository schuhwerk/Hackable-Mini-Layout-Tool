import { readFile, writeFile as fsWriteFile } from 'fs/promises'; // Removed readdir, stat
import path from 'path';
// Removed parseChordFile and generateDraggableItemHtml imports
import { serve } from 'bun';
// Removed cssContent import

// Helper to get content type based on file extension
function getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.html': return 'text/html';
        case '.css': return 'text/css';
        case '.js': return 'application/javascript';
        case '.json': return 'application/json';
        case '.png': return 'image/png';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.gif': return 'image/gif';
        case '.svg': return 'image/svg+xml';
        default: return 'application/octet-stream'; // Default binary type
    }
} // <-- Added missing closing brace

// Simplified HTML generation - no longer pre-renders items
async function generateBaseHtml(): Promise<string> {

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
</head>
<body>
    <div id="toast-container"></div>
    <div class="page-container" id="page-0">
        <!-- Items will be loaded here by client-side JS -->
    </div>
    <div class="page-container" id="page-1">
         <!-- Items will be loaded here by client-side JS -->
         &nbsp; <!-- Keep for visibility if empty -->
     </div>

    <script type="module" src="/dist/interactions.js" defer></script>
</body>
</html>
  `;
  return baseHtml;
}


const POSITIONS_FILE = 'user/settings.json'; // Rename positions file

console.log("Starting server on port 3001...");

const server = serve({
  port: 3001,
  async fetch(req, server) { // Add server argument
    const url = new URL(req.url);
    // Decode pathname to handle spaces or special characters in filenames
    const pathname = decodeURIComponent(url.pathname);

    // Upgrade to WebSocket if requested
    if (pathname === "/ws") {
      const success = server.upgrade(req);
      return success ? undefined : new Response("WebSocket upgrade error", { status: 400 });
    }

    // Serve base index.html
    if (req.method === 'GET' && pathname === '/') {
      try {
        const html = await generateBaseHtml(); // Use simplified generator
        return new Response(html, { headers: { 'Content-Type': 'text/html' } });
      } catch (error: any) {
        console.error("Error generating base HTML:", error);
        return new Response("Internal Server Error generating HTML", { status: 500 });
      }
    }
    // Save positions
    else if (req.method === 'POST' && pathname === '/save-positions') {
      try {
        const positions = await req.json();
        await fsWriteFile(POSITIONS_FILE, JSON.stringify(positions, null, 2)); // Use fsWriteFile alias
        console.log(`Positions saved to ${POSITIONS_FILE}`);
        return new Response("Positions saved successfully", { status: 200 });
      } catch (error: any) { // Added type annotation
        console.error("Error saving positions:", error);
        return new Response("Error saving positions", { status: 500 });
      }
    }
    // Load positions
    else if (req.method === 'GET' && pathname === '/load-positions') {
       try {
         const positionsData = await readFile(POSITIONS_FILE, 'utf-8');
         return new Response(positionsData, { headers: { 'Content-Type': 'application/json' } });
       } catch (error: any) { // Added type annotation
         if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
           console.log(`${POSITIONS_FILE} not found. Sending 404.`);
           return new Response(JSON.stringify({}), { status: 404, headers: { 'Content-Type': 'application/json' } });
         }
         console.error("Error loading positions:", error);
         return new Response("Error loading positions", { status: 500 });
        }
    }
    // Handle file uploads via POST to /user
    else if (req.method === 'POST' && pathname === '/user') {
        try {
            const formData = await req.formData();
            const file = formData.get('file') as File | null; // Type assertion

            if (!file) {
                return new Response("No file uploaded", { status: 400 });
            }

            // Basic security: Sanitize filename (consider more robust validation)
            // Use path.basename to prevent path traversal, but keep original filename.
            const safeFilename = path.basename(file.name);
            const uploadPath = path.join(process.cwd(), 'user', safeFilename);

            // Security check: Ensure upload path is within 'user'
            const userDir = path.join(process.cwd(), 'user'); // Renamed for clarity
            const resolvedUploadPath = path.resolve(uploadPath);
            if (!resolvedUploadPath.startsWith(userDir + path.sep)) { // Use userDir
                 console.warn(`Attempted upload outside user directory: ${safeFilename}`);
                 return new Response("Forbidden upload path", { status: 403 });
            }

            // Write the file using Bun's optimized function or fs/promises
            await fsWriteFile(uploadPath, Buffer.from(await file.arrayBuffer())); // Use fsWriteFile alias

            console.log(`File uploaded successfully: ${safeFilename}`);
            // Respond with the path or filename, useful for client-side updates
            return new Response(JSON.stringify({ success: true, filename: safeFilename, path: `/user/${safeFilename}` }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error: any) {
            console.error("Error handling file upload:", error);
            return new Response("Error uploading file", { status: 500 });
        }
    }
    // Handle file deletion
    else if (req.method === 'POST' && pathname === '/delete-file') {
      try {
        const { filepath } = await req.json();
        if (!filepath || typeof filepath !== 'string') {
          return new Response("Invalid filepath provided for deletion.", { status: 400 });
        }

        // Security: Ensure the path is within the 'user' directory and doesn't try to escape.
        const userDir = path.join(process.cwd(), 'user');
        const fullPath = path.join(process.cwd(), filepath); // Assuming filepath is like /user/filename.txt
        const resolvedPath = path.resolve(fullPath);

        if (!resolvedPath.startsWith(userDir + path.sep)) {
          console.warn(`Attempt to delete file outside user directory: ${filepath}`);
          return new Response("Forbidden: Cannot delete files outside the user directory.", { status: 403 });
        }

        await Bun.file(resolvedPath).unlink(); // Bun's way to delete a file
        console.log(`File deleted: ${resolvedPath}`);
        return new Response("File deleted successfully", { status: 200 });

      } catch (error: any) {
        console.error("Error deleting file:", error);
        if (error.code === 'ENOENT') {
          return new Response("File not found for deletion.", { status: 404 });
        }
        return new Response("Error deleting file", { status: 500 });
      }
    }
    // Generic static file serving (CSS, JS, images, etc.)
    else if (req.method === 'GET' && (pathname.startsWith('/src/') || pathname.startsWith('/dist/') || pathname.startsWith('/user/'))) {
        try {
            const relativePath = pathname.substring(1); // Remove leading '/'
            const filePath = path.join(process.cwd(), relativePath);
            const resolvedPath = path.resolve(filePath);

            // Security check: Ensure the resolved path is within the project directory and doesn't use '..' to escape.
            // This is a simplified check. For more robust security, you might want to ensure it's specifically
            // within 'src', 'dist', or 'static' subdirectories.
            if (!resolvedPath.startsWith(process.cwd() + path.sep) || resolvedPath.includes(path.sep + '..' + path.sep) || resolvedPath.endsWith(path.sep + '..')) {
                console.warn(`Attempted access to potentially unsafe path: ${pathname}`);
                return new Response("Forbidden", { status: 403 });
            }

            const fileData = await readFile(resolvedPath);
            const contentType = getContentType(resolvedPath);
            return new Response(fileData, { headers: { 'Content-Type': contentType } });
        } catch (error: any) {
            console.error(`Error serving static file ${pathname}:`, error);
            if (error?.code === 'ENOENT') {
                return new Response("File Not Found", { status: 404 });
            }
            return new Response("Internal Server Error serving file", { status: 500 });
        }
    }

    // Default 404
    console.log(`Not Found: ${req.method} ${pathname}`);
    return new Response("Not Found", { status: 404 });
  },
  websocket: { // WebSocket handler
    open(ws) {
      console.log("WebSocket client connected, sending reload command.");
      ws.send("reload"); // Send reload immediately on connection
    },
    message(ws, message) {
      // Handle messages from client if needed
    },
    close(ws, code, message) {
      console.log("WebSocket client disconnected");
    },
  },
});

console.log(`Server listening on http://localhost:${server.port}`);

// Keep the process alive (optional, Bun might handle this)
// setInterval(() => {}, 1 << 30); // Example: Keep alive with an empty interval
