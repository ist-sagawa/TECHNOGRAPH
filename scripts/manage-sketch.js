import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Command: create, update, or delete
const command = process.argv[2];
const args = process.argv.slice(3);

if (command !== 'create' && command !== 'update' && command !== 'delete') {
  console.error('Usage: node manage-sketch.js [create|update|delete] [args...]');
  process.exit(1);
}

// Helper to check if string is YYMMDD
const isDate = (str) => /^\d{6}$/.test(str);

const rootDir = path.resolve(__dirname, '..');

if (command === 'create') {
  // === CREATE MODE ===
  // Usage: npm run new [title] OR npm run new [date] [title]

  let dateStr = '';
  let titleStr = '';

  if (args.length > 0) {
    if (isDate(args[0])) {
      dateStr = args[0];
      if (args[1]) {
        titleStr = args[1];
      }
    } else {
      // First arg is not a date, assume it's a title and use today's date
      titleStr = args[0];
    }
  }

  // If no date determined yet, use today
  if (!dateStr) {
    const now = new Date();
    const year = now.getFullYear().toString().slice(2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    dateStr = `${year}${month}${day}`;
  }

  const srcDir = path.join(rootDir, 'src', 'pages', dateStr);
  const publicDir = path.join(rootDir, 'public', dateStr);

  if (fs.existsSync(srcDir)) {
    console.error(`Error: Directory ${srcDir} already exists.`);
    console.error(`To update an existing sketch, use: npm run change ${dateStr} ...`);
    process.exit(1);
  }

  const fullTitle = titleStr ? `${dateStr}_${titleStr}` : `${dateStr}_Sketch`;

  fs.mkdirSync(srcDir, { recursive: true });

  if (fs.existsSync(publicDir)) {
    console.log(`Directory ${publicDir} already exists. Using existing assets.`);
  } else {
    fs.mkdirSync(publicDir, { recursive: true });

    // Create style.css (Minimal, as common styles are in sketch.scss)
    const cssContent = `/* Local style overrides */
canvas {
  display: block;
}`;
    fs.writeFileSync(path.join(publicDir, 'style.css'), cssContent);

    // Create script.js
    const jsContent = `function setup() {
  createCanvas(windowWidth, windowHeight);
}

function draw() {
  background(0);
  fill(255);
  circle(mouseX, mouseY, 50);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}`;
    fs.writeFileSync(path.join(publicDir, 'script.js'), jsContent);
  }

  // Create index.astro using template
  const templatePath = path.join(__dirname, 'templates', 'sketch.astro');
  let astroContent = fs.readFileSync(templatePath, 'utf8');
  astroContent = astroContent.replace('{{title}}', fullTitle).replace('{{date}}', dateStr);

  fs.writeFileSync(path.join(srcDir, 'index.astro'), astroContent);

  console.log(`Successfully created sketch for ${dateStr}`);
  console.log(`- ${srcDir}/index.astro`);
  if (!fs.existsSync(publicDir)) {
    console.log(`- ${publicDir}/style.css`);
    console.log(`- ${publicDir}/script.js`);
  }

} else if (command === 'update') {
  // === UPDATE MODE ===
  // Usage: 
  // 1. Update Title: npm run change [date] [newTitle]
  // 2. Rename Date: npm run change [oldDate] [newDate]
  // 3. Rename Date & Title: npm run change [oldDate] [newDate] [newTitle]

  if (args.length < 2) {
    console.error('Usage: npm run change [date] [newTitle] OR npm run change [oldDate] [newDate] [newTitle]');
    process.exit(1);
  }

  const firstArg = args[0];
  const secondArg = args[1];
  const thirdArg = args[2];

  if (!isDate(firstArg)) {
    console.error('Error: First argument must be a valid date (YYMMDD).');
    process.exit(1);
  }

  const oldDateStr = firstArg;
  const srcDir = path.join(rootDir, 'src', 'pages', oldDateStr);
  const publicDir = path.join(rootDir, 'public', oldDateStr);

  if (!fs.existsSync(srcDir)) {
    console.error(`Error: Directory ${srcDir} does not exist.`);
    process.exit(1);
  }

  if (isDate(secondArg)) {
    // === RENAME DATE MODE ===
    const newDateStr = secondArg;
    const newTitleArg = thirdArg; // Optional

    const newSrcDir = path.join(rootDir, 'src', 'pages', newDateStr);
    const newPublicDir = path.join(rootDir, 'public', newDateStr);

    if (fs.existsSync(newSrcDir)) {
      console.error(`Error: Destination directory ${newSrcDir} already exists.`);
      process.exit(1);
    }

    console.log(`Renaming sketch from ${oldDateStr} to ${newDateStr}...`);

    // Rename src directory
    fs.renameSync(srcDir, newSrcDir);
    console.log(`- Renamed src/pages/${oldDateStr} to src/pages/${newDateStr}`);

    // Rename public directory if it exists
    if (fs.existsSync(publicDir)) {
      if (fs.existsSync(newPublicDir)) {
        console.error(`Error: Destination public directory ${newPublicDir} already exists.`);
        process.exit(1);
      }
      fs.renameSync(publicDir, newPublicDir);
      console.log(`- Renamed public/${oldDateStr} to public/${newDateStr}`);
    }

    // Update index.astro content
    const indexPath = path.join(newSrcDir, 'index.astro');
    if (fs.existsSync(indexPath)) {
      let content = fs.readFileSync(indexPath, 'utf8');

      // Update CSS/JS paths (in Astro template logic)
      // We look for `/${oldDateStr}/` in the content
      const dateRegex = new RegExp(`/${oldDateStr}/`, 'g');
      content = content.replace(dateRegex, `/${newDateStr}/`);

      // Update date variable
      content = content.replace(`const date = "${oldDateStr}";`, `const date = "${newDateStr}";`);

      if (newTitleArg) {
        // Update Title variable
        const newFullTitle = `${newDateStr}_${newTitleArg}`;
        content = content.replace(/const title = ".*";/, `const title = "${newFullTitle}";`);
        console.log(`- Updated title to: ${newFullTitle}`);
      } else {
        // Update Date prefix in title if it exists
        // We look for `const title = "oldDate_...`
        const oldDateTitleRegex = new RegExp(`const title = "${oldDateStr}`, 'g');
        content = content.replace(oldDateTitleRegex, `const title = "${newDateStr}`);
        console.log(`- Updated date prefix in title`);
      }

      fs.writeFileSync(indexPath, content);
      console.log(`- Updated paths and variables in index.astro`);
    } else {
      // Fallback for legacy .html files
      const htmlPath = path.join(newSrcDir, 'index.html');
      if (fs.existsSync(htmlPath)) {
        let content = fs.readFileSync(htmlPath, 'utf8');
        const dateRegex = new RegExp(`/${oldDateStr}/`, 'g');
        content = content.replace(dateRegex, `/${newDateStr}/`);

        if (newTitleArg) {
          const newFullTitle = `${newDateStr}_${newTitleArg}`;
          content = content.replace(/<title>.*<\/title>/, `<title>${newFullTitle}</title>`);
          content = content.replace(/<!-- <h1>.*<\/h1> -->/, `<!-- <h1>${newFullTitle}</h1> -->`);
          content = content.replace(/<h1>.*<\/h1>/, `<h1>${newFullTitle}</h1>`);
        } else {
          const oldDateTitleRegex = new RegExp(`>${oldDateStr}`, 'g');
          content = content.replace(oldDateTitleRegex, `>${newDateStr}`);
        }
        fs.writeFileSync(htmlPath, content);
        console.log(`- Updated paths in index.html (legacy)`);
      }
    }

  } else {
    // === UPDATE TITLE MODE ===
    // secondArg is the new title
    const newTitleArg = secondArg;
    const newFullTitle = `${oldDateStr}_${newTitleArg}`;

    const indexPath = path.join(srcDir, 'index.astro');
    if (fs.existsSync(indexPath)) {
      let content = fs.readFileSync(indexPath, 'utf8');
      content = content.replace(/const title = ".*";/, `const title = "${newFullTitle}";`);

      fs.writeFileSync(indexPath, content);
      console.log(`Updated title to: ${newFullTitle}`);
    } else {
      // Fallback for legacy .html files
      const htmlPath = path.join(srcDir, 'index.html');
      if (fs.existsSync(htmlPath)) {
        let content = fs.readFileSync(htmlPath, 'utf8');
        content = content.replace(/<title>.*<\/title>/, `<title>${newFullTitle}</title>`);
        content = content.replace(/<!-- <h1>.*<\/h1> -->/, `<!-- <h1>${newFullTitle}</h1> -->`);
        content = content.replace(/<h1>.*<\/h1>/, `<h1>${newFullTitle}</h1>`);
        fs.writeFileSync(htmlPath, content);
        console.log(`Updated title to: ${newFullTitle} (legacy)`);
      } else {
        console.error(`Error: index.astro or index.html not found in ${srcDir}`);
      }
    }
  }

  console.log('Update complete.');
} else if (command === 'delete') {
  // === DELETE MODE ===
  // Usage: npm run delete [date]

  if (args.length < 1) {
    console.error('Usage: npm run delete [date]');
    process.exit(1);
  }

  const dateStr = args[0];

  if (!isDate(dateStr)) {
    console.error('Error: Argument must be a valid date (YYMMDD).');
    process.exit(1);
  }

  const srcDir = path.join(rootDir, 'src', 'pages', dateStr);
  const publicDir = path.join(rootDir, 'public', dateStr);

  let deletedCount = 0;

  if (fs.existsSync(srcDir)) {
    fs.rmSync(srcDir, { recursive: true, force: true });
    console.log(`- Deleted ${srcDir}`);
    deletedCount++;
  } else {
    console.log(`- Skipping ${srcDir} (not found)`);
  }

  if (fs.existsSync(publicDir)) {
    fs.rmSync(publicDir, { recursive: true, force: true });
    console.log(`- Deleted ${publicDir}`);
    deletedCount++;
  } else {
    console.log(`- Skipping ${publicDir} (not found)`);
  }

  if (deletedCount > 0) {
    console.log(`Successfully deleted sketch for ${dateStr}.`);
  } else {
    console.log(`No folders found for ${dateStr}. Nothing was deleted.`);
  }
}
