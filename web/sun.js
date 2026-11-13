(function(root){
const RAD=Math.PI/180;
const julian=ms=>ms/86400000+2440587.5,fromJulian=j=>new Date((j-2440587.5)*86400000);
// Sunrise equation for one local calendar day. lat/lon in degrees, longitude positive east, tz in minutes east of UTC (Malaysia is 480).
function sunTimes(now,lat,lon,tz=480){
 const dayStart=Math.floor((now.getTime()+tz*60000)/86400000)*86400000-tz*60000,noon=dayStart+43200000;
 const n=Math.ceil(julian(noon)-2451545.0+0.0008),mean=n-lon/360;
 const M=(357.5291+0.98560028*mean)%360,Mr=M*RAD,C=1.9148*Math.sin(Mr)+0.02*Math.sin(2*Mr)+0.0003*Math.sin(3*Mr);
 const lambda=((M+C+180+102.9372)%360)*RAD,transit=2451545.0+mean+0.0053*Math.sin(Mr)-0.0069*Math.sin(2*lambda);
 const declination=Math.asin(Math.sin(lambda)*Math.sin(23.4397*RAD));
 const cosHour=(Math.sin(-0.833*RAD)-Math.sin(lat*RAD)*Math.sin(declination))/(Math.cos(lat*RAD)*Math.cos(declination));
 if(cosHour>1)return {sunrise:null,sunset:null,noon:fromJulian(transit),polar:'night'};
 if(cosHour<-1)return {sunrise:null,sunset:null,noon:fromJulian(transit),polar:'day'};
 const hour=Math.acos(cosHour)/RAD;
 return {sunrise:fromJulian(transit-hour/360),sunset:fromJulian(transit+hour/360),noon:fromJulian(transit)};
}
// Night runs from sunset until the next sunrise, the same moment Waze and Google switch.
function themeAt(now,lat,lon,tz=480){const t=sunTimes(now,lat,lon,tz);if(!t.sunrise)return t.polar;return now<t.sunrise||now>=t.sunset?'night':'day'}
const api={sunTimes,themeAt};
if(typeof module==='object')module.exports=api;
root.LapanSun=api;
})(typeof window==='object'?window:globalThis);
