// Temporary, owner-reported junction avoidance. This is not a country-wide closure feed.
(function(root){
// Manual entries use {id, name, reason, addedAt, west, south, east, north}.
// Keep empty unless a specific restriction is deliberately configured.
const areas=[];
// Liang–Barsky segment clipping catches crossings even with no vertex inside the box.
function intersects(a,b,r){let lo=0,hi=1;const dx=b[0]-a[0],dy=b[1]-a[1];for(const [p,q] of [[-dx,a[0]-r.west],[dx,r.east-a[0]],[-dy,a[1]-r.south],[dy,r.north-a[1]]]){if(p===0){if(q<0)return false;continue}const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false}return true}
function blocked(coords){if(!Array.isArray(coords))return false;return areas.some(r=>coords.some((p,i)=>i>0&&intersects(coords[i-1],p,r)))}
function avoidAreas(){return {rectangles:areas.map(r=>({southWestCorner:{latitude:r.south,longitude:r.west},northEastCorner:{latitude:r.north,longitude:r.east}}))}}
function list(){return areas.map(r=>({...r}))}
root.LapanRoadRestrictions={blocked,avoidAreas,list};
if(typeof module==='object')module.exports=root.LapanRoadRestrictions;
})(globalThis);
