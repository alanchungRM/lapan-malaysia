(function(root){
// Small reviewed directory for reported missing places. Never derive pins from guessed addresses.
const records=[{name:'HPMT Industries Sdn Bhd',address:'5, Jalan Sungai Kayu Ara 32/39, Taman Berjaya, Seksyen 32, 40460 Shah Alam, Selangor, Malaysia',lat:2.9844482978181563,lon:101.51036386832891,aliases:['HPMT','HPMT Industries','HPMT Industries Sdn Bhd'],source:'https://www.hpmt-industries.com/contact-us',checked:'2026-10-27'}];
const normal=s=>String(s).trim().toLowerCase().replace(/[.,]/g,'').replace(/\s+/g,' ');
const api={exact(query){const q=normal(query);return records.filter(r=>normal(r.name)===q||r.aliases.some(a=>normal(a)===q)).map(r=>[r.name+', '+r.address,r.lat,r.lon])},search(query){const q=normal(query);if(!q)return [];return records.filter(r=>normal(r.name+' '+r.address).includes(q)||r.aliases.some(a=>normal(a)===q)).map(r=>[r.name+', '+r.address,r.lat,r.lon])}};
root.LapanPlaces=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
