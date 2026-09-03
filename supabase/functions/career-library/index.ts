import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const PARTNER_URL = "https://careerdiya.edumilestones.com/global-career-library/backend.php";
const VIDEO_PARTNER_URL = "https://careerdiya.edumilestones.com/global-career-library/videoBackend.php";

const ALLOWED_COUNTRIES = new Set([
  "India","United States","Canada","United Kingdom","Australia","Germany","France","United Arab Emirates","Japan","Singapore","China","Brazil","South Africa","Russia","Italy","Spain","Netherlands","Sweden","Switzerland","New Zealand","Mexico","Indonesia","Saudi Arabia","Turkey","South Korea","Thailand","Malaysia","Vietnam","Philippines","Egypt","Nigeria","Kenya","Argentina","Poland","Ireland","North Macedonia","Sri Lanka","Zimbabwe","Qatar","Uganda","Panama"
]);
const COUNTRY_ALIASES: Record<string,string> = {
  IN:"India", INDIA:"India", US:"United States", USA:"United States", CA:"Canada", GB:"United Kingdom", UK:"United Kingdom", AU:"Australia", DE:"Germany", FR:"France", AE:"United Arab Emirates", JP:"Japan", SG:"Singapore", CN:"China", BR:"Brazil", ZA:"South Africa", RU:"Russia", IT:"Italy", ES:"Spain", NL:"Netherlands", SE:"Sweden", CH:"Switzerland", NZ:"New Zealand", MX:"Mexico", ID:"Indonesia", SA:"Saudi Arabia", TR:"Turkey", KR:"South Korea", TH:"Thailand", MY:"Malaysia", VN:"Vietnam", PH:"Philippines", EG:"Egypt", NG:"Nigeria", KE:"Kenya", AR:"Argentina", PL:"Poland", IE:"Ireland", MK:"North Macedonia", LK:"Sri Lanka", ZW:"Zimbabwe", QA:"Qatar", UG:"Uganda", PA:"Panama"
};
const ALLOWED_LANGUAGES = new Set(["English","Hindi","Marathi","Punjabi","Spanish","French","German","Bengali","Tamil","Telugu","Macedonian","Arabic","Sinhala","Manipuri"]);
const ALLOWED_CAREERS = new Set([
  "Data Science","Software Engineering","Product Management","Digital Marketing","Investment Banking","Law","Architecture","Aviation","Culinary Arts","Artificial Intelligence","Blockchain Technology","Sustainability","Ethical Hacking","Full Stack Development","Game Development","Bioinformatics","Content Creation","Social Media Management","Financial Analysis","Event Management","Fashion Design","Journalism","Veterinary Science","Nutrition and Dietetics","Sports Management","Supply Chain Management","Human Resource Management","Sales Management","Actuarial Science","Renewable Energy Engineering","Mobile Application Development","Software Testing and Quality Assurance","Hardware and Networking","Information Technology Business Analysis","User Interface Design","Graphic Design","Industrial Design","Visual Merchandising","Animation","Multimedia and Gaming","Photography","Image Consulting","Fine Arts","Performing Arts","Public Relations","Advertising","Corporate Communication","Creative Writing","Interpretation and Translation","Business Management","Strategy Consulting","Project Management","Operations Management","Retail Management","Growth Marketing","Performance Marketing","Brand Management","Chartered Accountancy","Cost and Management Accounting","Company Secretaryship","Financial Planning","Risk Management","Biotechnology Research","Clinical Research","Biomedical Engineering","Pharmacology","Environmental Science","Nanotechnology","Physiotherapy","Sports Physiotherapy","Audiology","Medical Laboratory Sciences","Radiology Technology","Occupational Therapy","Mechanical Engineering","Electrical Engineering","Aerospace Engineering","Chemical Engineering","Industrial Quality Engineering","Urban Planning","Construction Management","Landscape Design","Climate Science","Agricultural Engineering","Agri Business Management","Dairy Technology","Air Traffic Management","Cabin Services","Maritime Studies","Logistics and Transportation Management","Hotel Management","Travel and Tourism Management","Sports Coaching","Professional Sports","Physical Training","School Education","Higher Education and Academia","Corporate Training","Education Administration","Library Sciences","Career Counselling","Mentoring and Coaching","Law Enforcement Studies","Disaster Management","Staff Selection Services","Investment Advisory","Sustainability Analytics","Health Informatics","Agriculture Research","Airforce","Cyber Security","Robotics Engineering","Wildlife Biology","Interior Design","User Experience Design UX","Data Analyst","Statistician","Machine Learning Engineer","Data Product Manager","MLOps Engineer","Big Data Engineer","Analytics Consultant","Ethical Hacking Specialist"
]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function normalizeCountry(value="India") { const raw=String(value||"India").trim(); return COUNTRY_ALIASES[raw.toUpperCase()] || raw; }

async function fetchCareer(careerName:string, country:string, language:string){
  const payload=new URLSearchParams();
  payload.set("vars[careerName]",careerName); payload.set("vars[country]",country); payload.set("vars[language]",language);
  const partnerResponse=await fetch(PARTNER_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded; charset=UTF-8","Accept":"application/json, text/plain, */*","User-Agent":"CareerDiya-CareerLibrary-Adapter/1.0"},body:payload.toString()});
  const rawText=await partnerResponse.text();
  let parsed:any; try{parsed=JSON.parse(rawText);}catch{throw new Error("Career Library returned an invalid response");}
  if(!partnerResponse.ok || !parsed?.careerData) throw new Error(`Career Library could not return this career (partner ${partnerResponse.status})`);
  const d=parsed.careerData, stats=d.stats??{}, salary=stats.salary??{};
  return { title:d.title??careerName,introduction:d.introduction??"",stats:{salary:{entry:salary.entry??"",senior:salary.senior??"",currency:salary.currency??""},jobGrowth:stats.jobGrowth??"",demandLevel:stats.demandLevel??"",topIndustries:Array.isArray(stats.topIndustries)?stats.topIndustries:[],futureOutlook:stats.futureOutlook??""},whoShouldPursue:Array.isArray(d.whoShouldPursue)?d.whoShouldPursue:[],workNature:{description:d.workNature?.description??"",examples:Array.isArray(d.workNature?.examples)?d.workNature.examples:[]},eligibility:Array.isArray(d.eligibility)?d.eligibility:[],pathways:Array.isArray(d.pathways)?d.pathways:[],conventionalOptions:Array.isArray(d.conventionalOptions)?d.conventionalOptions:[],newAgeOptions:Array.isArray(d.newAgeOptions)?d.newAgeOptions:[],aiRelatedOptions:Array.isArray(d.aiRelatedOptions)?d.aiRelatedOptions:[],videoRecommendations:Array.isArray(d.videoRecommendations)?d.videoRecommendations:[],faqs:Array.isArray(d.seo?.faqs)?d.seo.faqs:[],country,language};
}

Deno.serve(async (req: Request) => {
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST') return jsonResponse({error:'Method not allowed'},405);
  try{
    const body=await req.json().catch(()=>({}));
    const careerName=typeof body?.careerName==='string'?body.careerName.trim():'';
    const country=normalizeCountry(body?.country);
    const language=typeof body?.language==='string'?body.language.trim():'English';
    if(!careerName) return jsonResponse({error:'careerName is required'},400);
    if(!ALLOWED_CAREERS.has(careerName)) return jsonResponse({error:'Career is not in the approved Career Library catalogue'},400);
    if(!ALLOWED_COUNTRIES.has(country)) return jsonResponse({error:'Unsupported Career Library country'},400);
    if(!ALLOWED_LANGUAGES.has(language)) return jsonResponse({error:'Unsupported Career Library language'},400);
    return jsonResponse({careerData:await fetchCareer(careerName,country,language),source:'career-library-adapter',adapterVersion:'2.1'});
  }catch(error){ console.error('career-library adapter error',error); return jsonResponse({error:error instanceof Error?error.message:'Unable to load career information right now'},502); }
});
