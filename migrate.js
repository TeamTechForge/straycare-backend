const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, 'src', 'controllers');

// The files we want to process
const filesToProcess = [
  'userController.ts',
  'searchController.ts',
  'rescueController.ts',
  'reportController.ts',
  'notificationController.ts',
  'nearbyController.ts',
  'forumController.ts',
  'commentController.ts',
  'chatController.ts',
  'adminAuthController.ts',
  'authController.ts'
];

// Helper to remove forwarding try/catch blocks
function processFile(filename) {
  const filePath = path.join(controllersDir, filename);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 1. Add catchAsync import if not present
  if (!content.includes('catchAsync')) {
    // find last import or require
    content = 'import { catchAsync } from "../utils/catchAsync";\nimport type { NextFunction } from "express";\n' + content;
  }

  // Use a regex to find all exports.* = async ... {
  // We'll replace the function signature and the outer try/catch
  
  let out = "";
  let i = 0;
  
  let modifiedFuncs = 0;
  let skippedFuncs = 0;

  while (i < content.length) {
    // Look for exported async functions
    const match = content.substring(i).match(/^(?:export const|exports\.)(\w+)\s*=\s*async\s*\(\s*req(?:\s*:\s*Request)?,\s*res(?:\s*:\s*Response)?(?:,\s*next(?:\s*:\s*NextFunction)?)?\s*\)(?:\s*:\s*Promise<void>)?\s*=>\s*\{/m);
    
    if (!match) {
      out += content.substring(i);
      break;
    }
    
    const funcStartIdx = i + match.index;
    const funcHeader = match[0];
    const funcName = match[1];
    const braceStartIdx = funcStartIdx + funcHeader.length - 1; // index of '{'
    
    out += content.substring(i, funcStartIdx);
    
    // Find the end of this function by matching braces
    let braceCount = 1;
    let j = braceStartIdx + 1;
    while (j < content.length && braceCount > 0) {
      if (content[j] === '{') braceCount++;
      if (content[j] === '}') braceCount--;
      j++;
    }
    const funcEndIdx = j;
    
    const funcBodyRaw = content.substring(braceStartIdx + 1, funcEndIdx - 1);
    
    // Now we check if the function body is completely wrapped in a try/catch
    // It should start with `try {` (ignoring whitespace) and end with `} catch (...) { ... }`
    const tryCatchMatch = funcBodyRaw.match(/^\s*try\s*\{([\s\S]*)\}\s*catch\s*\(([^)]+)\)\s*\{([\s\S]*)\}\s*$/);
    
    if (tryCatchMatch) {
      const tryBody = tryCatchMatch[1];
      const catchParam = tryCatchMatch[2];
      const catchBody = tryCatchMatch[3];
      
      // Check if catch body is just forwarding/logging and returning a 500 or next(error)
      if (catchBody.includes('res.status(500)') || catchBody.includes('res.status(400)') || catchBody.includes('res.status(') || catchBody.match(/next\s*\(\s*error\s*\)/) || catchBody.match(/next\s*\(\s*err\s*\)/)) {
        
        // Exclude if it has rollback/custom logic like findByIdAndDelete or next(new AppError)
        if (catchBody.includes('findByIdAndDelete') || catchBody.includes('new AppError')) {
           out += funcHeader + funcBodyRaw + '}';
           skippedFuncs++;
           continue;
        }

        // It's a forwarding error. We replace it!
        const newHeader = funcHeader.replace(/async\s*\(/, 'catchAsync(async (').replace(/=>\s*\{/, '=> {');
        const nextInjected = newHeader.includes('next:') ? newHeader : newHeader.replace(/req([^,]*),\s*res([^)]*)\)/, 'req$1, res$2, next: NextFunction)');
        
        out += nextInjected;
        out += tryBody;
        out += '});';
        modifiedFuncs++;
      } else {
        // It has genuine recovery logic
        out += funcHeader + funcBodyRaw + '}';
        skippedFuncs++;
      }
    } else {
      // Not wrapped in try/catch, just copy it over (might already be catchAsync or no try/catch)
      out += funcHeader + funcBodyRaw + '}';
    }
    
    i = funcEndIdx;
  }
  
  fs.writeFileSync(filePath, out, 'utf8');
  console.log(`Processed ${filename}: migrated ${modifiedFuncs} handlers, kept/skipped ${skippedFuncs}`);
}

filesToProcess.forEach(processFile);
