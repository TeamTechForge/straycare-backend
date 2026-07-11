const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, '../src/models');
const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.ts'));

files.forEach(file => {
  const filePath = path.join(modelsDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  const target1 = 'const mongoose = require("mongoose");';
  const target2 = "const mongoose = require('mongoose');";
  const replacement = 'import mongoose from "mongoose";';
  
  if (content.includes(target1)) {
    content = content.replace(target1, replacement);
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  } else if (content.includes(target2)) {
    content = content.replace(target2, replacement);
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
});
