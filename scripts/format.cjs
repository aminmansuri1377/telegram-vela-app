const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const printer=ts.createPrinter({newLine:ts.NewLineKind.LineFeed});
function walk(dir){for(const name of fs.readdirSync(dir)){const p=path.join(dir,name);if(fs.statSync(p).isDirectory())walk(p);else if(/\.(ts|tsx)$/.test(p)){const source=ts.createSourceFile(p,fs.readFileSync(p,'utf8'),ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);fs.writeFileSync(p,printer.printFile(source));}else if(p.endsWith('.json')){fs.writeFileSync(p,JSON.stringify(JSON.parse(fs.readFileSync(p,'utf8')),null,2)+'\n');}}}
for(const dir of ['apps','packages','tests','scripts'])walk(dir);
