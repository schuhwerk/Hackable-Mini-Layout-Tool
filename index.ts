import { readFile, writeFile as fsWriteFile } from 'fs/promises';
import path from 'path';
import { serve } from 'bun';
import { 
  ensureUserDirectory, 
  getContentType, 
  hasValidSettings, 
  POSITIONS_FILE 
} from './src/server/utils';
import { generateSetupHtml, generateBaseHtml } from './src/server/htmlGenerators';

// Ensure user directory exists on startup
ensureUserDirectory();

console.log("Starting server on port 3001...");

const server = serve({
  port: 3001,
  async fetch(req, server) {
    const url = new URL(req.url);
    // Decode pathname to handle spaces or special characters in filenames
    const pathname = decodeURIComponent(url.pathname);

    // Upgrade to WebSocket if requested
    if (pathname === "/ws") {
      const success = server.upgrade(req);
      return success ? undefined : new Response("WebSocket upgrade error", { status: 400 });
    }

    // Serve base index.html or setup page
    if (req.method === 'GET' && pathname === '/') {
      try {
        const hasValid = await hasValidSettings();
        const html = hasValid ? await generateBaseHtml() : await generateSetupHtml();
        return new Response(html, { headers: { 'Content-Type': 'text/html' } });
      } catch (error: any) {
        console.error("Error generating base HTML:", error);
        return new Response("Internal Server Error generating HTML", { status: 500 });
      }
    }
    // Initialize settings
    else if (req.method === 'POST' && pathname === '/initialize-settings') {
      try {
        const settings = await req.json();
        await fsWriteFile(POSITIONS_FILE, JSON.stringify(settings, null, 2));
        console.log(`Settings initialized in ${POSITIONS_FILE}`);
        return new Response("Settings created successfully", { status: 200 });
      } catch (error: any) {
        console.error("Error initializing settings:", error);
        return new Response("Error initializing settings", { status: 500 });
      }
    }
    // Save positions
    else if (req.method === 'POST' && pathname === '/save-positions') {
      try {
        const positions = await req.json();
        
        // Read existing settings to preserve page configuration
        let existingSettings: any = {};
        try {
          const existingData = await readFile(POSITIONS_FILE, 'utf-8');
          existingSettings = JSON.parse(existingData);
        } catch (error) {
          // File doesn't exist or is invalid, use defaults
          console.log("No existing settings found, using defaults");
        }
        
        // Merge: Keep page configuration, update objects
        const mergedSettings = {
          pageCount: existingSettings.pageCount || 2,
          pageWidth: existingSettings.pageWidth || 14.8,
          pageHeight: existingSettings.pageHeight || 21,
          baseDir: existingSettings.baseDir || 'user',
          objects: positions.objects || []
        };
        
        await fsWriteFile(POSITIONS_FILE, JSON.stringify(mergedSettings, null, 2));
        console.log(`Positions saved to ${POSITIONS_FILE}`);
        return new Response("Positions saved successfully", { status: 200 });
      } catch (error: any) {
        console.error("Error saving positions:", error);
        return new Response("Error saving positions", { status: 500 });
      }
    }
    // Load positions
    else if (req.method === 'GET' && pathname === '/load-positions') {
       try {
         const positionsData = await readFile(POSITIONS_FILE, 'utf-8');
         return new Response(positionsData, { headers: { 'Content-Type': 'application/json' } });
       } catch (error: any) {
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
            const file = formData.get('file') as File | null;

            if (!file) {
                return new Response("No file uploaded", { status: 400 });
            }

            // Basic security: Sanitize filename (consider more robust validation)
            const safeFilename = path.basename(file.name);
            const uploadPath = path.join(process.cwd(), 'user', safeFilename);

            // Security check: Ensure upload path is within 'user'
            const userDir = path.join(process.cwd(), 'user');
            const resolvedUploadPath = path.resolve(uploadPath);
            if (!resolvedUploadPath.startsWith(userDir + path.sep)) {
                 console.warn(`Attempted upload outside user directory: ${safeFilename}`);
                 return new Response("Forbidden upload path", { status: 403 });
            }

            // Write the file using Bun's optimized function or fs/promises
            await fsWriteFile(uploadPath, Buffer.from(await file.arrayBuffer()));

            console.log(`File uploaded successfully: ${safeFilename}`);
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
        const fullPath = path.join(process.cwd(), filepath);
        const resolvedPath = path.resolve(fullPath);

        if (!resolvedPath.startsWith(userDir + path.sep)) {
          console.warn(`Attempt to delete file outside user directory: ${filepath}`);
          return new Response("Forbidden: Cannot delete files outside the user directory.", { status: 403 });
        }

        await Bun.file(resolvedPath).unlink();
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

            // Security check: Ensure the resolved path is within the project directory
            if (!resolvedPath.startsWith(process.cwd() + path.sep) || resolvedPath.includes(path.sep + '..' + path.sep) || resolvedPath.endsWith(path.sep + '..')) {
                console.warn(`Attempted access to potentially unsafe path: ${pathname}`);
                return new Response("Forbidden", { status: 403 });
            }

            const fileData = await readFile(resolvedPath);
            const contentType = getContentType(resolvedPath);
            return new Response(new Uint8Array(fileData), { headers: { 'Content-Type': contentType } });
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
  websocket: {
    open(ws) {
      console.log("WebSocket client connected, sending reload command.");
      ws.send("reload");
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
