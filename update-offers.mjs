import fs from 'fs';

const offersDir = 'assets/images/offers';
const files = fs.readdirSync(offersDir).filter(f => /\.(jpg|png|jpeg)$/i.test(f));

console.log('Total offer images:', files.length);

// Parse school name from filename
// Format: YEAR_SchoolName_Other_Info.ext
function parseSchool(filename) {
  // Remove extension and common prefixes
  let name = filename.replace(/\.(jpg|png|jpeg)/i, '');
  // Remove leading year patterns like 2024-2025_ or 2025-2026_
  name = name.replace(/^\d{4}-\d{4}_/, '');
  // Remove "Inked" prefix
  name = name.replace(/^Inked/, '');
  // Get the school name (between first _ and next key info)
  const parts = name.split('_');
  if (parts.length === 0) return name;
  // First part is usually the school name
  let school = parts[0].trim();
  // If school name is short, try to include second part
  if (school.length < 3 && parts.length > 1) {
    school = parts[0] + parts[1];
  }
  // Common school name cleanup
  return school || '錄取通知書';
}

// Group by school for deduplication display
const schools = {};
for (const f of files) {
  const school = parseSchool(f);
  if (!schools[school]) schools[school] = [];
  schools[school].push(f);
}

console.log('Unique schools:', Object.keys(schools).length);

// Build offer cards HTML
const cards = [];
for (const f of files) {
  const name = parseSchool(f);
  cards.push(
    '<div class="offer-card">' +
    '<img src="assets/images/offers/' + f + '" alt="' + name + '" loading="lazy">' +
    '<div class="offer-card__label">' + name + '</div>' +
    '</div>'
  );
}

// ===== UPDATE ABOUT.HTML =====
let about = fs.readFileSync('about.html', 'utf8');

// Find and replace the academic results section
const oldResultsStart = about.indexOf('<!-- ===== Academic Results ===== -->');
const oldResultsEnd = about.indexOf('<!-- ===== Company History ===== -->');

if (oldResultsStart < 0 || oldResultsEnd < 0) {
  console.log('ERROR: Could not find Academic Results section');
  process.exit(1);
}

const newResults = `<!-- ===== Academic Results ===== -->
<section>
  <div class="page-wrapper">
    <div class="text-center mb-lg">
      <span class="section-badge">升學成果</span>
      <h2 class="section-title">學員成功入讀</h2>
      <p class="section-subtitle">我們的學員遍布以下香港及國際知名院校</p>
    </div>

    <div class="offer-grid">
      ${cards.join('\n      ')}
    </div>

    <div class="text-center mt-lg">
      <p style="color:var(--color-text-secondary);">尚有更多學員成功入讀聖士提反、德望、協恩、英基、弘立等名校</p>
    </div>
  </div>
</section>
`;

about = about.substring(0, oldResultsStart) + newResults + '\n' + about.substring(oldResultsEnd);
fs.writeFileSync('about.html', about);
console.log('  about.html updated with', files.length, 'offer images');

// ===== ADD OFFER GRID CSS =====
let components = fs.readFileSync('assets/css/components.css', 'utf8');

if (!components.includes('offer-grid')) {
  const css = `
/* ===== Offer Grid ===== */
.offer-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.75rem;
}
.offer-card {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  transition: transform 0.2s, box-shadow 0.2s;
}
.offer-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.12);
}
.offer-card img {
  width: 100%;
  height: 180px;
  object-fit: contain;
  background: #f7f9fb;
  display: block;
}
.offer-card__label {
  padding: 0.4rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-primary);
  text-align: center;
  line-height: 1.3;
}
@media (max-width: 1200px) {
  .offer-grid { grid-template-columns: repeat(4, 1fr); }
}
@media (max-width: 900px) {
  .offer-grid { grid-template-columns: repeat(3, 1fr); }
  .offer-card img { height: 150px; }
}
@media (max-width: 600px) {
  .offer-grid { grid-template-columns: repeat(2, 1fr); }
  .offer-card img { height: 130px; }
}
`;

  components += css;
  fs.writeFileSync('assets/css/components.css', components);
  console.log('  Offer grid CSS added');
}

console.log('\nDone!');
