(function(root){
const key='lapan-hot-fm-pointer',listeners=new Set();let hot=false;
try{hot=root.localStorage?.getItem(key)==='true'}catch{}
function paint(el){el.classList.toggle('vehicle-hot-fm',hot);el.setAttribute('aria-label',hot?'Your vehicle · HOT FM':'Your vehicle');el.replaceChildren();if(hot){const img=root.document.createElement('img');img.src='/hot-fm-pointer.png';img.alt='HOT FM';img.draggable=false;el.append(img)}else el.innerHTML='<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 4 33 34 20 27 7 34Z" fill="#1783ee" stroke="white" stroke-width="3" stroke-linejoin="round"/></svg>'}
root.LapanVehiclePointer={enabled:()=>hot,paint,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},createLeaflet(L,pos){if(!hot||!L.divIcon||!L.marker)return null;const icon=L.divIcon({className:'hot-fm-leaflet',html:'<img src="/hot-fm-pointer.png" alt="Your vehicle · HOT FM" draggable="false">',iconSize:[64,46],iconAnchor:[32,23]});const marker=L.marker(pos,{icon,interactive:false});marker._lapanHotFM=true;return marker}};
const input=root.document?.getElementById('loveHotFM');if(input){input.checked=hot;input.addEventListener('change',()=>{hot=input.checked;try{root.localStorage?.setItem(key,String(hot))}catch{}for(const fn of listeners)fn(hot)})}
})(typeof window==='object'?window:globalThis);
