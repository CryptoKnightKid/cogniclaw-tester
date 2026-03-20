#!/usr/bin/env node
/**
 * File Watcher Agent
 * Auto-ingests files dropped in ./inbox/ and converts to structured memory
 * Inspired by Google Always-On Memory Agent
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const INBOX_DIR = path.join(process.env.OPENCLAW_WORKSPACE || '/home/ubuntu/.openclaw/workspace', 'inbox');
const MEMORY_DIR = path.join(process.env.OPENCLAW_WORKSPACE || '/home/ubuntu/.openclaw/workspace', 'memory', 'ingested');
const PROCESSED_DIR = path.join(INBOX_DIR, '.processed');

// Ensure directories exist
[INBOX_DIR, MEMORY_DIR, PROCESSED_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const SUPPORTED_EXTENSIONS = {
  text: ['.txt', '.md', '.json', '.csv', '.log', '.xml', '.yaml', '.yml'],
  image: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'],
  document: ['.pdf']
};

function getFileType(ext) {
  for (const [type, exts] of Object.entries(SUPPORTED_EXTENSIONS)) {
    if (exts.includes(ext.toLowerCase())) return type;
  }
  return null;
}

function generateMemoryId() {
  return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function writeStructuredMemory(content, metadata) {
  const id = generateMemoryId();
  const timestamp = new Date().toISOString();
  const filename = `${id}.md`;
  const filepath = path.join(MEMORY_DIR, filename);
  
  const frontmatter = `---
id: ${id}
date: ${timestamp}
source: ${metadata.source}
source_type: ${metadata.sourceType}
file_type: ${metadata.fileType}
confidence: ${metadata.confidence}
tags: [${metadata.tags.map(t => `"${t}"`).join(', ')}]
---

# ${metadata.title}

**Original file:** ${metadata.originalFilename}

## Content

${content}

## Metadata
- **Ingested:** ${timestamp}
- **Type:** ${metadata.fileType}
- **Tags:** ${metadata.tags.join(', ')}
`;

  fs.writeFileSync(filepath, frontmatter);
  return { id, filepath };
}

function extractTextContent(filePath, fileType) {
  const ext = path.extname(filePath).toLowerCase();
  
  if (fileType === 'text') {
    return fs.readFileSync(filePath, 'utf8');
  }
  
  if (fileType === 'image') {
    // For images, we note that visual content was ingested
    // In a full implementation, this would use vision API
    return `[Image file ingested: ${path.basename(filePath)}]
[Visual content available for query]`;
  }
  
  if (ext === '.pdf') {
    // Try to extract text using pdftotext if available
    try {
      const text = execSync(`pdftotext -q "${filePath}" -`, { encoding: 'utf8', timeout: 30000 });
      return text;
    } catch {
      return `[PDF ingested: ${path.basename(filePath)}]
[Text extraction limited - PDF content stored]`;
    }
  }
  
  return `[File ingested: ${path.basename(filePath)}]
[Content type: ${fileType}]`;
}

function processFile(filePath) {
  const filename = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const fileType = getFileType(ext);
  
  if (!fileType) {
    console.log(`[SKIP] Unsupported file type: ${filename}`);
    return null;
  }
  
  console.log(`[INGEST] Processing: ${filename}`);
  
  try {
    const content = extractTextContent(filePath, fileType);
    
    const metadata = {
      source: 'inbox_watcher',
      sourceType: 'file_drop',
      fileType: fileType,
      originalFilename: filename,
      title: path.basename(filename, ext),
      confidence: 0.9,
      tags: ['auto_ingested', fileType, 'inbox']
    };
    
    const result = writeStructuredMemory(content, metadata);
    
    // Move to processed folder
    const processedPath = path.join(PROCESSED_DIR, `${Date.now()}_${filename}`);
    fs.renameSync(filePath, processedPath);
    
    console.log(`[SUCCESS] Saved to: ${result.filepath}`);
    return result;
    
  } catch (err) {
    console.error(`[ERROR] Failed to process ${filename}:`, err.message);
    return null;
  }
}

function watchInbox() {
  console.log(`[WATCHER] Monitoring: ${INBOX_DIR}`);
  console.log('[WATCHER] Drop files here to auto-ingest into memory');
  console.log('[WATCHER] Press Ctrl+C to stop\n');
  
  // Process existing files
  const existingFiles = fs.readdirSync(INBOX_DIR)
    .filter(f => !f.startsWith('.'))
    .map(f => path.join(INBOX_DIR, f));
    
  for (const file of existingFiles) {
    if (fs.statSync(file).isFile()) {
      processFile(file);
    }
  }
  
  // Watch for new files
  fs.watch(INBOX_DIR, (eventType, filename) => {
    if (!filename || filename.startsWith('.')) return;
    
    const filePath = path.join(INBOX_DIR, filename);
    
    // Small delay to ensure file is fully written
    setTimeout(() => {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        processFile(filePath);
      }
    }, 500);
  });
}

// Run if called directly
if (require.main === module) {
  watchInbox();
}

module.exports = { watchInbox, processFile };
