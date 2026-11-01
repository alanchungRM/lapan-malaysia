import http from 'node:http';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../dist/server/index.js',import.meta.url),'utf8');
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const port=Number(process.env.PORT||5173);
http.createServer(async(req,res)=>{try{const response=await worker.fetch(new Request(new URL(req.url,'http://localhost:'+port),{method:req.method,headers:req.headers}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}catch{res.writeHead(500);res.end('Request failed')}}).listen(port,'127.0.0.1',()=>console.log('Lapan: http://localhost:'+port));
