const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    let filePath = req.url.split('?')[0];
    
    if (filePath === '/') {
        filePath = '/index.html';
    }
    
    filePath = path.join(__dirname, 'front', filePath);
    
    const ext = path.extname(filePath);
    let contentType = 'text/html';
    
    switch (ext) {
        case '.css':
            contentType = 'text/css';
            break;
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.png':
            contentType = 'image/png';
            break;
        case '.jpg':
        case '.jpeg':
            contentType = 'image/jpeg';
            break;
    }
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            console.error(`File not found: ${filePath}`);
            res.writeHead(404);
            res.end('File not found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(3000, () => {
    console.log('Сервер запущен на http://localhost:3000');
    console.log('Ищет файлы в папке:', path.join(__dirname, 'front'));
});