// Temporary, owner-reported junction avoidance. This is not a country-wide closure feed.
(function(root){
// Manual entries use {id, name, reason, addedAt, west, south, east, north}.
const areas=[
 {id:'delima-bayu-impian-east-access-divider',name:'Persiaran Delima / Bayu Impian east access',
  reason:'Reported physical divider blocks right turn across the median',addedAt:'2026-11-14',
  // Between the two carriageways. Keep the mapped left exit and entrance north of the divider open.
  west:101.45534,south:2.974705,east:101.45559,north:2.974754}
];
// Liang–Barsky segment clipping catches crossings even with no vertex inside the box.
function intersects(a,b,r){let lo=0,hi=1;const dx=b[0]-a[0],dy=b[1]-a[1];for(const [p,q] of [[-dx,a[0]-r.west],[dx,r.east-a[0]],[-dy,a[1]-r.south],[dy,r.north-a[1]]]){if(p===0){if(q<0)return false;continue}const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false}return true}
// Northbound from Persiaran Delima 3, the signal allows turns but no straight crossing.
const signal={west:101.45068,east:101.45106,south:2.97467,north:2.97488};
function blocksStraight(coords){
 let entered=false;
 const inside=lon=>lon>=signal.west&&lon<=signal.east;
 for(let i=1;i<coords.length;i++){
  const [x,y]=coords[i-1], [nextX,nextY]=coords[i];
  if(nextY>y){
   const lonAt=lat=>x+(nextX-x)*(lat-y)/(nextY-y);
   if(y<=signal.south&&nextY>signal.south)entered=inside(lonAt(signal.south));
   if(entered&&y<signal.north&&nextY>=signal.north&&inside(lonAt(signal.north)))return true;
  }
  if(!inside(nextX)||nextY<=signal.south||nextY>=signal.north)entered=false;
 }
 return false;
}
function blocked(coords){
 if(!Array.isArray(coords))return false;
 return blocksStraight(coords)||areas.some(r=>coords.some((p,i)=>i>0&&intersects(coords[i-1],p,r)));
}
function avoidAreas(retryStraight=false){
 // Offer a detour only after the provider returns the prohibited movement.
 const exits=retryStraight?[...areas,{west:101.45073,east:101.45092,south:2.97486,north:2.97490}]:areas;
 return {rectangles:exits.map(r=>({southWestCorner:{latitude:r.south,longitude:r.west},northEastCorner:{latitude:r.north,longitude:r.east}}))};
}
function list(){return areas.map(r=>({...r}))}
root.LapanRoadRestrictions={blocked,blocksStraight,avoidAreas,list};
if(typeof module==='object')module.exports=root.LapanRoadRestrictions;
})(globalThis);
