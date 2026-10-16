/* Source-level regression guards for the optional resume-import UX.
 * Run in a checkout with: node apps/web/public/assets/profile-resume-import.test.js
 */
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'profile.html'), 'utf8');
const checks = [
  ['resume upload is optional and manual entry remains available', /optional shortcut/i.test(source) && /fill the profile manually/i.test(source)],
  ['PDF, DOCX and TXT are accepted', /\.pdf,\.docx,\.txt/.test(source) && /ext==='pdf'/.test(source) && /ext==='docx'/.test(source) && /ext==='txt'/.test(source)],
  ['resume text extraction runs in the browser and has a 10 MB limit', /extractResumeText\(file\)/.test(source) && /file\.size>10\*1024\*1024/.test(source)],
  ['resume extraction prefills profile and education fields', /applyResumeFields\(data\)/.test(source) && /addEducationRecord\(row\)/.test(source) && /current_role_title/.test(source)],
  ['save remains disabled until user confirms review after successful extraction', /setSaveEnabled\(false\)/.test(source) && /setSaveEnabled\(!!resumeVerify\.checked\)/.test(source) && /resumeVerify\.addEventListener/.test(source)],
  ['editing after verification requires a new confirmation', /You changed a field after confirming/.test(source)],
  ['unreadable or unsupported resumes preserve manual entry', /Manual profile entry remains available/.test(source) && /scanned PDF/.test(source)],
  ['resume is not automatically saved during extraction', /Extracted text is not saved automatically/.test(source)],
].map(([name, pass]) => ({name, pass}));
for (const check of checks) console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`);
if (checks.some(check => !check.pass)) process.exitCode = 1;