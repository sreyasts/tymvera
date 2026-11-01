import sharp from 'sharp';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const master = path.join(root, 'assets/brand/tymvera-logo-master.png');
const publicDir = path.join(root, 'public');
const androidRes = path.join(root, 'android-twa/app/src/main/res');
const navy = '#050b15';
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const raster = size => sharp(master).resize(size, size, { fit: 'contain', background: transparent }).png();

for (const [filename, size] of [['logo-96.png',96],['favicon-32.png',32],['icon-192.png',192],['icon-512.png',512],['icon.png',1024]]) {
  await raster(size).toFile(path.join(publicDir,filename));
}
await raster(180).flatten({background:navy}).toFile(path.join(publicDir,'apple-touch-icon.png'));
for (const size of [192,512]) {
  const inset=Math.round(size*0.1),inner=size-inset*2;
  const image=await raster(inner).toBuffer();
  await sharp({create:{width:size,height:size,channels:4,background:navy}})
    .composite([{input:image,left:inset,top:inset}]).png().toFile(path.join(publicDir,`icon-maskable-${size}.png`));
}

// ICO directories contain standard PNG frames, retaining their transparent corners.
const frames=await Promise.all([16,32,48,64,128,256].map(async size=>({size,data:await raster(size).toBuffer()})));
const header=Buffer.alloc(6+16*frames.length);header.writeUInt16LE(1,2);header.writeUInt16LE(frames.length,4);
let offset=header.length;
frames.forEach(({size,data},i)=>{const p=6+i*16;header[p]=size===256?0:size;header[p+1]=header[p];header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(data.length,p+8);header.writeUInt32LE(offset,p+12);offset+=data.length;});
await writeFile(path.join(publicDir,'icon.ico'),Buffer.concat([header,...frames.map(f=>f.data)]));

for (const [density,size] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]]) {
  const directory=path.join(androidRes,`mipmap-${density}`);await mkdir(directory,{recursive:true});
  await raster(size).toFile(path.join(directory,'ic_launcher.png'));
  await sharp(path.join(publicDir,'icon-maskable-512.png')).resize(size,size).png().toFile(path.join(directory,'ic_maskable.png'));
}
await mkdir(path.join(androidRes,'drawable-nodpi'),{recursive:true});
const foreground=await raster(332).toBuffer();
await sharp({create:{width:512,height:512,channels:4,background:transparent}})
  .composite([{input:foreground,left:90,top:90}]).png().toFile(path.join(androidRes,'drawable-nodpi/tymvera_icon_foreground.png'));
await raster(512).toFile(path.join(androidRes,'drawable-anydpi/tymvera_icon.png'));

const logo=await raster(280).toBuffer();
const text=Buffer.from('<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><text x="475" y="302" fill="#f8f9f5" font-family="Segoe UI,Arial,sans-serif" font-size="86" font-weight="700" letter-spacing="-4">tymvera.</text><text x="480" y="366" fill="#aec9bc" font-family="Segoe UI,Arial,sans-serif" font-size="25">A little structure. More room to live.</text></svg>');
await sharp({create:{width:1200,height:630,channels:4,background:navy}})
  .composite([{input:logo,left:140,top:175},{input:text}]).png().toFile(path.join(publicDir,'og-image.png'));
console.log('Brand assets generated: web, ICO, PWA, share preview, Android legacy and adaptive icons.');

const vector = await readFile(path.join(androidRes,'drawable/ic_tymvera_monochrome.xml'),'utf8');
const paths = [...vector.matchAll(/android:pathData="([^"]+)"/g)].map(match=>`<path fill="white" d="${match[1]}"/>`).join('');
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 66 66">${paths}</svg>`)).png().toFile(path.join(publicDir,'notification-badge.png'));

// Dedicated notification image avoids stale generic drawable caches after upgrades.
await raster(128).toFile(path.join(androidRes,'drawable-nodpi/tymvera_notification_logo_v5.png'));
await raster(192).toFile(path.join(publicDir,'notification-logo.png'));
